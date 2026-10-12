/**
 * Placement d'une liste de menu sous son bouton, dans les bornes visibles : un ancêtre peut la couper
 * (`.cadre-formulaire-editer .formulaire_spip` a `overflow: hidden` dans l'espace privé).
 */

/** Écart gardé entre la liste et le bord qui la couperait. */
const MARGE = 8;
/** Hauteur en dessous de laquelle une liste n'est plus réduite (elle défile au-delà). */
const HAUTEUR_MIN = 120;

/**
 * Bornes réellement visibles d'un élément : la largeur de la fenêtre (pas de défilement horizontal),
 * réduite par chaque ancêtre qui coupe ce qui dépasse (overflow autre que visible). En hauteur, seuls
 * ces ancêtres comptent : la page défile, et le menu avec elle.
 *
 * @param {HTMLElement} element
 * @returns {{ left: number, top: number, right: number, bottom: number }}
 */
export function bornes(element) {
	let b = { left: 0, top: -Infinity, right: document.documentElement.clientWidth, bottom: Infinity };
	for (let p = element.parentElement; p && p !== document.body; p = p.parentElement) {
		const style = getComputedStyle(p);
		if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
		const r = p.getBoundingClientRect();
		b = { left: Math.max(b.left, r.left), top: Math.max(b.top, r.top), right: Math.min(b.right, r.right), bottom: Math.min(b.bottom, r.bottom) };
	}
	return b;
}

/**
 * Place une liste ouverte : sous le bouton, alignée à gauche (CSS) ; si elle dépasse à droite, alignée
 * sur le bord droit du bouton, puis décalée si elle dépasse alors à gauche ; si elle dépasse en bas,
 * hauteur limitée avec défilement. Repart du placement par défaut à chaque appel.
 *
 * @param {HTMLElement} liste
 */
export function placerMenu(liste) {
	liste.style.left = '';
	liste.style.right = '';
	liste.style.maxHeight = '';
	liste.style.overflowY = '';
	if (liste.hidden) return;
	const b = bornes(liste);
	let r = liste.getBoundingClientRect();
	if (r.right > b.right - MARGE) {
		liste.style.left = 'auto';
		liste.style.right = '0px';
		r = liste.getBoundingClientRect();
		if (r.left < b.left + MARGE) liste.style.right = `${r.left - (b.left + MARGE)}px`;
	}
	r = liste.getBoundingClientRect();
	if (r.bottom > b.bottom - MARGE) {
		liste.style.maxHeight = `${Math.max(HAUTEUR_MIN, b.bottom - MARGE - r.top)}px`;
		liste.style.overflowY = 'auto';
	}
}
