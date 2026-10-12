// @vitest-environment jsdom
import { Node } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allerRetour, oublierExtensions } from '../../src/api.js';
import { instances, tiptap_spip_init } from '../../src/main.js';
import { Popover } from '../../src/ui/popover.js';
import { Emoji, Faq, TIERCES } from '../fixtures/tierces.js';

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	delete globalThis.spipConfig;
	oublierExtensions();
	vi.restoreAllMocks();
});

const FAQ = '<faq|q=Q>\nR\n</faq>';

describe('window.tiptapSpip', () => {
	it('expose l\'API et le cœur de Tiptap du bundle (une seule copie de ProseMirror)', () => {
		const api = globalThis.tiptapSpip;
		expect(Object.keys(api).sort()).toEqual(['allerRetour', 'core', 'label', 'registerExtension', 'registerToolbarComponent', 'ui']);
		expect(api.core.Node).toBe(Node);
		expect(Object.keys(api.core).sort()).toEqual(['Extension', 'Mark', 'Node', 'Plugin', 'PluginKey', 'markInputRule', 'mergeAttributes', 'nodeInputRule']);
		expect(Object.keys(api.ui).sort()).toEqual(['Popover', 'boutonOutil', 'menuOutil']);
		expect(api.ui.Popover).toBe(Popover);
	});

	it('extension enregistrée avant le lancement : présente dans les éditeurs', () => {
		globalThis.tiptapSpip.registerExtension(Faq);
		document.body.innerHTML = `<textarea class="inserer_barre_edition" name="texte">${FAQ}</textarea>`;
		tiptap_spip_init();
		const [instance] = instances;
		expect(instance.editor.state.doc.firstChild.type.name).toBe('faqItem');
		instance.bridge.flush();
		expect(instance.textarea.value).toBe(FAQ);
	});

	it('restreinte à des barres : les autres éditeurs gardent la source brute', () => {
		globalThis.tiptapSpip.registerExtension(Faq, { toolbars: ['forum'] });
		document.body.innerHTML = `<textarea class="inserer_barre_edition" name="texte">${FAQ}</textarea><textarea class="inserer_barre_forum" name="forum">${FAQ}</textarea>`;
		tiptap_spip_init();
		const [edition, forum] = instances;
		expect(edition.editor.state.doc.firstChild.type.name).not.toBe('faqItem');
		expect(forum.editor.state.doc.firstChild.type.name).toBe('faqItem');
	});

	it('même nom enregistré deux fois : la dernière gagne, avec un avertissement', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		globalThis.tiptapSpip.registerExtension(Faq);
		const Autre = Faq.extend({ renderSpip: () => 'AUTRE' });
		globalThis.tiptapSpip.registerExtension(Autre);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('faqItem'));
		document.body.innerHTML = `<textarea data-tts-toolbar="edition" name="texte">${FAQ}</textarea>`;
		tiptap_spip_init();
		const [instance] = instances;
		instance.editor.commands.insertContentAt(2, 'x');
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('AUTRE');
	});

	it('extension invalide refusée', () => {
		expect(() => globalThis.tiptapSpip.registerExtension({})).toThrow(TypeError);
	});

	it('composant de barre enregistré, placé par la configuration des barres', () => {
		globalThis.tiptapSpip.registerToolbarComponent('faq', ({ editor }) => {
			const element = document.createElement('button');
			element.className = 'faq-bouton';
			element.addEventListener('click', () => editor.commands.insertContent({ type: 'faqItem', attrs: { question: 'N' }, content: [{ type: 'paragraph' }] }));
			return { element };
		});
		globalThis.tiptapSpip.registerExtension(Faq);
		globalThis.spipConfig = { tiptap_spip: { toolbars: { edition: ['gras', 'faq'] } } };
		document.body.innerHTML = '<textarea class="inserer_barre_edition" name="texte">x</textarea>';
		tiptap_spip_init();
		document.querySelector('.faq-bouton').click();
		const [instance] = instances;
		instance.bridge.flush();
		expect(instance.textarea.value).toContain('<faq|q=N>');
	});
});

describe('allerRetour (harnais des extensions tierces)', () => {
	it('source restituée, forme canonique stable, JSON valide pour le schéma', () => {
		const r = allerRetour(`Un :smile:\n\n${FAQ}`, TIERCES);
		expect(r).toMatchObject({ identique: true, stable: true, valide: true, canonique: `Un :smile:\n\n${FAQ}` });
		expect(r.json.content[1].type).toBe('faqItem');
	});

	it('extension dont l\'écriture ne se relit pas : stable faux', () => {
		const Perdu = Emoji.extend({ renderSpip: (n) => `[${n.attrs.nom}]` });
		expect(allerRetour('Un :smile:', [Perdu])).toMatchObject({ identique: true, stable: false });
	});

	it('contenu refusé par le schéma : valide faux', () => {
		const Etroite = Faq.extend({ content: 'paragraph' });
		expect(allerRetour('<faq|q=Q>\n-* liste\n</faq>', [Etroite]).valide).toBe(false);
	});
});
