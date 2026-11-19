import { node, text } from './json.js';

/**
 * Bloc `<md>…</md>` du plugin Markdown (spip-contrib-extensions/markdown), en syntaxe SPIP par
 * défaut : son contenu est du Markdown, que l'éditeur garde en texte brut (spec 05 §6).
 *
 * Le plugin met ces blocs de côté au pipeline pre_echappe_html_propre, avant la wheel des
 * backticks et les blocs protégés du cœur ; la règle est donc de niveau `echappe`. Seule
 * l'ouverture exacte `<md>` est lue : le plugin ne convertit pas les autres (`<md class>`, `<MD>`),
 * qui restent brutes. Il ferme le bloc au premier `</md>` de toute casse.
 */
export const MARKDOWN = 'spipMarkdown';

export const markdownTokenizer = {
	level: 'echappe',
	priority: 0,
	start: '<md>',
	match: /<md>([\s\S]*?)<\/[mM][dD]>/,
};

/** Texte du bloc, tel quel : le plugin ne passe ni la typo ni les échappements SPIP avant Markdown. */
export const parseMarkdown = (m) => node(MARKDOWN, null, m[1] === '' ? undefined : [text(m[1])]);

/** `</md>`, toute casse : le plugin ferme le bloc au premier, même dans du code Markdown. */
export const FERMETURE = /<\/md>/i;

/**
 * Source du bloc. L'éditeur refuse un `</md>` dans le bloc (extensions.js) ; un JSON qui en
 * contient l'écrit `&lt;/md>`, que Markdown affiche `</md>` hors du code (dans du code, l'entité
 * reste telle quelle).
 */
export function renderMarkdown(n) {
	const contenu = (n.content ?? []).map((t) => t.text ?? '').join('');
	return `<md>${contenu.replace(new RegExp(FERMETURE.source, 'gi'), '&lt;/md>')}</md>`;
}
