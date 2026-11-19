// @vitest-environment jsdom
import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { coreExtensions } from '../../src/editor/extensions.js';
import { reglesSpip } from '../../src/editor/regles.js';
import { node, stripTech, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { serialize } from '../../src/spip/serialize.js';

// Blocs <md> du plugin Markdown (spec 05 §6) : règles de l'éditeur avec et sans le plugin
const avec = reglesSpip(coreExtensions({ markdown: true }));
const sans = reglesSpip(coreExtensions({ markdown: false }));

const lire = (source, regles = avec) => stripTech(parse(source, { regles }).content);
const conserve = (source, regles = avec) => serialize(parse(source, { regles }), { regles });
const canonique = (source, regles = avec) => serialize(parse(source, { regles }), { conservative: false, regles });
const md = (contenu) => node('spipMarkdown', null, contenu === '' ? undefined : [text(contenu)]);
const p = (...content) => node('paragraph', null, content);

const SOURCE = 'Intro {{SPIP}}.\n\n<md>\n# Titre\n\nDu **gras**, `code` et [lien](art12).\n\n- un\n- deux\n</md>\n\nFin.';

describe('blocs <md> du plugin Markdown', () => {
	it('avec le plugin : un bloc brut, lignes vides comprises ; source restituée, forme canonique stable', () => {
		expect(lire(SOURCE)).toEqual([
			p(text('Intro '), text('SPIP', [{ type: 'bold' }]), text('.')),
			md('\n# Titre\n\nDu **gras**, `code` et [lien](art12).\n\n- un\n- deux\n'),
			p(text('Fin.')),
		]);
		expect(conserve(SOURCE)).toBe(SOURCE);
		expect(canonique(SOURCE)).toBe(SOURCE);
	});

	it('sans le plugin : <md> est une balise, son contenu du SPIP', () => {
		expect(lire(SOURCE, sans).some((b) => b.type === 'spipMarkdown')).toBe(false);
		expect(conserve(SOURCE, sans)).toBe(SOURCE);
	});

	it('bloc vide ; texte modifié écrit tel quel ; </md> d\'un JSON écrit &lt;/md>, toute casse', () => {
		expect(lire('<md></md>')).toEqual([md('')]);
		const doc = parse('Avant\n\n<md>*x*</md>', { regles: avec });
		doc.content[1].content = [text('*y* </md> </MD> {{z}}')];
		expect(serialize(doc, { regles: avec })).toBe('Avant\n\n<md>*y* &lt;/md> &lt;/md> {{z}}</md>');
	});

	it('fermé par le premier </md> de toute casse, comme le plugin', () => {
		const source = '<md>a</MD>\n\n{{b}} </md>';
		expect(lire(source)).toEqual([md('a'), p(text('b', [{ type: 'bold' }]), text(' '), node('spipRawInline', { source: '</md>' }))]);
		expect(conserve(source)).toBe(source);
	});

	it('lu avant les backticks, comme le plugin (pre_echappe_html_propre) : un backtick du bloc n\'ouvre pas de code', () => {
		const source = '<md>`abc</md>\n\n`outside`';
		expect(lire(source)).toEqual([md('`abc'), p(text('outside', [{ type: 'code' }]))]);
		expect(conserve(source)).toBe(source);
		// bloc suivi de texte : gardé brut en ligne, la suite est du SPIP (sans backtick fermant)
		expect(lire('<md>a `b</md> c` d')).toEqual([p(node('spipRawInline', { source: '<md>a `b</md>' }), text(' c` d'))]);
	});

	it('seule l\'ouverture exacte <md> est lue ; un bloc au milieu d\'un paragraphe reste brut', () => {
		for (const source of ['<md class="x">*a*</md>', '<MD>*a*</MD>', 'Texte <md>*a*</md> suite']) {
			expect(lire(source).some((b) => b.type === 'spipMarkdown')).toBe(false);
			expect(conserve(source)).toBe(source);
		}
	});

	it('dans une citation ; dans du code, lu par le plugin avant le code (rendu cassé) : gardé brut', () => {
		expect(lire('<quote>\n<md>*a*</md>\n</quote>')).toEqual([node('blockquote', null, [md('*a*')])]);
		for (const source of ['<code>\n<md>*a*</md>\n</code>', 'Un <code><md>*a*</md></code>.', '<html><md>*a*</md></html>']) {
			expect(lire(source).some((b) => b.type === 'codeBlock' || b.type === 'spipHtml' || b.content?.some((t) => t.marks?.some((m) => m.type === 'code')))).toBe(false);
			expect(conserve(source)).toBe(source);
		}
	});

	it('le JSON est valide pour le schéma, avec ou sans le plugin', () => {
		for (const markdown of [true, false]) {
			const schema = getSchema(coreExtensions({ markdown }));
			expect(() => schema.nodeFromJSON(parse(SOURCE, { regles: avec })).check()).not.toThrow();
		}
	});

	it('éditeur : une modification qui écrirait </md> dans un bloc est refusée ; les autres passent', () => {
		const editor = createEditor({ element: document.createElement('div'), source: 'Avant\n\n<md>ab</md>', extensions: coreExtensions({ markdown: true }) });
		const refus = [];
		editor.on('refus', ({ message }) => refus.push(message));
		const fin = editor.state.doc.content.size - 1;
		editor.commands.insertContentAt(fin, '</md');
		expect(editor.state.doc.lastChild.textContent).toBe('ab</md');
		expect(refus).toEqual([]);
		editor.commands.insertContentAt(fin + 4, '>');
		editor.commands.insertContentAt(fin, '</MD>');
		expect(editor.state.doc.lastChild.textContent).toBe('ab</md');
		// chaque refus est signalé, avec le libellé de l'interface
		expect(refus).toEqual(Array(2).fill('Un bloc Markdown ne peut pas contenir </md>, qui le fermerait.'));
		// hors du bloc, </md> est du texte SPIP ordinaire
		editor.commands.insertContentAt(1, '</md> ');
		expect(editor.state.doc.firstChild.textContent).toBe('</md> Avant');
		editor.destroy();
	});

	it('éditeur : option markdown lue dans la configuration du serveur', () => {
		globalThis.spipConfig = { tiptap_spip: { markdown: true } };
		try {
			const editor = createEditor({ element: document.createElement('div'), source: SOURCE });
			expect(editor.getJSON().content[1].type).toBe('spipMarkdown');
			expect(editor.view.dom.querySelector('pre.tts-markdown')).not.toBeNull();
			editor.destroy();
		} finally {
			delete globalThis.spipConfig;
		}
	});
});
