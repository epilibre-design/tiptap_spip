import { Editor, getSchema } from '@tiptap/core';
import { toEditorJSON } from './content.js';
import { coreExtensions } from './extensions.js';
import { reglesSpip } from './regles.js';

/**
 * Crée un éditeur Tiptap pour une source SPIP.
 * Lève une exception si la source donne un contenu invalide pour le schéma : l'appelant laisse
 * alors le textarea tel quel (jamais d'édition d'un contenu que l'éditeur altérerait).
 *
 * L'éditeur porte `tiptapSpip = { regles, tierces }` : règles SPIP de ses extensions (lecture et
 * écriture de la source, cf. src/editor/regles.js) et extensions tierces (reprises par les
 * sous-éditeurs de note et de multi).
 *
 * @param {{ element: HTMLElement, source: string, ui?: object, tierces?: object[], extensions?: object[], editorProps?: object }} options
 *        ui : interface de l'instance (cf. coreExtensions) ; tierces : extensions des plugins (spec 07)
 * @returns {Editor}
 */
export function createEditor({ element, source, ui = null, tierces = [], extensions = coreExtensions({ ui, tierces }), editorProps = {} }) {
	const regles = reglesSpip(extensions);
	const content = toEditorJSON(source, getSchema(extensions), regles);
	const editor = new Editor({
		element,
		extensions,
		content,
		editorProps,
		enableContentCheck: true,
		onContentError: ({ error }) => {
			throw error;
		},
	});
	editor.tiptapSpip = { regles, tierces };
	return editor;
}
