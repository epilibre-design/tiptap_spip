import { RE_IDIOME_SEUL, RE_LANGUE_MULTI } from './regex.js';

const OUVRANT = '<multi>'.length;
const FERMANT = '</multi>'.length;

/**
 * Parties d'un multi `<multi>[fr]…[en]…</multi>`, découpées comme Multis::extraire_trads() : une
 * partie par marqueur de langue ; le texte avant le premier marqueur est une partie sans langue s'il
 * n'est pas vide. Les marqueurs se cherchent dans le texte que voit le core au moment de typo(), où
 * liens, notes, modèles… sont déjà remplacés (masked).
 *
 * Provenance du découpage : Multis::extraire_trads() (ecrire/src/Texte/Collecteur/Multis.php,
 * SPIP 4.4.21), © Arnaud Martin, Antoine Pitrou, Philippe Rivière, Emmanuel Saint-James, licence
 * GNU GPL. Adaptation du 2026-10-12 : traduit en JavaScript, positions au lieu des textes.
 *
 * Un marqueur caché dans un raccourci traité avant (note, lien, code) rend le découpage incertain : le
 * core coupe le multi dans une note (`[[voir [en] ici]]`), pas dans du code. Non représentable (null).
 *
 * @param {string} src  raccourci entier
 * @param {string} [masked]  même texte, raccourcis traités avant masqués (même longueur)
 * @returns {{ lang: ?string, start: number, end: number }[] | null}  positions relatives à src
 */
export function parseMulti(src, masked = src) {
	const fin = src.length - FERMANT;
	const marqueurs = (s) => [...s.slice(OUVRANT, fin).matchAll(RE_LANGUE_MULTI)].length;
	if (marqueurs(src) !== marqueurs(masked)) return null;
	// <multi></multi> : aucune partie (extraire_trads() d'un texte vide)
	if (fin === OUVRANT) return [];
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

/**
 * \ final (non échappé) d'une partie : il précède un marqueur, et SPIP ne le rend pas de la même
 * façon selon la langue choisie (gardé ou retiré quand la langue manque) : à restituer tel quel.
 */
export const BARRE_FINALE = /(?<!\\)(?:\\\\)*\\$/;

/**
 * <multi> + [lang]partie… + </multi>. Une partie sans langue ne s'écrit qu'en tête (sans marqueur,
 * elle se fondrait dans la précédente) : elle y est placée.
 */
export function serializeMulti(parts) {
	const ordre = [...parts.filter((p) => !p.lang), ...parts.filter((p) => p.lang)];
	// [ final d'une partie devant le marqueur suivant : \[[fr] ferait une note (notes avant échappements)
	const texte = (t, k) => (k < ordre.length - 1 ? t.replace(/\\?\[$/, '&#91;') : t);
	return `<multi>${ordre.map(({ lang, texte: t }, k) => (lang ? `[${lang}]` : '') + texte(t, k)).join('')}</multi>`;
}

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
