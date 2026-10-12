// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bornes, placerMenu } from '../../src/ui/placement.js';

/**
 * Géométrie simulée (jsdom ne calcule pas de mise en page) : formulaire qui coupe de 0 à 400 en
 * largeur et de 0 à 300 en hauteur, bouton à droite, liste de 200 × largeur et hauteur données.
 */
let formulaire;
let liste;
let rects;
beforeEach(() => {
	document.body.innerHTML = '<div class="formulaire"><div class="menu"><button></button><div class="liste"></div></div></div>';
	formulaire = document.querySelector('.formulaire');
	liste = document.querySelector('.liste');
	rects = new Map();
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
		const r = typeof rects.get(this) === 'function' ? rects.get(this)() : rects.get(this) ?? { left: 0, top: 0, right: 2000, bottom: 2000 };
		return { ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top };
	});
	const style = window.getComputedStyle;
	vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => (el === formulaire
		? { overflowX: 'hidden', overflowY: 'hidden' }
		: { ...style(el), overflowX: 'visible', overflowY: 'visible' }));
	Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
	Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
	rects.set(formulaire, { left: 0, top: 0, right: 400, bottom: 300 });
});
afterEach(() => vi.restoreAllMocks());

/** Liste dont la position dépend de son style (left par défaut, right: 0 sous un bouton finissant à 380). */
const listeA = ({ gauche, largeur, hauteur, haut = 40 }) => () => {
	const basHauteur = liste.style.maxHeight ? Math.min(hauteur, parseFloat(liste.style.maxHeight)) : hauteur;
	if (liste.style.right !== '') {
		const droite = 380 - (parseFloat(liste.style.right) || 0);
		return { left: droite - largeur, top: haut, right: droite, bottom: haut + basHauteur };
	}
	return { left: gauche, top: haut, right: gauche + largeur, bottom: haut + basHauteur };
};

describe('bornes', () => {
	it('intersection de la fenêtre et des ancêtres qui coupent', () => {
		expect(bornes(liste)).toEqual({ left: 0, top: 0, right: 400, bottom: 300 });
	});
});

describe('placerMenu', () => {
	it('tient dans les bornes : placement par défaut, sous le bouton à gauche', () => {
		rects.set(liste, listeA({ gauche: 20, largeur: 200, hauteur: 100 }));
		placerMenu(liste);
		expect(liste.style.right).toBe('');
		expect(liste.style.maxHeight).toBe('');
	});

	it('dépasse à droite : aligné sur le bord droit du bouton', () => {
		rects.set(liste, listeA({ gauche: 300, largeur: 200, hauteur: 100 }));
		placerMenu(liste);
		expect(liste.style.left).toBe('auto');
		expect(liste.style.right).toBe('0px');
	});

	it('aligné à droite, dépasse alors à gauche : décalé juste assez pour rentrer', () => {
		rects.set(liste, listeA({ gauche: 300, largeur: 390, hauteur: 100 }));
		placerMenu(liste);
		// bord droit à 380, largeur 390 : gauche à -10, il faut la ramener à la marge (8)
		expect(parseFloat(liste.style.right)).toBe(-18);
	});

	it('dépasse en bas : hauteur limitée, défilement', () => {
		rects.set(liste, listeA({ gauche: 20, largeur: 200, hauteur: 400 }));
		placerMenu(liste);
		expect(liste.style.maxHeight).toBe('252px');
		expect(liste.style.overflowY).toBe('auto');
	});

	it('repart du placement par défaut à chaque ouverture', () => {
		liste.style.left = 'auto';
		liste.style.right = '0px';
		liste.style.maxHeight = '10px';
		rects.set(liste, listeA({ gauche: 20, largeur: 200, hauteur: 100 }));
		placerMenu(liste);
		expect([liste.style.left, liste.style.right, liste.style.maxHeight]).toEqual(['', '', '']);
	});
});

describe('menuOutil : placement à l\'ouverture et au redimensionnement', () => {
	it('placé à l\'ouverture, replacé au redimensionnement tant qu\'il est ouvert', async () => {
		const { menuOutil } = await import('../../src/ui/boutons.js');
		const menu = menuOutil({ nom: 'essai', libelle: 'Essai', elements: () => [{ libelle: 'Un', action: () => {} }] });
		formulaire.append(menu.element);
		const l = menu.element.querySelector('.tts-menu__liste');
		let gauche = 20;
		rects.set(l, () => {
			if (l.style.right !== '') return { left: 180, top: 40, right: 380, bottom: 140 };
			return { left: gauche, top: 40, right: gauche + 200, bottom: 140 };
		});
		menu.cible.click();
		expect(l.hidden).toBe(false);
		expect(l.style.right).toBe('');
		// la fenêtre change : la liste dépasse désormais à droite
		gauche = 300;
		window.dispatchEvent(new Event('resize'));
		expect(l.style.right).toBe('0px');
		menu.fermer();
		gauche = 20;
		window.dispatchEvent(new Event('resize'));
		// fermé : plus replacé
		expect(l.style.right).toBe('0px');
	});
});
