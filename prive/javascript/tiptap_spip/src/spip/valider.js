import { canon, mergeText, node, text } from './json.js';
import { parse } from './parse.js';
import { avecRegles } from './regles.js';
import { serialize } from './serialize.js';

/**
 * Validation des saisies de l'interface : une saisie n'est acceptée que si ce qu'elle écrit se relit
 * à l'identique. Le sérialiseur abandonne sinon la mark (texte gardé) ; l'interface préfère refuser.
 * Chaque fonction reçoit les règles tierces de l'éditeur (editor.tiptapSpip.regles) : le contenu
 * peut contenir leurs nœuds et leurs marks.
 */

const doc = (content) => node('doc', null, content);
const ecrire = (content) => serialize(doc(content), { conservative: false });

/** Contenu inline (texte marqué d'un lien, glossaire, abréviation…) qui se relit à l'identique. */
export const seRelitInline = (content, regles) => avecRegles(regles, () => inlineSeRelit(content));

function inlineSeRelit(content) {
	const relu = parse(ecrire([node('paragraph', null, content)])).content;
	return canon(relu) === canon([node('paragraph', null, mergeText(content))]);
}

/**
 * Note qui se relit à l'identique : même nom, et contenu identique à ce qu'il devient écrit seul
 * (les crochets et le nom de la note ne le changent pas).
 *
 * @param {{ name: ?string, content: object[] }} note  name : null automatique, '' sans appel
 * @param {object[]} [regles]
 */
export const noteSeRelit = (note, regles) => avecRegles(regles, () => noteRelue(note));

function noteRelue({ name = null, content }) {
	const note = node('spipNote', { name, content });
	const relu = parse(ecrire([node('paragraph', null, [text('x'), note])])).content;
	const [, appel, ...reste] = relu.length === 1 ? relu[0].content ?? [] : [];
	if (appel?.type !== 'spipNote' || reste.length) return false;
	return (appel.attrs.name ?? null) === (name ?? null) && canon(appel.attrs.content) === canon(parse(ecrire(content)).content);
}

/**
 * Multi en ligne qui se relit à l'identique : mêmes parties, dans l'ordre où elles s'écrivent
 * (partie sans langue en tête), chacune identique à ce que son contenu devient écrit seul.
 *
 * @param {{ lang: ?string, content: object[] }[]} parts
 * @param {object[]} [regles]
 */
export const multiSeRelit = (parts, regles) => avecRegles(regles, () => multiRelu(parts));

function multiRelu(parts) {
	const multi = node('spipMultiInline', { parts });
	const relu = parse(ecrire([node('paragraph', null, [text('x'), multi])])).content;
	const [, appel, ...reste] = relu.length === 1 ? relu[0].content ?? [] : [];
	if (appel?.type !== 'spipMultiInline' || reste.length) return false;
	const ordre = [...parts.filter((p) => !p.lang), ...parts.filter((p) => p.lang)];
	const seul = (content) => parse(ecrire([node('paragraph', null, content)])).content[0]?.content ?? [];
	return appel.attrs.parts.length === ordre.length && ordre.every((part, i) => {
		const r = appel.attrs.parts[i];
		return (r.lang ?? null) === (part.lang || null) && canon(r.content) === canon(seul(part.content ?? []));
	});
}
