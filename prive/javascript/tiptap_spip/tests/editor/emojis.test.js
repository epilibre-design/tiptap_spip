// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { emojiAutorise, insererEmoji } from '../../src/emojis/insertion.js';
import { filtrerEmojis } from '../../src/emojis/catalogue.js';
import { lierContexteSuggestions } from '../../src/suggestions/sessions.js';
import { demonter, monter, notePos, source, tick, wrapper } from '../ui/outils.js';

const catalogue = JSON.parse(readFileSync('node_modules/emoji-picker-element-data/en/emojibase/data.json', 'utf8'));
let numero = 0;
beforeEach(() => {
	globalThis.spipConfig = { tiptap_spip: { emojis: { url: `https://exemple.test/emojis-inline/${++numero}.json` } } };
	vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => catalogue })));
});
afterEach(() => { demonter(); delete globalThis.spipConfig; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const installer = (initial = '') => {
	const openEmoji = vi.fn(() => ({ fermer() {} }));
	const montage = monter(initial, null, { ui: { openEmoji } });
	lierContexteSuggestions(montage.editor, { wrapper });
	montage.editor.view.focus(); montage.editor.commands.setTextSelection(montage.editor.state.doc.content.size - 1);
	return { ...montage, openEmoji };
};
const saisir = async (editor, text) => { editor.commands.insertContent({ type: 'text', text }); await tick(); };
const touche = (editor, key, autres = {}) => {
	const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...autres }); editor.view.dom.dispatchEvent(e); return e;
};
const options = () => [...document.querySelectorAll('.tts-suggestions [role=option]')];
const actif = () => document.querySelector('.tts-suggestions [aria-selected=true]');
const plus = () => document.querySelector('.tts-suggestions__action');

it.each([':h', ':he', ' :h'])('ouvre dès un caractère et respecte toute la requête : %s', async (text) => {
	const { editor } = installer(); await saisir(editor, text);
	expect(options()).toHaveLength(6); expect(actif()).toBeNull(); expect(fetch).toHaveBeenCalledOnce();
	expect(options()[0].textContent).toBe(`${filtrerEmojis(catalogue, text.split(':').at(-1))[0].context.unicode} :${filtrerEmojis(catalogue, text.split(':').at(-1))[0].title}:`);
});
it.each([':-', ':+', ':='])('lance la recherche pour le caractère autorisé %s', async (text) => {
	const { editor } = installer(); await saisir(editor, text); expect(fetch).toHaveBeenCalledOnce();
});
it.each([':', ':smile:', ':)', '<3', 'mot:h', 'https://', '12:30', '\u00a0:h', '\u202f:h'])('reste littéral sans ouverture : %s', async (text) => {
	const { editor } = installer(); await saisir(editor, text);
	expect(options()).toHaveLength(0); expect(fetch).not.toHaveBeenCalled(); expect(editor.state.doc.textContent).toBe(text);
});
it('frontières de marks et atomes ne valent pas début de bloc ; espace et hardBreak autorisés', async () => {
	const { editor } = installer('{{mot}}'); editor.commands.unsetBold(); await saisir(editor, ':h'); expect(options()).toHaveLength(0);
	editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'mot' }, { type: 'hardBreak' }] }] });
	editor.commands.setTextSelection(editor.state.doc.content.size - 1); await saisir(editor, ':h'); expect(options()).toHaveLength(6);
	editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'spipRawInline', attrs: { source: '&#128512;' } }] }] });
	editor.commands.setTextSelection(editor.state.doc.content.size - 1); await saisir(editor, ':h'); expect(options()).toHaveLength(0);
	await saisir(editor, ' :h'); expect(options()).toHaveLength(6);
});
it('espace ferme sans mutation, vide masque sans rejet, retour arrière affine de nouveau', async () => {
	const { editor } = installer(); await saisir(editor, ':h'); const premier = options()[0].textContent;
	await saisir(editor, 'e'); expect(options()[0].textContent).not.toBe(premier);
	editor.commands.deleteRange({ from: 3, to: 4 }); await tick(); expect(options()[0].textContent).toBe(premier);
	await saisir(editor, ' '); expect(options()).toHaveLength(0); expect(source()).toBe(':h ');
	await saisir(editor, ':='); expect(document.querySelector('.tts-suggestions')).toBeNull();
	editor.commands.deleteRange({ from: 5, to: 6 }); await saisir(editor, 'h'); expect(options()).toHaveLength(6);
});
it('premier caractère montre le chargement ; réponses tardives après fermeture ignorées', async () => {
	let terminer; fetch.mockReturnValue(new Promise((r) => { terminer = r; }));
	const { editor } = installer(); await saisir(editor, ':h');
	expect(document.querySelector('.tts-suggestions [role=status]').textContent).toContain('Chargement');
	expect(touche(editor, 'ArrowDown').defaultPrevented).toBe(false);
	touche(editor, 'Escape'); terminer({ ok: true, json: async () => catalogue }); await tick(); expect(options()).toHaveLength(0);
});
it('six_et_plus_hors_listbox et haut_dernier_emoji, sans option active implicite', async () => {
	const { editor, openEmoji } = installer(); await saisir(editor, ':h');
	expect(plus().closest('[role=listbox]')).toBeNull(); expect(plus().textContent).toBe('Plus…');
	expect(openEmoji).not.toHaveBeenCalled();
	touche(editor, 'ArrowUp'); expect(actif()).toBe(options().at(-1));
	touche(editor, 'ArrowDown'); expect(actif()).toBeNull(); expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false);
	expect(document.querySelector('.tts-suggestions [role=status]').textContent).toBe('Plus…');
	touche(editor, 'ArrowUp'); expect(actif()).toBe(options().at(-1));
	touche(editor, 'ArrowDown'); touche(editor, 'Enter'); expect(openEmoji).toHaveBeenCalledOnce(); expect(source()).toBe(':h');
});
it('plus_annule_rejete_requete avant retour du focus', async () => {
	const { editor, openEmoji } = installer(); await saisir(editor, ':h'); plus().click();
	const origin = openEmoji.mock.calls[0][0]; expect(origin.range).toEqual({ from: 1, to: 3 });
	origin.onClose({ reason: 'escape' }); editor.view.focus(); await saisir(editor, 'e');
	expect(options()).toHaveLength(0); expect(source()).toBe(':he');
	await saisir(editor, ' :h'); expect(options()).toHaveLength(6);
});
it('curseur_he_art : remplace uniquement la plage jusqu’au curseur', async () => {
	const { editor } = installer(':heart'); editor.commands.setTextSelection(4); await tick();
	const unicode = filtrerEmojis(catalogue, 'he')[0].context.unicode;
	touche(editor, 'ArrowDown'); touche(editor, 'Enter'); expect(editor.state.doc.textContent).toBe(`${unicode}art`);
});
it('insertion_texte_avec_marks et undo_requete_seule, puis rétablissement', async () => {
	const { editor } = installer(); editor.commands.setBold(); await saisir(editor, ':smi');
	touche(editor, 'ArrowDown'); touche(editor, 'Enter'); expect(source()).toBe('{{😃}}');
	await saisir(editor, 'x'); editor.commands.undo(); expect(source()).toBe('{{😃}}');
	editor.commands.undo(); expect(source()).toBe('{{:smi}}'); await tick(); expect(options().length).toBeGreaterThan(0);
	editor.commands.redo(); editor.commands.redo(); expect(source()).toBe('{{😃x}}');
});
it('Plus suit la plage, refuse le choix tardif après fermeture ou modification', async () => {
	const { editor, openEmoji } = installer(); await saisir(editor, ':h'); plus().click();
	const origin = openEmoji.mock.calls[0][0]; origin.onClose({ reason: 'outside' });
	expect(origin.onChoose('😄')).toBe(false); expect(source()).toBe(':h');
	await saisir(editor, ' :h'); plus().click(); const deux = openEmoji.mock.calls[1][0];
	editor.commands.insertContentAt({ from: deux.range.from, to: deux.range.to }, 'autre');
	expect(deux.onChoose('😄')).toBe(false); deux.onClose({ reason: 'cancel' });
});
it('Plus insère le texte dans la plage suivie et isole son historique', async () => {
	const { editor, openEmoji } = installer(); await saisir(editor, ':h'); plus().click();
	const origin = openEmoji.mock.calls[0][0]; expect(origin.onChoose('❤️')).toBe(true); origin.onClose({ reason: 'choose' });
	expect(source()).toBe('❤️'); editor.commands.undo(); expect(source()).toBe(':h');
});
it.each(['codeBlock', 'spipCadre', 'spipHtml', 'spipMath', 'spipMarkdown'])('emojiAutorise refuse le contexte %s', (type) => {
	const { editor } = installer(); editor.commands.setContent({ type: 'doc', content: [{ type, content: [{ type: 'text', text: ':h' }] }] });
	editor.commands.setTextSelection(3); expect(emojiAutorise({ editor, range: { from: 1, to: 3 } })).toBe(false);
	expect(insererEmoji({ editor, range: { from: 1, to: 3 }, unicode: '😄' })).toBe(false);
});
it('sélection de nœud refusée, atome inchangé (retour Claude a)', () => {
	const { editor, ui } = monter('avant [[note]] après'); editor.commands.setNodeSelection(notePos());
	const doc = editor.state.doc;
	expect(emojiAutorise({ editor, range: editor.state.selection })).toBe(false);
	expect(insererEmoji({ editor, range: editor.state.selection, unicode: '😄' })).toBe(false);
	expect(ui.openEmoji({})).toBeNull(); expect(editor.state.doc).toBe(doc);
});
it('code en ligne, source, lecture seule et plage invalide refusés sans mutation', async () => {
	const { editor } = installer(); editor.commands.setCode(); await saisir(editor, ':h');
	expect(emojiAutorise({ editor, range: { from: 1, to: 3 } })).toBe(false);
	editor.commands.unsetCode(); editor.setEditable(false);
	expect(emojiAutorise({ editor, range: { from: 1, to: 3 } })).toBe(false); editor.setEditable(true);
	editor.view.dom.parentElement.hidden = true;
	expect(emojiAutorise({ editor, range: { from: 1, to: 3 } })).toBe(false); editor.view.dom.parentElement.hidden = false;
	expect(emojiAutorise({ editor, range: { from: -1, to: 30 } })).toBe(false);
	expect(insererEmoji({ editor, range: { from: 1, to: 3 }, unicode: '' })).toBe(false); expect(editor.state.doc.textContent).toBe(':h');
});
it('texte Unicode littéral, séquences conservées, aucun HTML interprété', () => {
	const { editor } = installer(); const unicode = '<b>😄 👍🏽 👩‍💻 🇫🇷 ❤️</b>';
	expect(insererEmoji({ editor, range: { from: 1, to: 1 }, unicode })).toBe(true);
	expect(editor.state.doc.textContent).toBe(unicode); expect(editor.view.dom.querySelector('b')).toBeNull();
});
it('IME et modificateurs ne valident aucune option', async () => {
	const { editor } = installer(); await saisir(editor, ':h'); touche(editor, 'ArrowDown');
	for (const autres of [{ isComposing: true }, { shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
		touche(editor, 'Enter', autres); expect(source()).toContain(':h');
	}
});
it('autorisation pendant apply : utilise le nouvel état, avant la mise à jour de editor.state', () => {
	const { editor } = installer();
	const suivant = editor.state.apply(editor.state.tr.insertText(':h', 1));
	expect(emojiAutorise({ editor, state: suivant, range: { from: 1, to: 3 } })).toBe(true);
	expect(editor.state.doc.textContent).toBe('');
});

it('Entrée sans choix actif garde sa fonction de paragraphe et n’ouvre pas le picker', async () => {
	const { editor, openEmoji } = installer(); await saisir(editor, ':h');
	touche(editor, 'Enter'); expect(openEmoji).not.toHaveBeenCalled();
	expect(editor.state.doc.textContent).toBe(':h'); expect(editor.state.doc.childCount).toBe(2);
});
