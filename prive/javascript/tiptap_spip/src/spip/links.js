import { LANGUES, RE_ATTRIBUTS_LIEN } from './regex.js';

/**
 * Partie « texte » d'un raccourci de lien [texte|bulle{lang}->cible], découpée comme
 * traiter_raccourci_lien_atts() (plugins-dist/textwheel/inc/lien.php) :
 * - {xx} final : langue si xx est un code connu, sinon reste dans la bulle (ou le texte) ;
 * - {} final : langue de l'objet, qui dépend du contexte : non représentable (null).
 * Le texte n'est pas rogné : SPIP le rogne au rendu, la source garde ses espaces.
 *
 * Le core met le code (backticks, <code>, <cadre>…) à l'abri avant de découper : le découpage se
 * fait donc sur `masked`, où ce code est masqué, et les morceaux sont repris dans `part`.
 *
 * @param {string} part
 * @param {string} [masked]  même texte, code masqué (même longueur)
 * @returns {{ text: string, bulle: string|null, hreflang: string|null } | null}
 */
export function parseLinkAtts(part, masked = part) {
	const whole = { text: part, bulle: null, hreflang: null };
	if (!/[|{]/.test(masked)) return whole;
	const m = masked.match(RE_ATTRIBUTS_LIEN);
	if (!m) return whole;
	const [, maskedText, pipe, maskedBulle, brace, lang] = m;
	const text = part.slice(0, maskedText.length);
	const bulle = pipe !== undefined ? part.slice(maskedText.length + 1, maskedText.length + 1 + maskedBulle.length) : undefined;
	if (brace !== undefined) {
		if (lang === '') return null;
		if (!LANGUES.has(lang)) {
			return pipe !== undefined ? { text, bulle: bulle + brace, hreflang: null } : whole;
		}
	}
	return { text, bulle: pipe !== undefined ? bulle : null, hreflang: brace !== undefined ? lang : null };
}

/** Attributs écrits après le texte d'un lien : |bulle{lang} */
export const linkAtts = ({ bulle, hreflang }) => (bulle != null ? `|${bulle}` : '') + (hreflang ? `{${hreflang}}` : '');

/** Fin d'un raccourci de lien : |bulle{lang}->cible] (->> : nouvelle fenêtre) */
export const linkEnd = (attrs) => `${linkAtts(attrs)}->${attrs.newWindow ? '>' : ''}${attrs.href}]`;
