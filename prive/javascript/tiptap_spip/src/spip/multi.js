import { RE_IDIOME_SEUL, RE_LANGUE_MULTI } from './regex.js';

const OUVRANT = '<multi>'.length;
const FERMANT = '</multi>'.length;

/**
 * Parties d'un multi `<multi>[fr]…[en]…</multi>`, découpées comme Multis::extraire_trads() : une
 * partie par marqueur de langue ; le texte avant le premier marqueur est une partie sans langue s'il
 * n'est pas vide. Les marqueurs se cherchent dans le texte que voit le core au moment de typo(), où
 * liens, notes, modèles… sont déjà remplacés (masked).
 *
 * @param {string} src  raccourci entier
 * @param {string} [masked]  même texte, raccourcis traités avant masqués (même longueur)
 * @returns {{ lang: ?string, start: number, end: number }[]}  positions relatives à src
 */
export function parseMulti(src, masked = src) {
	const fin = src.length - FERMANT;
	const parts = [];
	let lang = null;
	let debut = OUVRANT;
	for (const m of masked.slice(OUVRANT, fin).matchAll(RE_LANGUE_MULTI)) {
		const pos = OUVRANT + m.index;
		if (lang !== null || pos > debut) parts.push({ lang, start: debut, end: pos });
		lang = m[1];
		debut = pos + m[0].length;
	}
	parts.push({ lang, start: debut, end: fin });
	return parts;
}

/** <multi> + [lang]partie… + </multi> ; une partie sans langue ne peut être que la première. */
export const serializeMulti = (parts) => `<multi>${parts.map(({ lang, texte }) => (lang ? `[${lang}]` : '') + texte).join('')}</multi>`;

/**
 * Idiome <:module:cle:> (Idiomes::collecter()).
 * @returns {{ module?: string, cle: string } | null}  module absent : module par défaut
 */
export function parseIdiome(src) {
	const m = src.match(RE_IDIOME_SEUL);
	if (!m) return null;
	return m[1] === undefined ? { cle: m[2] } : { module: m[1], cle: m[2] };
}

export const serializeIdiome = ({ module, cle }) => `<:${module ? `${module}:` : ''}${cle}:>`;
