// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseModel } from '../../src/spip/models.js';
import BARRES from '../../src/ui/barres.json';
import { catalogueDe, ouvrirCatalogue, parametresFormulaire, urlCatalogue } from '../../src/ui/catalogue.js';
import '../../src/ui/composants.js';
import { label } from '../../src/ui/labels.js';
import { Toolbar } from '../../src/ui/Toolbar.js';
import { demonter, editor, monter, source, tick, wrapper } from './outils.js';

// formulaire media.yaml du plugin Insérer modèles, tel que le décrit tiptap_spip_catalogue_modeles()
const MEDIA = {
	formulaire: 'media',
	nom: 'Document',
	modele: 'doc',
	id: 'id_modele',
	champs: ['align', 'largeur', 'masquer', 'titre'],
	valeurs: { left: 'align', center: 'align', right: 'align' },
	multiples: ['masquer'],
};
const URL_MODALBOX = 'http://site.test/spip.php?page=inserer_modeles&modalbox=oui&objet=article&id_objet=3';

/** Faux jQuery : modalbox mémorisée, contenu posé par le test comme le ferait le plugin. */
const fauxJQuery = () => {
	const $ = { modalbox: vi.fn(), modalboxclose: vi.fn() };
	$.modalboxclose.mockImplementation(() => $.modalbox.mock.lastCall?.[1]?.onClose?.());
	return $;
};
/** Ce que rend le formulaire du plugin après « Insérer » (formulaire ajax rechargé dans la modalbox). */
const renduInsertion = (code) => {
	const boite = document.createElement('div');
	boite.className = 'box_mediabox';
	boite.innerHTML = '<form><textarea readonly class="code_modele" id="code_modele_modalbox"></textarea></form>';
	boite.querySelector('textarea').value = code;
	document.body.append(boite);
};

describe('urlCatalogue', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('lit l\'URL posée par le plugin dans le formulaire du textarea', () => {
		document.body.innerHTML = `<form><textarea name="texte"></textarea><input type="hidden" disabled name="url_inserer_modeles" value="${URL_MODALBOX}"></form>`;
		expect(urlCatalogue(document.querySelector('textarea'))).toBe(URL_MODALBOX);
	});

	it('la cherche aussi après le formulaire (crayon : le plugin l\'ajoute à la suite)', () => {
		document.body.innerHTML = `<div class="crayon-html"><form><textarea name="texte"></textarea></form><input type="hidden" disabled name="url_inserer_modeles" value="${URL_MODALBOX}"></div>`;
		expect(urlCatalogue(document.querySelector('textarea'))).toBe(URL_MODALBOX);
	});

	it('null sans le plugin, ou sans formulaire', () => {
		document.body.innerHTML = '<form><textarea></textarea></form><textarea id="seul"></textarea>';
		expect(urlCatalogue(document.querySelector('form textarea'))).toBeNull();
		expect(urlCatalogue(document.querySelector('#seul'))).toBeNull();
	});
});

describe('catalogueDe', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		delete globalThis.spipConfig;
	});
	const textarea = (avecUrl) => {
		document.body.innerHTML = `<form><textarea></textarea>${avecUrl ? `<input type="hidden" disabled name="url_inserer_modeles" value="${URL_MODALBOX}">` : ''}</form>`;
		return document.querySelector('textarea');
	};

	it('URL du plugin pour ce textarea et modèles de la configuration', () => {
		globalThis.spipConfig = { tiptap_spip: { modeles: { doc: MEDIA } } };
		expect(catalogueDe(textarea(true))).toEqual({ url: URL_MODALBOX, modeles: { doc: MEDIA } });
	});

	it('null sans URL (pas de droit), sans plugin (modeles null) ou sans modèle proposé', () => {
		globalThis.spipConfig = { tiptap_spip: { modeles: { doc: MEDIA } } };
		expect(catalogueDe(textarea(false))).toBeNull();
		globalThis.spipConfig = { tiptap_spip: { modeles: null } };
		expect(catalogueDe(textarea(true))).toBeNull();
		globalThis.spipConfig = { tiptap_spip: { modeles: {} } };
		expect(catalogueDe(textarea(true))).toBeNull();
	});
});

describe('parametresFormulaire', () => {
	const params = (raccourci) => parametresFormulaire(parseModel(raccourci), MEDIA)?.toString() ?? null;

	it('préremplit le formulaire : identifiant, valeur seule, champ=valeur, cases à cocher', () => {
		expect(params('<doc12|left|largeur=200|masquer=legende,titre>'))
			.toBe('formulaire_modele=media&id_modele=12&align=left&largeur=200&masquer%5B%5D=legende&masquer%5B%5D=titre');
		expect(params('<doc5>')).toBe('formulaire_modele=media&id_modele=5');
	});

	it('valeur seule égale au nom d\'un champ : champ=champ, comme l\'écrit le plugin', () => {
		expect(params('<doc5|titre>')).toBe('formulaire_modele=media&id_modele=5&titre=titre');
	});

	it('null si un paramètre n\'a pas de champ : la réécriture le perdrait', () => {
		expect(params('<doc12|inconnu>')).toBeNull();
		expect(params('<doc12|foo=bar>')).toBeNull();
		expect(params('<doc12|left|right>')).toBeNull();
		expect(parametresFormulaire(parseModel('<doc12>'), { ...MEDIA, id: null })).toBeNull();
	});
});

describe('ouvrirCatalogue', () => {
	let $;
	beforeEach(() => {
		$ = fauxJQuery();
		globalThis.jQuery = $;
	});
	afterEach(() => {
		demonter();
		delete globalThis.jQuery;
	});

	it('liste des modèles : le raccourci rendu par le plugin est inséré, la modalbox fermée', async () => {
		monter('Intro');
		// paragraphe vide après l'intro : le modèle y est inséré en bloc
		editor.chain().setTextSelection(editor.state.doc.content.size - 1).splitBlock().run();
		expect(ouvrirCatalogue({ editor, url: URL_MODALBOX })).toBe(true);
		expect($.modalbox).toHaveBeenCalledWith(URL_MODALBOX, expect.objectContaining({ className: 'tts-catalogue', type: 'ajax' }));

		renduInsertion('<doc12|left>');
		await tick();

		expect(source()).toBe('Intro\n\n<doc12|left>');
		expect($.modalboxclose).toHaveBeenCalled();
	});

	it('modification : formulaire prérempli, le modèle à pos est remplacé', async () => {
		monter('Voir <doc12|left> ici');
		let pos = null;
		editor.state.doc.descendants((n, p) => { if (n.type.name === 'spipModel') pos = p; });
		ouvrirCatalogue({ editor, url: URL_MODALBOX, pos, parametres: new URLSearchParams('formulaire_modele=media&id_modele=12&align=left') });
		expect($.modalbox.mock.lastCall[0]).toBe(`${URL_MODALBOX}&formulaire_modele=media&id_modele=12&align=left`);

		renduInsertion('<doc12|center>');
		await tick();

		expect(source()).toBe('Voir <doc12|center> ici');
	});

	it('fermée sans insertion : rien ne change, plus rien n\'est observé', async () => {
		monter('Texte');
		ouvrirCatalogue({ editor, url: URL_MODALBOX });
		$.modalbox.mock.lastCall[1].onClose();
		renduInsertion('<doc12>');
		await tick();

		expect(source()).toBe('Texte');
	});

	it('un raccourci qui n\'est pas un modèle n\'est pas posé', async () => {
		monter('Texte');
		ouvrirCatalogue({ editor, url: URL_MODALBOX });
		renduInsertion('<b>');
		await tick();

		expect(source()).toBe('Texte');
	});

	it('sans modalbox (mediabox absent) : false, rien n\'est ouvert', () => {
		monter('Texte');
		globalThis.jQuery = {};
		expect(ouvrirCatalogue({ editor, url: URL_MODALBOX })).toBe(false);
	});

	it('une zone du porte-plume qui avait le focus ne reçoit pas le raccourci', () => {
		monter('Texte');
		$.markItUp = Object.assign(() => {}, { focused: document.createElement('textarea') });
		ouvrirCatalogue({ editor, url: URL_MODALBOX });
		expect($.markItUp.focused).toBeNull();
	});
});

describe('interface et barre', () => {
	const catalogue = { url: URL_MODALBOX, modeles: { doc: MEDIA } };
	let $;
	beforeEach(() => {
		$ = fauxJQuery();
		globalThis.jQuery = $;
	});
	afterEach(() => {
		demonter();
		delete globalThis.jQuery;
	});
	const position = () => {
		let pos = null;
		editor.state.doc.descendants((n, p) => { if (/^spipModel/.test(n.type.name)) pos = p; });
		return pos;
	};
	const popoverBrut = () => wrapper.querySelector('.tts-popover--modele');

	it('Modifier : formulaire du catalogue prérempli quand tous les paramètres ont un champ', () => {
		const { ui } = monter('Voir <doc12|left> ici', null, { catalogue });
		ui.editModel(position());
		expect($.modalbox.mock.lastCall[0]).toBe(`${URL_MODALBOX}&formulaire_modele=media&id_modele=12&align=left`);
		expect(popoverBrut()).toBeNull();
	});

	it('Modifier : saisie brute pour un paramètre sans champ ou un modèle hors catalogue', () => {
		for (const raccourci of ['<doc12|foo=bar>', '<img3|left>']) {
			const { ui } = monter(`Voir ${raccourci} ici`, null, { catalogue });
			ui.editModel(position());
			expect(popoverBrut()).not.toBeNull();
			demonter();
		}
		expect($.modalbox).not.toHaveBeenCalled();
	});

	it('sans catalogue : saisie brute, comme avant', () => {
		const { ui } = monter('Voir <doc12|left> ici');
		ui.editModel(position());
		expect(popoverBrut()).not.toBeNull();
		expect(ui.catalogue).toBeNull();
	});

	it('barre : menu Modèle (catalogue ou raccourci) avec catalogue, bouton sans', () => {
		const monterBarre = (options) => {
			const { ui } = monter('Texte', null, options);
			const element = document.createElement('div');
			wrapper.prepend(element);
			const instance = { mode: () => 'visual', pleinEcran: () => false, langue: () => 'fr' };
			return new Toolbar({ ctx: { editor, ui, instance }, barre: BARRES.edition, element });
		};

		monterBarre({ catalogue });
		const bouton = wrapper.querySelector('.tts-menu--modele .tts-outil--modele');
		bouton.click();
		const elements = [...wrapper.querySelectorAll('.tts-menu--modele [role=menuitem]')];
		expect(elements.map((e) => e.textContent)).toEqual([label('modele_catalogue'), label('modele_saisir')]);
		elements[0].click();
		expect($.modalbox.mock.lastCall[0]).toBe(URL_MODALBOX);
		demonter();

		monterBarre({});
		expect(wrapper.querySelector('.tts-menu--modele')).toBeNull();
		wrapper.querySelector('.tts-outil--modele').click();
		expect(popoverBrut()).not.toBeNull();
	});
});
