import { Editor, getSchema } from '@tiptap/core';
import { toEditorJSON } from './content.js';
import { coreExtensions } from './extensions.js';

/**
 * Crée un éditeur Tiptap pour une source SPIP.
 * Lève une exception si la source donne un contenu invalide pour le schéma : l'appelant laisse
 * alors le textarea tel quel (jamais d'édition d'un contenu que l'éditeur altérerait).
 *
 * @param {{ element: HTMLElement, source: string, extensions?: object[], editorProps?: object }} options
 * @returns {Editor}
 */
export function createEditor({ element, source, extensions = coreExtensions(), editorProps = {} }) {
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
