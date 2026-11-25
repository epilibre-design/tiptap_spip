import { placerDepuisRect } from '../ui/placement.js';
import { contexteSuggestions, enregistrerCoucheSuggestions } from './sessions.js';

let compteur = 0;

/** Liste inline : aucun focus pris, aucun filtrage métier, aucune mutation de document. */
export class ListeSuggestions {
	constructor({ editor, labels, onChoose, onDismiss }) {
		this.dom = editor.view.dom;
		this.labels = labels;
		this.onChoose = onChoose;
		this.actif = -1;
		this.detruite = false;
		const doc = this.dom.ownerDocument;
		this.element = doc.createElement('div');
		this.element.className = 'tts-suggestions';
		this.element.setAttribute('popover', 'manual');
		if (!this.element.showPopover) this.element.style.display = 'block';
		this.etat = doc.createElement('div');
		this.etat.setAttribute('role', 'status');
		this.liste = doc.createElement('div');
		this.liste.id = `tts-suggestions-${++compteur}`;
		this.liste.setAttribute('role', 'listbox');
		this.liste.setAttribute('aria-label', labels.suggestions);
		this.element.append(this.etat, this.liste);
		const contexte = contexteSuggestions(editor);
		(contexte.parent?.element ?? contexte.wrapper).append(this.element);
		this.element.showPopover?.();
		this.attributs = new Map(['aria-controls', 'aria-activedescendant', 'aria-autocomplete', 'aria-haspopup']
			.map((a) => [a, this.dom.getAttribute(a)]));
		this.dom.setAttribute('aria-controls', this.liste.id);
		this.dom.setAttribute('aria-autocomplete', 'list');
		this.dom.setAttribute('aria-haspopup', 'listbox');
		this.nettoyer = [enregistrerCoucheSuggestions({ editor, ...contexte, fermer: onDismiss })];
		const ecouter = (el, type, fn, capture = false) => {
			el.addEventListener(type, fn, capture);
			this.nettoyer.push(() => el.removeEventListener(type, fn, capture));
		};
		const dehors = (e) => {
			if (!e.composedPath().includes(this.element) && !e.composedPath().includes(this.dom)) onDismiss();
		};
		ecouter(doc, 'pointerdown', dehors, true);
		ecouter(doc, 'focusin', dehors, true);
		ecouter(doc.defaultView, 'resize', () => this.placer());
		ecouter(doc.defaultView, 'scroll', (e) => { if (!this.element.contains(e.target)) this.placer(); }, true);
	}

	update({ query, items = [], loading = false, error = false, clientRect }) {
		if (this.detruite) return;
		this.query = query;
		this.items = loading || error ? [] : items;
		this.actif = -1;
		this.rect = clientRect;
		this.dom.removeAttribute('aria-activedescendant');
		this.etat.textContent = loading ? this.labels.loading : error ? this.labels.error
			: this.items.length ? `${this.labels.suggestions} : ${this.items.length}` : this.labels.empty;
		this.etat.className = this.items.length ? 'tts-suggestions__annonce' : '';
		this.liste.hidden = !this.items.length;
		this.liste.replaceChildren();
		for (const [i, item] of this.items.entries()) {
			const option = this.dom.ownerDocument.createElement('div');
			option.className = 'tts-suggestions__option';
			option.id = `${this.liste.id}-${i}`;
			option.setAttribute('role', 'option');
			option.setAttribute('aria-selected', 'false');
			const titre = this.dom.ownerDocument.createElement('span'); titre.textContent = item.title;
			option.append(titre);
			if (item.subtext) {
				const sous = this.dom.ownerDocument.createElement('small'); sous.textContent = item.subtext;
				option.append(sous);
			}
			option.addEventListener('pointerdown', (e) => e.preventDefault());
			option.addEventListener('click', () => {
				if (!this.detruite && this.liste.contains(option)) this.onChoose(item);
			});
			this.liste.append(option);
		}
		this.placer();
	}

	placer() {
		if (this.detruite) return;
		placerDepuisRect(this.element, () => this.rect?.() ?? this.dom.getBoundingClientRect(), { ecart: 4 });
	}

	keydown(event) {
		if (this.detruite || event.isComposing || !this.items?.length) return false;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const sens = event.key === 'ArrowDown' ? 1 : -1;
			this.actif = this.actif < 0 ? (sens > 0 ? 0 : this.items.length - 1)
				: (this.actif + sens + this.items.length) % this.items.length;
			for (const [i, option] of [...this.liste.children].entries()) option.setAttribute('aria-selected', String(i === this.actif));
			const actif = this.liste.children[this.actif];
			this.dom.setAttribute('aria-activedescendant', actif.id);
			actif.scrollIntoView?.({ block: 'nearest' });
			return true;
		}
		if (event.key === 'Enter' && this.actif >= 0) {
			this.onChoose(this.items[this.actif]); return true;
		}
		return false;
	}

	destroy() {
		if (this.detruite) return;
		this.detruite = true;
		this.nettoyer.forEach((fn) => fn());
		this.element.hidePopover?.();
		this.element.remove();
		for (const [nom, valeur] of this.attributs) {
			if (valeur === null) this.dom.removeAttribute(nom);
			else this.dom.setAttribute(nom, valeur);
		}
	}
}
