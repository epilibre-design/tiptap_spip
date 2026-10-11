import { LANGUES, RE_ATTRIBUTS_LIEN } from './regex.js';

/**
 * Partie « texte » d'un raccourci de lien [texte|bulle{lang}->cible], découpée comme
 * traiter_raccourci_lien_atts() (plugins-dist/textwheel/inc/lien.php) :
 * - {xx} final : langue si xx est un code connu, sinon reste dans la bulle (ou le texte) ;
 * - {} final : langue de l'objet, qui dépend du contexte : non représentable (null).
 * Le texte n'est pas rogné : SPIP le rogne au rendu, la source garde ses espaces.
 *
 * @param {string} part
 * @returns {{ text: string, bulle: string|null, hreflang: string|null } | null}
 */
export function parseLinkAtts(part) {
	const whole = { text: part, bulle: null, hreflang: null };
	if (!/[|{]/.test(part)) return whole;
	const m = part.match(RE_ATTRIBUTS_LIEN);
	if (!m) return whole;
	const [, text, pipe, bulle, brace, lang] = m;
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
