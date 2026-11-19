import { node, text } from './json.js';

/**
 * Bloc `<md>…</md>` du plugin Markdown (spip-contrib-extensions/markdown), en syntaxe SPIP par
 * défaut : son contenu est du Markdown, que l'éditeur garde en texte brut (spec 05 §6).
 *
 * Le plugin met ces blocs de côté au pipeline pre_echappe_html_propre, avant la wheel des
 * backticks et les blocs protégés du cœur ; la règle est donc de niveau `protect`. Seule la
 * forme exacte `<md>` est lue : le plugin ne convertit pas les autres (`<md class>`, `<MD>`), qui
 * restent brutes.
 */
export const MARKDOWN = 'spipMarkdown';

export const markdownTokenizer = {
	level: 'protect',
	priority: 0,
	start: '<md>',
	match: /<md>([\s\S]*?)<\/md>/,
};

/** Texte du bloc, tel quel : le plugin ne passe ni la typo ni les échappements SPIP avant Markdown. */
export const parseMarkdown = (m) => node(MARKDOWN, null, m[1] === '' ? undefined : [text(m[1])]);

/**
 * Source du bloc. Un `</md>` saisi fermerait le bloc : il est écrit `&lt;/md>`, que Markdown
 * affiche `</md>`.
 */
export function renderMarkdown(n) {
	const contenu = (n.content ?? []).map((t) => t.text ?? '').join('');
	return `<md>${contenu.replace(/<\/md>/gi, '&lt;/md>')}</md>`;
}
