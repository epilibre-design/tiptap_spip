// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apres, champ, cliquer, demonter, editor, erreur, fakeServices, monter, popovers, remplir, source, tick, valider } from './outils.js';

afterEach(demonter);

describe('popover de glossaire', () => {
	it('Ctrl+Alt+G sur un mot sélectionné : terme avec glossaire, numéro, bulle', () => {
		monter('Le SPIP est là');
		editor.commands.setTextSelection({ from: apres('Le '), to: apres('SPIP') });
		editor.commands.keyboardShortcut('Mod-Alt-g');
		expect(champ('terme')).toBeUndefined();
		remplir('glossaire', 'mots');
		remplir('numero', '12');
		remplir('bulle', 'Système');
		valider();
		expect(source()).toBe('Le [?SPIP#mots12|Système] est là');
		expect(popovers()).toHaveLength(0);
	});

	it('curseur dans un terme : modification du terme entier, puis retrait', () => {
		const { ui } = monter('Le [?SPIP#mots12] ici');
		editor.commands.setTextSelection(apres('SP'));
		ui.openGlossary();
		expect(champ('glossaire').value).toBe('mots');
		expect(champ('numero').value).toBe('12');
		remplir('langue', 'fr');
		valider();
		expect(source()).toBe('Le [?SPIP#mots12{fr}] ici');
		editor.commands.setTextSelection(apres('SP'));
		ui.openGlossary();
		cliquer('retirer');
		expect(source()).toBe('Le SPIP ici');
	});

	it('curseur seul : champ « Terme », terme inséré', () => {
		const { ui } = monter('Voir ');
		editor.commands.setTextSelection(apres('Voir '));
		ui.openGlossary();
		remplir('terme', 'CMS');
		valider();
		expect(source()).toBe('Voir [?CMS]');
	});

	it('saisie qui ne s\'écrit pas en raccourci : erreur, popover ouvert', () => {
		const { ui } = monter('Voir ');
		editor.commands.setTextSelection(apres('Voir '));
		ui.openGlossary();
		remplir('terme', 'S{P}');
		valider();
		expect(erreur().hidden).toBe(false);
		expect(popovers()).toHaveLength(1);
		remplir('terme', 'SPIP');
		remplir('numero', 'douze');
		valider();
		expect(erreur().textContent).toBe('Ce terme ou ces réglages ne peuvent pas s’écrire en raccourci de glossaire.');
		expect(source()).toBe('Voir ');
	});

	it('sélection sur deux paragraphes : refusée', () => {
		const { ui } = monter('un\n\ndeux');
		editor.commands.setTextSelection({ from: 2, to: apres('de') });
		ui.openGlossary();
		valider();
		expect(erreur().textContent).toBe('Sélectionnez du texte d’un même paragraphe.');
	});

	it('services : liste des glossaires du site, « Voir la définition » ouvre l\'URL calculée par SPIP', async () => {
		const services = fakeServices({ glossaire: ({ raccourci }) => ({ url: `https://def/${raccourci}`, glossaires: ['mots', 'wikipedia'] }) });
		// fenêtre ouverte au clic, avant la réponse du serveur (bloqueurs de fenêtres) : envoyée à l'URL
		const fenetre = { opener: 'page', location: null, close: vi.fn() };
		const open = vi.spyOn(globalThis, 'open').mockImplementation(() => fenetre);
		try {
			const { ui } = monter('Le [?SPIP] ici', services);
			editor.commands.setTextSelection(apres('SP'));
			ui.openGlossary();
			await tick();
			expect([...document.querySelectorAll('datalist option')].map((o) => o.value)).toEqual(['mots', 'wikipedia']);
			expect(champ('glossaire').getAttribute('list')).toBe(document.querySelector('datalist').id);
			remplir('glossaire', 'mots');
			cliquer('definition');
			expect(open).toHaveBeenCalledWith('', '_blank');
			expect(fenetre.opener).toBeNull();
			await tick();
			expect(services.call).toHaveBeenLastCalledWith('glossaire', { raccourci: '[?SPIP#mots]' });
			expect(fenetre.location).toBe('https://def/[?SPIP#mots]');
			expect(fenetre.close).not.toHaveBeenCalled();
			expect(popovers()).toHaveLength(1);
			// pas d'URL (glossaire inconnu, services en échec) : la fenêtre ouverte est refermée
			services.call.mockResolvedValueOnce({ url: null, glossaires: [] });
			cliquer('definition');
			await tick();
			expect(fenetre.close).toHaveBeenCalled();
		} finally {
			open.mockRestore();
		}
	});

	it('sans services : ni liste ni « Voir la définition »', () => {
		const { ui } = monter('Le [?SPIP] ici');
		editor.commands.setTextSelection(apres('SP'));
		ui.openGlossary();
		expect(champ('definition')).toBeUndefined();
		expect(document.querySelector('datalist')).toBeNull();
	});
});

describe('popover d\'abréviation', () => {
	it('texte sélectionné : explication et langue', () => {
		const { ui } = monter('Le CMS ici');
		editor.commands.setTextSelection({ from: apres('Le '), to: apres('CMS') });
		ui.openAbbr();
		remplir('explication', 'Content Management System');
		remplir('langue', 'en');
		valider();
		expect(source()).toBe('Le [CMS|Content Management System{en}] ici');
	});

	it('modification et retrait ; explication vide refusée', () => {
		const { ui } = monter('Le [CMS|x] ici');
		editor.commands.setTextSelection(apres('C'));
		ui.openAbbr();
		expect(champ('explication').value).toBe('x');
		remplir('explication', '');
		valider();
		expect(erreur().hidden).toBe(false);
		remplir('explication', 'Système');
		valider();
		expect(source()).toBe('Le [CMS|Système] ici');
		editor.commands.setTextSelection(apres('C'));
		ui.openAbbr();
		cliquer('retirer');
		expect(source()).toBe('Le CMS ici');
	});
});

describe('popover de lien : cible validée', () => {
	it('cible qui couperait le raccourci : refusée', () => {
		const { ui } = monter('Bonjour monde');
		editor.commands.setTextSelection({ from: apres('Bonjour '), to: apres('monde') });
		ui.openLink();
		remplir('cible', 'a]b');
		valider();
		expect(erreur().textContent).toBe('Cette cible ou cette bulle ne peut pas s’écrire dans un raccourci de lien.');
		expect(source()).toBe('Bonjour monde');
	});
});
