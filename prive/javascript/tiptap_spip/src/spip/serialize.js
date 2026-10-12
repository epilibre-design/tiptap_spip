import { serializeAbbr } from './abbr.js';
import { delimiteursRegle, ecrireRegle } from './aides.js';
import { serializeGlossary } from './glossary.js';
import { canon, MARK_ORDER, node, sameMark, text } from './json.js';
import { linkEnd } from './links.js';
import { serializeModel } from './models.js';
import { serializeIdiome, serializeMulti } from './multi.js';
import { parseNote } from './notes.js';
import { parse } from './parse.js';
import { canBacktick, encodeCode, protect } from './protect.js';
import { LIGNE_VIDE, RE_AVANT_LANGUE } from './regex.js';
import { avecRegles, regleDe } from './regles.js';

/**
 * Règle tierce qui écrit ce type (bloc, nœud en ligne ou mark), null sinon. Elle passe avant le
 * cœur : une extension tierce peut remplacer une extension du cœur de même nom (spec 07 §4).
 */
const regleEcrite = (nom, type) => {
	const regle = regleDe(nom);
	return regle?.type === type && regle.renderSpip ? regle : null;
};

/**
 * Document JSON → source SPIP.
 * Sérialisation conservatrice : un segment dont les blocs ont gardé leur forme canonique est
 * restitué à l'identique (spipSep + spipSrc), les autres blocs sont sérialisés.
 *
 * @param {object} doc
 * @param {{ conservative?: boolean, regles?: object[] }} options  conservative:false donne la forme
 *        canonique ; regles : règles tierces (regles.js), sinon celles de l'appel englobant
 * @returns {string}
 */
export function serialize(doc, { conservative = true, regles } = {}) {
	const avant = contexte;
	contexte = { ...contexte, conservative };
	try {
		return avecRegles(regles, () => serializeDoc(doc, conservative));
	} finally {
		contexte = avant;
	}
}

/**
 * Contexte de la sérialisation en cours : conservative (forme canonique ou non, transmise au
 * contenu des notes) ; note (texte d'une note : un ] s'écrit \] pour ne pas la fermer) ; multi
 * (partie d'un multi : un [xx] s'écrit en entité) ; ouvert (nombre de < restés ouverts avant ce bloc) ;
 * crochets (nombre de [ restés ouverts avant ce bloc) ; crochetsNote (ceux qu'ouvre la note englobante).
 */
let contexte = { conservative: true, note: false, multi: false, ouvert: 0, crochets: 0, crochetsNote: 0 };

/**
 * Chevrons < restés ouverts à la fin de ce texte, en partant de ceux d'avant : le modèle du core
 * ([a-z_-]{3,} … >) et une balise peuvent se fermer plus loin, même après une ligne vide. Comptés : un
 * idiome (<:m:c:>) ferme son propre chevron, pas celui d'avant.
 */
function chevronsOuverts(texte, avant = 0) {
	if (!texte.includes('<') && !texte.includes('>')) return avant;
	let n = avant;
	// -> et <- des liens et des ancres, et le code : masqués avant la recherche des balises
	for (const c of sansCode(texte).replace(/->|<-/g, '')) {
		if (c === '<') n++;
		else if (c === '>' && n > 0) n--;
	}
	return n;
}

/** Code en backticks et blocs verbatim (<code>, <math>…) : masqués par le core, ils ne comptent pas. */
const sansCode = (texte) => (texte.includes('`') || /<(?:code|cadre|frame|html|math)\b/i.test(texte)
	? texte.replace(/(`+)[\s\S]*?\1|<(code|cadre|frame|html|math)\b[^>]*>[\s\S]*?<\/\2>/gi, '')
	: texte);

/** Crochets [ restés ouverts à la fin de ce texte, en partant de ceux d'avant (un lien les ferme par ->). */
function crochetsOuverts(texte, avant = 0) {
	if (!texte.includes('[') && !texte.includes(']')) return avant;
	let n = avant;
	for (const c of sansCode(texte)) {
		if (c === '[') n++;
		else if (c === ']' && n > 0) n--;
	}
	return n;
}

function serializeDoc(doc, conservative) {
	const blocks = doc.content ?? [];
	let out = conservative ? (doc.attrs?.spipLead ?? '') : '';
	let crochets = contexte.crochets;
	let ouvert = contexte.ouvert;
	let i = 0;
	while (i < blocks.length) {
		const b = blocks[i];
		const a = b.attrs ?? {};
		const sep = separator(i, conservative ? a.spipSep : null);
		if (conservative && a.spipGroup && typeof a.spipSrc === 'string' && canon(blocks.slice(i, i + a.spipGroup)) === a.spipHash) {
			crochets = crochetsOuverts(sep + a.spipSrc, crochets);
			ouvert = chevronsOuverts(a.spipSrc, ouvert);
			out += sep + a.spipSrc;
			i += a.spipGroup;
			continue;
		}
		// un < resté ouvert plus haut (modèle, balise) peut se fermer dans ce bloc : serializeInline le sait
		const avant = contexte;
		contexte = { ...contexte, ouvert, crochets };
		try {
			const ecrit = sep + serializeBlock(b);
			crochets = crochetsOuverts(ecrit, crochets);
			ouvert = chevronsOuverts(ecrit, ouvert);
			out += ecrit;
		} finally {
			contexte = avant;
		}
		i++;
	}
	return out + (conservative ? (doc.attrs?.spipTrail ?? '') : '');
}

/**
 * Séparateur avant le bloc i. L'éditeur recopie les attributs techniques quand il coupe un bloc
 * ou colle une copie : un spipSep n'est donc repris que s'il reste valide à cette place, c'est-à-
 * dire vide en tête de document, contenant une ligne vide ailleurs.
 */
function separator(i, spipSep) {
	if (i === 0) return '';
	return typeof spipSep === 'string' && /\n[ \t\r]*\n/.test(spipSep) ? spipSep : '\n\n';
}

const textOf = (n) => (n.content ?? []).map((c) => c.text ?? '').join('');
const blocks = (content = []) => content.map(serializeBlock).join('\n\n');

/** Blocs → source, séparés par une ligne vide (aides des règles tierces). */
export const serializeBlocks = blocks;

export function serializeBlock(b) {
	const a = b.attrs ?? {};
	const regle = regleEcrite(b.type, 'block');
	if (regle) return ecrireRegle(regle, b);
	switch (b.type) {
		case 'paragraph':
			return serializeInline(b.content, { lineStart: true });
		case 'heading':
			return a.level === 2
				? `{{{${serializeInline(b.content, { html: true, uneLigne: true })}}}}`
				: `<h${a.level}>${serializeInline(b.content, { uneLigne: true })}</h${a.level}>`;
		case 'horizontalRule':
			return '----';
		case 'bulletList':
		case 'orderedList':
			return serializeList(b, 1);
		case 'blockquote':
			return `<quote>\n${blocks(b.content)}\n</quote>`;
		case 'spipPoesie':
			return `<${a.tag ?? 'poesie'}>\n${blocks(b.content)}\n</${a.tag ?? 'poesie'}>`;
		case 'spipAlign':
			return `<div class="text-${a.align}">\n\n${blocks(b.content)}\n\n</div>`;
		case 'codeBlock':
			return serializeCodeBlock(b);
		case 'spipCadre':
		case 'spipHtml':
		case 'spipMath':
			return a.openTag + encodeCode(textOf(b)) + a.closeTag;
		case 'spipRaw':
			return a.source;
		case 'spipModelBlock':
			return serializeModel(a.model);
		case 'spipMultiBlock':
			return enMulti(() => {
				const parties = b.content.map((part) => ({
					lang: part.attrs?.lang ?? null,
					texte: serialize(node('doc', null, part.content), { conservative: false }),
				}));
				// sans ligne vide, le multi se relirait en ligne : parties séparées (ou suivies) d'une ligne vide
				if (!parties.some(({ texte }) => LIGNE_VIDE.test(texte))) {
					parties.forEach((partie, k) => {
						if (k < parties.length - 1 || parties.length === 1) partie.texte += '\n\n';
					});
				}
				return serializeMulti(parties);
			});
		case 'table':
			return serializeTable(b);
		default:
			throw new Error(`serialize: type de bloc inconnu « ${b.type} »`);
	}
}

function serializeCodeBlock(b) {
	const a = b.attrs ?? {};
	const code = textOf(b);
	// les backticks perdent les sauts de ligne de tête (<code> n'en retire qu'un), et un ` final se
	// collerait à la clôture
	if (a.openTag || !canBacktick(code) || code.startsWith('\n') || code.endsWith('`')) return `${a.openTag ?? '<code>'}\n${encodeCode(code)}\n</code>`;
	let fence = '```';
	while (code.includes(fence)) fence += '`';
	return `${fence}${a.language ?? ''}\n${code}${fence}`;
}

function serializeList(list, depth) {
	const marker = (list.type === 'bulletList' ? '*' : '#').repeat(depth);
	return list.content.map((item) => {
		const [para, nested] = item.content;
		const line = `-${marker} ${serializeInline(para.content)}`;
		return nested ? `${line}\n${serializeList(nested, depth + 1)}` : line;
	}).join('\n');
}

function serializeTable(table) {
	const a = table.attrs ?? {};
	const lines = [];
	if (a.caption != null || a.summary != null) {
		lines.push(`||${a.caption ?? ''}${a.summary != null ? `|${a.summary}` : ''}||`);
	}
	const occ = [];
	table.content.forEach((row, r) => {
		occ[r] ??= [];
		let c = 0;
		for (const cell of row.content) {
			while (occ[r][c] !== undefined) c++;
			const { colspan = 1, rowspan = 1 } = cell.attrs ?? {};
			for (let dr = 0; dr < rowspan; dr++) {
				occ[r + dr] ??= [];
				for (let dc = 0; dc < colspan; dc++) {
					occ[r + dr][c + dc] = dr > 0 ? '^' : dc > 0 ? '<' : cell;
				}
			}
			c += colspan;
		}
	});
	for (const row of occ) {
		const cells = row.map((x) => {
			if (typeof x === 'string') return x;
			// en-tête écrit {{…}} : son italique en HTML, comme dans un intertitre ({{{ serait ambigu)
			let inline = serializeInline(x.content?.[0]?.content, { cellule: true, uneLigne: true, html: x.type === 'tableHeader' });
			// < ou ^ seul : marqueur de fusion
			if (inline === '<') inline = '&lt;';
			else if (inline === '^') inline = '&#94;';
			return x.type === 'tableHeader' && inline !== '' ? `{{${inline}}}` : inline;
		});
		let ligne = `|${cells.join('|')}|`;
		// première ligne sans légende qui se lirait légende (||texte|, comme traiter_tableau()) : sa
		// première cellule, vide, s'écrit avec une espace
		if (!lines.length && /^\|\|([^|]*)(?:\|([\s\S]*))?$/.test(ligne.slice(0, -1).replace(/\|+$/, ''))) ligne = `| ${ligne.slice(1)}`;
		lines.push(ligne);
	}
	return lines.join('\n');
}

const OPEN = { bold: ['{{', '}}'], italic: ['{', '}'], strike: ['<del>', '</del>'], superscript: ['<sup>', '</sup>'], subscript: ['<sub>', '</sub>'] };

/** Délimiteurs d'une mark ; un lien, un glossaire, une abréviation dépendent de leurs attributs. */
const delimiters = (mark) => {
	const regle = regleEcrite(mark.type, 'mark');
	if (regle) return delimiteursRegle(regle, mark);
	if (mark.type === 'spipLink') return ['[', linkEnd(mark.attrs)];
	if (mark.type === 'spipGlossary') return ['[?', serializeGlossary('', mark.attrs).slice(2)];
	if (mark.type === 'spipAbbr') return ['[', serializeAbbr('', mark.attrs).slice(1)];
	if (OPEN[mark.type]) return OPEN[mark.type];
	throw new Error(`serialize: mark inconnue « ${mark.type} »`);
};

/** Marks dont le texte s'écrit tel quel dans le raccourci, sans autre mark à l'intérieur. */
const ATOMIQUES = ['spipGlossary', 'spipAbbr'];
const avecMarks = (n, marks) => {
	const { marks: _, ...rest } = n;
	return marks.length ? { ...rest, marks } : rest;
};

/** Le raccourci écrit pour ce texte marqué se relit-il en ce même texte marqué ? */
function seRelit(n, mark) {
	const [open, close] = delimiters(mark);
	const relu = parse(open + n.text + close).content;
	return canon(relu) === canon([node('paragraph', null, [text(n.text, [mark])])]);
}

/**
 * Glossaire et abréviation saisis dans l'éditeur : seulement sur un texte sans lien ni code (un
 * glossaire l'emporte sur une abréviation) ; des textes voisins sous la même mark sont fusionnés
 * avec leurs seules marks communes ; un raccourci qui ne se relirait pas à l'identique est
 * abandonné (le texte est écrit normalement). Le parseur ne produit que des formes valides.
 */
function marksAtomiques(nodes) {
	let out = nodes.map((n) => {
		const marks = n.marks ?? [];
		let garde = marks;
		if (marks.some((m) => m.type === 'spipLink' || m.type === 'code')) garde = garde.filter((m) => !ATOMIQUES.includes(m.type));
		if (garde.some((m) => m.type === 'spipGlossary')) garde = garde.filter((m) => m.type !== 'spipAbbr');
		return garde.length === marks.length ? n : avecMarks(n, garde);
	});
	for (const type of ATOMIQUES) {
		const res = [];
		for (let i = 0; i < out.length;) {
			const mark = out[i].marks?.find((m) => m.type === type);
			if (!mark) {
				res.push(out[i++]);
				continue;
			}
			let j = i;
			while (j < out.length && out[j].marks?.some((m) => sameMark(m, mark))) j++;
			const run = out.slice(i, j);
			let fusion = null;
			if (run.every((n) => n.type === 'text')) {
				const communes = run[0].marks.filter((m) => run.every((n) => n.marks.some((x) => sameMark(x, m))));
				const candidat = text(run.map((n) => n.text).join(''), communes);
				if (seRelit(candidat, mark)) fusion = candidat;
			}
			if (fusion) res.push(fusion);
			else res.push(...run.map((n) => avecMarks(n, n.marks.filter((m) => !sameMark(m, mark)))));
			i = j;
		}
		out = res;
	}
	return out;
}
const HTML = { bold: ['<strong>', '</strong>'], italic: ['<i>', '</i>'] };


/** Source d'un fragment brut, '' pour un autre nœud (un texte a ses accolades échappées). */
const brut = (n) => (n?.type === 'spipRawInline' ? n.attrs.source : '');

/**
 * La mark sur nodes[i, i + run[ a-t-elle un fragment brut à accolade contre l'un de ses délimiteurs,
 * dedans ou juste avant ou après ({ contre {{{ ferait {{{{) ? Ses délimiteurs s'écrivent alors en HTML.
 */
const accoladeContre = (nodes, i, run) => /[{}]$/.test(brut(nodes[i - 1])) || /^[{}]/.test(brut(nodes[i]))
	|| /[{}]$/.test(brut(nodes[i + run - 1])) || /^[{}]/.test(brut(nodes[i + run]));

/**
 * Contenu inline → SPIP.
 * Gras et italique imbriqués (ou italique dans un intertitre) : la mark intérieure est écrite en
 * HTML (<strong>, <i>, même rendu) pour ne jamais produire {{{ ou }}}.
 *
 * @param {object[]} nodes
 * @param {{ lineStart?: boolean, html?: boolean, cellule?: boolean, uneLigne?: boolean, bords?: boolean }} options
 *        cellule : texte d'une cellule de tableau ; uneLigne : contenu d'une seule ligne (cellule,
 *        intertitre) ; bords : false garde les sauts de ligne de bord (partie de multi)
 */
export function serializeInline(nodes = [], { lineStart = false, html = false, cellule = false, uneLigne = false, bords = true } = {}) {
	// saut de ligne au bord d'un bloc : SPIP n'affiche pas un _ de tête et affiche un _ final ; un <br>
	// final ne se voit pas. Non écrit (sauf dans une partie de multi, bords: false).
	let debut = 0;
	let fin = nodes.length;
	// sans mark : ceux de l'éditeur ; le parseur n'en produit au bord que dans une mark ({\n})
	const sautNu = (n) => n.type === 'hardBreak' && !n.marks?.length;
	while (bords && debut < fin && sautNu(nodes[debut])) debut++;
	while (bords && fin > debut && sautNu(nodes[fin - 1])) fin--;
	nodes = marksAtomiques(nodes.slice(debut, fin));
	let out = '';
	const stack = [];
	let atLineStart = lineStart;
	// tant qu'un < reste ouvert (balise incomplète, ici ou dans un bloc précédent), un > du texte le
	// fermerait et un | en ferait un modèle (<doc|x>) : &gt; et \|
	let chevron = contexte.ouvert;
	// un [ resté ouvert (ici, plus haut, ou le [[ d'une note) : un -> du texte fermerait un lien
	let crochets = contexte.crochets;
	// un modèle déjà écrit dans ce contenu : un > du texte prolongerait ses paramètres
	let modeleVu = false;
	let lu = 0;
	const closeTo = (k) => {
		while (stack.length > k) out += stack.pop().close;
	};
	const marksOf = (n) => (n.marks ?? []).filter((m) => m.type !== 'code');
	// italique qui finit le texte d'un lien : son } ferait un {…} final, lu comme une langue ({} : celle
	// de l'objet). Seulement à étendue égale (le lien est alors extérieur) : plus étendu, l'italique
	// s'ouvre avant le lien et se ferme après son ].
	const finitLeLien = (m, i) => {
		if (m.type !== 'italic') return false;
		const lien = marksOf(nodes[i]).find((x) => x.type === 'spipLink');
		return lien !== undefined && runLength(i, m) === runLength(i, lien);
	};
	// longueur de la suite de nœuds portant la mark à partir du nœud i
	const runLength = (i, mark) => {
		let j = i;
		while (j < nodes.length && marksOf(nodes[j]).some((m) => sameMark(m, mark))) j++;
		return j - i;
	};
	nodes.forEach((n, i) => {
		const marks = marksOf(n);
		// les marks déjà ouvertes qui continuent restent ouvertes (du bas de la pile vers le haut)
		let k = 0;
		while (k < stack.length && marks.some((m) => sameMark(m, stack[k].mark))) k++;
		closeTo(k);
		// les autres s'ouvrent de la plus longue à la plus courte : la plus longue est extérieure
		const toOpen = marks
			.filter((m) => !stack.some((s) => sameMark(s.mark, m)))
			.map((m) => ({ m, run: runLength(i, m) }))
			.sort((a, b) => b.run - a.run || MARK_ORDER.indexOf(a.m.type) - MARK_ORDER.indexOf(b.m.type));
		for (const { m } of toOpen) {
			// écriture HTML de secours des accolades du cœur, pas d'une mark écrite par une règle tierce
			const useHtml = HTML[m.type] && !regleEcrite(m.type, 'mark')
				&& (html || stack.some((s) => delimiters(s.mark)[0].startsWith('{')) || accoladeContre(nodes, i, runLength(i, m))
					|| finitLeLien(m, i));
			const [open, close] = useHtml ? HTML[m.type] : delimiters(m);
			out += open;
			stack.push({ mark: m, close });
			atLineStart = false;
		}
		const inLink = stack.some((s) => s.mark.type === 'spipLink');
		const regleNoeud = n.type === 'text' ? null : regleEcrite(n.type, 'inline');
		if (regleNoeud) {
			out += ecrireRegle(regleNoeud, n);
			atLineStart = false;
		} else if (n.type === 'text') {
			const code = n.marks?.find((m) => m.type === 'code');
			const atomique = stack.some((s) => ATOMIQUES.includes(s.mark.type));
			// texte d'un glossaire ou d'une abréviation : validé par marksAtomiques, écrit tel quel
			const texte = code ? serializeCode(n.text) : atomique ? n.text : escapeText(n.text, atLineStart, { link: inLink, cellule });
			chevron = chevronsOuverts(out.slice(lu), chevron);
			crochets = crochetsOuverts(out.slice(lu), crochets);
			let ecrit = chevron > 0 && !code ? texte.replace(/>/g, '&gt;').replace(/(?<!\\)\|/g, '\\|') : texte;
			if (!code && !inLink && !atomique) {
				// [ ouverts à chaque position, ceux du texte compris ([&#91;[]-> : le motif des liens admet
				// des groupes [xx] dans le texte) : un -> ou un <- y ferait un lien ou une ancre
				let ouverts = crochets;
				ecrit = ecrit.replace(/->|<-|[[\]]/g, (x) => {
					if (x === '[') ouverts++;
					else if (x === ']') ouverts = Math.max(0, ouverts - 1);
					else if (ouverts > 0) return x === '->' ? '-&gt;' : '&lt;-';
					return x;
				});
			}
			if (crochets > 0 && !code && !inLink && !atomique) {
				// un [ resté ouvert plus haut : un ] qui ne ferme pas un [ de ce texte le fermerait. Le ]] d'une
				// note est traité à part (règles de la note) : seuls les [ ouverts en plus comptent
				if (crochets > contexte.crochetsNote) {
					let local = 0;
					ecrit = ecrit.replace(/[[\]]/g, (c) => {
						if (c === '[') local++;
						else if (local > 0) local--;
						else return '&#93;';
						return c;
					});
				}
			}
			// dans une note, un ] de tête derrière un ] ferait ]] et la fermerait
			if (contexte.note && !code && out.endsWith(']')) ecrit = ecrit.replace(/^\]/, '&#93;');
			// > après un modèle dans ce contenu : ses paramètres admettent des balises (<doc|<sup>>) et
			// le prolongeraient
			if (!code && modeleVu) ecrit = ecrit.replace(/>/g, '&gt;');
			// après un marqueur de début de ligne brut (-, --, ----, ____) : -* ferait une liste, ---- un filet
			if (/^(?:--?|-{4,}|_{4,})$/.test(brut(nodes[i - 1]))) ecrit = ecrit.replace(/^[*#_-]/, '\\$&');
			if (!code) {
				crochets = crochetsOuverts(ecrit, crochets);
				chevron = chevronsOuverts(ecrit, chevron);
			}
			out += ecrit;
			lu = out.length;
			atLineStart = false;
		} else if (n.type === 'hardBreak') {
			// suivi d'un autre saut sans mark qui s'ouvre ou se ferme entre eux, \n puis \n (ou \n_ ) ferait
			// une ligne vide : ce saut s'écrit forcé, sauf dans un lien (masqué avant le découpage en
			// segments, il peut contenir une ligne vide)
			const suivant = nodes[i + 1];
			const colle = suivant?.type === 'hardBreak' && JSON.stringify(marksOf(suivant)) === JSON.stringify(marksOf(n));
			const autobr = n.attrs?.syntax === 'autobr' && (!colle || inLink);
			// contenu d'une seule ligne (cellule, intertitre) : un saut de ligne le couperait
			out += uneLigne ? '<br />' : autobr ? '\n' : '\n_ ';
			atLineStart = autobr;
		} else if (n.type === 'spipRawInline') {
			out += n.attrs.source;
			atLineStart = false;
		} else if (n.type === 'spipLinkAuto') {
			out += `[${linkEnd(n.attrs)}`;
			atLineStart = false;
		} else if (n.type === 'spipAnchor') {
			out += `[#${n.attrs.name}<-]`;
			atLineStart = false;
		} else if (n.type === 'spipModel') {
			out += serializeModel(n.attrs.model);
			modeleVu = true;
			atLineStart = false;
		} else if (n.type === 'spipNote') {
			out += serializeNote(n.attrs);
			atLineStart = false;
		} else if (n.type === 'spipMultiInline') {
			out += serializeMultiInline(n.attrs);
			atLineStart = false;
		} else if (n.type === 'spipIdiome') {
			out += serializeIdiome(n.attrs);
			atLineStart = false;
		} else {
			throw new Error(`serialize: type inline inconnu « ${n.type} »`);
		}
	});
	closeTo(0);
	return out;
}

/** <…> en tête du texte d'une note (_NOTES_RACCOURCI) : blancs, puis nom possible. */
const RE_NOM_NOTE = /^([ \t\n\v\f\r]*)<[^>'"]*>/;

/**
 * Zone de note couvrant tout le raccourci relu, comme par parse() : son texte masqué est celui où le
 * core cherche le nom, modèles, liens et glossaire déjà remplacés (`[[<doc1|left>]]` est automatique).
 */
const noteDe = (raccourci) => protect(raccourci).regions.find((r) => r.kind === 'note' && r.start === 0 && r.end === raccourci.length);

/**
 * Note : [[ + <nom> (nommée) ou <> (sans appel) + contenu + ]]. Le contenu est un document dont les
 * blocs gardent leur carte de segments : non modifié, il est restitué à l'identique.
 */
function serializeNote({ name = null, content, spipLead = '', spipTrail = '' }) {
	const avant = contexte;
	contexte = { ...contexte, note: true, crochets: contexte.crochets + 2, crochetsNote: contexte.crochets + 2 };
	try {
		const doc = { type: 'doc', attrs: { spipLead, spipTrail }, content: content?.length ? content : [node('paragraph')] };
		const nom = name == null ? '' : `<${name}>`;
		let texte = serialize(doc, { conservative: avant.conservative });
		// relue, la note doit rester une note : ? en tête ([[? : glossaire [?…], traité avant les notes),
		// puis -> avant tout crochet ([[a -> b]] : lien [a -> b] entre crochets) en entités, ou ] final
		let fleche;
		while (!noteDe(`[[${nom}${texte}]]`)) {
			if (!nom && texte.startsWith('?')) texte = `&#63;${texte.slice(1)}`;
			// cherché dans le texte masqué : un -> du code n'est pas un lien (code protégé avant les liens)
			else if ((fleche = protect(texte).masked.match(/^[^[\]]*?->/))) texte = `${texte.slice(0, fleche[0].length - 2)}-&gt;${texte.slice(fleche[0].length)}`;
			// <- avant tout crochet : [[a<-]] ferait une ancre [a<-] (ancres avant notes)
			else if ((fleche = protect(texte).masked.match(/^[^[\]]*?<-/))) texte = `${texte.slice(0, fleche[0].length - 2)}&lt;-${texte.slice(fleche[0].length)}`;
			// contenu qui finit par ] d'un raccourci traité après les notes (abréviation) : ]]] fermerait
			// la note un crochet trop tôt ; SPIP retire les blancs de fin du texte d'une note, le parseur
			// range un saut de ligne final hors du contenu
			else if (texte.endsWith(']')) texte += '\n';
			else break;
		}
		// note automatique dont le texte commence par un < sans > dans la note : le nom du core
		// (<[^>'"]*>) chercherait son > plus loin dans le texte, au-delà de la note ; cherché dans le
		// texte masqué, où le core a déjà remplacé liens, modèles et glossaire
		const masque = name == null ? protect(texte).masked : '';
		// (s'arrête au premier ' ou " : une balise à attributs n'est pas concernée ; un < brut, lu tel quel
		// dans la source, est restitué tel quel)
		const premier = content?.[0]?.content?.find((x) => x.type !== 'text' || x.marks?.length || x.text.trim() !== '');
		const brutEnTete = premier?.type === 'spipRawInline' && premier.attrs.source.startsWith('<');
		if (name == null && !brutEnTete && /^[ \t\n\v\f\r]*<[^>'"]*$/.test(masque)) {
			const blancs = texte.match(/^[ \t\n\v\f\r]*/)[0];
			texte = `${blancs}&lt;${texte.slice(blancs.length + 1)}`;
		}
		// note automatique dont le texte commence par <…> : le core y lirait un nom
		const m = name == null ? texte.match(RE_NOM_NOTE) : null;
		if (m && parseNote(`[[${texte}]]`, noteDe(`[[${texte}]]`)?.data.masked)?.name != null) {
			texte = `${m[1]}&lt;${texte.slice(m[1].length + 1)}`;
		}
		return `[[${nom}${texte}]]`;
	} finally {
		contexte = avant;
	}
}

/** Contexte d'un multi : un [xx] du texte s'écrit en entité (il serait un marqueur de langue). */
function enMulti(f) {
	const avant = contexte;
	contexte = { ...contexte, multi: true };
	try {
		return f();
	} finally {
		contexte = avant;
	}
}

/** Multi dans une phrase : réécrit tel quel si ses parties n'ont pas changé (sérialisation conservatrice). */
function serializeMultiInline({ parts = [], spipSrc = null, spipHash = null }) {
	if (contexte.conservative && typeof spipSrc === 'string' && spipHash === canon(parts)) return spipSrc;
	return enMulti(() => serializeMulti(parts.map(({ lang, content }) => ({ lang, texte: serializeInline(content ?? [], { bords: false }) }))));
}

/**
 * Code inline : backticks par défaut (`` si le code contient un backtick) ; <code> si le code a
 * des blancs aux bords (SPIP les retire entre backticks) ou ne tient pas entre backticks.
 */
function serializeCode(code) {
	const backtick = code === code.trim() && canBacktick(code) && !/^`|`$|``/.test(code);
	if (!backtick) return `<code>${encodeCode(code)}</code>`;
	return code.includes('`') ? `\`\`${code}\`\`` : `\`${code}\``;
}

/**
 * Échappe dans du texte ce que SPIP interpréterait comme un raccourci.
 * Dans le texte d'un lien, le collecteur de liens passe avant les échappements : [ ] | et ->
 * s'écrivent en entités.
 */
export function escapeText(value, atLineStart, { link = false, cellule = false } = {}) {
	let s = value
		.replace(/\\/g, '\\\\')
		.replace(/[{}`~]/g, (c) => `\\${c}`)
		.replace(/ /g, '~')
		.replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;')
		// balise, idiome, ou modèle ([a-z_-]{3,} : <- d'une ancre reste tel quel)
		.replace(/<(?=[a-z/!:]|[_-][a-z_-]{2})/gi, '&lt;')
		// notes et glossaire sont traités avant les échappements \[ : on passe par des entités
		.replace(/\[\?/g, '[&#63;')
		.replace(/\[\[/g, '[&#91;');
	// marqueur de langue d'un multi : \[ ne le protège pas (typo() passe après les échappements)
	if (contexte.multi) s = s.replace(RE_AVANT_LANGUE, '&#91;');
	if (!link) {
		// \[ protège un lien ou une abréviation, comme dans SPIP ; pas une ancre (pre_liens) : entité
		s = s.replace(/\[(?=#|[^\]]*?<-[^\]]*\])/g, '&#91;')
			// [ final : ce qui suit (note, raccourci, ligne suivante d'une liste) peut former [[ ou une
			// ancre [ … <-], que \[ ne protège pas : entité
			.replace(/\[$/, '&#91;')
			// [ sans ] dans ce texte : le ], le ->, le | ou le <- peuvent venir dans un nœud suivant ; l'entité
			// protège de tous les raccourcis (\[ ne protège pas une ancre)
			.replace(/\[(?![^\]]*\])(?=[\s\S])/g, '&#91;')
			.replace(/\[(?=[^\]]*?(?:->|\|)[^\]]*\])/g, '\\[');
	} else {
		s = s.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/\|/g, '&#124;').replace(/->/g, '-&gt;');
	}
	// dans une note, un ] suivi d'un autre ou en fin de texte la fermerait (]]) ; \] n'y suffit pas
	// (le core cherche le premier ]] avant de traiter les échappements) : entité
	if (contexte.note && !link) s = s.replace(/\](?=\]|$)/g, '&#93;');
	if (atLineStart) s = s.replace(/^([-|]|_(?= |_))/, '\\$1');
	// texte d'une cellule : un | la couperait (un lien l'écrit déjà en entité)
	if (cellule && !link) s = s.replace(/\|/g, '\\|');
	return s;
}
