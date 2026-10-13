import { ICONES } from './icones.js';
import { idUnique } from './popover.js';
import { placerMenu } from './placement.js';

const MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

/** Raccourci lisible : Mod-Alt-n → Ctrl+Alt+N (⌘⌥N sur Mac). */
export function raccourciLisible(raccourci) {
	const touches = raccourci.split('-').map((t) => (t.length === 1 ? t.toUpperCase() : t));
	if (MAC) return touches.map((t) => ({ Mod: '⌘', Alt: '⌥', Shift: '⇧' }[t] ?? t)).join('');
	return touches.map((t) => (t === 'Mod' ? 'Ctrl' : t)).join('+');
}

/** Libellé, icône SVG (ou le libellé en texte, sans icône) et bulle d'un bouton de la barre. */
export function habiller(bouton, { icone, libelle, raccourci }) {
	bouton.setAttribute('aria-label', libelle);
	bouton.title = raccourci ? `${libelle} (${raccourciLisible(raccourci)})` : libelle;
	if (ICONES[icone]) bouton.innerHTML = ICONES[icone];
	else bouton.textContent = libelle;
}

/**
 * Bouton de la barre d'outils.
 *
 * @param {{ nom: string, icone?: string, libelle: string, raccourci?: string, bascule?: boolean,
 *           action: () => void }} options  bascule : bouton à deux états (aria-pressed)
 */
export function boutonOutil({ nom, icone = nom, libelle, raccourci, bascule = false, action }) {
	const bouton = document.createElement('button');
	bouton.type = 'button';
	bouton.className = `tts-outil tts-outil--${nom}`;
	habiller(bouton, { icone, libelle, raccourci });
	if (bascule) bouton.setAttribute('aria-pressed', 'false');
	bouton.addEventListener('click', () => action());
	return bouton;
}

/** Menu ouvert dans la page : un seul à la fois. */
let ouvert = null;

/**
 * Menu déroulant de la barre (pattern ARIA « menu button ») : ↓ ou Entrée ouvre, ↑ ↓ Début Fin
 * parcourent, Échap ferme et rend le focus au bouton, un clic ailleurs ferme.
 *
 * Les éléments sont recalculés à chaque ouverture : { libelle, icone?, action, possible?, actif?,
 * coche? } ; coche 'radio' (choix exclusif) ou 'case' (bascule) affiche `actif`. { separateur: true }
 * sépare deux groupes.
 *
 * @param {{ nom: string, icone?: string, libelle: string, elements: () => object[] }} options
 * @returns {{ element: HTMLElement, cible: HTMLButtonElement, fermer: (options?: { focus?: boolean }) => void }}
 */
export function menuOutil({ nom, icone = nom, libelle, elements }) {
	const element = document.createElement('div');
	element.className = `tts-menu tts-menu--${nom}`;
	const liste = document.createElement('div');
	liste.className = 'tts-menu__liste';
	liste.setAttribute('role', 'menu');
	liste.setAttribute('aria-label', libelle);
	liste.id = idUnique('tts-menu');
	liste.hidden = true;
	const popover = typeof liste.showPopover === 'function';
	if (popover) liste.popover = 'manual';
	const bouton = boutonOutil({ nom, icone, libelle, action: () => (liste.hidden ? ouvrir() : fermer()) });
	bouton.setAttribute('aria-haspopup', 'menu');
	bouton.setAttribute('aria-expanded', 'false');
	bouton.setAttribute('aria-controls', liste.id);
	element.append(bouton, liste);

	const items = () => [...liste.querySelectorAll('[role^=menuitem]:not(:disabled)')];
	const dehors = (event) => {
		if (!element.contains(event.target)) fermer();
	};
	// En popover, la liste échappe au formulaire qui la couperait ; le placement suit son bouton.
	const replacer = () => placerMenu(liste);
	let prochainPlacement = 0;
	const auDefilement = (event) => {
		if (liste.contains(event.target) || prochainPlacement) return;
		prochainPlacement = requestAnimationFrame(() => {
			prochainPlacement = 0;
			if (liste.hidden) return;
			const rect = bouton.getBoundingClientRect();
			if (rect.bottom <= 0 || rect.top >= window.innerHeight) fermer();
			else replacer();
		});
	};

	function construire(el) {
		if (el.separateur) {
			const s = document.createElement('div');
			s.setAttribute('role', 'separator');
			return s;
		}
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'tts-menu__element';
		b.tabIndex = -1;
		b.setAttribute('role', { radio: 'menuitemradio', case: 'menuitemcheckbox' }[el.coche] ?? 'menuitem');
		if (el.coche) b.setAttribute('aria-checked', String(Boolean(el.actif?.())));
		if (el.ariaLabel) b.setAttribute('aria-label', el.ariaLabel);
		if (ICONES[el.icone]) b.insertAdjacentHTML('afterbegin', ICONES[el.icone]);
		const texte = document.createElement('span');
		texte.textContent = el.libelle;
		b.append(texte);
		// un choix coché reste atteignable, même sans effet (paragraphe déjà paragraphe)
		b.disabled = el.possible ? !(el.possible() || (el.coche && el.actif?.())) : false;
		b.addEventListener('click', () => {
			fermer();
			el.action();
		});
		return b;
	}

	function ouvrir(dernier = false) {
		if (ouvert && ouvert !== menu) ouvert.fermer();
		liste.replaceChildren(...elements().map(construire));
		liste.hidden = false;
		if (popover) liste.showPopover();
		replacer();
		bouton.setAttribute('aria-expanded', 'true');
		ouvert = menu;
		document.addEventListener('pointerdown', dehors, true);
		window.addEventListener('resize', replacer);
		if (popover) window.addEventListener('scroll', auDefilement, true);
		const premiers = items();
		(dernier ? premiers.at(-1) : premiers[0])?.focus();
	}

	function fermer({ focus = false } = {}) {
		if (liste.hidden) return;
		if (prochainPlacement) cancelAnimationFrame(prochainPlacement);
		prochainPlacement = 0;
		if (popover) liste.hidePopover();
		liste.hidden = true;
		bouton.setAttribute('aria-expanded', 'false');
		if (ouvert === menu) ouvert = null;
		document.removeEventListener('pointerdown', dehors, true);
		window.removeEventListener('resize', replacer);
		if (popover) window.removeEventListener('scroll', auDefilement, true);
		if (focus) bouton.focus();
	}

	bouton.addEventListener('keydown', (event) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		ouvrir(event.key === 'ArrowUp');
	});
	liste.addEventListener('keydown', (event) => {
		const tous = items();
		const i = tous.indexOf(event.target);
		const suivant = {
			ArrowDown: tous[(i + 1) % tous.length],
			ArrowUp: tous[(i - 1 + tous.length) % tous.length],
			Home: tous[0],
			End: tous.at(-1),
		}[event.key];
		if (suivant) {
			event.preventDefault();
			suivant.focus();
		} else if (event.key === 'Escape') {
			// Échap n'atteint pas l'éditeur (sortie du plein écran)
			event.preventDefault();
			event.stopPropagation();
			fermer({ focus: true });
		} else if (event.key === 'Tab') {
			fermer();
		}
		// les flèches gauche et droite ne parcourent pas la barre depuis un menu
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation();
	});

	const menu = { element, cible: bouton, fermer };
	return menu;
}
