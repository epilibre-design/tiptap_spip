// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ajouterMarqueurs, positionMarqueur, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from '../../src/editor/marqueurEnvoi.js';
import { serialize } from '../../src/spip/index.js';
import { editor, monter } from '../ui/outils.js';

const source = () => serialize(editor.getJSON(), { regles: editor.tiptapSpip.regles });

describe('marqueurs d\'envoi (spec 10 §3)', () => {
	it('posé à la sélection, absent du document et de la sérialisation', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		expect(positionMarqueur(editor.state, 'a')).toBe(6);
		expect(editor.view.dom.querySelector('[data-tts-envoi="a"]').textContent).toContain('Envoi du fichier');
		expect(JSON.stringify(editor.getJSON())).not.toContain('envoi');
		expect(source()).toBe('Avant après');
	});

	it('sélection non vide : posé après elle, texte sélectionné conservé', () => {
		monter('Avant après');
		editor.commands.setTextSelection({ from: 7, to: 12 });
		ajouterMarqueurs(editor.view, ['a']);
		expect(positionMarqueur(editor.state, 'a')).toBe(12);
		remplacerMarqueur(editor, 'a', '<doc3>');
		expect(source()).toBe('Avant après<doc3>');
	});

	it('position reportée quand on tape avant lui', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		editor.commands.insertContentAt(1, 'xyz');
		expect(positionMarqueur(editor.state, 'a')).toBe(9);
	});

	it('repli sur le point le plus proche quand le texte autour est supprimé', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		editor.commands.deleteRange({ from: 3, to: 9 });
		expect(positionMarqueur(editor.state, 'a')).toBe(3);
	});

	it('remplacement par <docN> en une transaction annulable', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		expect(remplacerMarqueur(editor, 'a', '<doc12>')).toBe(true);
		expect(source()).toBe('Avant<doc12> après');
		expect(positionMarqueur(editor.state, 'a')).toBeNull();
		editor.commands.undo();
		expect(source()).toBe('Avant après');
	});

	it('plusieurs marqueurs au même endroit : insérés dans l\'ordre', () => {
		monter('Texte');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a', 'b']);
		remplacerMarqueur(editor, 'a', '<doc1>');
		remplacerMarqueur(editor, 'b', '<doc2>');
		expect(source()).toBe('Texte<doc1><doc2>');
	});

	it('retrait sans insertion ; marqueur inconnu : rien', () => {
		monter('Texte');
		ajouterMarqueurs(editor.view, ['a']);
		retirerMarqueurs(editor.view, ['a']);
		expect(positionMarqueur(editor.state, 'a')).toBeNull();
		expect(remplacerMarqueur(editor, 'a', '<doc1>')).toBe(false);
		expect(source()).toBe('Texte');
	});

	it('progression : barre déterminée, indéterminée sans ratio', () => {
		monter('Texte');
		ajouterMarqueurs(editor.view, ['a']);
		const barre = () => editor.view.dom.querySelector('[data-tts-envoi="a"] progress');
		expect(barre().hasAttribute('value')).toBe(false);
		progressionMarqueur(editor.view, 'a', 0.5);
		expect(barre().value).toBe(0.5);
	});

	it('handlePaste délègue à ui.collerImages', () => {
		const collerImages = vi.fn(() => true);
		monter('Texte', null, { ui: { collerImages } });
		const event = new Event('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'clipboardData', { value: { files: [], getData: () => '', types: [] } });
		editor.view.dom.dispatchEvent(event);
		expect(collerImages).toHaveBeenCalledWith(editor.view, event);
	});
});
