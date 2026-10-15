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
