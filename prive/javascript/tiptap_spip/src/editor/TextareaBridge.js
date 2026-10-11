import { serialize } from '../spip/serialize.js';
import { toEditorJSON } from './content.js';

/**
 * Synchronisation textarea ⇄ éditeur (spec 02 §4).
 * Le textarea reste la source de vérité pour la soumission du formulaire : l'éditeur ne fait
 * qu'en produire le contenu, et n'y écrit que si la sérialisation diffère.
 */
export class TextareaBridge {
	/**
	 * @param {{ textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor, delay?: number }} options
	 */
	constructor({ textarea, editor, delay = 150 }) {
		this.textarea = textarea;
		this.editor = editor;
		this.delay = delay;
		this.mode = 'visual';
		this.timer = null;
		this.dispatching = false;
		this.sourceDirty = false;

		this.onUpdate = () => this.schedule();
		this.onFlush = () => this.flush();
		this.onInput = () => {
			if (!this.dispatching && this.mode === 'source') this.sourceDirty = true;
		};

		editor.on('update', this.onUpdate);
		editor.on('blur', this.onFlush);
		textarea.addEventListener('input', this.onInput);
		textarea.form?.addEventListener('submit', this.onFlush, true);
		globalThis.window?.addEventListener('beforeunload', this.onFlush);
	}

	schedule() {
		clearTimeout(this.timer);
		this.timer = setTimeout(this.onFlush, this.delay);
	}

	/** Écrit la sérialisation dans le textarea si elle diffère, avec événements input et change. */
	flush() {
		clearTimeout(this.timer);
		this.timer = null;
		if (this.mode !== 'visual' || this.editor.isDestroyed) return;
		const value = serialize(this.editor.getJSON());
		if (value === this.textarea.value) return;
		this.textarea.value = value;
		this.dispatching = true;
		try {
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
			this.textarea.dispatchEvent(new Event('change', { bubbles: true }));
		} finally {
			this.dispatching = false;
		}
	}

	/** Recharge l'éditeur depuis le textarea, sans émettre de mise à jour (pas de réécriture). */
	load() {
		const json = toEditorJSON(this.textarea.value, this.editor.schema);
		this.editor.commands.setContent(json, { emitUpdate: false });
	}

	/**
	 * Bascule visuel ⇄ source. Au retour en visuel, l'éditeur est rechargé une seule fois si la
	 * source a changé. Renvoie false si la source n'est pas représentable (on reste en source).
	 * @param {'visual'|'source'} mode
	 * @returns {boolean}
	 */
	setMode(mode) {
		if (mode === this.mode) return true;
		if (mode === 'source') {
			this.flush();
			this.mode = 'source';
			this.sourceDirty = false;
			return true;
		}
		if (this.sourceDirty) {
			try {
				this.load();
			} catch (error) {
				console.warn('tiptap_spip : source non représentable, mode source conservé', error);
				return false;
			}
		}
		this.mode = 'visual';
		this.sourceDirty = false;
		return true;
	}

	destroy() {
		this.flush();
		this.editor.off('update', this.onUpdate);
		this.editor.off('blur', this.onFlush);
		this.textarea.removeEventListener('input', this.onInput);
		this.textarea.form?.removeEventListener('submit', this.onFlush, true);
		globalThis.window?.removeEventListener('beforeunload', this.onFlush);
		this.editor.destroy();
	}
}
