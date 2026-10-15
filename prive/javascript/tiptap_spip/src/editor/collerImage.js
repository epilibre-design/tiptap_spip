import { ServiceUnavailable } from '../services/cvt.js';
import { label } from '../ui/labels.js';
import { ajouterMarqueurs, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from './marqueurEnvoi.js';

/**
 * Coller des images (spec 10) : arbitrage du presse-papiers, nom des captures, envois vers
 * l'opération deposer_image des services et insertion de <docN>, dans l'éditeur visuel comme en
 * mode source.
 */

/** Extension de chaque type d'image de la liste blanche. */
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

const deux = (n) => String(n).padStart(2, '0');

/**
 * Nom envoyé au serveur (spec 10 §2) : une capture arrive sans nom ou nommée image.png, elle devient
 * capture-AAAAMMJJ-HHMMSS.<ext> ; un fichier nommé garde son nom, avec l'extension de son type.
 * @param {File} fichier
 * @param {Date} [date]
 * @returns {File}
 */
export function nommer(fichier, date = new Date()) {
	const extension = EXTENSIONS[fichier.type] ?? fichier.name.split('.').pop();
	const capture = !fichier.name || /^image\.\w+$/i.test(fichier.name);
	const base = capture
		? `capture-${date.getFullYear()}${deux(date.getMonth() + 1)}${deux(date.getDate())}-${deux(date.getHours())}${deux(date.getMinutes())}${deux(date.getSeconds())}`
		: fichier.name.replace(/\.[^.]*$/, '');
	return new File([fichier], `${base}.${extension}`, { type: fichier.type, lastModified: fichier.lastModified });
}

/** HTML réduit à une seule image (copie d'une image depuis un navigateur), liens et commentaires compris. */
function imageSeule(html) {
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	const images = body.querySelectorAll('img');
	if (images.length !== 1 || body.textContent.trim() !== '') return false;
	return [...body.querySelectorAll('*')].every((el) => el === images[0] || el.contains(images[0]));
}

/**
 * Arbitrage du presse-papiers (spec 10 §3) : le texte ou le HTML ordinaire gardent la priorité ;
 * sinon chaque image acceptée est envoyée, dans l'ordre, et les autres fichiers sont refusés.
 *
 * @param {DataTransfer|null} donnees
 * @param {{ types: string[], taille: number }} config  taille 0 : sans limite
 * @returns {{ envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null}
 *          null : collage habituel sans message ; envoyer vide : collage habituel, refus à signaler
 */
export function trierPressePapiers(donnees, { types, taille }) {
	const fichiers = [...(donnees?.files ?? [])];
	if (!fichiers.length) return null;
	const html = donnees.getData('text/html');
	if (html ? !imageSeule(html) : donnees.getData('text/plain').trim() !== '') return null;
	const envoyer = [];
	const refuses = [];
	for (const fichier of fichiers) {
		if (!types.includes(fichier.type)) refuses.push({ fichier, raison: 'type' });
		else if (taille && fichier.size > taille) refuses.push({ fichier, raison: 'taille' });
		else envoyer.push(fichier);
	}
	return { envoyer, refuses };
}

let compteur = 0;
const nouvelId = () => `tts-img-${Date.now().toString(36)}-${++compteur}`;

/** Texte provisoire d'un envoi en mode source (spec 10 §1), unique par envoi. */
const marqueurSource = (id) => `<!-- envoi ${id} -->`;

/**
 * Envois des images collées d'une instance (spec 10 §1, §3). Un envoi appartient au mode où il a été
 * collé : la bascule de mode est refusée tant qu'il en reste (main.js).
 */
export class CollerImages {
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
		const config = services?.available ? services.images() : null;
		const tri = config && trierPressePapiers(donnees, config);
		if (!tri) return false;
		if (tri.refuses.length) {
			this.signaler(tri.refuses.map(({ fichier, raison }) => label(raison === 'type' ? 'image_type_refuse' : 'image_trop_grosse').replace('@nom@', fichier.name || 'image')).join(' '));
		} else {
			this.effacer();
		}
		if (!tri.envoyer.length) return false;
		const envois = tri.envoyer.map((fichier) => ({ id: nouvelId(), fichier: nommer(fichier), mode, controleur: new AbortController() }));
		if (mode === 'visual') {
			ajouterMarqueurs(this.editor.view, envois.map((e) => e.id));
		} else {
			const { selectionStart, selectionEnd } = this.textarea;
			this.textarea.setRangeText(envois.map((e) => marqueurSource(e.id)).join(''), selectionStart, selectionEnd, 'end');
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
		}
		for (const envoi of envois) {
			this.envois.set(envoi.id, envoi);
			this.emettre('image-recue', { fichier: envoi.fichier });
			this.envoyer(services, envoi);
		}
		this.surChangement();
		return true;
	}

	async envoyer(services, envoi) {
		const { signal } = envoi.controleur;
		try {
			const resultat = await services.call('deposer_image', {}, {
				fichier: envoi.fichier,
				signal,
				progression: (ratio) => envoi.mode === 'visual' && progressionMarqueur(this.editor.view, envoi.id, ratio),
			});
			if (signal.aborted) return;
			this.inserer(envoi, `<${resultat.raccourci}>`);
			this.emettre('image-inseree', { fichier: envoi.fichier, id_document: resultat.id_document, raccourci: resultat.raccourci });
		} catch (erreur) {
			if (signal.aborted || erreur?.name === 'AbortError') return;
			this.retirer(envoi);
			const message = erreur instanceof ServiceUnavailable || !erreur?.message ? label('image_echec') : erreur.message;
			this.signaler(message);
			this.emettre('image-erreur', { fichier: envoi.fichier, message });
		} finally {
			if (this.envois.delete(envoi.id)) this.surChangement();
		}
	}

	/** Remplace le marqueur par le raccourci ; marqueur supprimé par le rédacteur : rien. */
	inserer(envoi, raccourci) {
		if (envoi.mode === 'visual') {
			remplacerMarqueur(this.editor, envoi.id, raccourci);
			return;
		}
		this.remplacerSource(envoi.id, raccourci);
	}

	retirer(envoi) {
		if (envoi.mode === 'visual') {
			if (!this.editor.isDestroyed) retirerMarqueurs(this.editor.view, [envoi.id]);
			return;
		}
		this.remplacerSource(envoi.id, '');
	}

	/** Remplace le texte provisoire d'un envoi, sans toucher à la sélection ni aux autres marqueurs. */
	remplacerSource(id, texte) {
		const marqueur = marqueurSource(id);
		const debut = this.textarea.value.indexOf(marqueur);
		if (debut < 0) return;
		this.textarea.setRangeText(texte, debut, debut + marqueur.length, 'preserve');
		this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
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
