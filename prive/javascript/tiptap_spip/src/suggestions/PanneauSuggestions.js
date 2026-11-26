import { placerDepuisRect } from '../ui/placement.js';
import { contexteSuggestions, enregistrerCoucheSuggestions, fermerSuggestions, lierContexteSuggestions } from './sessions.js';

let compteur = 0;
const SELECTEUR = 'button, input, select, textarea, a[href], summary, iframe, [contenteditable="true"], [tabindex]';

/** Fabrique d'ouverture pour une interface dont l'éditeur est créé après elle. */
export const creerOuvreurPanneau = (editor, contexte) => (options) => {
	const cible = editor();
	if (!cible || cible.isDestroyed) return null;
	lierContexteSuggestions(cible, contexte);
	return ouvrirPanneauSuggestions({ ...options, editor: cible });
};

/** Voisin logique du déclencheur ; les contrôles privés du composant ne sont jamais parcourus. */
function voisin(editor, contexte, origine, sens) {
	const depart = origine.trigger ?? editor.view.dom;
	const scope = contexte.parent?.form ?? depart.ownerDocument.body;
	const cibles = [...scope.querySelectorAll(SELECTEUR)].filter((e) => {
		const summary = e.tagName === 'SUMMARY' && e.parentElement?.tagName === 'DETAILS'
			&& !e.hasAttribute('tabindex') && [...e.parentElement.children].find((c) => c.tagName === 'SUMMARY') === e;
		if ((e.tabIndex < 0 && !summary) || e.disabled || e.closest('[hidden], [inert], .tts-suggestions-panneau')
			|| getComputedStyle(e).visibility === 'hidden') return false;
		for (let ancetre = e; ancetre; ancetre = ancetre.parentElement) {
			if (getComputedStyle(ancetre).display === 'none') return false;
		}
		return true;
	});
	const i = cibles.indexOf(depart);
	if (i >= 0) return cibles[i + sens] ?? (contexte.parent ? (sens > 0 ? cibles[0] : cibles.at(-1)) : depart);
	const suivants = cibles.filter((e) => depart.compareDocumentPosition(e) & (sens > 0 ? 4 : 2));
	return (sens > 0 ? suivants[0] : suivants.at(-1)) ?? depart;
}

/** Enveloppe non modale, indépendante du singleton Popover ; aucun formulaire. */
export function ouvrirPanneauSuggestions({ editor, anchor, origin = {}, content, label, onClose }) {
	const contexte = contexteSuggestions(editor);
	if (!contexte || editor.isDestroyed || !editor.isEditable || editor.view.dom.closest('[hidden]')) return null;
	fermerSuggestions({ reason: 'replacement' });
	const { wrapper, parent } = contexte;
	const doc = editor.view.dom.ownerDocument;
	const element = doc.createElement('div');
	element.className = 'tts-suggestions-panneau';
	element.id = `tts-suggestions-panneau-${++compteur}`;
	element.setAttribute('popover', 'manual');
	// jsdom et anciens moteurs : l'attribut peut masquer la couche sans fournir l'API.
	if (typeof element.showPopover !== 'function') element.style.display = 'block';
	element.setAttribute('role', 'dialog');
	element.setAttribute('aria-label', label);
	const corps = doc.createElement('div');
	corps.className = 'tts-suggestions-panneau__corps';
	corps.tabIndex = -1;
	corps.setAttribute('role', 'group');
	corps.setAttribute('aria-label', label);
	let ouvert = true;
	let delier;
	const ecoutes = [];
	const ecouter = (cible, type, fn, capture = false) => {
		cible.addEventListener(type, fn, capture);
		ecoutes.push(() => cible.removeEventListener(type, fn, capture));
	};
	const trigger = origin.trigger;
	const boutonOrigine = trigger?.matches('button, [role="button"]') ? trigger : null;
	const ancienControls = boutonOrigine?.getAttribute('aria-controls');
	const fermer = ({ reason = 'cancel', refocus = true } = {}) => {
		if (!ouvert) return;
		ouvert = false;
		delier?.();
		ecoutes.forEach((retirer) => retirer());
		element.hidePopover?.();
		element.remove();
		if (boutonOrigine) {
			boutonOrigine.setAttribute('aria-expanded', 'false');
			if (ancienControls === null) boutonOrigine.removeAttribute('aria-controls');
			else boutonOrigine.setAttribute('aria-controls', ancienControls);
		}
		// Annulation/rejet de l'inline doit être appliqué avant tout retour du focus.
		onClose?.({ reason });
		if (refocus && !editor.isDestroyed) {
			const cible = origin.returnTarget ?? trigger ?? editor.view.dom;
			if (cible.isConnected) {
				if (cible === editor.view.dom) editor.view.focus();
				else cible.focus();
			}
		}
	};
	const sentinelle = (sens) => {
		const el = doc.createElement('span');
		el.tabIndex = 0;
		el.className = 'tts-suggestions-sentinelle';
		ecouter(el, 'focus', () => {
			const cible = voisin(editor, contexte, origin, sens);
			fermer({ reason: 'tab', refocus: false });
			if (cible?.isConnected) cible.focus();
		});
		return el;
	};
	element.append(sentinelle(-1), corps, sentinelle(1));
	(parent?.element ?? wrapper).append(element);
	delier = enregistrerCoucheSuggestions({ editor, wrapper, parent, fermer });
	if (boutonOrigine) {
		boutonOrigine.setAttribute('aria-expanded', 'true');
		boutonOrigine.setAttribute('aria-controls', element.id);
	}
	element.showPopover?.();
	const lireRect = typeof anchor === 'function' ? anchor : () => (anchor ?? editor.view.dom).getBoundingClientRect();
	const placer = () => {
		if (!ouvert) return;
		placerDepuisRect(element, lireRect, { ecart: 4 });
	};
	placer();
	const clavier = (event) => {
		if (event.isComposing) return;
		if (event.key === 'Escape') {
			event.preventDefault(); event.stopPropagation();
			fermer({ reason: 'escape' });
		} else if (event.key === 'Enter') {
			// Laisser les contrôles du Shadow DOM agir, sans validation de formulaire extérieur.
			event.stopPropagation();
			const cible = event.composedPath()[0];
			if (cible.form && !(cible.tagName === 'BUTTON' && cible.type === 'button')) event.preventDefault();
		}
	};
	ecouter(element, 'keydown', clavier);
	ecouter(doc, 'keydown', (event) => {
		if (event.key === 'Escape' && doc.activeElement === doc.body) clavier(event);
	});
	const dehors = (event) => {
		if (!event.composedPath().includes(element)) fermer({ reason: 'outside', refocus: false });
	};
	ecouter(doc, 'pointerdown', dehors, true);
	ecouter(doc, 'focusin', dehors, true);
	ecouter(doc.defaultView, 'resize', placer);
	ecouter(doc.defaultView, 'scroll', (e) => { if (!element.contains(e.target)) placer(); }, true);
	const remplacer = (contenu) => {
		if (!ouvert) return;
		corps.replaceChildren(contenu);
		for (const bouton of corps.querySelectorAll('button')) bouton.type = 'button';
		placer();
		(corps.querySelector('input[type="search"]') ?? corps).focus();
	};
	const Observer = doc.defaultView.ResizeObserver;
	if (Observer) {
		const observer = new Observer(placer);
		observer.observe(corps);
		observer.observe(element);
		ecoutes.push(() => observer.disconnect());
	}
	remplacer(content);
	return { element, corps, fermer, remplacer, placer };
}
