/**
 * Popover de l'éditeur : petit dialogue non modal ancré dans .tts-editor, près de la sélection.
 * Échap ferme, Entrée valide (spec 06 §4), le focus revient à l'éditeur à la fermeture.
 */
export class Popover {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, wrapper: HTMLElement, titre: string,
	 *           onSubmit: () => boolean|void }} options  onSubmit renvoie false pour garder le popover ouvert
	 */
	constructor({ editor, wrapper, titre, className, onSubmit }) {
		this.editor = editor;
		this.wrapper = wrapper;
		this.form = document.createElement('form');
		this.form.className = `tts-popover ${className ?? ''}`.trim();
		this.form.setAttribute('role', 'dialog');
		this.form.setAttribute('aria-label', titre);
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

	error(message) {
		this.erreur.textContent = message;
		this.erreur.hidden = !message;
	}

	open(focus) {
		Popover.current?.close({ refocus: false });
		Popover.current = this;
		this.wrapper.append(this.form);
		this.place();
		(focus ?? this.form.querySelector('input, button'))?.focus();
	}

	/** Sous la sélection, dans le repère de .tts-editor (sans effet sans moteur de mise en page). */
	place() {
		try {
			const { from } = this.editor.state.selection;
			const coords = this.editor.view.coordsAtPos(from);
			const box = this.wrapper.getBoundingClientRect();
			this.form.style.left = `${Math.max(0, coords.left - box.left)}px`;
			this.form.style.top = `${coords.bottom - box.top + 4}px`;
		} catch {
			// jsdom : pas de géométrie
		}
	}

	close({ refocus = true } = {}) {
		if (Popover.current === this) Popover.current = null;
		this.form.remove();
		if (refocus && !this.editor.isDestroyed) this.editor.commands.focus();
	}
}
Popover.current = null;
