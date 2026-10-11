import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { TextareaBridge } from './editor/TextareaBridge.js';
import { Services } from './services/cvt.js';

/**
 * Textareas équipés (spec 02 §6) : ceux du porte-plume (classes, et champ texte des formulaires
 * SPIP comme le fait son option inserer_auto_name_texte) ou data-tts-toolbar.
 */
const SELECTOR = [
	'textarea.inserer_barre_edition',
	'textarea.inserer_barre_forum',
	'.formulaire_spip textarea[name="texte"]',
	'textarea[data-tts-toolbar]',
].join(', ');

/** Textareas pris par markdown_editor : jamais touchés. */
const MARKDOWN_EDITOR = '[class*="inserer_md_barre"], [data-md-editor-toolbar]';

/** Éditeurs montés dans la page. */
export const instances = new Set();

const config = () => globalThis.spipConfig?.tiptap_spip ?? {};
const label = (key, fallback) => config().i18n?.[key] ?? fallback;

let observer = null;

/** Détruit les éditeurs dont le textarea a quitté le DOM (rechargement AJAX, crayon fermé). */
function watchRemovals() {
	if (observer || typeof MutationObserver === 'undefined') return;
	observer = new MutationObserver(() => {
		for (const instance of [...instances]) {
			if (!instance.wrapper.isConnected) instance.destroy({ restore: false });
		}
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

/** Retire le porte-plume du textarea : avant son lancement (classes) ou après (markItUp). */
function releasePortePlume(textarea) {
	textarea.classList.add('no_barre', 'no_previsualisation');
	const $ = globalThis.jQuery;
	if (textarea.classList.contains('markItUpEditor') && $?.fn?.markItUpRemove) $(textarea).markItUpRemove();
}

class Instance {
	constructor(textarea, { createEditor }) {
		this.textarea = textarea;
		const rows = Number(textarea.getAttribute('rows')) || 10;

		this.wrapper = document.createElement('div');
		this.wrapper.className = 'tts-editor';
		const toolbar = document.createElement('div');
		toolbar.className = 'tts-toolbar';
		this.modeButton = document.createElement('button');
		this.modeButton.type = 'button';
		this.modeButton.className = 'tts-mode';
		this.modeButton.textContent = label('mode_source', 'Source');
		this.modeButton.setAttribute('aria-pressed', 'false');
		toolbar.append(this.modeButton);
		this.content = document.createElement('div');
		this.content.className = 'tts-content';
		this.wrapper.append(toolbar, this.content);

		// l'éditeur est créé avant de toucher au DOM : en cas d'échec, rien n'a changé
		this.editor = createEditor({
			element: this.content,
			source: textarea.value,
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em` } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });
		// formulaire de services du champ (null : mode dégradé, sans services serveur)
		this.services = Services.forTextarea(textarea);

		textarea.before(this.wrapper);
		this.wrapper.append(textarea);
		textarea.hidden = true;
		this.modeButton.addEventListener('click', () => this.toggleMode());
	}

	toggleMode() {
		const mode = this.bridge.mode === 'visual' ? 'source' : 'visual';
		if (!this.bridge.setMode(mode)) return;
		const source = mode === 'source';
		this.textarea.hidden = !source;
		this.content.hidden = source;
		this.modeButton.setAttribute('aria-pressed', String(source));
		(source ? this.textarea : this.editor).focus?.();
	}

	/** @param {{ restore?: boolean }} options  restore : remettre le textarea à sa place */
	destroy({ restore = true } = {}) {
		instances.delete(this);
		this.bridge.destroy();
		if (restore && this.wrapper.isConnected) {
			this.wrapper.before(this.textarea);
			this.wrapper.remove();
			this.textarea.hidden = false;
			delete this.textarea.dataset.ttsMounted;
		}
	}
}

/**
 * Monte l'éditeur sur les textareas équipés de `racine` (document par défaut). Idempotent :
 * appelée au chargement puis à chaque onAjaxLoad (rechargements AJAX de SPIP et Crayons).
 *
 * @param {ParentNode|{ jquery: string, 0: ParentNode }} [racine]
 * @param {{ createEditor?: typeof defaultCreateEditor }} [options]
 */
export function tiptap_spip_init(racine = document, { createEditor = defaultCreateEditor } = {}) {
	// onAjaxLoad passe la racine rechargée dans this, parfois sous forme d'objet jQuery
	const node = racine?.jquery ? racine[0] : racine;
	const root = node?.querySelectorAll ? node : document;
	for (const textarea of root.querySelectorAll(SELECTOR)) {
		if (textarea.dataset.ttsMounted || textarea.matches(MARKDOWN_EDITOR)) continue;
		textarea.dataset.ttsMounted = 'oui';
		releasePortePlume(textarea);
		try {
			instances.add(new Instance(textarea, { createEditor }));
		} catch (error) {
			textarea.dataset.ttsMounted = 'erreur';
			console.warn('tiptap_spip : éditeur non monté, le textarea reste en saisie directe', error);
		}
	}
	if (instances.size) watchRemovals();
}
