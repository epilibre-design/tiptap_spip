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
