// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ListeSuggestions } from '../../src/suggestions/ListeSuggestions.js';
import { lierContexteSuggestions } from '../../src/suggestions/sessions.js';
import { demonter, monter, wrapper } from './outils.js';

afterEach(demonter);
const labels = { suggestions: 'Suggestions', loading: 'Chargement', empty: 'Vide', error: 'Erreur' };
const preparer = () => {
	const { editor } = monter('Texte'); lierContexteSuggestions(editor, { wrapper }); editor.view.focus();
	const onChoose = vi.fn(); const onDismiss = vi.fn();
	const liste = new ListeSuggestions({ editor, labels, onChoose, onDismiss });
	liste.update({ query: 'a', items: [{ id: 'a', title: '<img src=x onerror=x>', subtext: 'Détail' }, { id: 'b', title: 'Autre' }], loading: false });
	return { editor, liste, onChoose, onDismiss };
};

it('texte inerte, options nommées et focus conservé dans le texte', () => {
	const { editor, liste } = preparer();
	expect(liste.element.querySelector('img')).toBeNull();
	expect(liste.element.querySelector('[role="option"]').textContent).toContain('<img');
	expect(editor.view.hasFocus()).toBe(true);
	expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false);
	liste.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
	expect(document.getElementById(editor.view.dom.getAttribute('aria-activedescendant')).getAttribute('aria-selected')).toBe('true');
	liste.destroy(); expect(editor.view.dom.hasAttribute('aria-controls')).toBe(false);
});

it('clic valide directement, survol ne valide rien et ancienne option retirée ignorée', () => {
	const { liste, onChoose } = preparer(); const option = liste.element.querySelector('[role="option"]');
	option.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); expect(onChoose).not.toHaveBeenCalled();
	const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); option.dispatchEvent(down);
	expect(down.defaultPrevented).toBe(true); option.click(); expect(onChoose).toHaveBeenCalledOnce();
	liste.update({ query: 'b', loading: true, items: [] }); option.click(); expect(onChoose).toHaveBeenCalledOnce();
	liste.destroy();
});

it('pas de choix implicite ; états sans option laissent Haut/Bas/Entrée', () => {
	const { liste, onChoose } = preparer();
	expect(liste.keydown(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
	for (const state of [{ loading: true }, { error: true }, {}]) {
		liste.update({ query: 'a', items: [], ...state });
		for (const key of ['ArrowUp', 'ArrowDown', 'Enter']) expect(liste.keydown(new KeyboardEvent('keydown', { key }))).toBe(false);
	}
	expect(onChoose).not.toHaveBeenCalled(); liste.destroy(); liste.destroy();
});

it('toute la liste conserve le focus souris sans bloquer le tactile ni la molette', () => {
	const { liste } = preparer();
	for (const cible of [liste.element, liste.etat, liste.liste]) {
		const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); cible.dispatchEvent(e);
		expect(e.defaultPrevented).toBe(true);
		for (const type of ['touchstart', 'touchmove', 'wheel']) {
			const e = new Event(type, { bubbles: true, cancelable: true }); cible.dispatchEvent(e); expect(e.defaultPrevented).toBe(false);
		}
	}
	liste.destroy();
});
