import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { TextareaBridge } from './editor/TextareaBridge.js';
import { servicesALaDemande } from './hosts/aLaDemande.js';
import { barreDuTextarea, contexte as contexteHote } from './hosts/contexte.js';
import { Services } from './services/cvt.js';
import { creerInterface } from './ui/interface.js';
import BARRES from './ui/barres.json';
import { label } from './ui/labels.js';
import './ui/composants.js';
import { NotesPanel } from './ui/NotesPanel.js';
import { Popover } from './ui/popover.js';
import { StatusBar } from './ui/StatusBar.js';
import { Toolbar } from './ui/Toolbar.js';

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

/** Mode choisi par l'auteur (spec 06 §3), gardé par le navigateur ; stockage indisponible : ignoré. */
const PREFERENCE = 'tiptap_spip.mode';
const lirePreference = () => {
	try {
		return globalThis.localStorage?.getItem(PREFERENCE) ?? null;
	} catch {
		return null;
	}
};
const ecrirePreference = (mode) => {
	try {
		globalThis.localStorage?.setItem(PREFERENCE, mode);
	} catch {
		// navigation privée, stockage bloqué : préférence non gardée
	}
};

/** Nom accessible du champ : son <label>, sinon son aria-label ou sa bulle, sinon un nom générique. */
const nomDuChamp = (textarea) => textarea.labels?.[0]?.textContent.replace(/\s+/g, ' ').trim()
	|| textarea.getAttribute('aria-label')
	|| textarea.title
	|| label('zone_texte');

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
		this.toolbarElement = document.createElement('div');
		this.toolbarElement.className = 'tts-toolbar';
		this.content = document.createElement('div');
		this.content.className = 'tts-content';
		this.wrapper.append(this.toolbarElement, this.content);

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
			// zone éditable nommée comme le champ SPIP (spec 06 §7)
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em`, 'aria-label': nomDuChamp(textarea), 'aria-multiline': 'true' } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });
		this.notes = new NotesPanel({ editor: this.editor, editNote: (pos) => this.ui.editNote(pos), editMulti: (pos) => this.ui.editMulti(pos) });
		// barre d'outils déclarée (spec 06 §2) : celle de la configuration (pipeline tiptap_spip_toolbars),
		// sinon celle du bundle ; une barre inconnue donne la barre minimale
		const barres = config().toolbars ?? BARRES;
		this.toolbar = new Toolbar({
			ctx: { editor: this.editor, ui: this.ui, instance: this },
			barre: barres[barreDuTextarea(textarea)] ?? barres.minimale ?? BARRES.minimale,
			element: this.toolbarElement,
		});
		this.majBarre = () => this.toolbar.maj();
		this.editor.on('transaction', this.majBarre);
		this.content.after(this.notes.element);

		// barre d'état (mots, anomalies) en bas, sous le textarea du mode source
		this.etat = new StatusBar({ editor: this.editor, editRaw: (pos) => this.ui.editRaw(pos) });

		textarea.before(this.wrapper);
		this.wrapper.append(textarea, this.etat.element);
		textarea.hidden = true;

		// raccourcis de l'instance (spec 06 §6), depuis l'éditeur comme depuis le textarea ; en capture :
		// Échap doit voir si un popover ou un menu est ouvert avant que celui-ci ne se ferme
		this.wrapper.addEventListener('keydown', (event) => this.raccourci(event), true);
		// mode mémorisé (spec 06 §3) : préférence du navigateur, sinon mode par défaut de la configuration
		if ((lirePreference() ?? config().mode) === 'source') this.toggleMode({ focus: false });
	}

	/** Mode affiché : visual ou source. */
	mode() {
		return this.bridge.mode;
	}

	/** Langue de l'objet édité (guillemets) : attribut lang le plus proche, sinon celle de la page. */
	langue() {
		return this.textarea.closest('[lang]')?.lang || document.documentElement.lang;
	}

	pleinEcran() {
		return this.wrapper.classList.contains('tts-editor--plein-ecran');
	}

	/**
	 * Plein écran (spec 06 §3) par CSS, pas par l'API Fullscreen : celle-ci n'affiche que l'élément en
	 * plein écran, la modalbox des modèles (posée dans body) serait cachée.
	 */
	togglePleinEcran(plein = !this.pleinEcran()) {
		this.wrapper.classList.toggle('tts-editor--plein-ecran', plein);
		document.documentElement.classList.toggle('tts-plein-ecran', plein);
		this.toolbar.maj();
	}

	/** Mod-Shift-E : bascule source ; F11 : plein écran ; Échap : sortie du plein écran. */
	raccourci(event) {
		const mod = event.ctrlKey || event.metaKey;
		if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'e') {
			event.preventDefault();
			this.toggleMode();
		} else if (event.key === 'F11' && !mod && !event.altKey && !event.shiftKey) {
			event.preventDefault();
			this.togglePleinEcran();
		} else if (event.key === 'Escape' && this.pleinEcran()) {
			// un popover ou un menu ouvert se ferme d'abord (ProseMirror empêche l'action par défaut de
			// toute touche Échap : defaultPrevented ne dit rien)
			const ouvert = Popover.current?.wrapper === this.wrapper || this.toolbarElement.querySelector('[aria-expanded="true"]');
			if (ouvert) return;
			event.preventDefault();
			this.togglePleinEcran(false);
		}
	}

	/** @param {{ focus?: boolean }} options  focus : donner le focus à la zone affichée */
	toggleMode({ focus = true } = {}) {
		const mode = this.bridge.mode === 'visual' ? 'source' : 'visual';
		if (!this.bridge.setMode(mode)) return;
		const source = mode === 'source';
		this.textarea.hidden = !source;
		this.content.hidden = source;
		this.notes.setMode(source);
		this.etat.setMode(source);
		this.toolbar.maj();
		ecrirePreference(mode);
		if (focus) (source ? this.textarea : this.editor).focus?.();
	}

	/** @param {{ restore?: boolean }} options  restore : remettre le textarea à sa place */
	destroy({ restore = true } = {}) {
		instances.delete(this);
		// popovers de l'instance (et sous-éditeur d'une note) fermés
		while (Popover.current?.wrapper === this.wrapper) Popover.current.close({ refocus: false });
		this.notes.destroy();
		this.etat.destroy();
		this.editor.off('transaction', this.majBarre);
		if (this.pleinEcran()) this.togglePleinEcran(false);
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
