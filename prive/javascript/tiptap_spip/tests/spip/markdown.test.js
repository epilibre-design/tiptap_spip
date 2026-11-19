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

	it('bloc vide ; texte modifié écrit tel quel ; </md> saisi écrit &lt;/md>', () => {
		expect(lire('<md></md>')).toEqual([md('')]);
		const doc = parse('Avant\n\n<md>*x*</md>', { regles: avec });
		doc.content[1].content = [text('*y* </md> {{z}}')];
		expect(serialize(doc, { regles: avec })).toBe('Avant\n\n<md>*y* &lt;/md> {{z}}</md>');
	});

	it('seule la forme exacte <md> est lue ; un bloc au milieu d\'un paragraphe reste brut', () => {
		for (const source of ['<md class="x">*a*</md>', '<MD>*a*</MD>', 'Texte <md>*a*</md> suite']) {
			expect(lire(source).some((b) => b.type === 'spipMarkdown')).toBe(false);
			expect(conserve(source)).toBe(source);
		}
	});

	it('dans une citation ; un <md> dans du code reste du code', () => {
		expect(lire('<quote>\n<md>*a*</md>\n</quote>')).toEqual([node('blockquote', null, [md('*a*')])]);
		expect(lire('<code>\n<md>*a*</md>\n</code>').some((b) => b.type === 'spipMarkdown')).toBe(false);
	});

	it('le JSON est valide pour le schéma, avec ou sans le plugin', () => {
		for (const markdown of [true, false]) {
			const schema = getSchema(coreExtensions({ markdown }));
			expect(() => schema.nodeFromJSON(parse(SOURCE, { regles: avec })).check()).not.toThrow();
		}
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
