import { parseAbbr, serializeAbbr } from './abbr.js';
import { lireRegle } from './aides.js';
import { parseGlossary, serializeGlossary } from './glossary.js';
import { canon, mergeText, node, raw, sortMarks, text } from './json.js';
import { parseLinkAtts } from './links.js';
import { parseModel } from './models.js';
import { BARRE_FINALE, parseIdiome, parseMulti } from './multi.js';
import { LIGNE_VIDE } from './regex.js';
import { parseNote } from './notes.js';
import { FILL, protect } from './protect.js';
import { regleDe } from './regles.js';
import { escapeText } from './serialize.js';

/** Balises HTML sans attribut équivalentes à une mark (même rendu que le raccourci SPIP). */
const MARK_TAGS = { strong: 'bold', i: 'italic', del: 'strike', sup: 'superscript', sub: 'subscript' };
const ENTITIES = { lt: '<', gt: '>', amp: '&', '#91': '[', '#93': ']', '#63': '?' };
/** Dans le texte d'un lien, | et ] s'écrivent en entités (le collecteur de liens passe avant les échappements). */
const LINK_ENTITIES = { ...ENTITIES, '#124': '|', '#93': ']' };
const entityRegex = (entities) => new RegExp(`^&(${Object.keys(entities).join('|')});`);
const RE_ENTITY = entityRegex(ENTITIES);
const RE_LINK_ENTITY = entityRegex(LINK_ENTITIES);

/**
 * Analyse le contenu inline d'un bloc.
 *
 * @param {string} source  texte source du contenu
 * @param {string} masked  même texte masqué (cf. protect.js)
 * @param {import('./protect.js').Region[]} regions  régions, positions relatives à source
 * @param {{ lineStart?: boolean, link?: boolean }} options  lineStart : le contenu commence en début
 *        de ligne (paragraphe), donc les marqueurs de début de ligne (`- `, `_ `) s'appliquent ;
 *        link : texte d'un lien (entités &#124; et &#93; décodées)
 * @returns {object[]} nœuds inline JSON
 */
export function parseInline(source, masked, regions, { lineStart = false, link = false } = {}) {
	return buildNodes(tokenize(source, masked, regions, lineStart, link));
}

/** Texte où seul le code (backticks, <code>, <cadre>…) est masqué : ce que voit le core quand il
 * découpe le texte d'un lien. */
function maskCode(part) {
	let masked = part;
	for (const r of protect(part).regions) {
		if (r.kind === 'backtick' || r.kind === 'block') {
			masked = masked.slice(0, r.start) + FILL.repeat(r.end - r.start) + masked.slice(r.end);
		}
	}
	return masked;
}

/** Région d'un raccourci de lien → jeton : lien (contenu analysé), lien sans texte, ou brut. */
function linkToken(region, src) {
	const atts = parseLinkAtts(region.data.part, maskCode(region.data.part));
	if (!atts) return { t: 'raw', v: src };
	const attrs = { href: region.data.href, bulle: atts.bulle, hreflang: atts.hreflang, newWindow: region.data.newWindow };
	if (atts.text.trim() === '') return { t: 'node', node: node('spipLinkAuto', attrs) };
	const { masked, regions } = protect(atts.text);
	return { t: 'link', mark: { type: 'spipLink', attrs }, children: parseInline(atts.text, masked, regions, { link: true }) };
}

/**
 * Région d'une règle tierce en ligne → jeton : nœud en ligne, ou mark posée sur le contenu lu. Une
 * règle de bloc hors de son segment, ou une lecture impossible, laissent la source brute (null).
 */
function jetonTiers(region, src) {
	const regle = regleDe(region.data.regle);
	if (!regle || regle.type === 'block') return null;
	const lu = lireRegle(regle, src);
	if (!lu) return null;
	if (regle.type === 'inline') return { t: 'node', node: lu };
	const mark = lu.attrs && Object.keys(lu.attrs).length ? { type: regle.name, attrs: lu.attrs } : { type: regle.name };
	return { t: 'link', mark, children: lu.content };
}

/** Glossaire et abréviation : analyse, puis forme écrite par le sérialiseur à partir des attributs. */
const MARKED = {
	glossary: { type: 'spipGlossary', parse: (src) => { const r = parseGlossary(src); return r && { v: r.term, attrs: r.attrs }; }, write: serializeGlossary },
	abbr: { type: 'spipAbbr', parse: (src) => { const r = parseAbbr(src); return r && { v: r.text, attrs: r.attrs }; }, write: serializeAbbr },
};

/**
 * Région glossaire ou abréviation → texte marqué, si le raccourci se réécrit à l'identique depuis
 * ses attributs et que son texte s'écrit tel quel (sinon brut : `[? SPIP]`, `[?S{P}]`…).
 */
function markedToken(region, src) {
	const def = MARKED[region.kind];
	const r = def.parse(src);
	if (!r || /[\r\n]/.test(r.v) || escapeText(r.v, false) !== r.v || def.write(r.v, r.attrs) !== src) return null;
	return { t: 'marked', mark: { type: def.type, attrs: r.attrs }, v: r.v };
}

/**
 * Multi dans une phrase : atome dont chaque partie est analysée en inline. La source et la forme
 * canonique des parties sont gardées : un multi inchangé est réécrit tel quel.
 */
function multiNode(src, masked) {
	const decoupe = LIGNE_VIDE.test(src) ? null : parseMulti(src, masked);
	if (!decoupe) return null;
	const parts = decoupe.map(({ lang, start, end }) => {
		// \ final : fragment brut, restitué tel quel (multi.js)
		const barre = BARRE_FINALE.test(src.slice(start, end)) ? 1 : 0;
		const part = src.slice(start, end - barre);
		const p = protect(part);
		const content = parseInline(part, p.masked, p.regions);
		return { lang, content: barre ? [...content, raw('\\')] : content };
	});
	return node('spipMultiInline', { parts, spipSrc: src, spipHash: canon(parts) });
}

/** Nœud spipNote : name absent pour une note automatique. */
function noteNode({ name, content, lead, trail }) {
	return node('spipNote', { ...(name === null ? {} : { name }), content, spipLead: lead, spipTrail: trail });
}

function tokenize(source, masked, regions, lineStart, link) {
	const reEntity = link ? RE_LINK_ENTITY : RE_ENTITY;
	const entities = link ? LINK_ENTITIES : ENTITIES;
	const tokens = [];
	const regionAt = new Map(regions.map((r) => [r.start, r]));
	let buf = '';
	let i = 0;
	const flush = () => {
		if (buf) tokens.push({ t: 'text', v: buf });
		buf = '';
	};
	const push = (token) => {
		flush();
		tokens.push(token);
	};

	// marqueurs de début de ligne que l'éditeur ne gère pas : conservés bruts
	const lineMarker = () => {
		const m = masked.slice(i).match(/^(?:-{4,}|_{4,}|--? *|_ +)/);
		if (m) {
			push({ t: 'raw', v: source.slice(i, i + m[0].length) });
			i += m[0].length;
		}
	};

	if (lineStart) lineMarker();
	while (i < source.length) {
		const region = regionAt.get(i);
		if (region) {
			const src = source.slice(region.start, region.end);
			let note;
			let marque;
			let multi;
			let idiome;
			let tierce;
			if (region.kind === 'escape') {
				buf += region.data.char;
			} else if (region.kind === 'backtick' && region.data.ticks.length < 3 && region.data.code.trim() !== '') {
				push({ t: 'code', v: region.data.code.trim() });
			} else if (region.kind === 'link') {
				push(linkToken(region, src));
			} else if (MARKED[region.kind] && !link && (marque = markedToken(region, src))) {
				// pas de glossaire ni d'abréviation dans le texte d'un lien
				push(marque);
			} else if (region.kind === 'note' && (note = parseNote(src, region.data.masked))) {
				push({ t: 'node', node: noteNode(note) });
			} else if (region.kind === 'anchor') {
				push({ t: 'node', node: node('spipAnchor', { name: region.data.name }) });
			} else if (region.kind === 'multi' && !link && (multi = multiNode(src, region.data.masked))) {
				// pas de multi dans le texte d'un lien
				push({ t: 'node', node: multi });
			} else if (region.kind === 'extension' && (tierce = jetonTiers(region, src))) {
				push(tierce);
			} else if (region.kind === 'idiome' && (idiome = parseIdiome(src))) {
				push({ t: 'node', node: node('spipIdiome', idiome) });
			} else if (region.kind === 'model' && parseModel(src)) {
				push({ t: 'node', node: node('spipModel', { model: parseModel(src) }) });
			} else if (region.kind === 'block' && region.data.openTag === '<code>' && !region.data.inner.includes('\n') && region.data.inner !== '' && !region.data.absorbed.includes('backtick')) {
				push({ t: 'code', v: region.data.inner });
			} else {
				push({ t: 'raw', v: src });
			}
			i = region.end;
			continue;
		}

		const c = masked[i];
		const rest = masked.slice(i);
		let m;
		if (c === '\r' && masked[i + 1] === '\n') {
			i++;
		} else if (c === '\n') {
			if ((m = rest.match(/^\n_ +/)) && !rest.startsWith('\n____')) {
				push({ t: 'br', syntax: 'manual' });
				i += m[0].length;
			} else {
				push({ t: 'br', syntax: 'autobr' });
				i++;
				lineMarker();
			}
		} else if (c === '{' || c === '}') {
			const run = rest.match(c === '{' ? /^\{+/ : /^\}+/)[0];
			if (run.length >= 3 || rest.startsWith('{}') || rest.startsWith('{{}}')) {
				const v = run.length >= 3 ? run : rest.startsWith('{{}}') ? '{{}}' : '{}';
				push({ t: 'raw', v });
				i += v.length;
			} else {
				push({ t: c === '{' ? 'open' : 'close', mark: run.length === 2 ? 'bold' : 'italic', src: run });
				i += run.length;
			}
		} else if (c === '<' && (m = rest.match(/^<(\/?)(strong|i|del|sup|sub)>/))) {
			push({ t: m[1] ? 'close' : 'open', mark: MARK_TAGS[m[2]], src: m[0] });
			i += m[0].length;
		} else if (c === '<' && (m = rest.match(/^(?:<!--[\s\S]*?-->|<\/?[a-z][a-z0-9]*\b[^<>]*>)/i))) {
			push({ t: 'raw', v: source.slice(i, i + m[0].length) });
			i += m[0].length;
		} else if (c === '&' && (m = rest.match(reEntity))) {
			buf += entities[m[1]];
			i += m[0].length;
		} else if (c === '&' && (m = rest.match(/^&#?[a-z0-9]+;/i))) {
			// autre entité HTML : conservée telle quelle
			push({ t: 'raw', v: m[0] });
			i += m[0].length;
		} else if (c === '<' && /^<[a-z/!]/i.test(rest)) {
			// début de balise incomplète (<img alt="<b>">, commentaire non fermé) : SPIP restitue le <
			// tel quel et le navigateur l'interprète ; en texte, il s'écrirait &lt;
			push({ t: 'raw', v: '<' });
			i++;
		} else if (c === '~') {
			buf += ' ';
			i++;
		} else {
			buf += source[i];
			i++;
		}
	}
	flush();
	return tokens;
}

/** Les marks doivent être correctement imbriquées ; sinon tous leurs délimiteurs restent bruts. */
function wellNested(tokens) {
	const stack = [];
	for (const tk of tokens) {
		if (tk.t === 'open') {
			if (stack.includes(tk.mark)) return false;
			stack.push(tk.mark);
		} else if (tk.t === 'close') {
			if (stack[stack.length - 1] !== tk.mark) return false;
			stack.pop();
		}
	}
	return stack.length === 0;
}

function buildNodes(tokens) {
	const ok = wellNested(tokens);
	const open = [];
	const nodes = [];
	for (const tk of tokens) {
		const marks = sortMarks(open.map((type) => ({ type })));
		const withMarks = (n) => (marks.length ? { ...n, marks } : n);
		switch (tk.t) {
			case 'open':
				if (ok) open.push(tk.mark);
				else nodes.push(raw(tk.src, marks));
				break;
			case 'close':
				if (ok) open.pop();
				else nodes.push(raw(tk.src, marks));
				break;
			case 'text':
				nodes.push(text(tk.v, marks));
				break;
			case 'raw':
				nodes.push(raw(tk.v, marks));
				break;
			case 'code':
				nodes.push(text(tk.v, sortMarks([...marks, { type: 'code' }])));
				break;
			case 'marked':
				nodes.push(text(tk.v, sortMarks([...marks, tk.mark])));
				break;
			case 'br':
				nodes.push(withMarks({ type: 'hardBreak', attrs: { syntax: tk.syntax } }));
				break;
			case 'node':
				nodes.push(withMarks(tk.node));
				break;
			case 'link':
				for (const child of tk.children) {
					nodes.push({ ...child, marks: sortMarks([...marks, tk.mark, ...(child.marks ?? [])]) });
				}
				break;
		}
	}
	return mergeText(nodes);
}
