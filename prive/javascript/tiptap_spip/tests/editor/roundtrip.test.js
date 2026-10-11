// @vitest-environment jsdom
import { Editor, getSchema } from '@tiptap/core';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { toEditorJSON } from '../../src/editor/content.js';
import { coreExtensions } from '../../src/editor/extensions.js';
import { canon, parse, serialize } from '../../src/spip/index.js';

// jsdom remplace URL : on part de la chaîne import.meta.url
const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../../../tests/corpus');
const dirs = [corpus, ...(process.env.TTS_CORPUS ? [process.env.TTS_CORPUS] : [])];
const files = dirs.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.spip')).sort().map((f) => join(dir, f)));

const schema = getSchema(coreExtensions());
let editor;
afterEach(() => editor?.destroy());

const mount = (source) => {
	editor = new Editor({
		extensions: coreExtensions(),
		content: toEditorJSON(source, schema),
		enableContentCheck: true,
		onContentError: ({ error }) => {
			throw error;
		},
	});
	return editor;
};

describe.each(files)('%s', (file) => {
	const source = readFileSync(file, 'utf8');

	it('le JSON du parseur est valide pour le schéma (node.check)', () => {
		expect(() => schema.nodeFromJSON(parse(source)).check()).not.toThrow();
	});

	it('identité à travers l\'éditeur : serialize(editor.getJSON()) === source', () => {
		expect(serialize(mount(source).getJSON())).toBe(source);
	});
});

describe('modification d\'un bloc', () => {
	it('ne réécrit que le segment modifié', () => {
		const source = '{{{Titre}}}\n\n\nUn  paragraphe {{gras}}.\n\n\n-* liste\n-* suite\n';
		const ed = mount(source);
		// curseur à la fin du paragraphe (2e bloc), insertion d'un texte
		let end = 0;
		ed.state.doc.forEach((n, offset, index) => {
			if (index === 1) end = offset + n.nodeSize - 1;
		});
		ed.chain().setTextSelection(end).insertContent(' Ajout').run();
		expect(serialize(ed.getJSON())).toBe('{{{Titre}}}\n\n\nUn  paragraphe {{gras}}. Ajout\n\n\n-* liste\n-* suite\n');
	});

	it('un nouveau bloc créé par Entrée ne reprend pas la source du bloc coupé', () => {
		const ed = mount('Premier.\n\nSecond.');
		ed.chain().setTextSelection(4).splitBlock().run();
		expect(serialize(ed.getJSON())).toBe('Pre\n\nmier.\n\nSecond.');
	});
});

describe('liens, ancres et modèles dans l\'éditeur', () => {
	const source = 'Voir [la {{doc}}|bulle{en}->>art12], [->rub3] et [#ici<-] avec <img3|left>.\n\n<doc12|center>';

	it('le HTML de l\'éditeur se relit à l\'identique (copier-coller interne)', () => {
		const ed = mount(source);
		const json = ed.getJSON();
		ed.commands.setContent(ed.getHTML());
		expect(canon(ed.getJSON())).toBe(canon(json));
	});

	it('changer la cible d\'un lien ne réécrit que son paragraphe', () => {
		const ed = mount(`${source}\n\n\nFin  intacte.`);
		ed.chain().setTextSelection(6).extendMarkRange('spipLink').updateAttributes('spipLink', { href: 'art13' }).run();
		expect(serialize(ed.getJSON())).toBe('Voir [la {{doc}}|bulle{en}->>art13], [->rub3] et [#ici<-] avec <img3|left>.\n\n<doc12|center>\n\n\nFin  intacte.');
	});
});
