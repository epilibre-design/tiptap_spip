import { label } from '../ui/labels.js';
import { previewFragment } from '../ui/sanitize.js';

/**
 * NodeViews des nœuds qui dépendent des services serveur : prévisualisation des modèles (spec 05 §3)
 * et titre des liens sans texte (spec 05 §4). Sans réponse du serveur, ils gardent l'affichage
 * compact (raccourci, cible).
 */

const chip = (text) => {
	const span = document.createElement('span');
	span.className = 'tts-chip';
	span.textContent = text;
	return span;
};

/**
 * Modèle (spipModel, spipModelBlock) : HTML calculé par SPIP, inerte ; bouton « Modifier ».
 * @param {{ previews: import('../services/cache.js').ModelPreviews, editModel: (pos: number) => void }} ui
 */
export const modelView = (ui) => ({ node, getPos }) => {
	const block = node.type.name === 'spipModelBlock';
	const dom = document.createElement(block ? 'div' : 'span');
	dom.className = `tts-model${block ? ' tts-model-block' : ''}`;
	dom.contentEditable = 'false';
	const preview = document.createElement(block ? 'div' : 'span');
	preview.className = 'tts-model__preview';
	const bouton = document.createElement('button');
	bouton.type = 'button';
	bouton.className = 'tts-model__modifier';
	bouton.textContent = label('modele_modifier');
	bouton.addEventListener('click', () => ui.editModel(getPos()));
	dom.append(preview, bouton);

	let source = null;
	const render = (model) => {
		if (model?.source === source) return;
		source = model?.source ?? '';
		dom.dataset.ttsModel = JSON.stringify(model);
		dom.title = source;
		preview.replaceChildren(chip(source));
		dom.classList.add('tts-model--chargement');
		dom.classList.remove('tts-model--erreur', 'tts-model--vide');
		const demande = source;
		ui.previews.get(demande).then(
			(html) => {
				if (demande !== source) return;
				dom.classList.remove('tts-model--chargement');
				const fragment = previewFragment(html);
				if (fragment.textContent.trim() === '' && !fragment.querySelector('img, svg, iframe, video, audio')) {
					dom.classList.add('tts-model--vide');
					return;
				}
				preview.replaceChildren(fragment);
			},
			() => {
				if (demande !== source) return;
				dom.classList.remove('tts-model--chargement');
				dom.classList.add('tts-model--erreur');
			},
		);
	};
	render(node.attrs.model);

	return {
		dom,
		update(updated) {
			if (updated.type !== node.type) return false;
			render(updated.attrs.model);
			return true;
		},
		// le bouton gère ses événements ; le reste (clic, glisser) revient à ProseMirror
		stopEvent: (event) => event.target === bouton,
		ignoreMutation: () => true,
	};
};

/**
 * Lien sans texte [->cible] : titre que SPIP affichera, jamais écrit dans la source.
 * @param {{ titles: import('../services/cache.js').LinkTitles }} ui
 */
export const linkAutoView = (ui) => ({ node }) => {
	const dom = document.createElement('a');
	dom.className = 'tts-link tts-link-auto';
	dom.contentEditable = 'false';
	let cible = null;
	const render = (attrs) => {
		if (attrs.href === cible) return;
		cible = attrs.href;
		dom.dataset.ttsHref = cible;
		dom.textContent = `→ ${cible}`;
		dom.title = cible;
		const demande = cible;
		ui.titles.get(demande).then(
			(r) => {
				if (demande === cible && r?.titre) dom.textContent = r.titre;
			},
			() => {},
		);
	};
	render(node.attrs);
	return {
		dom,
		update(updated) {
			if (updated.type !== node.type) return false;
			render(updated.attrs);
			return true;
		},
		ignoreMutation: () => true,
	};
};
