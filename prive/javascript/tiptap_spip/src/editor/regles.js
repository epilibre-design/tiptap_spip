import { getExtensionField } from '@tiptap/core';
import { creerRegle } from '../spip/regles.js';

/**
 * Règles SPIP des extensions Tiptap (spec 07 §1) : champs spipTokenizer, parseSpip et renderSpip,
 * lus avec getExtensionField (héritage par extend() compris, fonctions liées à l'extension). Type de
 * la règle : mark, nœud en ligne (inline) ou bloc. Les extensions sans ces champs n'en donnent pas.
 *
 * @param {import('@tiptap/core').AnyExtension[]} extensions
 * @returns {object[]} règles (src/spip/regles.js)
 */
export function reglesSpip(extensions) {
	return extensions.flatMap((extension) => {
		if (extension.type !== 'node' && extension.type !== 'mark') return [];
		const contexte = { name: extension.name, options: extension.options, storage: extension.storage };
		const champ = (nom) => getExtensionField(extension, nom, contexte);
		const tokenizer = champ('spipTokenizer') ?? null;
		// fonction liée à l'extension, ou objet { open, close } d'une mark rendu tel quel
		const renderSpip = champ('renderSpip') ?? null;
		if (!tokenizer && !renderSpip) return [];
		const inline = champ('inline');
		const type = extension.type === 'mark' ? 'mark' : (typeof inline === 'function' ? inline() : inline) ? 'inline' : 'block';
		const regle = creerRegle({ name: extension.name, type, tokenizer, parseSpip: champ('parseSpip') ?? null, renderSpip });
		return regle ? [regle] : [];
	});
}

