import { config } from '../config.js';
import { emojiAutorise, insererEmoji } from '../emojis/insertion.js';
import { lireSelection, suivrePosition } from './popover.js';
import 'emoji-picker-element/picker';
import frEmoji from 'emoji-picker-element/i18n/fr';
import enEmoji from 'emoji-picker-element/i18n/en';
import { ouvrirPickerEmoji } from '../emojis/PickerEmoji.js';
import { lierContexteSuggestions } from '../suggestions/sessions.js';
import { IdiomTranslations, LinkTitles, ModelPreviews } from '../services/cache.js';
import { ouvrirCatalogue, parametresFormulaire } from './catalogue.js';
import { openLinkPopover } from './LinkPopover.js';
import { openAbbrPopover, openGlossaryPopover } from './MarkPopover.js';
import { openModelPopover } from './ModelPopover.js';
import { openIdiomePopover, openMultiPopover } from './MultiPopover.js';
import { openNotePopover } from './NotePopover.js';
import { openRawPopover } from './RawPopover.js';
import { creerOuvreurPanneau } from '../suggestions/PanneauSuggestions.js';

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
	const ouvrirEmoji = (cible, parent, origin = {}) => {
		if (!cible || cible.isDestroyed) return null;
		lireSelection(cible);
		const range = origin.range ?? { from: cible.state.selection.from, to: cible.state.selection.to };
		if (!emojiAutorise({ editor: cible, range })) return null;
		const debut = origin.onChoose ? null : suivrePosition(cible, range.from);
		const fin = origin.onChoose ? null : suivrePosition(cible, range.to);
		const terminer = (raison) => { debut?.fin(); fin?.fin(); origin.onClose?.(raison); };
		lierContexteSuggestions(cible, { wrapper, parent });
		const panneau = ouvrirPickerEmoji({ editor: cible, anchor: origin.anchor ?? origin.trigger, origin,
			range, onChoose: origin.onChoose ?? ((unicode) => insererEmoji({ editor: cible,
				range: { from: debut.pos(), to: fin.pos() }, unicode })), onClose: terminer,
			i18n: (config().lang ?? wrapper.ownerDocument.documentElement.lang).startsWith('en') ? enEmoji : frEmoji });
		if (!panneau) terminer({ reason: 'unavailable' });
		return panneau;
	};
	const contexte = () => ({ editor: editor(), wrapper, services, titles: ui.titles, previews: ui.previews, ouvrirEmoji });
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
		openSuggestionsPanel: creerOuvreurPanneau(editor, { wrapper }),
		openEmoji: (origin) => ouvrirEmoji(editor(), null, origin),
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
