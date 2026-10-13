// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { menuOutil } from '../../src/ui/boutons.js';
import { bornes, placerMenu } from '../../src/ui/placement.js';

/**
 * Géométrie simulée (jsdom ne calcule pas de mise en page) : formulaire qui coupe de 0 à 400 en
 * largeur et de 0 à 300 en hauteur ; menu (bouton) de 180 à 380 en largeur et de 100 à 120 en hauteur ;
 * liste de largeur et de hauteur données, sous le bouton (top: 100%) ou au-dessus (bottom: 100%),
 * alignée à gauche (left) ou sur le bord droit du bouton (right).
 */
let formulaire;
let menu;
let liste;
let rects;
let positions;
beforeEach(() => {
	document.body.innerHTML = '<div class="formulaire"><div class="menu"><button></button><div class="liste"></div></div></div>';
	formulaire = document.querySelector('.formulaire');
	menu = document.querySelector('.menu');
	liste = document.querySelector('.liste');
	rects = new Map();
	positions = new Map();
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
		const valeur = rects.get(this);
		const r = (typeof valeur === 'function' ? valeur() : valeur) ?? { left: 0, top: 0, right: 2000, bottom: 2000 };
		return { ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top };
	});
	vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => ({
		overflowX: el === formulaire ? 'hidden' : 'visible',
		overflowY: el === formulaire ? 'hidden' : 'visible',
		position: positions.get(el) ?? 'static',
	}));
	Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
	Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
	rects.set(formulaire, { left: 0, top: 0, right: 400, bottom: 300 });
	rects.set(menu, { left: 180, top: 100, right: 380, bottom: 120 });
});
afterEach(() => vi.restoreAllMocks());

/** Rectangle de la liste selon son style (placement par défaut : gauche du bouton, dessous). */
const rectListe = ({ gauche = 180, largeur = 200, hauteur = 100 }) => () => {
	const hauteurVisible = liste.style.maxHeight ? Math.min(hauteur, parseFloat(liste.style.maxHeight)) : hauteur;
	const droite = liste.style.right !== '' ? 380 - (parseFloat(liste.style.right) || 0) : gauche + largeur;
	const [haut, bas] = liste.style.bottom === '100%' ? [100 - hauteurVisible, 100] : [120, 120 + hauteurVisible];
	return { left: droite - largeur, top: haut, right: droite, bottom: bas };
};

describe('bornes', () => {
	it('largeur de la fenêtre et ancêtres qui coupent ; en hauteur, seuls ces ancêtres (la page défile)', () => {
		expect(bornes(liste)).toEqual({ left: 0, top: 0, right: 400, bottom: 300 });
		formulaire.style.overflow = '';
		vi.mocked(window.getComputedStyle).mockImplementation(() => ({ overflowX: 'visible', overflowY: 'visible', position: 'static' }));
		expect(bornes(liste)).toEqual({ left: 0, top: -Infinity, right: 1000, bottom: Infinity });
	});

	it('ancêtre en position fixe (plein écran) : ses ancêtres ne coupent plus, la fenêtre borne en hauteur', () => {
		positions.set(menu, 'fixed');
		expect(bornes(liste)).toEqual({ left: 0, top: 0, right: 1000, bottom: 800 });
	});
});

describe('placerMenu', () => {
	it('tient dans les bornes : placement par défaut, sous le bouton à gauche', () => {
		rects.set(liste, rectListe({}));
		placerMenu(liste);
		expect([liste.style.right, liste.style.bottom, liste.style.maxHeight]).toEqual(['', '', '']);
	});

	it('dépasse à droite : aligné sur le bord droit du bouton', () => {
		rects.set(liste, rectListe({ gauche: 300 }));
		placerMenu(liste);
		expect([liste.style.left, liste.style.right]).toEqual(['auto', '0px']);
	});

	it('aligné à droite, dépasse alors à gauche : décalé juste assez pour rentrer', () => {
		rects.set(liste, rectListe({ gauche: 300, largeur: 390 }));
		placerMenu(liste);
		// bord droit à 380, largeur 390 : gauche à -10, ramenée à la marge (8)
		expect(parseFloat(liste.style.right)).toBe(-18);
	});

	it('dépasse en bas, plus de place dessous que dessus : hauteur limitée à la place disponible, défilement', () => {
		rects.set(menu, { left: 180, top: 60, right: 380, bottom: 80 });
		rects.set(liste, () => {
			const h = liste.style.maxHeight ? parseFloat(liste.style.maxHeight) : 400;
			return { left: 180, top: 80, right: 380, bottom: 80 + h };
		});
		placerMenu(liste);
		// bas du formulaire 300, marge 8, haut de la liste 80
		expect([liste.style.maxHeight, liste.style.overflowY, liste.style.bottom]).toEqual(['212px', 'auto', '']);
	});

	it('dépasse en bas, plus de place dessus : ouverte au-dessus du bouton, sans minimum de hauteur imposé', () => {
		rects.set(menu, { left: 180, top: 240, right: 380, bottom: 260 });
		rects.set(liste, () => {
			const h = liste.style.maxHeight ? Math.min(300, parseFloat(liste.style.maxHeight)) : 300;
			return liste.style.bottom === '100%' ? { left: 180, top: 240 - h, right: 380, bottom: 240 } : { left: 180, top: 260, right: 380, bottom: 260 + h };
		});
		placerMenu(liste);
		// dessous : 300 - 8 - 260 = 32 ; dessus : 240 - 0 - 8 = 232
		expect([liste.style.top, liste.style.bottom, liste.style.maxHeight, liste.style.overflowY]).toEqual(['auto', '100%', '232px', 'auto']);
	});

	it('repart du placement par défaut à chaque ouverture', () => {
		Object.assign(liste.style, { left: 'auto', right: '0px', top: 'auto', bottom: '100%', maxHeight: '10px', overflowY: 'auto' });
		rects.set(liste, rectListe({}));
		placerMenu(liste);
		expect([liste.style.left, liste.style.right, liste.style.top, liste.style.bottom, liste.style.maxHeight]).toEqual(['', '', '', '', '']);
	});
});

describe('menuOutil : placement à l\'ouverture et au redimensionnement', () => {
	it('placé à l\'ouverture, replacé au redimensionnement tant qu\'il est ouvert', () => {
		const outil = menuOutil({ nom: 'essai', libelle: 'Essai', elements: () => [{ libelle: 'Un', action: () => {} }] });
		menu.replaceWith(outil.element);
		rects.set(outil.element, { left: 180, top: 100, right: 380, bottom: 120 });
		const l = outil.element.querySelector('.tts-menu__liste');
		liste = l;
		let gauche = 180;
		rects.set(l, () => rectListe({ gauche })());
		outil.cible.click();
		expect(l.hidden).toBe(false);
		expect(l.style.right).toBe('');
		// la fenêtre change : la liste dépasse désormais à droite
		gauche = 300;
		window.dispatchEvent(new Event('resize'));
		expect(l.style.right).toBe('0px');
		outil.fermer();
		gauche = 180;
		window.dispatchEvent(new Event('resize'));
		// fermé : plus replacé
		expect(l.style.right).toBe('0px');
	});
});
