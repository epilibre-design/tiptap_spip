/** Placement d'une liste près de son bouton : fenêtre pour un popover, ancêtres qui coupent en repli. */

/** Écart gardé entre la liste et le bord qui la couperait. */
const MARGE = 8;

/** Intersection de deux rectangles. */
const intersection = (a, b) => ({
	left: Math.max(a.left, b.left),
	top: Math.max(a.top, b.top),
	right: Math.min(a.right, b.right),
	bottom: Math.min(a.bottom, b.bottom),
});

/**
 * Bornes réellement visibles d'un élément : la largeur de la fenêtre (pas de défilement horizontal),
 * réduite par chaque ancêtre qui coupe ce qui dépasse (overflow autre que visible). En hauteur, seuls
 * ces ancêtres comptent : la page défile, et le menu avec elle. Un ancêtre en position fixe (éditeur
 * plein écran) arrête le parcours : ses propres ancêtres ne le coupent plus, et la fenêtre, qu'il ne
 * suit pas en défilant, le borne aussi en hauteur.
 *
 * @param {HTMLElement} element
 * @returns {{ left: number, top: number, right: number, bottom: number }}
 */
export function bornes(element) {
	let limites = { left: 0, top: -Infinity, right: document.documentElement.clientWidth, bottom: Infinity };
	for (let ancetre = element.parentElement; ancetre && ancetre !== document.body; ancetre = ancetre.parentElement) {
		const style = getComputedStyle(ancetre);
		if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
			limites = intersection(limites, ancetre.getBoundingClientRect());
		}
		if (style.position === 'fixed') return intersection(limites, { left: 0, top: 0, right: Infinity, bottom: window.innerHeight });
	}
	return limites;
}

/**
 * Place une liste ouverte : sous le bouton, alignée à gauche (CSS) ; si elle dépasse à droite, alignée
 * sur le bord droit du bouton, puis décalée si elle dépasse alors à gauche ; si elle dépasse en bas,
 * ouverte au-dessus du bouton quand il y a plus de place, sinon limitée à la place disponible, avec
 * défilement. Sa hauteur compte bordure et marges (box-sizing: border-box). Repart du placement par
 * défaut à chaque appel.
 *
 * @param {HTMLElement} liste  liste du menu, enfant du conteneur du bouton
 */
export function placerMenu(liste) {
	const positionDefilement = liste.scrollTop;
	Object.assign(liste.style, { left: '', right: '', top: '', bottom: '', maxHeight: '', overflowY: '' });
	if (liste.hidden) return;
	// La couche supérieure échappe aux ancêtres qui coupent : seule la fenêtre limite le menu.
	if (liste.popover === 'manual' && liste.matches(':popover-open')) {
		const bouton = liste.parentElement.getBoundingClientRect();
		const rect = liste.getBoundingClientRect();
		const largeur = document.documentElement.clientWidth;
		const dessous = Math.max(0, window.innerHeight - MARGE - bouton.bottom);
		const dessus = Math.max(0, bouton.top - MARGE);
		const versHaut = rect.height > dessous && dessus > dessous;
		const hauteurVisible = versHaut ? dessus : dessous;
		liste.style.left = `${Math.max(MARGE, Math.min(bouton.left, largeur - MARGE - rect.width))}px`;
		liste.style.top = `${versHaut ? Math.max(MARGE, bouton.top - Math.min(rect.height, dessus)) : bouton.bottom}px`;
		if (rect.height > hauteurVisible) {
			liste.style.maxHeight = `${hauteurVisible}px`;
			liste.style.overflowY = 'auto';
		}
		liste.scrollTop = positionDefilement;
		return;
	}
	const limites = bornes(liste);
	let rect = liste.getBoundingClientRect();
	if (rect.right > limites.right - MARGE) {
		liste.style.left = 'auto';
		liste.style.right = '0px';
		rect = liste.getBoundingClientRect();
		if (rect.left < limites.left + MARGE) liste.style.right = `${rect.left - (limites.left + MARGE)}px`;
	}
	rect = liste.getBoundingClientRect();
	if (rect.bottom <= limites.bottom - MARGE) return;
	const bouton = liste.parentElement.getBoundingClientRect();
	const dessous = limites.bottom - MARGE - rect.top;
	const dessus = bouton.top - (limites.top + MARGE);
	if (dessus > dessous) {
		liste.style.top = 'auto';
		liste.style.bottom = '100%';
		if (rect.height <= dessus) return;
	}
	liste.style.maxHeight = `${Math.max(0, dessus > dessous ? dessus : dessous)}px`;
	liste.style.overflowY = 'auto';
}
