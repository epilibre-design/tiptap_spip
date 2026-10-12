import { apercu, partieAffichee } from '../editor/texte.js';
import { serializeIdiome } from '../spip/multi.js';
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

/**
 * Contenu inline affiché en texte, ses notes en appels numérotés (libellés de SpipNoteNumbers ;
 * numéro absent : appel vide).
 */
function texteEtAppels(content, labels = []) {
	const noeuds = [];
	let morceau = [];
	// apercu coupe les blancs de bord : ceux qui séparent un appel du texte sont gardés
	const ecrire = (avantAppel) => {
		const t = apercu(morceau);
		if (t) {
			const debut = noeuds.length && /^\s/.test(morceau[0].text ?? '') ? ' ' : '';
			const fin = avantAppel && /\s$/.test(morceau.at(-1).text ?? '') ? ' ' : '';
			noeuds.push(debut + t + fin);
		}
		morceau = [];
	};
	let i = 0;
	for (const c of content) {
		if (c.type !== 'spipNote') {
			morceau.push(c);
			continue;
		}
		ecrire(true);
		const appel = document.createElement('sup');
		appel.className = 'tts-note';
		if (c.attrs?.name != null) appel.dataset.ttsNoteName = c.attrs.name;
		appel.dataset.ttsLabel = labels[i++] ?? '';
		appel.title = apercu(c.attrs?.content);
		noeuds.push(appel);
	}
	ecrire(false);
	return noeuds;
}

/**
 * Multi dans une phrase : texte de la partie de la langue affichée (décoration de SpipLangues, sinon
 * langue de l'interface) avec ses appels de note (décoration de SpipNoteNumbers), toutes les parties
 * en infobulle.
 */
export const multiView = () => ({ node, decorations }) => {
	const dom = document.createElement('span');
	dom.className = 'tts-multi';
	dom.contentEditable = 'false';
	const render = (n, decos) => {
		const langue = decos?.find((d) => d.spec?.langue !== undefined)?.spec.langue;
		const notes = decos?.find((d) => d.spec?.notes)?.spec.notes;
		const parts = n.attrs.parts ?? [];
		const affichee = partieAffichee(parts, langue ?? undefined);
		dom.replaceChildren(...texteEtAppels(affichee?.content ?? [], notes));
		// mêmes attributs que renderHTML : le HTML de la vue se relit (copier-coller)
		dom.dataset.ttsMulti = JSON.stringify(parts);
		dom.dataset.ttsLang = affichee?.lang ?? '';
		dom.title = parts.map((p) => `${p.lang ?? '*'} : ${apercu(p.content)}`).join(' · ');
	};
	render(node, decorations);
	return {
		dom,
		update(updated, decos) {
			if (updated.type !== node.type) return false;
			render(updated, decos);
			return true;
		},
		ignoreMutation: () => true,
	};
};

/**
 * Idiome <:module:cle:> : traduction calculée par SPIP (opération idiomes), le raccourci en
 * infobulle ; le raccourci affiché tant qu'elle manque.
 * @param {{ idiomes: import('../services/cache.js').IdiomTranslations }} ui
 */
export const idiomeView = (ui) => ({ node }) => {
	const dom = document.createElement('code');
	dom.className = 'tts-idiome';
	dom.contentEditable = 'false';
	let raccourci = null;
	const render = (attrs) => {
		const r = serializeIdiome(attrs);
		if (r === raccourci) return;
		raccourci = r;
		dom.dataset.ttsIdiome = attrs.cle;
		if (attrs.module) dom.dataset.ttsModule = attrs.module;
		else delete dom.dataset.ttsModule;
		dom.textContent = r;
		dom.title = r;
		dom.classList.remove('tts-idiome--traduit');
		ui.idiomes.get(attrs.module ? `${attrs.module}:${attrs.cle}` : attrs.cle).then(
			(t) => {
				if (raccourci !== r || !t?.texte) return;
				dom.textContent = t.texte;
				dom.classList.add('tts-idiome--traduit');
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
