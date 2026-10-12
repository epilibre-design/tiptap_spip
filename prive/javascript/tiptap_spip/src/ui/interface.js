import { IdiomTranslations, LinkTitles, ModelPreviews } from '../services/cache.js';
import { ouvrirCatalogue, parametresFormulaire } from './catalogue.js';
import { openLinkPopover } from './LinkPopover.js';
import { openAbbrPopover, openGlossaryPopover } from './MarkPopover.js';
import { openModelPopover } from './ModelPopover.js';
import { openIdiomePopover, openMultiPopover } from './MultiPopover.js';
import { openNotePopover } from './NotePopover.js';
import { openRawPopover } from './RawPopover.js';

/**
 * Interface d'une instance d'éditeur, transmise aux extensions (coreExtensions({ ui })) : caches des
 * services et ouverture des popovers.
 *
 * @param {{ editor: () => import('@tiptap/core').Editor, wrapper: HTMLElement,
 *           services: ?object|Promise<?object> }} options  editor : l'éditeur, créé après l'interface ;
 *        services : éventuellement une promesse (formulaire chargé à la demande) ; null : mode dégradé ;
 *        catalogue : { url, modeles } du plugin Insérer modèles (catalogue.js), null sans lui
 */
export function creerInterface({ editor, wrapper, services, catalogue = null }) {
	const contexte = () => ({ editor: editor(), wrapper, services, titles: ui.titles, previews: ui.previews });
	/**
	 * Modèle à `pos` dans le formulaire du catalogue, prérempli, si tous ses paramètres y ont un champ ;
	 * false sinon (saisie brute).
	 */
	const modifierParCatalogue = (pos) => {
		const model = pos === null ? null : editor().state.doc.nodeAt(pos)?.attrs.model;
		const description = model && catalogue?.modeles[model.name];
		const parametres = description && parametresFormulaire(model, description);
		return Boolean(parametres) && ouvrirCatalogue({ editor: editor(), url: catalogue.url, pos, parametres });
	};
	const ui = {
		catalogue,
		previews: services ? new ModelPreviews(services) : null,
		titles: services ? new LinkTitles(services) : null,
		idiomes: services ? new IdiomTranslations(services) : null,
		openLink: () => openLinkPopover(contexte()),
		// Modifier (NodeView) : formulaire du catalogue s'il couvre le modèle ; bouton sans catalogue et
		// Mod-Alt-M : saisie brute
		editModel: (pos) => modifierParCatalogue(pos) || openModelPopover(contexte(), pos),
		openCatalogue: () => (catalogue && ouvrirCatalogue({ editor: editor(), url: catalogue.url })) || openModelPopover(contexte(), null),
		editNote: (pos) => openNotePopover(contexte(), pos),
		openGlossary: () => openGlossaryPopover(contexte()),
		openAbbr: () => openAbbrPopover(contexte()),
		editMulti: (pos) => openMultiPopover(contexte(), pos),
		editIdiome: (pos) => openIdiomePopover(contexte(), pos),
		editRaw: (pos) => openRawPopover(contexte(), pos),
	};
	return ui;
}
