// plugins-dist/textwheel/wheels/spip/spip.json — règle abbr, ancrée sur un raccourci entier
const RE_ABBR_SEUL = /^\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]$/;

/**
 * Abréviation [ABBR|explication{lang}] (règle abbr de la wheel, inserer_abbr()).
 * @param {string} src  raccourci entier
 * @returns {{ text: string, attrs: { title: string, lang: ?string } } | null}
 */
export function parseAbbr(src) {
	const m = src.match(RE_ABBR_SEUL);
	return m ? { text: m[1], attrs: { title: m[2], lang: m[3] ?? null } } : null;
}

/** [texte|explication{lang}] */
export const serializeAbbr = (text, attrs) => `[${text}|${attrs.title}${attrs.lang ? `{${attrs.lang}}` : ''}]`;
