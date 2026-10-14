// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { langueAffichee } from '../../src/editor/extensions.js';
import { Popover } from '../../src/ui/popover.js';
import { apres, champ, cliquer, demonter, editor, erreur, fakeServices, monter, popovers, source, tick, valider, wrapper } from './outils.js';

afterEach(() => {
	demonter();
	document.documentElement.lang = '';
	delete globalThis.spipConfig;
});

/** Langues activées dans la configuration du multilinguisme. */
const activer = (...codes) => {
	globalThis.spipConfig = { tiptap_spip: { langues: codes.map((code) => ({ code, nom: { fr: 'français', en: 'English', de: 'Deutsch' }[code] ?? code })) } };
};
const options = (select) => [...select.options].map((o) => [o.value, o.textContent]);

/** Lignes du popover de multi : champ langue et sous-éditeur. */
const lignes = () => [...wrapper.querySelectorAll('.tts-multi__partie')].map((l) => ({
	langue: l.querySelector('[name=langue]'),
	sous: l.querySelector('.tts-multi__texte .ProseMirror')?.editor,
}));
const multiPos = () => {
	let pos = null;
	editor.state.doc.descendants((n, p) => {
		if (pos === null && n.type.name === 'spipMultiInline') pos = p;
	});
	return pos;
};

describe('multi en ligne', () => {
	it('texte sélectionné : première partie dans la langue de l\'interface, deuxième dans la langue activée suivante', () => {
		activer('en', 'fr', 'de');
		document.documentElement.lang = 'fr';
		const { ui } = monter('Un chat ici');
		editor.commands.setTextSelection({ from: apres('Un '), to: apres('chat') });
		ui.editMulti(null);
		const [fr, autre] = lignes();
		expect(fr.langue.value).toBe('fr');
		expect(fr.sous.getText()).toBe('chat');
		expect(autre.langue.value).toBe('en');
		autre.sous.commands.setContent('<p>cat</p>', { emitUpdate: true });
		valider();
		expect(source()).toBe('Un <multi>[fr]chat[en]cat</multi> ici');
	});

	it('sélecteur de langue : langues activées seulement, et « Sans langue »', () => {
		activer('fr', 'en');
		const { ui } = monter('x');
		ui.editMulti(null);
		expect(lignes()[0].langue.tagName).toBe('SELECT');
		expect(options(lignes()[0].langue)).toEqual([['fr', 'français (fr)'], ['en', 'English (en)'], ['', 'Sans langue']]);
	});

	it('langues activées que SPIP ne lit pas dans un multi (ber_tam_tfng, sh_latn) : non proposées', () => {
		activer('fr', 'ber_tam_tfng', 'sh_latn', 'pt_br');
		const { ui } = monter('x');
		ui.editMulti(null);
		expect(options(lignes()[0].langue).map(([v]) => v)).toEqual(['fr', 'pt_br', '']);
	});

	it('langue de l\'interface non activée : première langue activée ; langues toutes prises : sans langue', () => {
		activer('de', 'fr');
		document.documentElement.lang = 'en';
		const { ui } = monter('x');
		ui.editMulti(null);
		expect(lignes().map((l) => l.langue.value)).toEqual(['de', 'fr']);
		cliquer('ajouter_langue');
		expect(lignes()[2].langue.value).toBe('');
	});

	it('multi existant : une langue non activée reste proposée pour sa partie', () => {
		activer('fr', 'en');
		const { ui } = monter('x <multi>[fr]a[it]b</multi>');
		ui.editMulti(multiPos());
		expect(lignes().map((l) => l.langue.value)).toEqual(['fr', 'it']);
		expect(options(lignes()[0].langue).map(([v]) => v)).toEqual(['fr', 'en', '']);
		expect(options(lignes()[1].langue).map(([v]) => v)).toEqual(['fr', 'en', 'it', '']);
		valider();
		expect(source()).toBe('x <multi>[fr]a[it]b</multi>');
	});

	it('sans configuration : la langue de l\'interface', () => {
		document.documentElement.lang = 'fr';
		const { ui } = monter('x');
		ui.editMulti(null);
		expect(options(lignes()[0].langue)).toEqual([['fr', 'fr'], ['', 'Sans langue']]);
	});

	it('clic sur un multi : ses parties ; modification, partie retirée', () => {
		const { ui } = monter('x <multi>[fr]a[en]b[de]c</multi> y');
		ui.editMulti(multiPos());
		expect(lignes().map((l) => l.langue.value)).toEqual(['fr', 'en', 'de']);
		wrapper.querySelectorAll('[name=retirer_langue]')[2].click();
		lignes()[1].sous.commands.setContent('<p>B <strong>gras</strong></p>', { emitUpdate: true });
		valider();
		expect(source()).toBe('x <multi>[fr]a[en]B {{gras}}</multi> y');
	});

	it('ouvert puis appliqué sans changement : restitué à l\'identique', () => {
		const { ui } = monter('x <multi> [fr]a  b[en]c</multi> y');
		ui.editMulti(multiPos());
		valider();
		expect(source()).toBe('x <multi> [fr]a  b[en]c</multi> y');
	});

	it('deux parties sans langue : erreur', () => {
		const { ui } = monter('x <multi>[fr]a[en]b</multi>');
		ui.editMulti(multiPos());
		lignes()[0].langue.value = '';
		lignes()[1].langue.value = '';
		valider();
		expect(erreur().textContent).toBe('Ce multi ne peut pas s’écrire tel quel (code de langue, langue sans code en double, texte).');
		expect(source()).toBe('x <multi>[fr]a[en]b</multi>');
	});

	it('« Supprimer le multi » : reste le texte de la langue affichée', () => {
		document.documentElement.lang = 'en';
		const { ui } = monter('x <multi>[fr]{{a}}[en]{{b}}</multi> y');
		ui.editMulti(multiPos());
		cliquer('supprimer');
		expect(source()).toBe('x {{b}} y');
	});

	it('lien ouvert depuis une partie : popover enfant', () => {
		const { ui } = monter('x <multi>[fr]voir[en]see</multi>');
		ui.editMulti(multiPos());
		const { sous } = lignes()[1];
		sous.commands.focus();
		sous.commands.selectAll();
		sous.commands.keyboardShortcut('Mod-k');
		expect(popovers()).toHaveLength(2);
		champ('cible').value = 'art1';
		valider();
		valider();
		expect(source()).toBe('x <multi>[fr]voir[en][see->art1]</multi>');
	});

	it('Échap : sous-éditeurs détruits', () => {
		const { ui } = monter('x <multi>[fr]a[en]b</multi>');
		ui.editMulti(multiPos());
		const sous = lignes().map((l) => l.sous);
		Popover.current.close();
		expect(sous.every((s) => s.isDestroyed)).toBe(true);
	});
});

describe('multi bloc', () => {
	it('paragraphe vide : nouveau multi bloc, langues ajoutées', () => {
		activer('fr', 'en');
		document.documentElement.lang = 'fr';
		const { ui } = monter('Avant');
		editor.commands.setTextSelection(apres('Avant'));
		editor.commands.splitBlock();
		ui.editMulti(null);
		// inséré à « Appliquer » seulement
		expect(editor.state.doc.child(1).type.name).toBe('paragraph');
		expect(wrapper.querySelector('[name=supprimer]')).toBeNull();
		cliquer('ajouter_langue');
		expect(lignes()[1].langue.value).toBe('en');
		valider();
		expect(editor.state.doc.child(1).type.name).toBe('spipMultiBlock');
		editor.commands.insertContent('Bonjour');
		// ligne vide entre les parties : sans elle, le multi se relirait en ligne
		expect(source()).toBe('Avant\n\n<multi>[fr]Bonjour\n\n[en]</multi>');
	});

	it('nouveau multi bloc annulé, ou fermé par Échap : document inchangé', () => {
		document.documentElement.lang = 'fr';
		const { ui } = monter('');
		ui.editMulti(null);
		cliquer('annuler');
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe('');
		ui.editMulti(null);
		champ('langue').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe('');
	});

	it('curseur dans un multi bloc : langues modifiées, partie retirée, puis multi supprimé', () => {
		activer('fr', 'fr_fem', 'en', 'de');
		document.documentElement.lang = 'en';
		const { ui } = monter('<multi>[fr]Un\n\nDeux[en]One\n\nTwo[de]Eins</multi>');
		editor.commands.setTextSelection(apres('On'));
		ui.editMulti(null);
		expect(lignes().map((l) => l.langue.value)).toEqual(['fr', 'en', 'de']);
		lignes()[0].langue.value = 'fr_fem';
		wrapper.querySelectorAll('[name=retirer_langue]')[2].click();
		valider();
		expect(source()).toBe('<multi>[fr_fem]Un\n\nDeux[en]One\n\nTwo</multi>');
		editor.commands.setTextSelection(apres('On'));
		ui.editMulti(null);
		cliquer('supprimer');
		expect(source()).toBe('One\n\nTwo');
	});
});

describe('langue affichée', () => {
	it('setLangueAffichee : multi en ligne affiché dans cette langue, autres parties de bloc estompées', () => {
		monter('x <multi>[fr]chat[en]cat</multi>\n\n<multi>[fr]Un\n\nDeux[en]One\n\nTwo</multi>');
		editor.commands.setLangueAffichee('en');
		expect(langueAffichee(editor.state)).toBe('en');
		expect(wrapper.querySelector('.tts-multi').textContent).toBe('cat');
		const parties = [...wrapper.querySelectorAll('.tts-lang')];
		expect(parties.map((p) => p.classList.contains('tts-lang--autre'))).toEqual([true, false]);
		editor.commands.setLangueAffichee('fr');
		expect(wrapper.querySelector('.tts-multi').textContent).toBe('chat');
	});
});

describe('idiomes', () => {
	it('traduction calculée par SPIP, raccourci en infobulle', async () => {
		const services = fakeServices({ idiomes: ({ cles }) => cles.map((cle) => ({ cle, texte: cle === 'info_titre' ? 'Titre' : null })) });
		monter('Voir <:info_titre:> et <:x:absente:>.', services);
		await tick();
		await tick();
		const [a, b] = wrapper.querySelectorAll('.tts-idiome');
		expect(a.textContent).toBe('Titre');
		expect(a.title).toBe('<:info_titre:>');
		expect(b.textContent).toBe('<:x:absente:>');
		expect(services.call).toHaveBeenCalledTimes(1);
		expect(source()).toBe('Voir <:info_titre:> et <:x:absente:>.');
	});

	it('clic : raccourci modifié, validé, ou idiome supprimé', () => {
		const { ui } = monter('Voir <:info_titre:>.');
		let pos = null;
		editor.state.doc.descendants((n, p) => {
			if (n.type.name === 'spipIdiome') pos = p;
		});
		ui.editIdiome(pos);
		champ('raccourci').value = 'pas un idiome';
		valider();
		expect(erreur().textContent).toBe('Ce n’est pas un raccourci d’idiome.');
		champ('raccourci').value = '<:tiptap_spip:lien:>';
		valider();
		expect(source()).toBe('Voir <:tiptap_spip:lien:>.');
		ui.editIdiome(pos);
		cliquer('retirer');
		expect(source()).toBe('Voir .');
	});
});
