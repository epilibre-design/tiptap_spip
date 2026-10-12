import { lireRegle } from './aides.js';
import { parseInline } from './inline.js';
import { node, text } from './json.js';
import { parseModel } from './models.js';
import { BARRE_FINALE, parseMulti } from './multi.js';
import { LIGNE_VIDE } from './regex.js';
import { FILL, protect, regionsIn } from './protect.js';
import { regleDe } from './regles.js';
import { segment } from './segment.js';

/** Signale une construction que l'éditeur ne sait pas représenter : le segment reste brut. */
class Fallback extends Error {}

/**
 * Analyse un segment (texte entre deux lignes vides) en un ou plusieurs blocs JSON.
 * Ne lève jamais d'exception : en cas d'échec, le segment devient un bloc spipRaw.
 *
 * @param {string} src     source du segment
 * @param {string} msk     même texte masqué
 * @param {import('./protect.js').Region[]} regions  positions relatives au segment
 * @returns {object[]}
 */
export function blocksOf(src, msk, regions) {
	try {
		const verbatim = verbatimBlock(src, regions);
		if (verbatim) return verbatim;
		// \r seul (fins de ligne Mac OS 9, non gérées) : saut de ligne pour SPIP, pas pour le découpage
		if (/\r(?!\n)/.test(msk)) throw new Fallback();
		return containerBlock(src, msk) ?? tableBlock(src, msk, regions) ?? runBlocks(src, msk, regions);
	} catch {
		return [node('spipRaw', { source: src })];
	}
}

/** Contenu d'un conteneur (<quote>, <poesie>, <div>) : analyse complète, sans attributs techniques. */
export function parseContent(src) {
	const { masked, regions } = protect(src);
	const { segments } = segment(src, masked);
	const out = segments.flatMap((s) =>
		blocksOf(src.slice(s.start, s.end), masked.slice(s.start, s.end), regionsIn(regions, s.start, s.end)));
	return out.length ? out : [node('paragraph')];
}

const textContent = (value) => (value === '' ? undefined : [text(value)]);

function verbatimBlock(src, regions) {
	const r = regions.length === 1 && regions[0].start === 0 && regions[0].end === src.length ? regions[0] : null;
	if (!r) return null;
	if (r.kind === 'model' && parseModel(src)) return [node('spipModelBlock', { model: parseModel(src) })];
	if (r.kind === 'multi') return multiBlock(src, r.data.masked);
	if (r.kind === 'backtick' && r.data.ticks.length >= 3) {
		return [node('codeBlock', { language: r.data.language || null }, textContent(r.data.code))];
	}
	if (r.kind === 'extension') return blocExtension(src, r);
	if (r.kind !== 'block') return null;
	const { tag, openTag, closeTag, inner, absorbed } = r.data;
	// un bloc qui contenait du code en backticks est rendu autrement par SPIP : on le garde brut
	if (absorbed.includes('backtick')) return [node('spipRaw', { source: src })];
	if (tag === 'code') {
		// <code> sur une seule ligne : code inline dans un paragraphe
		if (!inner.includes('\n')) return null;
		// comme SPIP : un saut de ligne retiré au début et à la fin ; openTag seulement s'il a des attributs
		const code = inner.replace(/^\n/, '').replace(/\n$/, '');
		return [node('codeBlock', openTag.toLowerCase() === '<code>' ? null : { openTag }, textContent(code))];
	}
	const type = { cadre: 'spipCadre', frame: 'spipCadre', html: 'spipHtml', math: 'spipMath' }[tag];
	return [type ? node(type, { openTag, closeTag }, textContent(inner)) : node('spipRaw', { source: src })];
}

/**
 * Raccourci d'une règle tierce de bloc occupant tout son segment : le bloc qu'elle lit, sinon la
 * source brute. Une règle en ligne laisse le segment devenir un paragraphe (inline.js).
 */
function blocExtension(src, r) {
	const regle = regleDe(r.data.regle);
	if (regle?.type !== 'block') return null;
	const bloc = lireRegle(regle, src);
	return [bloc ?? node('spipRaw', { source: src })];
}

/**
 * Multi seul dans son segment, sur plusieurs paragraphes : une partie par langue, chacune faite de
 * paragraphes (SPIP mêle les parties d'une liste, d'un intertitre… : gardé brut). Sans ligne vide,
 * c'est un multi en ligne dans un paragraphe.
 */
function multiBlock(src, masked) {
	if (!LIGNE_VIDE.test(src)) return null;
	const decoupe = parseMulti(src, masked);
	// une partie sans langue faite de blancs compte pour SPIP (quand aucune langue ne convient) mais
	// ne s'écrit pas en paragraphes
	// \ final d'une partie : rendu variable selon la langue (multi.js), gardé brut
	if (!decoupe || decoupe.some((p) => (p.lang === null && src.slice(p.start, p.end).trim() === '') || BARRE_FINALE.test(src.slice(p.start, p.end)))) {
		throw new Fallback();
	}
	const parts = decoupe.map(({ lang, start, end }) => {
		const content = parseContent(src.slice(start, end));
		if (content.some((b) => b.type !== 'paragraph')) throw new Fallback();
		return node('spipLangBlock', { lang }, content);
	});
	return [node('spipMultiBlock', null, parts)];
}

function containerBlock(src, msk) {
	let m;
	// contenu où les balises du conteneur ne s'équilibrent pas (</div> en trop, <div> non refermé) :
	// réécrit, il fermerait le conteneur plus tôt ou plus tard
	const ferme = (inner, tag) => {
		let profondeur = 0;
		for (const [balise] of inner.matchAll(new RegExp(`</?${tag}\\b[^>]*>`, 'gi'))) {
			profondeur += balise[1] === '/' ? -1 : 1;
			if (profondeur < 0) throw new Fallback();
		}
		if (profondeur !== 0) throw new Fallback();
	};
	if ((m = msk.match(/^<quote>([\s\S]*)<\/quote>$/i))) {
		ferme(m[1], 'quote');
		return [node('blockquote', null, parseContent(src.slice(7, 7 + m[1].length)))];
	}
	if ((m = msk.match(/^<(poe(?:sie|try))>([\s\S]*)<\/\1>$/i))) {
		ferme(m[2], m[1]);
		const start = m[1].length + 2;
		const content = parseContent(src.slice(start, start + m[2].length));
		if (content.some((b) => b.type !== 'paragraph')) throw new Fallback();
		return [node('spipPoesie', { tag: m[1] }, content)];
	}
	if ((m = msk.match(/^<div class="text-(left|center|right|justify)">([\s\S]*)<\/div>$/))) {
		ferme(m[2], 'div');
		const start = m[0].indexOf('>') + 1;
		const content = parseContent(src.slice(start, start + m[2].length));
		if (content.some((b) => b.type === 'spipAlign')) throw new Fallback();
		return [node('spipAlign', { align: m[1] }, content)];
	}
	return null;
}

/** Découpe un segment en lignes : positions [start, end[ sans le \n final. */
function linesOf(msk) {
	const lines = [];
	let pos = 0;
	for (const line of msk.split('\n')) {
		lines.push({ start: pos, end: pos + line.length });
		pos += line.length + 1;
	}
	return lines;
}

/** Contenu inline de src[s, e[ ; refuse une région à cheval sur la limite. */
function inlineOf(src, msk, regions, s, e, options) {
	// le \r d'une fin de ligne CRLF n'est pas du texte (SPIP le retire)
	if (msk[e - 1] === '\r') e--;
	if (regions.some((r) => r.start < e && r.end > s && (r.start < s || r.end > e))) throw new Fallback();
	return parseInline(src.slice(s, e), msk.slice(s, e), regionsIn(regions, s, e), options);
}

const RE_HR = /^(?:-{4,}|_{4,})[ \t\r]*$/;
const RE_H2 = /^\{\{\{(?!\{)(.*?)\}\}\}[ \t\r]*$/;
const RE_HN = /^<h([3-6])>(.*)<\/h\1>[ \t\r]*$/;
const RE_ITEM = /^-(\*+|#+)(?![*#]) ?/;

function special(line) {
	return RE_HR.test(line) || RE_ITEM.test(line) || heading(line) !== null;
}

function heading(line) {
	let m = line.match(RE_H2);
	if (m && !/\{\{|\}\}/.test(m[1])) return { level: 2, offset: 3, length: m[1].length };
	m = line.match(RE_HN);
	if (m) return { level: Number(m[1]), offset: 4, length: m[2].length };
	return null;
}

/** Blocs d'un segment ordinaire : paragraphes, intertitres, filets, listes. */
function runBlocks(src, msk, regions) {
	const lines = linesOf(msk);
	const L = (k) => msk.slice(lines[k].start, lines[k].end);
	// textwheel (spip-tableaux.json) fait un tableau de toute ligne qui commence et finit par |, même
	// dans un paragraphe : un segment que tableBlock() n'a pas lu reste brut
	if (lines.some((_, k) => L(k).startsWith('|'))) throw new Fallback();
	const out = [];
	let k = 0;
	while (k < lines.length) {
		const line = L(k);
		const h = heading(line);
		if (RE_HR.test(line)) {
			out.push(node('horizontalRule'));
			k++;
		} else if (h) {
			const s = lines[k].start + h.offset;
			out.push(node('heading', { level: h.level }, inlineOf(src, msk, regions, s, s + h.length, { uneLigne: true })));
			k++;
		} else if (RE_ITEM.test(line)) {
			// comme SPIP, la liste va jusqu'à la fin du segment (ligne vide)
			out.push(...listBlocks(src, msk, regions, lines.slice(k), L, k));
			k = lines.length;
		} else {
			let j = k + 1;
			while (j < lines.length && !special(L(j))) j++;
			// ligne vide dans un paragraphe (segment recollé autour d'un conteneur mal fermé) : pas dans le
			// schéma (deux sauts de ligne de suite ne se relisent pas)
			if (LIGNE_VIDE.test(msk.slice(lines[k].start, lines[j - 1].end))) throw new Fallback();
			const content = inlineOf(src, msk, regions, lines[k].start, lines[j - 1].end, { lineStart: true });
			// modèle seul (sans mark) : modèle de bloc, comme seul dans son segment (même rendu)
			if (content.length === 1 && content[0].type === 'spipModel' && !content[0].marks) {
				out.push(node('spipModelBlock', { model: content[0].attrs.model }));
			} else {
				out.push(node('paragraph', null, content.length ? content : undefined));
			}
			k = j;
		}
	}
	return out;
}

/** Listes SPIP : -* puces, -# numéros, profondeur = nombre de * ou #. */
function listBlocks(src, msk, regions, lines, L, first) {
	const items = [];
	lines.forEach((line, n) => {
		const m = L(first + n).match(RE_ITEM);
		if (m) {
			const vide = L(first + n).slice(m[0].length).trim() === '';
			items.push({ depth: m[1].length, type: m[1][0] === '*' ? 'bulletList' : 'orderedList', start: line.start + m[0].length, end: line.end, vide });
		} else if (RE_HR.test(L(first + n)) || heading(L(first + n)) !== null) {
			// filet ou intertitre dans un élément (<li>a<hr /></li>) : pas dans le schéma
			throw new Fallback();
		} else if (items[items.length - 1].vide) {
			// première ligne vide puis continuation : rendu SPIP irrégulier (<br /> devant un marqueur de
			// ligne, rien sinon), pas dans le schéma
			throw new Fallback();
		} else {
			items[items.length - 1].end = line.end; // ligne de continuation
		}
	});

	const tops = [];
	const stack = [];
	let prevDepth = 0;
	for (const it of items) {
		if (it.depth > stack.length + 1) throw new Fallback();
		stack.length = Math.min(stack.length, it.depth);
		let list = stack[it.depth - 1];
		// comme SPIP : le type ne change qu'entre deux éléments de même profondeur ;
		// en remontant d'un niveau plus profond, la liste existante continue
		if (list && list.type !== it.type && prevDepth === it.depth) {
			if (it.depth > 1) throw new Fallback();
			list = null;
			stack.length = 0;
		}
		if (!list) {
			list = node(it.type, null, []);
			if (it.depth === 1) {
				tops.push(list);
			} else {
				const parent = stack[it.depth - 2].content.at(-1);
				if (parent.content.length > 1) throw new Fallback();
				parent.content.push(list);
			}
			stack[it.depth - 1] = list;
		}
		prevDepth = it.depth;
		const content = inlineOf(src, msk, regions, it.start, it.end);
		list.content.push(node('listItem', null, [node('paragraph', null, content.length ? content : undefined)]));
	}
	return tops;
}

/** Tableaux SPIP : |a|b|, légende ||titre|résumé||, en-tête {{…}}, fusions < et ^. */
function tableBlock(src, msk, regions) {
	const lines = linesOf(msk);
	const L = (k) => msk.slice(lines[k].start, lines[k].end).replace(/[ \t\r]+$/, '');
	if (!lines.every((_, k) => /^\|.*\|$/.test(L(k)))) return null;

	const attrs = {};
	let rowLines = lines.map((_, k) => k);
	// légende : cherchée comme textwheel (traiter_tableau()) sur la ligne privée de son | final puis de
	// tous les | de fin : ||x| en est une, |||| non (ligne d'en-têtes vides)
	const cm = L(0).slice(0, -1).replace(/\|+$/, '').match(/^\|\|([^|]*)(?:\|([\s\S]*))?$/);
	if (cm) {
		if (cm[0].includes(FILL)) throw new Fallback();
		attrs.caption = cm[1];
		if (cm[2] !== undefined) attrs.summary = cm[2];
		rowLines = rowLines.slice(1);
		if (!rowLines.length) throw new Fallback();
	}

	const cellsOf = (k) => {
		const line = L(k);
		const cells = [];
		let start = 1;
		for (let p = 1; p < line.length; p++) {
			if (line[p] === '|') {
				cells.push({ start: lines[k].start + start, end: lines[k].start + p });
				start = p + 1;
			}
		}
		return cells;
	};
	const rows = rowLines.map(cellsOf);
	if (rows.some((r) => r.length !== rows[0].length)) throw new Fallback();

	const trimmed = (c) => {
		const t = msk.slice(c.start, c.end);
		const s = c.start + (t.length - t.trimStart().length);
		const e = c.end - (t.length - t.trimEnd().length);
		return { s, e, t: msk.slice(s, e) };
	};
	const RE_TH = /^\{\{[^{}]+\}\}$/;
	// comme traiter_tableau() (_RACCOURCI_TH_SPAN, gras facultatif) : cellules vides, < ou {{…}}, même
	// toutes vides (|||| : ligne d'en-têtes vides)
	const headerRow = rows[0].every((c) => ['', '<'].includes(trimmed(c).t) || RE_TH.test(trimmed(c).t));

	const grid = [];
	const tableRows = rows.map((cells, r) => {
		const isHeader = r === 0 && headerRow;
		const row = [];
		const real = [];
		const seenAbove = new Set();
		cells.forEach((c, col) => {
			const { s, e, t } = trimmed(c);
			if (t === '<') {
				const left = row[col - 1];
				if (!left || !real.includes(left)) throw new Fallback();
				left.attrs.colspan++;
				row[col] = left;
			} else if (t === '^') {
				const above = grid[r - 1]?.[col];
				if (!above) throw new Fallback();
				if (!seenAbove.has(above)) above.attrs.rowspan++;
				seenAbove.add(above);
				row[col] = above;
			} else {
				const [is, ie] = isHeader && t !== '' ? [s + 2, e - 2] : [s, e];
				const content = inlineOf(src, msk, regions, is, ie, { uneLigne: true });
				const cell = node(isHeader ? 'tableHeader' : 'tableCell', { colspan: 1, rowspan: 1 },
					[node('paragraph', null, content.length ? content : undefined)]);
				row[col] = cell;
				real.push(cell);
			}
		});
		// une fusion verticale doit couvrir toutes les colonnes de la cellule fusionnée
		seenAbove.forEach((above) => {
			const cols = grid[r - 1].flatMap((x, col) => (x === above ? [col] : []));
			if (!cols.every((col) => row[col] === above)) throw new Fallback();
		});
		grid.push(row);
		return node('tableRow', null, real);
	});
	return [node('table', attrs, tableRows)];
}
