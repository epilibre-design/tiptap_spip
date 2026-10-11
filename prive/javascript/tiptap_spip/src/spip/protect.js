import {
	RE_ABBR, RE_ANCRE, RE_BACKTICKS, RE_ECHAPPEMENT, RE_ECHAPPEMENT_CODE, RE_GLOSSAIRE, RE_IDIOME,
	RE_LIEN, RE_MODELE, RE_MULTI, RE_NOTE, RE_PROTEGE_BLOCS,
} from './regex.js';

/** Caractère de masquage : zone privée Unicode, jamais produit par une regex de raccourci. */
export const FILL = '\uE000';

/**
 * Repère les zones « opaques » d'un texte SPIP, dans l'ordre de traitement du core,
 * et renvoie un texte masqué de même longueur : chaque zone y est remplacée par FILL.
 * Les positions sont donc identiques dans `source` et `masked`.
 *
 * @param {string} source
 * @returns {{ masked: string, regions: Region[] }}
 *
 * @typedef {{ start: number, end: number, kind: string, data: object }} Region
 */
export function protect(source) {
	let masked = source;
	let regions = [];

	const add = (start, end, kind, data) => {
		// une zone englobe celles qu'elle recouvre (ex. un modèle dans le texte d'un lien)
		const absorbed = regions.filter((r) => r.start >= start && r.end <= end).map((r) => r.kind);
		regions = regions.filter((r) => r.start < start || r.end > end);
		regions.push({ start, end, kind, data: { ...data, absorbed } });
		masked = masked.slice(0, start) + FILL.repeat(end - start) + masked.slice(end);
	};

	const scan = (regex, onMatch) => {
		for (const m of [...masked.matchAll(regex)]) {
			onMatch(m, m.index, m.index + m[0].length);
		}
	};

	// 1. wheel backticks (pre_echappe_html_propre, avant tout le reste) :
	//    d'abord \\ et \`, puis ``` `` ` — sur tout le texte, y compris dans <code> ou <html>
	scan(RE_ECHAPPEMENT_CODE, (m, start, end) => add(start, end, 'escape', { char: m[1] }));
	RE_BACKTICKS.forEach((regex) => scan(regex, (m, start, end) => {
		const ticks = m[1];
		let code = dropCodeEscapes(source.slice(start + ticks.length, end - ticks.length));
		let language = '';
		if (ticks.length >= 3) {
			const l = code.match(/^[\w\t -]+\n/);
			if (l) {
				language = l[0].trim();
				code = code.slice(l[0].length);
			}
			code = code.replace(/^\n/, '');
		}
		add(start, end, 'backtick', { ticks, code, language });
	}));

	// 2. blocs protégés <code>, <cadre>, <html>…
	scan(RE_PROTEGE_BLOCS, (m, start, end) => {
		const openTag = source.slice(start, start + m[0].indexOf('>') + 1);
		const closeLength = m[1].length + 3;
		add(start, end, 'block', {
			tag: m[1].toLowerCase(),
			openTag,
			closeTag: source.slice(end - closeLength, end),
			inner: decodeCode(source.slice(start + openTag.length, end - closeLength)),
		});
	});

	// 3. autres échappements \{ \[ …
	scan(RE_ECHAPPEMENT, (m, start, end) => add(start, end, 'escape', { char: m[1] }));

	// 4. raccourcis : modèles, liens et ancres analysés (inline.js), les autres conservés tels quels
	scan(RE_MODELE, (m, start, end) => {
		// condition du core : un id ou des paramètres, sinon c'est une balise HTML
		if (m[2] || m[3]) add(start, end, 'model', { source: m[0] });
	});
	scan(RE_NOTE, (m, start, end) => add(start, end, 'note', {}));
	// texte et cible relus dans la source : le texte masqué a remplacé les modèles par FILL
	scan(RE_LIEN, (m, start, end) => add(start, end, 'link', {
		part: source.slice(start + 1, start + 1 + m[1].length),
		newWindow: m[3] === '>',
		href: source.slice(end - 1 - m[4].length, end - 1),
	}));
	scan(RE_ANCRE, (m, start, end) => add(start, end, 'anchor', { name: source.slice(end - 3 - m[1].length, end - 3) }));
	scan(RE_GLOSSAIRE, (m, start, end) => add(start, end, 'glossary', {}));
	scan(RE_ABBR, (m, start, end) => add(start, end, 'abbr', {}));
	scan(RE_MULTI, (m, start, end) => add(start, end, 'multi', {}));
	scan(RE_IDIOME, (m, start, end) => add(start, end, 'idiome', {}));

	regions.sort((a, b) => a.start - b.start);
	return { masked, regions };
}

/** Dans <code>, <cadre>, <html>… la wheel backticks décode \\ en \ et \` en `. */
export const decodeCode = (s) => s.replace(/\\([\\`])/g, '$1');

/** Dans du code en backticks, SPIP perd purement et simplement \\ et \`. */
export const dropCodeEscapes = (s) => s.replace(/\\[\\`]/g, '');

/** Un code sans séquence \\, \` ni \ final peut s'écrire entre backticks. */
export const canBacktick = (s) => !/\\(?=[\\`]|$)/.test(s);

/** Inverse de decodeCode, pour le texte écrit dans <code>, <cadre>, <html>, <math>. */
export const encodeCode = (s) => s.replace(/\\(?=[\\`]|$)/g, '\\\\').replace(/`/g, '\\`');

/**
 * Régions contenues dans [start, end[, avec des positions relatives à start.
 * @param {Region[]} regions
 */
export function regionsIn(regions, start, end) {
	return regions
		.filter((r) => r.start >= start && r.end <= end)
		.map((r) => ({ ...r, start: r.start - start, end: r.end - start }));
}
