import { label } from '../ui/labels.js';
import { nommer } from './collerImage.js';

/**
 * Glisser-déposer de fichiers (spec 10 §8) : arbitrage du dépôt, état de survol de la zone d'édition,
 * position du dépôt, et partage avec le dépôt expérimental de Crayons.
 */

/** Extension telle que medias la cherche (corriger_extension de ecrire/inc/documents.php). */
const CORRECTIONS = { htm: 'html', jpeg: 'jpg', tiff: 'tif', aif: 'aiff', mpeg: 'mpg' };
export const corrigerExtension = (extension) => {
	const e = extension.replace(/[^a-z0-9]/gi, '');
	return CORRECTIONS[e] ?? e;
};

const extensionDe = (nom) => corrigerExtension((nom.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase());

/**
 * Arbitrage d'un dépôt : chaque fichier est traité, dans l'ordre, même accompagné de HTML ou de texte.
 * Une image de la liste blanche est renommée comme au collage ; un autre fichier est accepté si son
 * extension est déposable, et garde son nom.
 *
 * @param {DataTransfer|null} donnees
 * @param {{ images: string[], extensions: Record<string, string>, taille_image: number,
 *           documents: string[], documents_limite_image: string[], taille_document: number }} config
 *        tailles 0 : sans limite ; documents_limite_image : extensions que medias borne par
 *        _IMG_MAX_SIZE (liste de limite de taille, pas de types d'images)
 * @returns {{ envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null}
 *          null : pas de fichier (le dépôt n'est pas pour l'éditeur)
 */
export function trierDepot(donnees, config) {
	const fichiers = [...(donnees?.files ?? [])];
	if (!fichiers.length) return null;
	const envoyer = [];
	const refuses = [];
	for (const fichier of fichiers) {
		const image = config.images.includes(fichier.type);
		const extension = image ? config.extensions[fichier.type] : extensionDe(fichier.name);
		// limite de medias : _IMG_MAX_SIZE pour les extensions qu'il borne ainsi (svg, swf…), _DOC_MAX_SIZE sinon
		const taille = image || config.documents_limite_image.includes(extension) ? config.taille_image : config.taille_document;
		if (!image && !config.documents.includes(extension)) refuses.push({ fichier, raison: 'type' });
		else if (taille && fichier.size > taille) refuses.push({ fichier, raison: 'taille' });
		else envoyer.push(image ? nommer(fichier, new Date(), config.extensions) : fichier);
	}
	return { envoyer, refuses };
}

const porteFichiers = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');

/**
 * Glisser-déposer de fichiers sur la zone d'une instance (spec 10 §8). Écouteurs en capture sur le
 * wrapper : ils passent avant ProseMirror, qui ne voit pas un dépôt de fichiers. Tout survol ou dépôt
 * de fichiers est annulé (preventDefault), même refusé : sinon le navigateur ouvrirait le fichier à la
 * place de la page. Seule exception : le mode source d'un textarea .uploader, dont Crayons
 * (crayons/upload) gère le dépôt : rien n'est fait, l'événement lui parvient intact.
 */
export class DepotFichiers {
	/**
	 * @param {{ wrapper: HTMLElement, textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor,
	 *           envois: import('./envois.js').Envois, services: () => ?import('../services/cvt.js').Services,
	 *           mode: () => 'visual'|'source', signaler: (texte: string) => void }} options
	 */
	constructor({ wrapper, textarea, editor, envois, services, mode, signaler }) {
		Object.assign(this, { wrapper, textarea, editor, envois, services, mode, signaler });
		this.onSurvol = (event) => {
			if (!this.concerne(event)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
			this.survol(true);
		};
		this.onSortie = (event) => {
			// sortie de la zone : pas vers un de ses descendants
			if (!this.wrapper.contains(event.relatedTarget)) this.survol(false);
		};
		this.onDepot = (event) => {
			if (!this.concerne(event)) return;
			event.preventDefault();
			event.stopPropagation();
			this.survol(false);
			this.deposer(event);
		};
		wrapper.addEventListener('dragenter', this.onSurvol, true);
		wrapper.addEventListener('dragover', this.onSurvol, true);
		wrapper.addEventListener('dragleave', this.onSortie, true);
		wrapper.addEventListener('drop', this.onDepot, true);
	}

	/**
	 * Glisser de fichiers, sauf sur le textarea géré par Crayons en mode source (crayons/upload y a lié
	 * ses gestionnaires). Ailleurs dans la zone (barre d'outils, barre d'état), Crayons n'écoute pas :
	 * le dépôt reste à l'éditeur, qui l'annule au moins.
	 */
	concerne(event) {
		if (!porteFichiers(event)) return false;
		return !(this.mode() === 'source' && event.target === this.textarea && this.textarea.classList.contains('uploader'));
	}

	survol(actif) {
		this.wrapper.classList.toggle('tts-editor--depot', actif);
		if (actif) this.wrapper.dataset.ttsDepot = label('depot_indication');
		else delete this.wrapper.dataset.ttsDepot;
	}

	deposer(event) {
		const services = this.services();
		const config = services?.available ? services.depot() : null;
		if (!config) {
			this.signaler(label('depot_indisponible'));
			return;
		}
		const tri = trierDepot(event.dataTransfer, config);
		if (!tri) return;
		this.envois.signalerRefus(tri.refuses);
		if (!tri.envoyer.length) return;
		const mode = this.mode();
		this.envois.lancer(tri.envoyer, mode, mode === 'visual' ? this.position(event) : undefined);
	}

	/**
	 * Visuel : point du dépôt dans le contenu ; dans un bloc de code, après ce bloc ; hors du contenu ou
	 * sans position, après la sélection.
	 */
	position(event) {
		const { view } = this.editor;
		const trouve = view.dom.contains(event.target) ? view.posAtCoords({ left: event.clientX, top: event.clientY }) : null;
		if (!trouve) return view.state.selection.to;
		const $pos = view.state.doc.resolve(trouve.pos);
		for (let d = $pos.depth; d > 0; d--) {
			if ($pos.node(d).type.spec.code) return $pos.after(d);
		}
		return trouve.pos;
	}

	destroy() {
		this.survol(false);
		this.wrapper.removeEventListener('dragenter', this.onSurvol, true);
		this.wrapper.removeEventListener('dragover', this.onSurvol, true);
		this.wrapper.removeEventListener('dragleave', this.onSortie, true);
		this.wrapper.removeEventListener('drop', this.onDepot, true);
	}
}
