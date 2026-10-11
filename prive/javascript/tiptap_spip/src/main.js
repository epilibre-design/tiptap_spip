import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { TextareaBridge } from './editor/TextareaBridge.js';
import { servicesALaDemande } from './hosts/aLaDemande.js';
import { contexte as contexteHote } from './hosts/contexte.js';
import { LinkTitles, ModelPreviews } from './services/cache.js';
import { Services } from './services/cvt.js';
import { label } from './ui/labels.js';
import { openLinkPopover } from './ui/LinkPopover.js';
import { openModelPopover } from './ui/ModelPopover.js';

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

/** Textareas des crayons (plugin Crayons), équipés si la configuration l'active (tiptap_spip/crayons). */
const CRAYONS = '.formulaire_crayon textarea.crayon-active';

const config = () => globalThis.spipConfig?.tiptap_spip ?? {};
const selecteur = () => (config().crayons ? `${SELECTOR}, ${CRAYONS}` : SELECTOR);

/** Textareas pris par markdown_editor : jamais touchés. */
const MARKDOWN_EDITOR = '[class*="inserer_md_barre"], [data-md-editor-toolbar]';

/** Éditeurs montés dans la page. */
export const instances = new Set();

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
		// styles de contenu de l'éditeur : espace privé ; dans le site public, ceux du site (spec 02 §6)
		const styles = textarea.dataset.ttsStyles ?? (config().prive ? 'contenu' : 'site');
		if (styles === 'contenu') this.wrapper.classList.add('tts-styles-contenu');
		const toolbar = document.createElement('div');
		toolbar.className = 'tts-toolbar';
		const bouton = (className, texte, onClick) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = className;
			b.textContent = texte;
			b.addEventListener('click', onClick);
			toolbar.append(b);
			return b;
		};
		this.linkButton = bouton('tts-lien', label('lien'), () => this.ui.openLink());
		this.linkButton.title = `${label('lien')} (Ctrl+K)`;
		this.modelButton = bouton('tts-modele', label('modele'), () => this.ui.editModel(null));
		this.modeButton = bouton('tts-mode', label('mode_source'), () => this.toggleMode());
		this.modeButton.setAttribute('aria-pressed', 'false');
		this.content = document.createElement('div');
		this.content.className = 'tts-content';
		this.wrapper.append(toolbar, this.content);

		// formulaire de services du champ : rendu après le formulaire hôte (formulaire_fond), sinon
		// chargé à la demande pour le contexte du textarea ; null : mode dégradé. Le formulaire chargé
		// à la demande appartient à l'instance : retiré à sa destruction (destroy)
		this.services = Services.forTextarea(textarea);
		this.chargement = this.services ? null : new AbortController();
		this.servicesPrets = this.services
			? Promise.resolve(this.services)
			: servicesALaDemande(textarea, contexteHote(textarea), { signal: this.chargement.signal });
		this.servicesPrets.then((s) => {
			this.services = s;
		});
		// le popover de lien reçoit la promesse : ouvert avant l'arrivée des services, sa recherche
		// fonctionne dès qu'ils sont là
		const contexte = () => ({ editor: this.editor, wrapper: this.wrapper, services: this.servicesPrets, titles: this.ui.titles });
		this.ui = {
			previews: new ModelPreviews(this.servicesPrets),
			titles: new LinkTitles(this.servicesPrets),
			openLink: () => openLinkPopover(contexte()),
			editModel: (pos) => openModelPopover(contexte(), pos),
		};

		// l'éditeur est créé avant de toucher au DOM : en cas d'échec, rien n'a changé
		this.editor = createEditor({
			element: this.content,
			source: textarea.value,
			ui: this.ui,
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em` } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });

		textarea.before(this.wrapper);
		this.wrapper.append(textarea);
		textarea.hidden = true;
	}

	toggleMode() {
		const mode = this.bridge.mode === 'visual' ? 'source' : 'visual';
		if (!this.bridge.setMode(mode)) return;
		const source = mode === 'source';
		this.textarea.hidden = !source;
		this.content.hidden = source;
		this.linkButton.disabled = source;
		this.modelButton.disabled = source;
		this.modeButton.setAttribute('aria-pressed', String(source));
		(source ? this.textarea : this.editor).focus?.();
	}

	/** @param {{ restore?: boolean }} options  restore : remettre le textarea à sa place */
	destroy({ restore = true } = {}) {
		instances.delete(this);
		this.bridge.destroy();
		if (this.chargement) {
			this.chargement.abort();
			this.services?.container.remove();
		}
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
 * @param {ParentNode|ParentNode[]|{ jquery: string }} [racine]
 * @param {{ createEditor?: typeof defaultCreateEditor }} [options]
 */
export function tiptap_spip_init(racine = document, { createEditor = defaultCreateEditor } = {}) {
	const sel = selecteur();
	const textareas = new Set();
	for (const root of racines(racine)) {
		if (root.matches?.(sel)) textareas.add(root);
		root.querySelectorAll(sel).forEach((t) => textareas.add(t));
	}
	for (const textarea of textareas) {
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

/**
 * Racines où chercher : onAjaxLoad passe la racine rechargée dans this, parfois sous forme d'objet
 * jQuery ou de tableau d'éléments (Crayons : triggerAjaxLoad(tous.get())).
 */
function racines(racine) {
	const liste = racine?.jquery || Array.isArray(racine) ? Array.from(racine) : [racine];
	const noeuds = liste.filter((n) => n?.querySelectorAll);
	return noeuds.length ? noeuds : [document];
}
