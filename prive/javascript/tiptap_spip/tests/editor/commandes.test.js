// @vitest-environment jsdom
import { Editor, getSchema } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { schemaJSON } from '../../src/editor/content.js';
import { createEditor } from '../../src/editor/createEditor.js';
import { noteExtensions } from '../../src/editor/extensions.js';
import { serialize } from '../../src/spip/index.js';
import { node, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';

let editor;
afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
});

const monter = (source, ui = {}) => {
	document.body.innerHTML = '<div></div>';
	editor = createEditor({ element: document.body.firstChild, source, ui });
	return editor;
};
const source = () => serialize(editor.getJSON());
const p = (...content) => node('paragraph', null, content);
/** Position de la première note du document. */
const note = () => {
	let pos = null;
	editor.state.doc.descendants((n, p) => {
		if (pos === null && n.type.name === 'spipNote') pos = p;
	});
	return pos;
};
/** Frappe `texte` au curseur, caractère par caractère, en passant par les règles de saisie. */
const taper = (texte) => {
	for (const c of texte) {
		const { from, to } = editor.state.selection;
		const gere = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, c, () => editor.state.tr.insertText(c, from, to)));
		if (!gere) editor.view.dispatch(editor.state.tr.insertText(c, from, to));
	}
};
const touche = (key, options = {}) => {
	editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
};

describe('commandes de note', () => {
	it('insertSpipNote avec contenu : note insérée au curseur', () => {
		monter('Texte');
		editor.commands.setTextSelection(6);
		editor.commands.insertSpipNote({ content: [p(text('Une note.'))] });
		expect(source()).toBe('Texte[[Une note.]]');
		editor.commands.insertSpipNote({ name: 'A', content: [p(text('b'))] });
		expect(source()).toBe('Texte[[Une note.]][[<A>b]]');
	});

	it('insertSpipNote sans contenu : ouvre le popover de note', () => {
		const editNote = vi.fn();
		monter('Texte', { editNote });
		expect(editor.commands.insertSpipNote()).toBe(true);
		expect(editNote).toHaveBeenCalledWith(null);
		expect(source()).toBe('Texte');
	});

	it('updateSpipNote et removeSpipNote sur la note sélectionnée', () => {
		monter('a[[un]] b');
		editor.commands.setNodeSelection(note());
		editor.commands.updateSpipNote({ name: '', content: [p(text('deux'))] });
		expect(source()).toBe('a[[<>deux]] b');
		editor.commands.setNodeSelection(note());
		editor.commands.removeSpipNote();
		expect(source()).toBe('a b');
	});

	it('sans note sélectionnée : rien', () => {
		monter('a[[un]] b');
		editor.commands.setTextSelection(1);
		expect(editor.commands.updateSpipNote({ content: [p(text('x'))] })).toBe(false);
		expect(editor.commands.removeSpipNote()).toBe(false);
		expect(source()).toBe('a[[un]] b');
	});
});

describe('raccourcis clavier', () => {
	it('Mod-Alt-N : note ; Mod-Alt-G : glossaire', () => {
		const ui = { editNote: vi.fn(), openGlossary: vi.fn() };
		monter('Texte', ui);
		touche('n', { ctrlKey: true, altKey: true });
		expect(ui.editNote).toHaveBeenCalledWith(null);
		touche('g', { ctrlKey: true, altKey: true });
		expect(ui.openGlossary).toHaveBeenCalled();
	});
});

describe('règles de saisie', () => {
	it('[[ : retiré du texte, popover de note ouvert ensuite', async () => {
		const editNote = vi.fn();
		monter('Texte', { editNote });
		editor.commands.setTextSelection(6);
		taper(' [[');
		expect(source()).toBe('Texte ');
		await Promise.resolve();
		expect(editNote).toHaveBeenCalledWith(null);
	});

	it('[?terme…] : terme de glossaire', () => {
		monter('Texte');
		editor.commands.setTextSelection(6);
		taper(' [?SPIP#mots12|bulle]');
		expect(source()).toBe('Texte [?SPIP#mots12|bulle]');
		expect(editor.getJSON().content[0].content[1]).toMatchObject({ text: 'SPIP', marks: [{ type: 'spipGlossary' }] });
	});

	it('[?…] non représentable : texte laissé tel quel', () => {
		monter('Texte');
		editor.commands.setTextSelection(6);
		taper(' [? SPIP]');
		expect(editor.getJSON().content[0].content).toEqual([text('Texte [? SPIP]')]);
	});
});

describe('schéma du sous-éditeur des notes', () => {
	const schema = getSchema(noteExtensions());

	it('pas de note, seulement les blocs permis dans une note', () => {
		expect(schema.nodes.spipNote).toBeUndefined();
		expect(() => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [text('t')] }] }).check()).toThrow();
		expect(() => schema.nodeFromJSON(parse('-* a\n\n<doc1>\n\nb')).check()).not.toThrow();
	});

	it('schemaJSON : forme de getJSON(), empreintes recalculées (contenu non modifié restitué)', () => {
		const contenu = parse(' Premier.\n\n\nSecond.');
		const json = schemaJSON({ type: 'doc', content: contenu.content }, schema);
		document.body.innerHTML = '<div></div>';
		const sous = new Editor({ element: document.body.firstChild, extensions: noteExtensions(), content: json });
		try {
			const doc = { type: 'doc', attrs: contenu.attrs, content: sous.getJSON().content };
			expect(serialize(doc)).toBe(' Premier.\n\n\nSecond.');
		} finally {
			sous.destroy();
		}
	});
});
