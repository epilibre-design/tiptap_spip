// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { serialize } from '../../src/spip/index.js';

let editor;
afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
});

const monter = (source) => {
	document.body.innerHTML = '<div></div>';
	editor = createEditor({ element: document.body.firstChild, source });
	return editor;
};
const appels = () => [...document.querySelectorAll('.tts-note')];
const labels = () => appels().map((el) => el.getAttribute('data-tts-label'));

describe('appels de note', () => {
	it('numérotés comme SPIP : automatiques comptées, nommées par leur nom, sans appel sans numéro', () => {
		monter('a[[un]] b[[<A>nommée]] c[[deux]] d[[<>cachée]]');
		expect(labels()).toEqual(['1', 'A', '2', '']);
		expect(appels()[3].getAttribute('data-tts-note-name')).toBe('');
		expect(appels()[0].getAttribute('aria-label')).toBe('Note 1 : un');
		expect(appels()[3].getAttribute('aria-label')).toBe('Note sans appel : cachée');
	});

	it('numérotation recalculée quand une note disparaît', () => {
		monter('a[[un]] b[[deux]] c[[trois]]');
		let pos = null;
		editor.state.doc.descendants((n, p) => {
			if (pos === null && n.type.name === 'spipNote') pos = p;
		});
		editor.commands.deleteRange({ from: pos, to: pos + 1 });
		expect(labels()).toEqual(['1', '2']);
		expect(appels().map((el) => el.title)).toEqual(['deux', 'trois']);
		expect(serialize(editor.getJSON())).toBe('a b[[deux]] c[[trois]]');
	});

	it('multi : seules comptent les notes de la partie affichée, numérotées dans le multi', () => {
		document.documentElement.lang = 'fr';
		try {
			monter('x <multi>[fr]bonjour [[note FR]] ici[en]hello</multi> y[[autre]]\n\n<multi>[fr]un[[bloc FR]]\n\nsuite[en]one[[bloc EN]]\n\nnext</multi>');
			const multi = document.querySelector('.tts-multi');
			expect(multi.textContent).toBe('bonjour  ici');
			expect(multi.querySelector('.tts-note').title).toBe('note FR');
			// appels : celui du multi en ligne, puis ceux du document (bloc en non affiché : sans numéro)
			expect(labels()).toEqual(['1', '2', '3', null]);
			// SPIP en anglais : hello y[1], one[2] (oracle de rendu)
			editor.commands.setLangueAffichee('en');
			expect(document.querySelector('.tts-multi').textContent).toBe('hello');
			expect(labels()).toEqual(['1', null, '2']);
		} finally {
			document.documentElement.lang = '';
		}
	});

	it('multi en ligne : partie affichée en entier, au-delà de la limite des infobulles', () => {
		const long = 'mot '.repeat(30).trim();
		monter(`x <multi>[fr]${long}[[n]] fin[en]b</multi>`);
		const multi = document.querySelector('.tts-multi');
		expect(multi.textContent).toBe(`${long} fin`);
		expect(multi.title.length).toBeLessThan(long.length);
		const span = new DOMParser().parseFromString(editor.getHTML(), 'text/html').querySelector('.tts-multi');
		expect(span.textContent).toBe(`${long} fin`);
	});

	it('infobulle : texte de la note, sans raccourcis, coupé à 80 caractères', () => {
		monter(`x[[Voir [la doc->art1] et {{ceci}}.\n\nSuite.]] y[[${'long '.repeat(30)}]]`);
		expect(appels()[0].title).toBe('Voir la doc et ceci. Suite.');
		expect(appels()[1].title).toHaveLength(80);
		expect(appels()[1].title.endsWith('…')).toBe(true);
	});

	it('copier-coller interne : la note est recréée à l\'identique depuis le HTML', () => {
		monter('a[[<A>Voir [la doc->art1].]] b');
		const html = editor.view.dom.innerHTML;
		const autre = createEditor({ element: document.body.appendChild(document.createElement('div')), source: '' });
		try {
			autre.commands.setContent(html);
			expect(serialize(autre.getJSON(), { conservative: false })).toBe('a[[<A>Voir [la doc->art1].]] b');
		} finally {
			autre.destroy();
		}
	});
});

describe('glossaire et abréviations dans l\'éditeur', () => {
	it('rendus en span et abbr, restitués à l\'identique', () => {
		monter('Le [?SPIP#mots12|bulle{fr}] et le [CMS|Content Management System{en}].');
		const terme = document.querySelector('.tts-glossary');
		expect(terme.textContent).toBe('SPIP');
		expect(terme.getAttribute('title')).toBe('bulle');
		const abbr = document.querySelector('abbr.tts-abbr');
		expect(abbr.getAttribute('title')).toBe('Content Management System');
		expect(abbr.getAttribute('lang')).toBe('en');
		expect(serialize(editor.getJSON())).toBe('Le [?SPIP#mots12|bulle{fr}] et le [CMS|Content Management System{en}].');
	});

	it('copier-coller interne : marks recréées depuis le HTML', () => {
		monter('Le [?SPIP#mots12|bulle{fr}] et le [CMS|Content Management System{en}].');
		const html = editor.view.dom.innerHTML;
		editor.commands.setContent(html);
		expect(serialize(editor.getJSON(), { conservative: false })).toBe('Le [?SPIP#mots12|bulle{fr}] et le [CMS|Content Management System{en}].');
	});

	it('un lien posé sur un terme de glossaire le remplace (marks exclusives)', () => {
		monter('Le [?SPIP] ici');
		editor.commands.setTextSelection({ from: 4, to: 8 });
		editor.commands.setMark('spipLink', { href: 'art1' });
		expect(serialize(editor.getJSON())).toBe('Le [SPIP->art1] ici');
	});

	it('du code posé sur une abréviation la remplace ; un glossaire remplace une abréviation', () => {
		monter('Le [CMS|x] et [API|y]');
		editor.commands.setTextSelection({ from: 4, to: 7 });
		editor.commands.setMark('code');
		editor.commands.setTextSelection({ from: 11, to: 14 });
		editor.commands.setMark('spipGlossary');
		expect(serialize(editor.getJSON())).toBe('Le `CMS` et [?API]');
	});
});
