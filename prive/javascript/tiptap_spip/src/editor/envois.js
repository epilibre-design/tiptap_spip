import { ServiceUnavailable } from '../services/cvt.js';
import { label } from '../ui/labels.js';
import { nommer, trierPressePapiers } from './collerImage.js';
import { ajouterMarqueurs, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from './marqueurEnvoi.js';

let compteur = 0;
const nouvelId = () => `tts-envoi-${Date.now().toString(36)}-${++compteur}`;

/** Texte provisoire d'un envoi en mode source (spec 10 §1), unique par envoi. */
const marqueurSource = (id) => `<!-- envoi ${id} -->`;

/**
 * Envois de fichiers collés ou déposés dans une instance (spec 10 §1, §3, §8) : un marqueur par
 * fichier, un appel deposer_document par fichier dans la file des services, puis <docN> à la place du
 * marqueur. Un envoi appartient au mode où le fichier a été collé ou déposé : la bascule de mode est
 * refusée tant qu'il en reste (main.js).
 */
export class Envois {
	/**
	 * @param {{ textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor,
	 *           services: () => ?import('../services/cvt.js').Services, mode: () => 'visual'|'source',
	 *           signaler: (texte: string) => void, effacer: () => void, surChangement?: () => void }} options
	 *        services : lus à chaque collage (ils peuvent arriver après l'éditeur) ;
	 *        surChangement : appelé à chaque début et fin d'envoi
	 */
	constructor({ textarea, editor, services, mode, signaler, effacer, surChangement = () => {} }) {
		Object.assign(this, { textarea, editor, services, mode, signaler, effacer, surChangement });
		/** @type {Map<string, { id: string, fichier: File, mode: string, controleur: AbortController }>} */
		this.envois = new Map();
		this.onPaste = (event) => {
			if (this.mode() === 'source' && this.coller(event.clipboardData, 'source')) event.preventDefault();
		};
		textarea.addEventListener('paste', this.onPaste);
	}

	enCours() {
		return this.envois.size;
	}

	/** handlePaste de l'éditeur visuel (sous-éditeurs de note ou de multi : collage habituel). */
	collerVisuel(view, event) {
		if (view !== this.editor.view || view.state.selection.$from.parent.type.spec.code) return false;
		return this.coller(event.clipboardData, 'visual');
	}

	/**
	 * @returns {boolean} vrai si le collage est pris en charge (le collage habituel n'a pas lieu)
	 */
	coller(donnees, mode) {
		const services = this.services();
		const config = services?.available ? services.depot() : null;
		const tri = config && trierPressePapiers(donnees, config);
		if (!tri) return false;
		this.signalerRefus(tri.refuses);
		if (!tri.envoyer.length) return false;
		this.lancer(tri.envoyer.map((fichier) => nommer(fichier, new Date(), config.extensions)), mode);
		return true;
	}

	/** Refus avant envoi dans la barre d'état ; aucun refus : message effacé. */
	signalerRefus(refuses) {
		if (!refuses.length) {
			this.effacer();
			return;
		}
		this.signaler(refuses.map(({ fichier, raison }) => label(raison === 'type' ? 'fichier_type_refuse' : 'fichier_trop_gros').replace('@nom@', fichier.name || 'image')).join(' '));
	}

	/**
	 * Envoie des fichiers déjà nommés, dans l'ordre, chacun avec son marqueur.
	 * @param {File[]} fichiers
	 * @param {'visual'|'source'} mode
	 * @param {number} [pos]  visuel : position des marqueurs (après la sélection par défaut) ;
	 *        source : position dans le textarea (après la sélection par défaut)
	 */
	lancer(fichiers, mode, pos) {
		const services = this.services();
		const envois = fichiers.map((fichier) => ({ id: nouvelId(), fichier, mode, controleur: new AbortController() }));
		if (mode === 'visual') {
			ajouterMarqueurs(this.editor.view, envois.map((e) => e.id), pos);
		} else {
			// texte sélectionné conservé, comme avec Crayons : marqueurs après lui, sélection inchangée
			const fin = pos ?? this.textarea.selectionEnd;
			this.textarea.setRangeText(envois.map((e) => marqueurSource(e.id)).join(''), fin, fin, 'preserve');
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
		}
		for (const envoi of envois) {
			this.envois.set(envoi.id, envoi);
			this.emettre('document-recu', { fichier: envoi.fichier });
			this.envoyer(services, envoi);
		}
		this.surChangement();
	}

	async envoyer(services, envoi) {
		const { signal } = envoi.controleur;
		try {
			const resultat = await services.call('deposer_document', {}, {
				fichier: envoi.fichier,
				signal,
				progression: (ratio) => envoi.mode === 'visual' && progressionMarqueur(this.editor.view, envoi.id, ratio),
			});
			if (signal.aborted) return;
			// marqueur supprimé par le rédacteur : rien d'inséré, pas d'événement
			if (!this.inserer(envoi, `<${resultat.raccourci}>`)) return;
			this.emettre('document-insere', { fichier: envoi.fichier, id_document: resultat.id_document, raccourci: resultat.raccourci });
		} catch (erreur) {
			if (signal.aborted || erreur?.name === 'AbortError') return;
			this.retirer(envoi);
			const message = erreur instanceof ServiceUnavailable || !erreur?.message ? label('envoi_echec') : erreur.message;
			this.signaler(message);
			this.emettre('document-erreur', { fichier: envoi.fichier, message });
		} finally {
			if (this.envois.delete(envoi.id)) this.surChangement();
		}
	}

	/**
	 * Remplace le marqueur par le raccourci.
	 * @returns {boolean} false si le marqueur n'existe plus (supprimé par le rédacteur) : rien d'inséré
	 */
	inserer(envoi, raccourci) {
		return envoi.mode === 'visual' ? remplacerMarqueur(this.editor, envoi.id, raccourci) : this.remplacerSource(envoi.id, raccourci);
	}

	retirer(envoi) {
		if (envoi.mode === 'visual') {
			if (!this.editor.isDestroyed) retirerMarqueurs(this.editor.view, [envoi.id]);
			return;
		}
		this.remplacerSource(envoi.id, '');
	}

	/**
	 * Remplace le texte provisoire d'un envoi, sans toucher à la sélection ni aux autres marqueurs.
	 * @returns {boolean} false si le texte provisoire n'est plus là
	 */
	remplacerSource(id, texte) {
		const marqueur = marqueurSource(id);
		const debut = this.textarea.value.indexOf(marqueur);
		if (debut < 0) return false;
		this.textarea.setRangeText(texte, debut, debut + marqueur.length, 'preserve');
		this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
		return true;
	}

	emettre(nom, detail) {
		this.textarea.dispatchEvent(new CustomEvent(`tiptap-spip:${nom}`, { bubbles: true, detail }));
	}

	/** Abandonne les envois en cours et retire leurs marqueurs (« Enregistrer sans attendre », destruction). */
	abandonner() {
		const envois = [...this.envois.values()];
		this.envois.clear();
		for (const envoi of envois) {
			envoi.controleur.abort();
			this.retirer(envoi);
		}
		if (envois.length) this.surChangement();
	}

	destroy() {
		this.abandonner();
		this.textarea.removeEventListener('paste', this.onPaste);
	}
}
