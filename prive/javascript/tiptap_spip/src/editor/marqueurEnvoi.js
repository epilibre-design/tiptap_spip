import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { parseModel } from '../spip/models.js';
import { label } from '../ui/labels.js';

/**
 * Marqueurs d'envoi des images collées (spec 10 §3) : décorations, jamais des nœuds. Le document,
 * sa sérialisation, le textarea et l'historique ne les contiennent pas. Le plugin suit lui-même la
 * position de chaque marqueur : reportée à chaque transaction, repliée sur le point le plus proche si
 * le texte autour est supprimé (une décoration de ProseMirror disparaîtrait avec lui).
 */
export const cleMarqueurs = new PluginKey('spipUploadPlaceholder');

function widget(id) {
	const element = document.createElement('span');
	element.className = 'tts-envoi';
	element.dataset.ttsEnvoi = id;
	element.contentEditable = 'false';
	const barre = document.createElement('progress');
	barre.max = 1;
	element.append(label('image_envoi'), ' ', barre);
	return element;
}

const plugin = (ui) => new Plugin({
	key: cleMarqueurs,
	state: {
		init: () => new Map(),
		apply(tr, marqueurs) {
			const meta = tr.getMeta(cleMarqueurs);
			if (!tr.docChanged && !meta) return marqueurs;
			const suite = new Map();
			for (const [id, pos] of marqueurs) suite.set(id, tr.mapping.map(pos));
			for (const { id, pos } of meta?.ajouter ?? []) suite.set(id, pos);
			for (const id of meta?.retirer ?? []) suite.delete(id);
			return suite;
		},
	},
	props: {
		decorations(state) {
			const marqueurs = cleMarqueurs.getState(state);
			if (!marqueurs.size) return null;
			// key : le même élément est gardé d'un rendu à l'autre (progression)
			return DecorationSet.create(state.doc, [...marqueurs].map(([id, pos]) => Decoration.widget(pos, () => widget(id), { key: id })));
		},
		// collage d'images (spec 10 §3) : décidé à chaque collage par l'instance (services, disponibilité)
		handlePaste: (view, event) => ui?.collerImages?.(view, event) ?? false,
	},
});

/**
 * Marqueurs après la sélection, dans l'ordre des ids : le texte sélectionné est conservé, comme avec
 * Crayons (son envoi ne touche pas au texte).
 */
export function ajouterMarqueurs(view, ids) {
	const pos = view.state.selection.to;
	view.dispatch(view.state.tr.setMeta(cleMarqueurs, { ajouter: ids.map((id) => ({ id, pos })) }).setMeta('addToHistory', false));
}

export const positionMarqueur = (state, id) => cleMarqueurs.getState(state)?.get(id) ?? null;

export function retirerMarqueurs(view, ids) {
	view.dispatch(view.state.tr.setMeta(cleMarqueurs, { retirer: ids }).setMeta('addToHistory', false));
}

/**
 * Remplace le marqueur par le modèle `source` (<docN>), en une transaction : une étape d'historique.
 * @returns {boolean} false si le marqueur n'existe plus
 */
export function remplacerMarqueur(editor, id, source) {
	const pos = positionMarqueur(editor.state, id);
	if (pos === null) return false;
	return editor.chain()
		.command(({ tr }) => {
			tr.setMeta(cleMarqueurs, { retirer: [id] });
			return true;
		})
		.insertContentAt(pos, { type: 'spipModel', attrs: { model: parseModel(source) } }, { updateSelection: false })
		.run();
}

/** Progression de l'envoi (0 à 1) ; null : indéterminée. */
export function progressionMarqueur(view, id, ratio) {
	const barre = view.dom.querySelector(`[data-tts-envoi="${id}"] progress`);
	if (barre && ratio !== null) barre.value = ratio;
}

/** Capture du collage d'images et marqueurs d'envoi (spec 10 §3). */
export const SpipPasteImage = Extension.create({
	name: 'spipPasteImage',
	addOptions: () => ({ ui: null }),
	addProseMirrorPlugins() {
		return [plugin(this.options.ui)];
	},
});
