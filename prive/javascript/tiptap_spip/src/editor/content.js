import { canon } from '../spip/json.js';
import { parse } from '../spip/parse.js';

/**
 * Source SPIP → JSON prêt pour editor.commands.setContent().
 *
 * Le JSON passe par le schéma (nodeFromJSON puis check(), qui lève une exception si le contenu
 * viole le schéma), puis les empreintes spipHash sont recalculées sur la forme que l'éditeur
 * renverra dans getJSON() : attributs par défaut compris. Sans cela, un bloc non modifié dont
 * le schéma ajoute un attribut par défaut ne serait plus reconnu par la sérialisation
 * conservatrice.
 *
 * @param {string} source
 * @param {import('@tiptap/pm/model').Schema} schema
 * @returns {object} document JSON
 */
export function toEditorJSON(source, schema) {
	const doc = schema.nodeFromJSON(parse(source));
	doc.check();
	const json = doc.toJSON();
	const blocks = json.content ?? [];
	blocks.forEach((block, i) => {
		const group = block.attrs?.spipGroup;
		if (group) block.attrs.spipHash = canon(blocks.slice(i, i + group));
	});
	return json;
}
