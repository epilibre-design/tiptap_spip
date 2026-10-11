// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instances, tiptap_spip_init } from '../../src/main.js';

const page = (html) => {
	document.body.innerHTML = html;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
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
		const button = document.querySelector('.tts-mode');
		button.click();
		expect(textarea.hidden).toBe(false);
		expect(content.hidden).toBe(true);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		button.click();
		expect(textarea.hidden).toBe(true);
		expect(content.hidden).toBe(false);
		expect(button.getAttribute('aria-pressed')).toBe('false');
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
});
