import { LinkTitles, ModelPreviews } from '../services/cache.js';
import { openLinkPopover } from './LinkPopover.js';
import { openAbbrPopover, openGlossaryPopover } from './MarkPopover.js';
import { openModelPopover } from './ModelPopover.js';
import { openNotePopover } from './NotePopover.js';

/**
 * Interface d'une instance d'éditeur, transmise aux extensions (coreExtensions({ ui })) : caches des
 * services et ouverture des popovers.
 *
 * @param {{ editor: () => import('@tiptap/core').Editor, wrapper: HTMLElement,
 *           services: ?object|Promise<?object> }} options  editor : l'éditeur, créé après l'interface ;
 *        services : éventuellement une promesse (formulaire chargé à la demande) ; null : mode dégradé
 */
export function creerInterface({ editor, wrapper, services }) {
	const contexte = () => ({ editor: editor(), wrapper, services, titles: ui.titles, previews: ui.previews });
	const ui = {
		previews: services ? new ModelPreviews(services) : null,
		titles: services ? new LinkTitles(services) : null,
		openLink: () => openLinkPopover(contexte()),
		editModel: (pos) => openModelPopover(contexte(), pos),
		editNote: (pos) => openNotePopover(contexte(), pos),
		openGlossary: () => openGlossaryPopover(contexte()),
		openAbbr: () => openAbbrPopover(contexte()),
	};
	return ui;
}
