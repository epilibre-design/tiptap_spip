import { serializeAbbr } from './abbr.js';
import { serializeGlossary } from './glossary.js';
import { canon, MARK_ORDER, node, sameMark, text } from './json.js';
import { linkEnd } from './links.js';
import { serializeModel } from './models.js';
import { serializeIdiome, serializeMulti } from './multi.js';
import { parse } from './parse.js';
import { canBacktick, encodeCode } from './protect.js';
import { RE_AVANT_LANGUE } from './regex.js';

/**
 * Document JSON → source SPIP.
 * Sérialisation conservatrice : un segment dont les blocs ont gardé leur forme canonique est
 * restitué à l'identique (spipSep + spipSrc), les autres blocs sont sérialisés.
 *
 * @param {object} doc
 * @param {{ conservative?: boolean }} options  conservative:false donne la forme canonique
 * @returns {string}
 */
export function serialize(doc, { conservative = true } = {}) {
	const avant = contexte;
	contexte = { ...contexte, conservative };
	try {
		return serializeDoc(doc, conservative);
	} finally {
		contexte = avant;
	}
}

/**
 * Contexte de la sérialisation en cours : conservative (forme canonique ou non, transmise au
 * contenu des notes) ; note (texte d'une note : un ] s'écrit \] pour ne pas la fermer) ; multi
 * (partie d'un multi : un [xx] s'écrit en entité).
 */
let contexte = { conservative: true, note: false, multi: false };

function serializeDoc(doc, conservative) {
	const blocks = doc.content ?? [];
	let out = conservative ? (doc.attrs?.spipLead ?? '') : '';
	let i = 0;
	while (i < blocks.length) {
		const b = blocks[i];
		const a = b.attrs ?? {};
		const sep = separator(i, conservative ? a.spipSep : null);
		if (conservative && a.spipGroup && typeof a.spipSrc === 'string' && canon(blocks.slice(i, i + a.spipGroup)) === a.spipHash) {
			out += sep + a.spipSrc;
			i += a.spipGroup;
			continue;
		}
		out += sep + serializeBlock(b);
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

export function serializeBlock(b) {
	const a = b.attrs ?? {};
	switch (b.type) {
		case 'paragraph':
			return serializeInline(b.content, { lineStart: true });
		case 'heading':
			return a.level === 2
				? `{{{${serializeInline(b.content, { html: true })}}}}`
				: `<h${a.level}>${serializeInline(b.content)}</h${a.level}>`;
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
			return enMulti(() => serializeMulti(b.content.map((part) => ({
				lang: part.attrs?.lang ?? null,
				texte: serialize(node('doc', null, part.content), { conservative: false }),
			}))));
		case 'table':
			return serializeTable(b);
		default:
			throw new Error(`serialize: type de bloc inconnu « ${b.type} »`);
	}
}

function serializeCodeBlock(b) {
	const a = b.attrs ?? {};
	const code = textOf(b);
	if (a.openTag || !canBacktick(code)) return `${a.openTag ?? '<code>'}\n${encodeCode(code)}\n</code>`;
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
			const inline = serializeInline(x.content?.[0]?.content);
			return x.type === 'tableHeader' && inline !== '' ? `{{${inline}}}` : inline;
		});
		lines.push(`|${cells.join('|')}|`);
	}
	return lines.join('\n');
}

const OPEN = { bold: ['{{', '}}'], italic: ['{', '}'], strike: ['<del>', '</del>'], superscript: ['<sup>', '</sup>'], subscript: ['<sub>', '</sub>'] };

/** Délimiteurs d'une mark ; un lien, un glossaire, une abréviation dépendent de leurs attributs. */
const delimiters = (mark) => {
	if (mark.type === 'spipLink') return ['[', linkEnd(mark.attrs)];
	if (mark.type === 'spipGlossary') return ['[?', serializeGlossary('', mark.attrs).slice(2)];
	if (mark.type === 'spipAbbr') return ['[', serializeAbbr('', mark.attrs).slice(1)];
	return OPEN[mark.type];
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

/**
 * Contenu inline → SPIP.
 * Gras et italique imbriqués (ou italique dans un intertitre) : la mark intérieure est écrite en
 * HTML (<strong>, <i>, même rendu) pour ne jamais produire {{{ ou }}}.
 *
 * @param {object[]} nodes
 * @param {{ lineStart?: boolean, html?: boolean }} options
 */
export function serializeInline(nodes = [], { lineStart = false, html = false } = {}) {
	nodes = marksAtomiques(nodes);
	let out = '';
	const stack = [];
	let atLineStart = lineStart;
	const closeTo = (k) => {
		while (stack.length > k) out += stack.pop().close;
	};
	const marksOf = (n) => (n.marks ?? []).filter((m) => m.type !== 'code');
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
			const useHtml = HTML[m.type] && (html || stack.some((s) => delimiters(s.mark)[0].startsWith('{')));
			const [open, close] = useHtml ? HTML[m.type] : delimiters(m);
			out += open;
			stack.push({ mark: m, close });
			atLineStart = false;
		}
		const inLink = stack.some((s) => s.mark.type === 'spipLink');
		if (n.type === 'text') {
			const code = n.marks?.find((m) => m.type === 'code');
			const atomique = stack.some((s) => ATOMIQUES.includes(s.mark.type));
			// texte d'un glossaire ou d'une abréviation : validé par marksAtomiques, écrit tel quel
			// un [ final devant une note ou un fragment brut s'écrit en entité (\[[[n]] serait une note)
			const avantCrochets = ['spipNote', 'spipRawInline'].includes(nodes[i + 1]?.type);
			out += code ? serializeCode(n.text) : atomique ? n.text : escapeText(n.text, atLineStart, { link: inLink, avantCrochets });
			atLineStart = false;
		} else if (n.type === 'hardBreak') {
			const autobr = n.attrs?.syntax === 'autobr';
			out += autobr ? '\n' : '\n_ ';
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

/**
 * Note : [[ + <nom> (nommée) ou <> (sans appel) + contenu + ]]. Le contenu est un document dont les
 * blocs gardent leur carte de segments : non modifié, il est restitué à l'identique.
 */
function serializeNote({ name = null, content, spipLead = '', spipTrail = '' }) {
	const avant = contexte;
	contexte = { ...contexte, note: true };
	try {
		const doc = { type: 'doc', attrs: { spipLead, spipTrail }, content: content?.length ? content : [node('paragraph')] };
		return `[[${name == null ? '' : `<${name}>`}${serialize(doc, { conservative: avant.conservative })}]]`;
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
	return enMulti(() => serializeMulti(parts.map(({ lang, content }) => ({ lang, texte: serializeInline(content ?? []) }))));
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
export function escapeText(value, atLineStart, { link = false, avantCrochets = false } = {}) {
	let s = value
		.replace(/\\/g, '\\\\')
		.replace(/[{}`~]/g, (c) => `\\${c}`)
		.replace(/ /g, '~')
		.replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;')
		.replace(/<(?=[a-z/!:])/gi, '&lt;')
		// notes et glossaire sont traités avant les échappements \[ : on passe par des entités
		.replace(/\[\?/g, '[&#63;')
		.replace(/\[\[/g, '[&#91;');
	// marqueur de langue d'un multi : \[ ne le protège pas (typo() passe après les échappements)
	if (contexte.multi) s = s.replace(RE_AVANT_LANGUE, '&#91;');
	if (!link) {
		// \[ protège un lien ou une abréviation, comme dans SPIP ; pas une ancre (pre_liens) : entité
		s = s.replace(/\[(?=#|[^\]]*?<-[^\]]*\])/g, '&#91;')
			.replace(/\[$/, avantCrochets ? '&#91;' : '\\[')
			.replace(/\[(?=[^\]]*?(?:->|\|)[^\]]*\])/g, '\\[');
	} else {
		s = s.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/\|/g, '&#124;').replace(/->/g, '-&gt;');
	}
	// dans une note, un ] suivi d'un autre ou en fin de texte la fermerait (]]) ; \] n'y suffit pas
	// (le core cherche le premier ]] avant de traiter les échappements) : entité
	if (contexte.note && !link) s = s.replace(/\](?=\]|$)/g, '&#93;');
	if (atLineStart) s = s.replace(/^([-|]|_(?= |_))/, '\\$1');
	return s;
}
