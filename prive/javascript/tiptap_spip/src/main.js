import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { langueAffichee, languesDuDocument } from './editor/extensions.js';
import { TextareaBridge } from './editor/TextareaBridge.js';
import { servicesALaDemande } from './hosts/aLaDemande.js';
import { contexte as contexteHote } from './hosts/contexte.js';
import { Services } from './services/cvt.js';
import { creerInterface } from './ui/interface.js';
import { label } from './ui/labels.js';
import { NotesPanel } from './ui/NotesPanel.js';
import { Popover } from './ui/popover.js';

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
		// boutons de l'édition visuelle, désactivés en mode source
		this.visualButtons = [
			bouton('tts-lien', label('lien'), () => this.ui.openLink()),
			bouton('tts-bouton-note', label('note'), () => this.ui.editNote(null)),
			bouton('tts-bouton-glossaire', label('glossaire'), () => this.ui.openGlossary()),
			bouton('tts-bouton-abbr', label('abbr'), () => this.ui.openAbbr()),
			bouton('tts-modele', label('modele'), () => this.ui.editModel(null)),
			bouton('tts-bouton-multi', label('multi'), () => this.ui.editMulti(null)),
		];
		const [linkButton, noteButton, glossaryButton] = this.visualButtons;
		this.glossaryButton = glossaryButton;
		linkButton.title = `${label('lien')} (Ctrl+K)`;
		noteButton.title = `${label('note')} (Ctrl+Alt+N)`;
		glossaryButton.title = `${label('glossaire')} (Ctrl+Alt+G)`;
		// langue affichée par les multis (spec 05 §5) : présente quand le texte a des multis
		this.langues = document.createElement('select');
		this.langues.className = 'tts-langues';
		this.langues.setAttribute('aria-label', label('langue_affichee'));
		this.langues.addEventListener('change', () => this.editor.commands.setLangueAffichee(this.langues.value));
		toolbar.append(this.langues);
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
		// les popovers reçoivent la promesse : ouverts avant l'arrivée des services, leurs appels
		// (recherche de liens, glossaire) fonctionnent dès qu'ils sont là
		this.ui = creerInterface({ editor: () => this.editor, wrapper: this.wrapper, services: this.servicesPrets });

		// l'éditeur est créé avant de toucher au DOM : en cas d'échec, rien n'a changé
		this.editor = createEditor({
			element: this.content,
			source: textarea.value,
			ui: this.ui,
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em` } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });
		this.notes = new NotesPanel({ editor: this.editor, editNote: (pos) => this.ui.editNote(pos) });
		// pas de [ ] < > dans un terme de glossaire (spec 05 §2) : bouton désactivé sur une telle sélection
		this.majGlossaire = () => {
			const { from, to } = this.editor.state.selection;
			this.glossaryButton.disabled = this.bridge.mode === 'source' || /[[\]<>]/.test(this.editor.state.doc.textBetween(from, to, ' '));
		};
		this.editor.on('selectionUpdate', this.majGlossaire);
		this.majLangues = ({ transaction } = {}) => {
			if (transaction && !transaction.docChanged) return;
			const langues = languesDuDocument(this.editor.state.doc);
			const affichee = langueAffichee(this.editor.state);
			const options = [...new Set([...(affichee ? [affichee] : []), ...langues])];
			this.langues.replaceChildren(...options.map((l) => Object.assign(document.createElement('option'), { value: l, textContent: l })));
			this.langues.value = affichee;
			this.langues.hidden = langues.length === 0;
		};
		this.editor.on('transaction', this.majLangues);
		this.majLangues();
		this.content.after(this.notes.element);

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
		this.notes.setMode(source);
		for (const b of this.visualButtons) b.disabled = source;
		this.langues.disabled = source;
		this.majGlossaire();
		this.modeButton.setAttribute('aria-pressed', String(source));
		(source ? this.textarea : this.editor).focus?.();
	}

	/** @param {{ restore?: boolean }} options  restore : remettre le textarea à sa place */
	destroy({ restore = true } = {}) {
		instances.delete(this);
		// popovers de l'instance (et sous-éditeur d'une note) fermés
		while (Popover.current?.wrapper === this.wrapper) Popover.current.close({ refocus: false });
		this.notes.destroy();
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
