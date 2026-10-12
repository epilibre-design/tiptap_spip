// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLinkPopover } from '../../src/ui/LinkPopover.js';
import { openModelPopover } from '../../src/ui/ModelPopover.js';
import { apres, champ, cliquer, demonter, editor, fakeServices, monter, remplir, source, tick, valider, wrapper } from './outils.js';

afterEach(demonter);


describe('prévisualisation des modèles', () => {
	it('HTML du serveur, inerte ; la source reste identique', async () => {
		const services = fakeServices({ previsu_modele: ({ modele }) => `<div class="spip_document"><img src="x.png" alt="${modele}" onerror="alert(1)"></div>` });
		monter('Avant\n\n<doc12|center>\n\nUn <img3> ici', services);
		await tick();
		const [bloc, inline] = wrapper.querySelectorAll('.tts-model');
		expect(bloc.classList.contains('tts-model-block')).toBe(true);
		expect(bloc.querySelector('img').alt).toBe('<doc12|center>');
		expect(bloc.querySelector('img').hasAttribute('onerror')).toBe(false);
		expect(bloc.contentEditable).toBe('false');
		expect(bloc.getAttribute('aria-label')).toBe('Modèle doc 12');
		expect(inline.getAttribute('aria-label')).toBe('Modèle img 3');
		expect(inline.querySelector('img').alt).toBe('<img3>');
		expect(services.call).toHaveBeenCalledTimes(2);
		expect(source()).toBe('Avant\n\n<doc12|center>\n\nUn <img3> ici');
	});

	it('rendu vide ou erreur : le raccourci reste affiché', async () => {
		monter('<doc1>\n\n<doc2>', fakeServices({ previsu_modele: ({ modele }) => (modele === '<doc1>' ? '' : Promise.reject(new Error('x'))) }));
		await tick();
		const [vide, erreur] = wrapper.querySelectorAll('.tts-model');
		expect(vide.classList.contains('tts-model--vide')).toBe(true);
		expect(vide.textContent).toContain('<doc1>');
		expect(erreur.classList.contains('tts-model--erreur')).toBe(true);
		expect(erreur.textContent).toContain('<doc2>');
	});

	it('sans services : affichage compact, pas de NodeView', () => {
		monter('<doc12|center>');
		expect(wrapper.querySelector('.tts-model').textContent).toBe('<doc12|center>');
		expect(wrapper.querySelector('.tts-model__modifier')).toBeNull();
	});

	it('bouton « Modifier » : popover prérempli, nouveau raccourci écrit dans la source', async () => {
		monter('Avant\n\n<doc12|center>', fakeServices({ previsu_modele: '<p>doc</p>' }));
		await tick();
		wrapper.querySelector('.tts-model__modifier').click();
		expect(champ('raccourci').value).toBe('<doc12|center>');
		remplir('raccourci', '<doc12|left>');
		valider();
		await tick();
		expect(source()).toBe('Avant\n\n<doc12|left>');
	});
});

describe('titres des liens sans texte', () => {
	it('titre calculé par SPIP, jamais écrit dans la source', async () => {
		const services = fakeServices({ titre_lien: ({ cibles }) => cibles.map((cible) => ({ cible, titre: cible === 'art1' ? 'Un article' : null })) });
		monter('Voir [->art1] et [->art2].', services);
		await tick();
		await tick();
		const [a, b] = wrapper.querySelectorAll('.tts-link-auto');
		expect(a.textContent).toBe('Un article');
		expect(b.textContent).toBe('→ art2');
		expect(services.call).toHaveBeenCalledTimes(1);
		expect(source()).toBe('Voir [->art1] et [->art2].');
	});
});

describe('popover de lien', () => {
	it('Ctrl+K sur une sélection : nouveau lien avec bulle, langue, nouvelle fenêtre', () => {
		monter('Bonjour monde');
		editor.commands.setTextSelection({ from: apres('Bonjour '), to: apres('monde') });
		editor.commands.keyboardShortcut('Mod-k');
		remplir('cible', 'art12');
		remplir('bulle', 'Une bulle');
		remplir('langue', 'en');
		remplir('nouvelle_fenetre', true);
		valider();
		expect(source()).toBe('Bonjour [monde|Une bulle{en}->>art12]');
		expect(wrapper.querySelector('.tts-popover')).toBeNull();
	});

	it('curseur seul : lien sans texte', () => {
		monter('Voir ');
		editor.commands.setTextSelection(apres('Voir '));
		openLinkPopover({ editor, wrapper });
		remplir('cible', 'rub3');
		valider();
		expect(source()).toBe('Voir [->rub3]');
	});

	it('curseur dans un lien : le lien entier est modifié, ou retiré', () => {
		monter('Voir [la doc|bulle->art12].');
		editor.commands.setTextSelection(apres('la d'));
		openLinkPopover({ editor, wrapper });
		expect(champ('cible').value).toBe('art12');
		expect(champ('bulle').value).toBe('bulle');
		remplir('cible', 'art13');
		valider();
		expect(source()).toBe('Voir [la doc|bulle->art13].');
		editor.commands.setTextSelection(apres('la d'));
		openLinkPopover({ editor, wrapper });
		cliquer('retirer');
		expect(source()).toBe('Voir la doc.');
	});

	it('lien sans texte sélectionné : « Figer le titre » écrit le titre résolu', async () => {
		const services = fakeServices({ titre_lien: ({ cibles }) => cibles.map((cible) => ({ cible, titre: 'Mon article', url: 'spip.php?article1' })) });
		const { ui } = monter('Voir [->art1].', services);
		await tick();
		editor.commands.setNodeSelection(apres('Voir '));
		ui.openLink();
		cliquer('figer');
		await tick();
		expect(source()).toBe('Voir [Mon article->art1].');
	});

	it('« Figer le titre » vise le lien même si le document change pendant l\'appel', async () => {
		let repondre;
		const titres = new Promise((r) => { repondre = r; });
		const services = fakeServices({ titre_lien: () => titres });
		const { ui } = monter('Voir [->art1].', services);
		editor.commands.setNodeSelection(apres('Voir '));
		ui.openLink();
		cliquer('figer');
		// pendant l'appel, du texte est inséré avant le lien
		editor.commands.insertContentAt(1, 'X');
		repondre([{ cible: 'art1', titre: 'Mon article', url: 'spip.php?article1' }]);
		await tick();
		await tick();
		expect(source()).toBe('XVoir [Mon article->art1].');
	});

	it('« Figer le titre » ne touche à rien si le lien a été supprimé pendant l\'appel', async () => {
		let repondre;
		const titres = new Promise((r) => { repondre = r; });
		const { ui } = monter('Voir [->art1] puis [->art2].', fakeServices({ titre_lien: () => titres }));
		editor.commands.setNodeSelection(apres('Voir '));
		ui.openLink();
		cliquer('figer');
		editor.commands.setNodeSelection(apres('Voir '));
		editor.commands.deleteSelection();
		repondre([{ cible: 'art1', titre: 'Mon article' }, { cible: 'art2', titre: 'Autre' }]);
		await tick();
		await tick();
		expect(source()).toBe('Voir  puis [->art2].');
	});

	it('cible vide : message d\'erreur, le popover reste ouvert', () => {
		monter('Voir');
		openLinkPopover({ editor, wrapper });
		valider();
		expect(wrapper.querySelector('.tts-popover__erreur').hidden).toBe(false);
		expect(wrapper.querySelector('.tts-popover')).not.toBeNull();
		expect(source()).toBe('Voir');
	});

	it('recherche d\'objets : une suggestion choisie devient la cible', async () => {
		vi.useFakeTimers();
		try {
			const services = fakeServices({ rechercher: [{ objet: 'article', id: 7, titre: 'Tiptap', raccourci: 'article7' }] });
			monter('Voir ');
			editor.commands.setTextSelection(apres('Voir '));
			openLinkPopover({ editor, wrapper, services });
			remplir('cible', 'tip');
			await vi.advanceTimersByTimeAsync(300);
			expect(services.call).toHaveBeenCalledWith('rechercher', expect.objectContaining({ q: 'tip' }));
			const suggestion = wrapper.querySelector('.tts-popover__suggestions li');
			expect(suggestion.textContent).toBe('Tiptap (article7)');
			suggestion.click();
			expect(champ('cible').value).toBe('article7');
			valider();
			expect(source()).toBe('Voir [->article7]');
		} finally {
			vi.useRealTimers();
		}
	});

	it('recherche d\'objets : services arrivés après l\'ouverture du popover (chargement à la demande)', async () => {
		vi.useFakeTimers();
		try {
			const services = fakeServices({ rechercher: [{ objet: 'article', id: 7, titre: 'Tiptap', raccourci: 'article7' }] });
			let fournir;
			const prets = new Promise((resolve) => { fournir = resolve; });
			monter('Voir ');
			editor.commands.setTextSelection(apres('Voir '));
			openLinkPopover({ editor, wrapper, services: prets });
			remplir('cible', 'tip');
			await vi.advanceTimersByTimeAsync(300);
			expect(services.call).not.toHaveBeenCalled();
			fournir(services);
			await vi.advanceTimersByTimeAsync(0);
			expect(services.call).toHaveBeenCalledWith('rechercher', expect.objectContaining({ q: 'tip' }));
			expect(wrapper.querySelector('.tts-popover__suggestions li').textContent).toBe('Tiptap (article7)');
		} finally {
			vi.useRealTimers();
		}
	});

	it('recherche d\'objets : pas de services (null), aucune suggestion', async () => {
		vi.useFakeTimers();
		try {
			monter('Voir ');
			openLinkPopover({ editor, wrapper, services: Promise.resolve(null) });
			remplir('cible', 'tip');
			await vi.advanceTimersByTimeAsync(300);
			expect(wrapper.querySelector('.tts-popover__suggestions li')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('Échap ferme sans rien changer', () => {
		monter('Voir');
		openLinkPopover({ editor, wrapper });
		remplir('cible', 'art1');
		champ('cible').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(wrapper.querySelector('.tts-popover')).toBeNull();
		expect(source()).toBe('Voir');
	});
});

describe('popover de modèle', () => {
	it('insertion : en bloc dans un paragraphe vide, en ligne dans un texte', () => {
		monter('Texte\n\nUn  mot');
		editor.commands.setTextSelection(editor.state.doc.content.size - 1);
		editor.commands.splitBlock();
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<doc12|center>');
		valider();
		editor.commands.setTextSelection(apres('Un '));
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<img3>');
		valider();
		expect(source()).toBe('Texte\n\nUn <img3> mot\n\n<doc12|center>');
	});

	it('raccourci invalide : erreur, rien n\'est inséré', () => {
		monter('Texte');
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<span>');
		valider();
		expect(wrapper.querySelector('.tts-popover__erreur').textContent).toBe('Ce n’est pas un raccourci de modèle.');
		expect(source()).toBe('Texte');
	});
});
