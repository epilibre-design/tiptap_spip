import { Editor, getSchema } from '@tiptap/core';
import { toEditorJSON } from './content.js';
import { coreExtensions } from './extensions.js';

/**
 * Crée un éditeur Tiptap pour une source SPIP.
 * Lève une exception si la source donne un contenu invalide pour le schéma : l'appelant laisse
 * alors le textarea tel quel (jamais d'édition d'un contenu que l'éditeur altérerait).
 *
 * @param {{ element: HTMLElement, source: string, ui?: object, extensions?: object[], editorProps?: object }} options
 *        ui : interface de l'instance (cf. coreExtensions)
 * @returns {Editor}
 */
export function createEditor({ element, source, ui = null, extensions = coreExtensions({ ui }), editorProps = {} }) {
	const content = toEditorJSON(source, getSchema(extensions));
	return new Editor({
		element,
		extensions,
		content,
		editorProps,
		enableContentCheck: true,
		onContentError: ({ error }) => {
			throw error;
		},
	});
}
