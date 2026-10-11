import { linkAtts, parseLinkAtts } from './links.js';
import { RE_GLOSES, RE_GLOSSAIRE_SEUL } from './regex.js';

/**
 * Terme de glossaire [?terme#glossaireN|bulle{lang}], découpé comme traiter_raccourci_glossaire()
 * (plugins-dist/textwheel/inc/lien.php) : le terme est isolé de ses accessoires (#glossaire et
 * numéro, puis |bulle et {lang} comme dans un lien), où qu'ils soient.
 *
 * @param {string} src  raccourci entier
 * @returns {{ term: string, attrs: { glossaire: ?string, numero: ?string, bulle: ?string, hreflang: ?string } } | null}
 */
export function parseGlossary(src) {
	const m = src.match(RE_GLOSSAIRE_SEUL);
	const r = m?.[1].match(RE_GLOSES);
	if (!r) return null;
	const [, nom, numero] = (r[4] ?? '').match(/^(.*?)(\d*)$/);
	const atts = parseLinkAtts(r[1] + r[2] + r[5]);
	if (!atts) return null;
	return { term: atts.text, attrs: { glossaire: nom || null, numero: numero || null, bulle: atts.bulle, hreflang: atts.hreflang } };
}

/** [?terme#glossaireN|bulle{lang}] */
export const serializeGlossary = (term, attrs) =>
	`[?${term}${attrs.glossaire || attrs.numero ? `#${attrs.glossaire ?? ''}${attrs.numero ?? ''}` : ''}${linkAtts(attrs)}]`;
