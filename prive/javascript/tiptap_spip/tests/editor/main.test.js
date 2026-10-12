// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instances, tiptap_spip_init } from '../../src/main.js';
import { Popover } from '../../src/ui/popover.js';

const page = (html) => {
	document.body.innerHTML = html;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	localStorage.clear();
	delete globalThis.spipConfig;
});

describe('tiptap_spip_init', () => {
	it('monte l\'éditeur sur les textareas du porte-plume et data-tts-toolbar, une seule fois', () => {
		page(`<form>
			<textarea class="inserer_barre_edition" name="texte">{{a}}</textarea>
			<textarea class="inserer_barre_forum" name="forum">b</textarea>
			<textarea data-tts-toolbar="minimale" name="ps">c</textarea>
			<textarea name="autre">d</textarea>
		</form>`);
		tiptap_spip_init();
		tiptap_spip_init();
		expect(instances.size).toBe(3);
		expect(document.querySelectorAll('.tts-editor').length).toBe(3);
		expect(document.querySelector('textarea[name=autre]').dataset.ttsMounted).toBeUndefined();
	});

	it('laisse les textareas de markdown_editor', () => {
		page('<textarea class="inserer_barre_edition inserer_md_barre_edition">a</textarea><textarea data-tts-toolbar="edition" data-md-editor-toolbar="edition">b</textarea>');
		tiptap_spip_init();
		expect(instances.size).toBe(0);
	});

	it('écarte le porte-plume : classes no_barre et no_previsualisation', () => {
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		expect(textarea.classList.contains('no_barre')).toBe(true);
		expect(textarea.classList.contains('no_previsualisation')).toBe(true);
	});

	it('remplace le textarea par l\'éditeur, le textarea reste dans le formulaire', () => {
		page('<form><textarea class="inserer_barre_edition" name="texte" rows="5">Un {{texte}}</textarea></form>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		const wrapper = textarea.closest('.tts-editor');
		expect(wrapper.parentElement.tagName).toBe('FORM');
		expect(textarea.hidden).toBe(true);
		expect(wrapper.querySelector('.ProseMirror strong').textContent).toBe('texte');
	});

	it('bascule source / visuel avec le bouton de mode', () => {
		page('<textarea class="inserer_barre_edition">Texte</textarea>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		const content = document.querySelector('.tts-content');
		const button = document.querySelector('.tts-outil--source');
		button.click();
		expect(textarea.hidden).toBe(false);
		expect(content.hidden).toBe(true);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		button.click();
		expect(textarea.hidden).toBe(true);
		expect(content.hidden).toBe(false);
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	it('barre : lien, note, glossaire, abréviation, modèle, désactivés en mode source ; panneau des notes', () => {
		page('<textarea class="inserer_barre_edition">a[[une note]] b</textarea>');
		tiptap_spip_init();
		const visuels = ['lien', 'note', 'glossaire', 'abbr', 'modele'].map((s) => document.querySelector(`.tts-toolbar .tts-outil--${s}`));
		expect(visuels.every((b) => b && !b.disabled)).toBe(true);
		const panneau = document.querySelector('.tts-notes');
		expect(panneau.hidden).toBe(false);
		expect(panneau.querySelector('summary').textContent).toBe('Notes (1)');
		expect(panneau.previousElementSibling.classList.contains('tts-content')).toBe(true);
		document.querySelector('.tts-outil--source').click();
		expect(visuels.every((b) => b.disabled)).toBe(true);
		expect(panneau.hidden).toBe(true);
		document.querySelector('.tts-outil--source').click();
		expect(panneau.hidden).toBe(false);
		document.querySelector('.tts-outil--note').click();
		expect(document.querySelector('.tts-popover--note')).not.toBeNull();
		const { sous } = Popover.current;
		[...instances][0].destroy();
		expect(Popover.current).toBeNull();
		expect(sous.isDestroyed).toBe(true);
	});

	it('bouton Glossaire désactivé sur une sélection contenant [ ] < >', () => {
		page('<textarea class="inserer_barre_edition">un a&lt;b mot</textarea>');
		tiptap_spip_init();
		const { editor } = [...instances][0];
		const bouton = document.querySelector('.tts-outil--glossaire');
		editor.commands.setTextSelection({ from: 1, to: 6 });
		expect(bouton.disabled).toBe(true);
		editor.commands.setTextSelection({ from: 8, to: 11 });
		expect(bouton.disabled).toBe(false);
	});

	it('sélecteur de langue : présent avec des multis, langues du texte, change la langue affichée', () => {
		page('<textarea class="inserer_barre_edition">a <multi>[fr]chat[en]cat[de]Katze</multi></textarea>');
		document.documentElement.lang = 'fr';
		try {
			tiptap_spip_init();
			const select = document.querySelector('.tts-toolbar .tts-outil--langues');
			expect(select.hidden).toBe(false);
			expect([...select.options].map((o) => o.value)).toEqual(['fr', 'en', 'de']);
			select.value = 'de';
			select.dispatchEvent(new Event('change'));
			expect(document.querySelector('.tts-multi').textContent).toBe('Katze');
			expect(document.querySelector('.tts-outil--multi').disabled).toBe(false);
			document.querySelector('.tts-outil--source').click();
			expect(select.disabled).toBe(true);
			expect(document.querySelector('.tts-outil--multi').disabled).toBe(true);
		} finally {
			document.documentElement.lang = '';
		}
	});

	it('sélecteur de langue masqué sans multi', () => {
		page('<textarea class="inserer_barre_edition">rien</textarea>');
		tiptap_spip_init();
		expect(document.querySelector('.tts-outil--langues').hidden).toBe(true);
	});

	it('panneau des notes recalculé au retour du mode source', () => {
		page('<textarea class="inserer_barre_edition">a[[un]] b[[deux]]</textarea>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		const panneau = document.querySelector('.tts-notes');
		document.querySelector('.tts-outil--source').click();
		const saisir = (valeur) => {
			textarea.value = valeur;
			textarea.dispatchEvent(new Event('input'));
		};
		saisir('a b[[deux]] c[[trois]] d[[quatre]]');
		document.querySelector('.tts-outil--source').click();
		expect(panneau.querySelector('summary').textContent).toBe('Notes (3)');
		document.querySelector('.tts-outil--source').click();
		saisir('plus de note');
		document.querySelector('.tts-outil--source').click();
		expect(panneau.hidden).toBe(true);
	});

	it('barre selon l\'hôte : attribut, classe, champ, forum ; inconnue : minimale', () => {
		page(`<form>
			<textarea data-tts-toolbar="forum" class="inserer_barre_edition" name="a">a</textarea>
			<textarea class="inserer_barre_forum" name="b">b</textarea>
			<textarea data-tts-toolbar="nulle" name="c">c</textarea>
		</form>
		<form class="formulaire_spip"><textarea name="texte">d</textarea></form>
		<div class="formulaire_spip formulaire_forum"><form><textarea name="texte">e</textarea></form></div>`);
		tiptap_spip_init();
		const barre = (i) => [...document.querySelectorAll('.tts-toolbar')][i];
		const a = (i, nom) => Boolean(barre(i).querySelector(`.tts-outil--${nom}`));
		expect([0, 1, 2, 3, 4].map((i) => [a(i, 'note'), a(i, 'citation')])).toEqual([
			[false, true], [false, true], [false, false], [true, true], [false, true],
		]);
	});

	it('barre déclarée par la configuration (pipeline tiptap_spip_toolbars)', () => {
		globalThis.spipConfig = { tiptap_spip: { toolbars: { edition: ['gras', 'note'] } } };
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		expect([...document.querySelectorAll('.tts-toolbar .tts-outil')].map((b) => b.getAttribute('aria-label'))).toEqual(['Gras', 'Note']);
	});

	it('mode mémorisé : rouvert en source ; stockage indisponible : mode visuel', () => {
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		document.querySelector('.tts-outil--source').click();
		expect(localStorage.getItem('tiptap_spip.mode')).toBe('source');
		for (const instance of [...instances]) instance.destroy();
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		expect([...instances][0].mode()).toBe('source');
		expect(document.querySelector('textarea').hidden).toBe(false);
		for (const instance of [...instances]) instance.destroy();
		const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('bloqué');
		});
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		expect([...instances][0].mode()).toBe('visual');
		lire.mockRestore();
	});

	it('mode par défaut de la configuration', () => {
		globalThis.spipConfig = { tiptap_spip: { mode: 'source' } };
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		expect([...instances][0].mode()).toBe('source');
	});

	it('raccourcis : Mod-Shift-E bascule le mode, F11 le plein écran, Échap en sort sauf popover ouvert', () => {
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		const instance = [...instances][0];
		const touche = (cible, key, options = {}) => {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
			cible.dispatchEvent(event);
			return event;
		};
		touche(instance.editor.view.dom, 'E', { ctrlKey: true, shiftKey: true });
		expect(instance.mode()).toBe('source');
		touche(instance.textarea, 'E', { ctrlKey: true, shiftKey: true });
		expect(instance.mode()).toBe('visual');
		expect(touche(instance.editor.view.dom, 'F11').defaultPrevented).toBe(true);
		expect(instance.wrapper.classList.contains('tts-editor--plein-ecran')).toBe(true);
		expect(document.documentElement.classList.contains('tts-plein-ecran')).toBe(true);
		expect(document.querySelector('.tts-outil--pleinEcran').getAttribute('aria-pressed')).toBe('true');
		instance.ui.openLink();
		touche(document.querySelector('.tts-popover input'), 'Escape');
		expect(Popover.current).toBeNull();
		expect(instance.pleinEcran()).toBe(true);
		document.querySelector('.tts-outil--titre').click();
		touche(document.querySelector('.tts-menu__element'), 'Escape');
		expect(instance.pleinEcran()).toBe(true);
		// ProseMirror empêche l'action par défaut de toute touche Échap
		instance.editor.view.dom.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
		touche(instance.editor.view.dom, 'Escape');
		expect(instance.pleinEcran()).toBe(false);
		touche(instance.editor.view.dom, 'F11');
		instance.destroy();
		expect(document.documentElement.classList.contains('tts-plein-ecran')).toBe(false);
	});

	it('barre d\'état sous le textarea, masquée en mode source ; le bouton ouvre la source de l\'anomalie', () => {
		page('<textarea class="inserer_barre_edition">Un {deux</textarea>');
		tiptap_spip_init();
		const etat = document.querySelector('.tts-etat');
		expect(etat.previousElementSibling.tagName).toBe('TEXTAREA');
		expect(etat.textContent).toBe('2 mots1 anomalie de syntaxe');
		etat.querySelector('button').click();
		expect(document.querySelector('.tts-popover--brut textarea').value).toBe('Un {deux');
		Popover.current.close();
		document.querySelector('.tts-outil--source').click();
		expect(etat.hidden).toBe(true);
	});

	it('zone éditable nommée comme le champ : label, sinon aria-label, sinon nom générique', () => {
		page(`<form><label for="t">Texte de l'article</label><textarea id="t" class="inserer_barre_edition">a</textarea>
			<textarea class="inserer_barre_edition" aria-label="Post-scriptum">b</textarea>
			<textarea class="inserer_barre_edition">c</textarea></form>`);
		tiptap_spip_init();
		const zones = [...document.querySelectorAll('.ProseMirror')];
		expect(zones.map((z) => z.getAttribute('aria-label'))).toEqual(['Texte de l\'article', 'Post-scriptum', 'Texte']);
		expect(zones[0].getAttribute('aria-multiline')).toBe('true');
	});

	it('ne monte rien si la source n\'est pas représentable', () => {
		page('<textarea class="inserer_barre_edition">Texte</textarea>');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		tiptap_spip_init(document, { createEditor: () => {
			throw new Error('invalide');
		} });
		const textarea = document.querySelector('textarea');
		expect(instances.size).toBe(0);
		expect(textarea.hidden).toBe(false);
		expect(textarea.dataset.ttsMounted).toBe('erreur');
		expect(document.querySelector('.tts-editor')).toBeNull();
		expect(warn).toHaveBeenCalled();
	});

	it('détruit l\'éditeur quand le textarea quitte le DOM (rechargement AJAX, crayon fermé)', async () => {
		page('<div id="bloc"><textarea class="inserer_barre_edition">Texte</textarea></div>');
		tiptap_spip_init();
		const [instance] = instances;
		document.getElementById('bloc').remove();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(instances.size).toBe(0);
		expect(instance.editor.isDestroyed).toBe(true);
	});

	it('ne cherche que dans la racine fournie (onAjaxLoad)', () => {
		page('<div id="a"><textarea class="inserer_barre_edition">a</textarea></div><div id="b"><textarea class="inserer_barre_edition">b</textarea></div>');
		tiptap_spip_init(document.getElementById('b'));
		expect(instances.size).toBe(1);
		expect(document.querySelector('#a textarea').dataset.ttsMounted).toBeUndefined();
	});

	it('accepte une racine jQuery (triggerAjaxLoad de Crayons)', () => {
		page('<div id="a"><textarea class="inserer_barre_edition">a</textarea></div><div id="b"><textarea class="inserer_barre_edition">b</textarea></div>');
		const b = document.getElementById('b');
		tiptap_spip_init({ jquery: '3.7.1', 0: b, length: 1 });
		expect(instances.size).toBe(1);
		expect(document.querySelector('#b textarea').dataset.ttsMounted).toBe('oui');
	});

	it('monte aussi sur le champ texte des formulaires SPIP, comme le porte-plume (editer_article)', () => {
		page('<div class="formulaire_spip formulaire_editer"><form><textarea name="texte">a</textarea><textarea name="ps">b</textarea></form></div>');
		tiptap_spip_init();
		expect(instances.size).toBe(1);
		expect(document.querySelector('textarea[name=texte]').dataset.ttsMounted).toBe('oui');
	});

	it('relie chaque éditeur au formulaire de services de son champ (identifiant d\'instance)', () => {
		const services = (instance, champ) => `<div class="tts-services" hidden data-tts-instance="${instance}" data-tts-champ="${champ}"><form action="/ecrire/"></form></div>`;
		page(`<div class="formulaire_spip"><form data-tts-instance="tts-aaa"><textarea name="texte">a</textarea></form></div>${services('tts-aaa', 'texte')}
			<div class="formulaire_spip"><form data-tts-instance="tts-bbb"><textarea name="texte">b</textarea></form></div>${services('tts-bbb', 'texte')}
			<div class="formulaire_spip"><form><textarea name="texte">c</textarea></form></div>`);
		tiptap_spip_init();
		const [a, b, c] = instances;
		expect(a.services.container.dataset.ttsInstance).toBe('tts-aaa');
		expect(b.services.container.dataset.ttsInstance).toBe('tts-bbb');
		expect(c.services).toBeNull();
	});

	it('racine sous forme de tableau d\'éléments (triggerAjaxLoad de Crayons)', () => {
		page('<div id="a"><textarea class="inserer_barre_edition">a</textarea></div><div id="b"><textarea class="inserer_barre_edition">b</textarea></div>');
		tiptap_spip_init([document.getElementById('b')]);
		expect(instances.size).toBe(1);
		expect(document.querySelector('#a textarea').dataset.ttsMounted).toBeUndefined();
	});

	it('crayons : équipés seulement si la configuration l\'active', () => {
		const crayon = '<div class="formulaire_spip"><form class="formulaire_crayon"><textarea class="crayon-active" name="content_wid1_texte">a</textarea></form></div>';
		page(crayon);
		tiptap_spip_init();
		expect(instances.size).toBe(0);
		globalThis.spipConfig = { tiptap_spip: { crayons: true } };
		try {
			tiptap_spip_init();
			expect(instances.size).toBe(1);
		} finally {
			delete globalThis.spipConfig;
		}
	});

	it('site public avec les seuls crayons : formulaires publics laissés, crayons équipés', () => {
		const crayon = '<form class="formulaire_crayon"><textarea class="crayon-active" name="content_wid1_texte">a</textarea></form>';
		const forum = '<div class="formulaire_spip formulaire_forum"><form><textarea name="texte">b</textarea></form></div>';
		page(crayon + forum);
		globalThis.spipConfig = { tiptap_spip: { prive: false, public: false, crayons: true } };
		tiptap_spip_init();
		expect([...instances].map((i) => i.textarea.name)).toEqual(['content_wid1_texte']);
		// espace privé : formulaires toujours équipés, quel que soit le réglage public
		for (const instance of [...instances]) instance.destroy();
		page(forum);
		globalThis.spipConfig = { tiptap_spip: { prive: false, public: false, crayons: false } };
		tiptap_spip_init();
		expect(instances.size).toBe(0);
		globalThis.spipConfig = { tiptap_spip: { prive: true, public: false } };
		tiptap_spip_init();
		expect(instances.size).toBe(1);
	});

	it('formulaire d\'objet : seuls les champs de data-tts-champs sont équipés', () => {
		page(`<form class="formulaire_spip" data-tts-champs="texte ps">
			<textarea class="inserer_barre_edition" name="texte">a</textarea>
			<textarea class="inserer_barre_edition" name="chapo">b</textarea>
			<textarea class="inserer_barre_edition" name="ps">c</textarea>
		</form>
		<form class="formulaire_spip" data-tts-champs=""><textarea name="texte">d</textarea></form>`);
		tiptap_spip_init();
		expect([...instances].map((i) => i.textarea.name)).toEqual(['texte', 'ps']);
		expect(document.querySelector('textarea[name=chapo]').classList.contains('no_barre')).toBe(false);
	});

	it('crayons : seulement les champs configurés des objets connus', () => {
		const crayon = (cle, nom, champ) => `<form class="formulaire_crayon"><input class="crayon-id" value="${cle}"><input type="hidden" name="name_${cle}" value="${nom}"><textarea class="crayon-active" name="content_${cle}_${champ}">x</textarea></form>`;
		page(crayon('w1', 'article-texte-1', 'texte') + crayon('w2', 'article-chapo-1', 'chapo') + crayon('w3', 'livre-resume-2', 'resume'));
		globalThis.spipConfig = { tiptap_spip: { crayons: true, champs: { article: ['texte'] } } };
		tiptap_spip_init();
		expect([...instances].map((i) => i.textarea.name)).toEqual(['content_w1_texte', 'content_w3_resume']);
	});

	it('niveaux d\'intertitres de la configuration dans le menu Titre', () => {
		page('<textarea class="inserer_barre_edition" name="texte">a</textarea>');
		globalThis.spipConfig = { tiptap_spip: { niveaux: [2, 5] } };
		tiptap_spip_init();
		document.querySelector('.tts-outil[aria-label=Titre]').click();
		const items = [...document.querySelectorAll('.tts-menu--titre [role=menuitemradio]')];
		expect(items.map((i) => i.textContent)).toEqual(['Paragraphe', 'Intertitre', 'Titre de niveau 5']);
	});

	it('styles de contenu : espace privé par défaut, ou data-tts-styles', () => {
		page('<textarea class="inserer_barre_edition">a</textarea><textarea class="inserer_barre_edition" data-tts-styles="site">b</textarea>');
		globalThis.spipConfig = { tiptap_spip: { prive: true } };
		try {
			tiptap_spip_init();
		} finally {
			delete globalThis.spipConfig;
		}
		const [a, b] = document.querySelectorAll('.tts-editor');
		expect(a.classList.contains('tts-styles-contenu')).toBe(true);
		expect(b.classList.contains('tts-styles-contenu')).toBe(false);
	});

	it('sans formulaire de services rendu : services chargés à la demande pour le contexte du textarea', async () => {
		const fetch = vi.fn(async () => ({ ok: true, text: async () => '<div class="tts-services"><form action="/spip.php"></form></div>' }));
		vi.stubGlobal('fetch', fetch);
		globalThis.spipConfig = { tiptap_spip: { services: 'https://site.test/spip.php?page=tiptap_spip_services' } };
		try {
			page('<textarea data-tts-toolbar="minimale" name="bio" data-tts-objet="auteur" data-tts-id-objet="4" data-tts-champ="bio">a</textarea>');
			tiptap_spip_init();
			const [instance] = instances;
			const services = await instance.servicesPrets;
			expect(services.container.parentElement.id).toBe('tts-services');
			expect(new URL(fetch.mock.calls[0][0]).searchParams.get('objet')).toBe('auteur');
			expect(instance.services).toBe(services);
		} finally {
			delete globalThis.spipConfig;
			vi.unstubAllGlobals();
		}
	});

	it('services à la demande : le formulaire chargé part avec l\'éditeur, une réponse tardive n\'est pas ajoutée', async () => {
		let repondre;
		const fetch = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
			repondre = () => resolve({ ok: true, text: async () => '<div class="tts-services"><form action="/spip.php"></form></div>' });
			signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
		}));
		vi.stubGlobal('fetch', fetch);
		globalThis.spipConfig = { tiptap_spip: { services: 'https://site.test/spip.php?page=tiptap_spip_services' } };
		const charges = () => document.querySelectorAll('#tts-services .tts-services').length;
		const textarea = '<textarea data-tts-toolbar="minimale" name="bio" data-tts-objet="auteur" data-tts-id-objet="4" data-tts-champ="bio">a</textarea>';
		try {
			// chargé puis détruit : le formulaire est retiré
			page(textarea);
			tiptap_spip_init();
			let [instance] = instances;
			repondre();
			await instance.servicesPrets;
			expect(charges()).toBe(1);
			instance.destroy();
			expect(charges()).toBe(0);

			// détruit pendant le chargement : la réponse n'ajoute rien
			page(textarea);
			tiptap_spip_init();
			[instance] = instances;
			instance.destroy();
			repondre();
			expect(await instance.servicesPrets).toBeNull();
			expect(charges()).toBe(0);

			// même si fetch ignore l'annulation
			fetch.mockImplementation(async () => ({ ok: true, text: async () => '<div class="tts-services"><form action="/spip.php"></form></div>' }));
			page(textarea);
			tiptap_spip_init();
			[instance] = instances;
			instance.destroy();
			expect(await instance.servicesPrets).toBeNull();
			expect(charges()).toBe(0);
		} finally {
			delete globalThis.spipConfig;
			vi.unstubAllGlobals();
		}
	});

	it('formulaire de services rendu par la page : laissé en place à la destruction', () => {
		page(`<div class="formulaire_spip"><form data-tts-instance="tts-aaa"><textarea name="texte">a</textarea></form></div>
			<div class="tts-services" hidden data-tts-instance="tts-aaa" data-tts-champ="texte"><form action="/ecrire/"></form></div>`);
		tiptap_spip_init();
		[...instances][0].destroy();
		expect(document.querySelectorAll('.tts-services')).toHaveLength(1);
	});
});
