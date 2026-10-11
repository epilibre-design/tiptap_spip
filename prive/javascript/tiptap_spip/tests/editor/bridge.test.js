// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { TextareaBridge } from '../../src/editor/TextareaBridge.js';

let form;
let textarea;
let bridge;

const setup = (value) => {
	document.body.innerHTML = '<form><textarea name="texte"></textarea><div id="ed"></div></form>';
	form = document.querySelector('form');
	textarea = form.querySelector('textarea');
	textarea.value = value;
	const editor = createEditor({ element: document.getElementById('ed'), source: value });
	bridge = new TextareaBridge({ textarea, editor });
	return bridge;
};

const typeAtEnd = (text) => {
	const { editor } = bridge;
	editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent(text).run();
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	bridge?.destroy();
	vi.useRealTimers();
});

describe('TextareaBridge', () => {
	it('ne touche pas au textarea tant que rien n\'est modifié', () => {
		const source = 'Un  texte {{gras}}\n\n\n';
		setup(source);
		const onInput = vi.fn();
		textarea.addEventListener('input', onInput);
		vi.advanceTimersByTime(1000);
		bridge.flush();
		expect(textarea.value).toBe(source);
		expect(onInput).not.toHaveBeenCalled();
	});

	it('sérialise une modification après 150 ms et prévient les scripts SPIP', () => {
		setup('Texte');
		const events = [];
		textarea.addEventListener('input', () => events.push('input'));
		textarea.addEventListener('change', () => events.push('change'));
		typeAtEnd(' ajouté');
		vi.advanceTimersByTime(149);
		expect(textarea.value).toBe('Texte');
		vi.advanceTimersByTime(1);
		expect(textarea.value).toBe('Texte ajouté');
		expect(events).toEqual(['input', 'change']);
	});

	it('sérialise immédiatement à la soumission du formulaire', () => {
		setup('Texte');
		typeAtEnd('!');
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(textarea.value).toBe('Texte!');
	});

	it('mode source : le textarea est la référence, rechargé une seule fois au retour', () => {
		setup('Texte');
		typeAtEnd('!');
		bridge.setMode('source');
		expect(textarea.value).toBe('Texte!');
		expect(bridge.mode).toBe('source');
		const load = vi.spyOn(bridge, 'load');
		textarea.value = '{{Gras}}\n\nSuite';
		textarea.dispatchEvent(new Event('input'));
		textarea.value = '{{Gras}}\n\nSuite.';
		textarea.dispatchEvent(new Event('input'));
		vi.advanceTimersByTime(1000);
		expect(load).not.toHaveBeenCalled();
		bridge.setMode('visual');
		expect(load).toHaveBeenCalledTimes(1);
		expect(bridge.editor.getText()).toContain('Gras');
		// pas de réécriture du textarea par l'éditeur rechargé
		vi.advanceTimersByTime(1000);
		expect(textarea.value).toBe('{{Gras}}\n\nSuite.');
	});

	it('retour en visuel avec une source non représentable : reste en mode source', () => {
		setup('Texte');
		bridge.setMode('source');
		vi.spyOn(bridge, 'load').mockImplementation(() => {
			throw new Error('contenu invalide');
		});
		textarea.value = 'autre';
		textarea.dispatchEvent(new Event('input'));
		expect(bridge.setMode('visual')).toBe(false);
		expect(bridge.mode).toBe('source');
	});

	it('formulaire envoyé par jquery.form (Crayons, CVT en AJAX) : sérialise sur form-pre-serialize', () => {
		const handlers = {};
		const $form = { on: vi.fn((evt, h) => { handlers[evt] = h; return $form; }), off: vi.fn(() => $form) };
		globalThis.jQuery = vi.fn(() => $form);
		try {
			setup('Texte');
			typeAtEnd('!');
			handlers['form-pre-serialize.tts']();
			expect(textarea.value).toBe('Texte!');
			bridge.destroy();
			expect($form.off).toHaveBeenCalledWith('form-pre-serialize.tts', handlers['form-pre-serialize.tts']);
			bridge = null;
		} finally {
			delete globalThis.jQuery;
		}
	});

	it('destroy() sérialise ce qui reste et détache tout', () => {
		setup('Texte');
		typeAtEnd('!');
		const { editor } = bridge;
		bridge.destroy();
		expect(textarea.value).toBe('Texte!');
		expect(editor.isDestroyed).toBe(true);
		bridge = null;
	});
});
