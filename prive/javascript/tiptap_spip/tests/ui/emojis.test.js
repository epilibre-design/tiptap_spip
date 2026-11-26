// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('emoji-picker-element/picker', () => ({}));
import '../../src/ui/composants.js';
import { creerBoutonEmoji } from '../../src/emojis/bouton.js';
import BARRES from '../../src/ui/barres.json';
import { Toolbar } from '../../src/ui/Toolbar.js';
import { lierContexteSuggestions } from '../../src/suggestions/sessions.js';
import { demonter, monter, source, tick, wrapper } from './outils.js';

class PickerTest extends HTMLElement {
	dataSource = ''; locale = ''; i18n = {};
	get database() { return { ready: () => Promise.resolve() }; }
	constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<input type="search">'; }
}
customElements.define('emoji-picker', PickerTest);
let numero = 0;
beforeEach(() => {
	globalThis.spipConfig = { tiptap_spip: { emojis: { url: `https://exemple.test/boutons/${++numero}.json`, locale: 'en-tiptap-spip-1.8.0' } } };
	vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ emoji: '❤️', shortcodes: ['heart'], tags: [], annotation: 'red heart', order: 1 }] })));
});
afterEach(() => { demonter(); delete globalThis.spipConfig; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const barre = (nom = 'edition', initial = 'avant {{mot}} après') => {
	const montage = monter(initial); lierContexteSuggestions(montage.editor, { wrapper });
	const element = document.createElement('div'); wrapper.prepend(element); const etat = { mode: 'visual' };
	const instance = { mode: () => etat.mode, pleinEcran: () => false, langue: () => 'fr' };
	const toolbar = new Toolbar({ ctx: { ...montage, instance }, barre: typeof nom === 'string' ? BARRES[nom] : nom, element });
	montage.editor.on('transaction', () => toolbar.maj());
	return { ...montage, toolbar, etat, element, bouton: element.querySelector('.tts-outil--emoji') };
};
const choisir = (unicode = '❤️', picker = document.querySelector('emoji-picker')) => picker.dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode }, bubbles: true }));

it.each([['edition', 'caracteres'], ['forum', 'code'], ['minimale', 'lien']])('bouton après %s/%s et SVG décoratif nommé', (nom, precedent) => {
	expect(BARRES[nom].indexOf('emoji')).toBe(BARRES[nom].indexOf(precedent) + 1);
	const { bouton } = barre(nom); expect(bouton.getAttribute('aria-label')).toBe('Emoji');
	expect(bouton.querySelector('svg.svg-add-emoji').getAttribute('aria-hidden')).toBe('true');
});
it('modele et barre personnalisée sans bouton gardent le fournisseur inline', async () => {
	expect(BARRES.modele).not.toContain('emoji');
	const { editor, bouton } = barre(BARRES.edition.filter((item) => item !== 'emoji'), ''); expect(bouton).toBeNull();
	editor.view.focus(); editor.commands.insertContent({ type: 'text', text: ':h' }); await tick();
	expect(document.querySelector('[role=option]').textContent).toBe('❤️ :heart:');
});
it('le bouton remplace la sélection mémorisée, conserve les marks et rend le focus à l’éditeur', async () => {
	const { editor, bouton } = barre(); editor.commands.setTextSelection({ from: 7, to: 10 }); bouton.click(); await tick();
	expect(bouton.getAttribute('aria-expanded')).toBe('true'); choisir();
	expect(source()).toBe('avant {{❤️}} après'); expect(editor.view.hasFocus()).toBe(true);
	expect(bouton.getAttribute('aria-expanded')).toBe('false');
});
it('annuler rend le focus au bouton sans toucher au texte, clic extérieur garde sa cible', async () => {
	const { bouton } = barre(); const initial = source(); bouton.click(); await tick();
	document.querySelector('emoji-picker').shadowRoot.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
	expect(document.activeElement).toBe(bouton); expect(source()).toBe(initial);
	bouton.click(); await tick(); const dehors = document.createElement('input'); wrapper.append(dehors); dehors.focus();
	expect(document.querySelector('.tts-suggestions-panneau')).toBeNull(); expect(document.activeElement).toBe(dehors); expect(source()).toBe(initial);
});
it('source, lecture seule et code désactivent le bouton', () => {
	const { editor, bouton, toolbar, etat } = barre(); expect(bouton.disabled).toBe(false);
	etat.mode = 'source'; toolbar.maj(); expect(bouton.disabled).toBe(true); etat.mode = 'visual';
	editor.setEditable(false); toolbar.maj(); expect(bouton.disabled).toBe(true); editor.setEditable(true);
	editor.commands.setCode(); toolbar.maj(); expect(bouton.disabled).toBe(true);
});
it('notes : petit bouton ciblant le sous-éditeur, sans validation du parent', async () => {
	const { ui, editor } = monter('Texte'); const doc = editor.state.doc; const note = ui.editNote(null);
	note.sous.commands.insertContent('note'); note.sous.commands.setTextSelection({ from: 1, to: 5 });
	const bouton = note.form.querySelector('.tts-outil--emoji'); expect(bouton).not.toBeNull(); bouton.click(); await tick(); choisir('😄');
	expect(note.sous.state.doc.textContent).toBe('😄'); expect(editor.state.doc).toBe(doc); expect(note.ouvert).toBe(true);
});
it('multis : un bouton et une sélection indépendants par langue', async () => {
	const { ui, editor } = monter('Texte'); const doc = editor.state.doc; const multi = ui.editMulti(null); const [a, b] = multi.lignes;
	a.sous.commands.insertContent('fr'); b.sous.commands.insertContent('en');
	a.ligne.querySelector('.tts-outil--emoji').click(); await tick(); choisir('😄');
	expect(a.sous.state.doc.textContent).toBe('fr😄'); expect(b.sous.state.doc.textContent).toBe('en');
	b.ligne.querySelector('.tts-outil--emoji').click(); await tick(); choisir('❤️');
	expect(a.sous.state.doc.textContent).toBe('fr😄'); expect(b.sous.state.doc.textContent).toBe('en❤️');
	expect(multi.ouvert).toBe(true); expect(editor.state.doc).toBe(doc);
});
it('destruction nettoie le bouton et ignore les choix tardifs ou doubles', async () => {
	const { editor, ui } = monter('Texte'); const bouton = creerBoutonEmoji({ editor, ouvrir: ui.openEmoji }); wrapper.append(bouton.element);
	bouton.element.click(); await tick(); const picker = document.querySelector('emoji-picker'); const doc = editor.state.doc;
	editor.destroy(); choisir('😄', picker); bouton.destroy();
	expect(editor.state.doc).toBe(doc); expect(bouton.element.isConnected).toBe(false); expect(document.querySelector('emoji-picker')).toBeNull();
});
it('un choix après déplacement de la plage garde la bonne sélection ; double événement = une insertion', async () => {
	const { editor, bouton } = barre(); editor.commands.setTextSelection({ from: 7, to: 10 }); bouton.click(); await tick();
	const picker = document.querySelector('emoji-picker'); editor.commands.insertContentAt(1, 'x');
	choisir('❤️', picker); choisir('❤️', picker); expect(source()).toBe('xavant {{❤️}} après');
});
