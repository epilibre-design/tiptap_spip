import { canon } from '../spip/json.js';
import { parse } from '../spip/parse.js';

/**
 * Document JSON → forme que l'éditeur renverra dans getJSON(), empreintes comprises.
 *
 * Le JSON passe par le schéma (nodeFromJSON puis check(), qui lève une exception si le contenu
 * viole le schéma), puis les empreintes spipHash sont recalculées sur la forme que l'éditeur
 * renverra dans getJSON() : attributs par défaut compris. Sans cela, un bloc non modifié dont
 * le schéma ajoute un attribut par défaut ne serait plus reconnu par la sérialisation
 * conservatrice.
 *
 * @param {object} json  document JSON (parse(), ou contenu d'une note)
 * @param {import('@tiptap/pm/model').Schema} schema
 * @returns {object} document JSON
 */
export function schemaJSON(json, schema) {
	const doc = schema.nodeFromJSON(json);
	doc.check();
	const out = doc.toJSON();
	const blocks = out.content ?? [];
	blocks.forEach((block, i) => {
		const group = block.attrs?.spipGroup;
		if (group) block.attrs.spipHash = canon(blocks.slice(i, i + group));
	});
	return out;
}

/**
 * Source SPIP → JSON prêt pour editor.commands.setContent().
 *
 * @param {string} source
 * @param {import('@tiptap/pm/model').Schema} schema
 * @param {object[]} [regles]  règles tierces de l'éditeur (editor.tiptapSpip.regles)
 * @returns {object} document JSON
 */
export const toEditorJSON = (source, schema, regles = []) => schemaJSON(parse(source, { empreintes: false, regles }), schema);
