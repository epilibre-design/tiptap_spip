// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { partieAffichee } from '../../src/editor/texte.js';
import { serialize } from '../../src/spip/index.js';

let editor;
afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
	document.documentElement.lang = '';
});

const monter = (source) => {
	document.body.innerHTML = '<div></div>';
	editor = createEditor({ element: document.body.firstChild, source });
	return editor;
};

describe('multi en ligne', () => {
	it('affiché dans la langue de l\'interface, les autres en infobulle', () => {
		document.documentElement.lang = 'en';
		monter('Un <multi>[fr]{{chat}}[en]cat</multi> ici');
		const multi = document.querySelector('.tts-multi');
		expect(multi.textContent).toBe('cat');
		expect(multi.getAttribute('data-tts-lang')).toBe('en');
		expect(multi.title).toBe('fr : chat · en : cat');
		expect(serialize(editor.getJSON())).toBe('Un <multi>[fr]{{chat}}[en]cat</multi> ici');
	});

	it('partieAffichee : code exact, langue de base, sinon la première', () => {
		const parts = [{ lang: 'fr' }, { lang: 'pt_br' }, { lang: 'en' }];
		expect(partieAffichee(parts, 'en').lang).toBe('en');
		expect(partieAffichee(parts, 'pt-BR').lang).toBe('pt_br');
		expect(partieAffichee(parts, 'pt').lang).toBe('pt_br');
		expect(partieAffichee(parts, 'de').lang).toBe('fr');
		// langue en double : SPIP garde la dernière
		expect(partieAffichee([{ lang: 'fr', n: 1 }, { lang: 'fr', n: 2 }], 'fr').n).toBe(2);
	});

	it('copier-coller interne : multi recréé (forme canonique)', () => {
		monter('Un <multi> [fr]chat[en]cat</multi> ici');
		const html = editor.view.dom.innerHTML;
		editor.commands.setContent(html);
		expect(serialize(editor.getJSON())).toBe('Un <multi> [fr]chat[en]cat</multi> ici');
	});
});

describe('multi bloc', () => {
	const source = 'Avant\n\n<multi>[fr]Bonjour\n\nDeux[en]Hello\n\nTwo</multi>\n\nAprès';

	it('parties empilées avec leur langue, identité', () => {
		monter(source);
		const parties = [...document.querySelectorAll('.tts-multi-block .tts-lang')];
		expect(parties.map((p) => p.getAttribute('data-tts-lang'))).toEqual(['fr', 'en']);
		expect(parties[1].textContent).toBe('HelloTwo');
		expect(serialize(editor.getJSON())).toBe(source);
	});

	it('paragraphe modifié dans une partie : multi réécrit, le reste intact', () => {
		monter(source);
		let pos = null;
		editor.state.doc.descendants((n, p) => {
			if (pos === null && n.isText && n.text === 'Two') pos = p + 3;
		});
		editor.commands.insertContentAt(pos, ' more');
		expect(serialize(editor.getJSON())).toBe('Avant\n\n<multi>[fr]Bonjour\n\nDeux[en]Hello\n\nTwo more</multi>\n\nAprès');
	});
});

describe('idiomes', () => {
	it('affichés par leur raccourci, copier-coller', () => {
		monter('Voir <:tiptap_spip:lien:> et <:info_titre:>.');
		expect([...document.querySelectorAll('.tts-idiome')].map((e) => e.textContent)).toEqual(['<:tiptap_spip:lien:>', '<:info_titre:>']);
		editor.commands.setContent(editor.view.dom.innerHTML);
		expect(serialize(editor.getJSON())).toBe('Voir <:tiptap_spip:lien:> et <:info_titre:>.');
	});
});
