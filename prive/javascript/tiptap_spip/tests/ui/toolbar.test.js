// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import BARRES from '../../src/ui/barres.json';
import '../../src/ui/composants.js';
import { Toolbar } from '../../src/ui/Toolbar.js';
import { apres, demonter, editor, monter, source, wrapper } from './outils.js';

afterEach(() => {
	demonter();
	document.documentElement.lang = '';
});

/** Instance simulée : mode, plein écran, langue de l'objet. */
const instance = (etat = {}) => ({
	mode: () => etat.mode ?? 'visual',
	toggleMode: vi.fn(() => {
		etat.mode = etat.mode === 'source' ? 'visual' : 'source';
	}),
	pleinEcran: () => Boolean(etat.plein),
	togglePleinEcran: vi.fn(),
	langue: () => etat.langue ?? 'fr',
});

/** Barre montée au-dessus de l'éditeur, mise à jour à chaque transaction comme dans main.js. */
const barre = (nom, { src = 'Texte', etat = {} } = {}) => {
	const { ui } = monter(src);
	const element = document.createElement('div');
	wrapper.prepend(element);
	const toolbar = new Toolbar({ ctx: { editor, ui, instance: instance(etat) }, barre: typeof nom === 'string' ? BARRES[nom] : nom, element });
	editor.on('transaction', () => toolbar.maj());
	return { toolbar, element, ui };
};
const outil = (nom) => wrapper.querySelector(`.tts-outil--${nom}`);
const touche = (cible, key) => cible.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
const tabulables = (element) => [...element.querySelectorAll('[tabindex="0"]')];

describe('construction', () => {
	it('barre edition dans l\'ordre déclaré, séparateurs, role toolbar', () => {
		const { element } = barre('edition');
		expect(element.getAttribute('role')).toBe('toolbar');
		const noms = [...element.children].map((e) => (e.matches('.tts-separateur') ? '|' : [...e.classList].find((c) => c.startsWith('tts-outil--') || c.startsWith('tts-menu--')).replace(/^tts-(outil|menu)--/, '')));
		expect(noms).toEqual(BARRES.edition);
	});

	it('composant inconnu : ignoré avec un avertissement ; options passées à la fabrique', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fabrique = vi.fn(() => ({ element: document.createElement('span') }));
		Toolbar.registerComponent('essai', fabrique);
		const { element } = barre(['gras', 'inconnu', { composant: 'essai', x: 1 }]);
		expect(warn).toHaveBeenCalledOnce();
		expect(element.children).toHaveLength(2);
		expect(fabrique.mock.calls[0][1]).toEqual({ x: 1 });
		warn.mockRestore();
		Toolbar.registre.delete('essai');
	});

	it('barres forum et minimale : ni note, ni modèle', () => {
		for (const nom of ['forum', 'minimale']) {
			const { element } = barre(nom);
			expect(element.querySelector('.tts-outil--note, .tts-outil--modele')).toBeNull();
			demonter();
		}
	});

	it('libellé traduit, bulle avec le raccourci, icône SVG masquée aux lecteurs d\'écran', () => {
		barre('edition');
		const gras = outil('gras');
		expect(gras.getAttribute('aria-label')).toBe('Gras');
		expect(gras.title).toBe('Gras (Ctrl+B)');
		expect(gras.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
	});
});

describe('clavier (roving tabindex)', () => {
	it('un seul élément tabulable ; flèches, Début, Fin ; éléments désactivés sautés', () => {
		const { element } = barre('edition');
		// rien à annuler ni à rétablir : la barre commence au menu Titre
		expect(tabulables(element)).toEqual([outil('titre')]);
		const premier = outil('titre');
		premier.focus();
		touche(premier, 'ArrowRight');
		expect(document.activeElement).toBe(outil('liste'));
		expect(tabulables(element)).toEqual([outil('liste')]);
		touche(document.activeElement, 'End');
		expect(document.activeElement).toBe(outil('pleinEcran'));
		touche(document.activeElement, 'ArrowRight');
		expect(document.activeElement).toBe(outil('titre'));
		touche(document.activeElement, 'ArrowLeft');
		expect(document.activeElement).toBe(outil('pleinEcran'));
		touche(document.activeElement, 'Home');
		expect(document.activeElement).toBe(outil('titre'));
	});

	it('mode source : seuls Source et Plein écran restent actifs', () => {
		const etat = {};
		const { toolbar } = barre('edition', { etat });
		outil('source').click();
		toolbar.maj();
		const actifs = [...wrapper.querySelectorAll('.tts-outil')].filter((b) => !b.disabled && !b.hidden);
		expect(actifs.map((b) => b.className)).toEqual(['tts-outil tts-outil--source', 'tts-outil tts-outil--pleinEcran']);
		expect(outil('source').getAttribute('aria-pressed')).toBe('true');
		outil('source').click();
		toolbar.maj();
		expect(outil('note').disabled).toBe(false);
	});
});

describe('composants', () => {
	it('gras : appliqué par le bouton, aria-pressed suit la sélection', () => {
		barre('edition', { src: 'un deux' });
		editor.commands.setTextSelection({ from: apres('un') - 2, to: apres('un') });
		outil('gras').click();
		expect(source()).toBe('{{un}} deux');
		expect(outil('gras').getAttribute('aria-pressed')).toBe('true');
		editor.commands.setTextSelection(apres('deu'));
		expect(outil('gras').getAttribute('aria-pressed')).toBe('false');
	});

	it('menu Titre au clavier : ↓ ouvre, ↓ puis Entrée choisit, Échap ferme et rend le focus', () => {
		barre('edition', { src: 'Texte' });
		editor.commands.setTextSelection(apres('Tex'));
		const bouton = outil('titre');
		touche(bouton, 'ArrowDown');
		expect(bouton.getAttribute('aria-expanded')).toBe('true');
		const items = [...wrapper.querySelectorAll('.tts-menu--titre [role=menuitemradio]')];
		expect(items.map((i) => i.textContent)).toEqual(['Paragraphe', 'Intertitre', 'Titre de niveau 3', 'Titre de niveau 4']);
		expect(items[0].getAttribute('aria-checked')).toBe('true');
		expect(document.activeElement).toBe(items[0]);
		touche(items[0], 'ArrowDown');
		expect(document.activeElement).toBe(items[1]);
		items[1].click();
		expect(source()).toBe('{{{Texte}}}');
		expect(bouton.getAttribute('aria-expanded')).toBe('false');
		touche(bouton, 'ArrowDown');
		const premier = wrapper.querySelector('.tts-menu--titre [role=menuitemradio]');
		const echap = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		premier.dispatchEvent(echap);
		expect(echap.defaultPrevented).toBe(true);
		expect(bouton.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(bouton);
	});

	it('menu fermé par un clic ailleurs ; un seul menu ouvert à la fois', () => {
		barre('edition');
		outil('titre').click();
		outil('liste').click();
		expect(outil('titre').getAttribute('aria-expanded')).toBe('false');
		expect(outil('liste').getAttribute('aria-expanded')).toBe('true');
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(outil('liste').getAttribute('aria-expanded')).toBe('false');
	});

	it('glossaire désactivé sur une sélection avec [', () => {
		barre('edition', { src: 'a [b' });
		editor.commands.selectAll();
		expect(outil('glossaire').disabled).toBe(true);
		editor.commands.setTextSelection(apres('a'));
		expect(outil('glossaire').disabled).toBe(false);
	});

	it('guillemets selon la langue de l\'objet', () => {
		barre('edition', { src: 'mot', etat: { langue: 'de' } });
		editor.commands.setTextSelection({ from: 1, to: apres('mot') });
		outil('guillemets').click();
		const items = [...wrapper.querySelectorAll('.tts-menu--guillemets [role=menuitem]')];
		expect(items.map((i) => i.textContent)).toEqual(['„…“', '‚…‘']);
		items[0].click();
		expect(source()).toBe('„mot“');
	});

	it('alignement : choix coché', () => {
		barre('edition', { src: 'A' });
		editor.commands.setTextSelection(apres('A'));
		outil('alignement').click();
		let items = [...wrapper.querySelectorAll('.tts-menu--alignement [role=menuitemradio]')];
		expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'false', 'true']);
		items[1].click();
		expect(source()).toBe('<div class="text-center">\n\nA\n\n</div>');
		outil('alignement').click();
		items = [...wrapper.querySelectorAll('.tts-menu--alignement [role=menuitemradio]')];
		expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'false']);
	});

	it('alignement d\'une sélection mixte : aucun choix coché, « Sans alignement » possible', () => {
		barre('edition', { src: 'A\n\n<div class="text-center">\n\nB\n\n</div>' });
		const coches = () => [...wrapper.querySelectorAll('.tts-menu--alignement [role=menuitemradio]')].map((i) => i.getAttribute('aria-checked'));
		for (const [de, a] of [['A', 'B'], ['B', 'B']]) {
			editor.commands.setTextSelection({ from: apres(de) - 1, to: apres(a) });
			outil('alignement').click();
			const attendu = de === 'A' ? ['false', 'false', 'false', 'false', 'false'] : ['false', 'true', 'false', 'false', 'false'];
			expect(coches()).toEqual(attendu);
			expect(wrapper.querySelector('.tts-menu--alignement [role=menuitemradio]:last-child').disabled).toBe(false);
			outil('alignement').click();
		}
	});

	it('tableau : insertion, puis éléments de ligne et de colonne possibles dans le tableau', () => {
		barre('edition', { src: 'A' });
		editor.commands.setTextSelection(apres('A'));
		outil('tableau').click();
		const possibles = () => [...wrapper.querySelectorAll('.tts-menu--tableau [role=menuitem]')].filter((i) => !i.disabled).map((i) => i.textContent);
		expect(possibles()).toEqual(['Insérer un tableau']);
		wrapper.querySelector('.tts-menu--tableau [role=menuitem]').click();
		outil('tableau').click();
		expect(possibles()).toContain('Insérer une ligne en dessous');
		expect(possibles()).not.toContain('Insérer un tableau');
	});

	it('caractères et casse', () => {
		barre('edition', { src: 'ab' });
		editor.commands.setTextSelection(apres('a'));
		outil('caracteres').click();
		wrapper.querySelector('.tts-menu--caracteres [role=menuitem]').click();
		expect(source()).toBe('aÀb');
	});

	it('plein écran : bouton bascule, libellé « Quitter » une fois actif', () => {
		const etat = {};
		const { toolbar } = barre('edition', { etat });
		outil('pleinEcran').click();
		etat.plein = true;
		toolbar.maj();
		expect(outil('pleinEcran').getAttribute('aria-pressed')).toBe('true');
		expect(outil('pleinEcran').getAttribute('aria-label')).toBe('Quitter le plein écran');
	});

	it('sélecteur de langue : masqué sans multi', () => {
		barre('edition', { src: 'x <multi>[fr]a[en]b</multi>' });
		const select = wrapper.querySelector('.tts-outil--langues');
		expect(select.hidden).toBe(false);
		editor.commands.setContent('<p>y</p>', { emitUpdate: true });
		expect(select.hidden).toBe(true);
	});
});
