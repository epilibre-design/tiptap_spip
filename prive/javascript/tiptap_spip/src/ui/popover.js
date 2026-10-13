/**
 * Popover de l'éditeur : petit dialogue ancré dans .tts-editor, près de la sélection. Échap ferme,
 * Entrée valide (spec 06 §4), Tab reste dans le popover (piège de focus, spec 06 §7), le focus revient
 * à l'éditeur à la fermeture.
 *
 * Un popover peut en ouvrir un autre (lien depuis le sous-éditeur d'une note) : l'enfant s'ouvre
 * sans fermer son parent ; fermé, il rend la main au parent ; le parent fermé ferme l'enfant.
 */
export class Popover {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, wrapper: HTMLElement, titre: string,
	 *           onSubmit: () => boolean|void, parent?: Popover, onClose?: () => void }} options
	 *        onSubmit renvoie false pour garder le popover ouvert ; editor : celui qui reprend le focus
	 */
	constructor({ editor, wrapper, titre, className, onSubmit, parent = null, onClose = null }) {
		this.editor = editor;
		this.wrapper = wrapper;
		this.parent = parent;
		this.enfant = null;
		this.onClose = onClose;
		this.ouvert = false;
		// dialogue : un div, un <form> ne pouvant pas porter role="dialog" (ARIA in HTML)
		this.element = document.createElement('div');
		this.element.className = 'tts-popover-dialogue';
		this.element.setAttribute('role', 'dialog');
		this.element.setAttribute('aria-label', titre);
		this.flottant = typeof this.element.showPopover === 'function';
		if (this.flottant) this.element.popover = 'manual';
		this.placementEnAttente = 0;
		this.replacer = () => {
			if (this.placementEnAttente) return;
			this.placementEnAttente = requestAnimationFrame(() => {
				this.placementEnAttente = 0;
				if (this.ouvert) this.place();
			});
		};
		this.auDefilement = (event) => {
			if (!this.element.contains(event.target)) this.replacer();
		};
		this.form = document.createElement('form');
		this.form.className = `tts-popover ${className ?? ''}`.trim();
		this.element.append(this.form);
		this.erreur = document.createElement('p');
		this.erreur.className = 'tts-popover__erreur';
		this.erreur.setAttribute('role', 'alert');
		this.erreur.hidden = true;
		this.actions = document.createElement('div');
		this.actions.className = 'tts-popover__actions';
		this.form.append(this.erreur, this.actions);
		this.form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (onSubmit() !== false) this.close();
		});
		this.form.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				this.close();
			} else if (event.key === 'Tab' && !event.defaultPrevented) {
				this.pieger(event);
			}
		});
	}

	/** Champ libellé ; renvoie l'élément de saisie. */
	field(texte, input) {
		const etiquette = document.createElement('label');
		etiquette.className = 'tts-popover__champ';
		const span = document.createElement('span');
		span.textContent = texte;
		etiquette.append(span, input);
		this.actions.before(etiquette);
		return input;
	}

	input(texte, { value = '', type = 'text', name } = {}) {
		const input = document.createElement('input');
		input.type = type;
		input.name = name ?? '';
		if (type === 'checkbox') input.checked = Boolean(value);
		else input.value = value ?? '';
		return this.field(texte, input);
	}

	/** Bouton d'action ; type submit pour l'action principale. */
	button(texte, onClick, { submit = false, name } = {}) {
		const bouton = document.createElement('button');
		bouton.type = submit ? 'submit' : 'button';
		bouton.textContent = texte;
		if (name) bouton.name = name;
		if (!submit) {
			bouton.addEventListener('click', () => {
				if (onClick() !== false) this.close();
			});
		}
		this.actions.append(bouton);
		return bouton;
	}

	/** Éléments du popover atteignables à la tabulation, dans l'ordre. */
	focusables() {
		return [...this.form.querySelectorAll('input, select, textarea, button, [contenteditable="true"], [tabindex]')]
			.filter((e) => e.tabIndex >= 0 && !e.disabled && !e.closest('[hidden]'));
	}

	/**
	 * Piège de focus (spec 06 §7) : Tab sur le dernier élément revient au premier, Maj+Tab sur le
	 * premier va au dernier. Une tabulation déjà traitée (liste du sous-éditeur d'une note) n'arrive pas ici.
	 */
	pieger(event) {
		const cibles = this.focusables();
		if (!cibles.length) return;
		const actif = this.form.ownerDocument.activeElement;
		const dedans = cibles.includes(actif);
		const cible = event.shiftKey
			? (!dedans || actif === cibles[0]) && cibles.at(-1)
			: (!dedans || actif === cibles.at(-1)) && cibles[0];
		if (!cible) return;
		event.preventDefault();
		cible.focus();
	}

	error(message) {
		this.erreur.textContent = message;
		this.erreur.hidden = !message;
	}

	open(focus) {
		// les popovers ouverts qui ne sont pas des ancêtres de celui-ci se ferment
		while (Popover.current && Popover.current !== this.parent) Popover.current.close({ refocus: false });
		if (this.parent) this.parent.enfant = this;
		Popover.current = this;
		this.ouvert = true;
		this.wrapper.append(this.element);
		if (this.flottant) this.element.showPopover();
		this.place();
		if (this.flottant) {
			window.addEventListener('resize', this.replacer);
			window.addEventListener('scroll', this.auDefilement, true);
		}
		(focus ?? this.form.querySelector('input, button'))?.focus();
	}

	/** Près de la sélection, dans la fenêtre si la couche supérieure est disponible. */
	place() {
		try {
			const { from } = this.editor.state.selection;
			const coords = this.editor.view.coordsAtPos(from);
			if (this.flottant) {
				const marge = 8;
				const ecart = 4;
				const defilement = this.element.scrollTop;
				Object.assign(this.element.style, { left: '0px', top: '0px', maxHeight: '', overflowY: '' });
				const rect = this.element.getBoundingClientRect();
				const barre = this.wrapper.querySelector('.tts-toolbar')?.getBoundingClientRect();
				const haut = (barre && barre.top <= 1 && barre.bottom > 0 ? barre.bottom : 0) + marge;
				const bas = window.innerHeight - marge;
				const dessous = Math.max(0, bas - Math.max(haut, coords.bottom + ecart));
				const dessus = Math.max(0, Math.min(coords.top - ecart, bas) - haut);
				const versHaut = rect.height > dessous && dessus > dessous;
				const hauteur = versHaut ? dessus : dessous;
				const gauche = Math.max(marge, Math.min(coords.left, document.documentElement.clientWidth - marge - rect.width));
				this.element.style.left = `${gauche}px`;
				const hauteurAffichee = Math.min(rect.height, hauteur);
				const position = versHaut ? coords.top - ecart - hauteurAffichee : coords.bottom + ecart;
				this.element.style.top = `${Math.max(haut, Math.min(position, bas - hauteurAffichee))}px`;
				if (rect.height > hauteur) {
					this.element.style.maxHeight = `${hauteur}px`;
					this.element.style.overflowY = 'auto';
				}
				this.element.scrollTop = defilement;
				return;
			}
			const box = this.wrapper.getBoundingClientRect();
			this.form.style.left = `${Math.max(0, coords.left - box.left)}px`;
			this.form.style.top = `${coords.bottom - box.top + 4}px`;
		} catch {
			// jsdom : pas de géométrie
		}
	}

	close({ refocus = true } = {}) {
		if (!this.ouvert) return;
		this.ouvert = false;
		this.enfant?.close({ refocus: false });
		if (Popover.current === this) Popover.current = this.parent;
		if (this.parent?.enfant === this) this.parent.enfant = null;
		if (this.flottant) {
			window.removeEventListener('resize', this.replacer);
			window.removeEventListener('scroll', this.auDefilement, true);
			if (this.placementEnAttente) cancelAnimationFrame(this.placementEnAttente);
			this.placementEnAttente = 0;
			this.element.hidePopover();
		}
		this.element.remove();
		// focus rendu tout de suite (la commande focus de Tiptap attend l'image suivante) : une touche
		// pressée juste après agit dans l'éditeur, sur la sélection gardée
		if (refocus && !this.editor.isDestroyed) this.editor.view.focus();
		this.onClose?.();
	}
}
Popover.current = null;

/**
 * Suit une position à travers les transactions de l'éditeur (appel au serveur, popover ouvert).
 * `pos()` donne la position à jour, null si ce qui la suivait a été supprimé ; `fin()` arrête le
 * suivi et renvoie la position.
 */
export function suivrePosition(editor, pos) {
	let courante = pos;
	const onTransaction = ({ transaction }) => {
		if (courante === null) return;
		const r = transaction.mapping.mapResult(courante, 1);
		courante = r.deletedAfter ? null : r.pos;
	};
	editor.on('transaction', onTransaction);
	return {
		pos: () => courante,
		fin() {
			editor.off('transaction', onTransaction);
			return courante;
		},
	};
}

/**
 * ProseMirror lit la sélection du navigateur sur « selectionchange », asynchrone dans Chromium : un
 * raccourci qui suit de près Maj+flèches verrait l'ancienne sélection. On la lui fait lire maintenant.
 */
export function lireSelection(editor) {
	if (editor.view.hasFocus()) editor.view.domObserver?.flush?.();
}

/** Identifiant d'élément unique dans la page. */
export const idUnique = (prefixe) => `${prefixe}-${Math.random().toString(36).slice(2)}`;
