// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('emoji-picker-element/picker', () => ({}));
import { demonter, monter, tick } from './outils.js';

let mode, instances;
const attente = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
class PickerExistant extends HTMLElement {
	constructor() { super(); this.attachShadow({ mode: 'open' }); this.attente = attente(); instances.push(this); }
	get dataSource() { return this.url; } set dataSource(v) { this.url = v; }
	get locale() { return this.lang; } set locale(v) { this.lang = v; }
	get i18n() { return this.traduction; } set i18n(v) { this.traduction = v; }
	get database() { return mode === 'incompatible' ? {} : { ready: () => this.attente.promise }; }
	connectedCallback() {
		this.proprietesAttachees = { url: this.dataSource, locale: this.locale, i18n: this.i18n };
		if (mode !== 'sans-champ') this.shadowRoot.innerHTML = '<input type="search">';
	}
}
customElements.define('emoji-picker', PickerExistant);
beforeEach(() => {
	mode = ''; instances = [];
	globalThis.spipConfig = { tiptap_spip: { emojis: { url: 'https://exemple.test/1.8.0/en.json', version: '1.8.0', locale: 'en-tiptap-spip-1.8.0' } } };
});
afterEach(() => { vi.useRealTimers(); document.documentElement.lang = ''; demonter(); delete globalThis.spipConfig; vi.restoreAllMocks(); });
const ouvrir = (options = {}) => {
	const { ui, editor } = monter('Un texte'); const trigger = document.createElement('button'); trigger.type = 'button'; document.querySelector('.tts-editor').append(trigger);
	const onChoose = vi.fn(() => true); const onClose = vi.fn();
	const p = ui.openEmoji({ trigger, onChoose, onClose, ...options });
	return { p, ui, editor, trigger, onChoose, onClose, picker: instances.at(-1) };
};
const choix = (picker, unicode = '❤️') => picker.dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode }, bubbles: true }));
it('réutilise la balise existante et configure les propriétés avant son attachement', async () => {
	const { picker } = ouvrir();
	expect(picker).toBeInstanceOf(PickerExistant);
	expect(picker.proprietesAttachees).toMatchObject({ url: 'https://exemple.test/1.8.0/en.json', locale: 'en-tiptap-spip-1.8.0', i18n: { searchLabel: expect.any(String) } });
	picker.attente.resolve(); await tick();
	expect(picker.shadowRoot.activeElement).toBe(picker.shadowRoot.querySelector('input'));
});
it('incompatibilité limitée au panneau et configuration indisponible', async () => {
	mode = 'incompatible'; const { editor } = ouvrir(); await tick();
	expect(document.querySelector('[role="alert"]')).not.toBeNull(); expect(editor.isDestroyed).toBe(false);
	expect(document.querySelector('emoji-picker')).toBeNull();
});
it('erreur ready persistante, repli et Réessayer entre les sentinelles, nouvel élément au réessai', async () => {
	const { picker, onChoose } = ouvrir(); picker.attente.reject(new Error('IndexedDB indisponible')); await tick();
	const panneau = document.querySelector('.tts-suggestions-panneau'); const corps = panneau.querySelector('.tts-suggestions-panneau__corps');
	expect(document.activeElement).toBe(corps); expect(corps.querySelector('[role="alert"]')).not.toBeNull();
	expect(panneau.children[1]).toBe(corps); expect(picker.isConnected).toBe(false);
	await tick(); expect(corps.querySelector('[role="alert"]')).not.toBeNull();
	const retry = corps.querySelector('button'); expect(retry.type).toBe('button'); retry.click();
	const autre = instances.at(-1); expect(autre).not.toBe(picker); autre.attente.resolve(); await tick();
	choix(picker); expect(onChoose).not.toHaveBeenCalled();
	expect(autre.shadowRoot.activeElement?.type).toBe('search');
});
it('ready et choix tardifs après fermeture sont ignorés', async () => {
	const { p, picker, onChoose, onClose } = ouvrir(); p.fermer(); picker.attente.resolve(); await tick(); choix(picker);
	expect(onChoose).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledOnce(); expect(document.querySelector('emoji-picker')).toBeNull();
});
it('n’accepte qu’un choix par ouverture et ignore emoji-click-sync', async () => {
	const { picker, onChoose, onClose } = ouvrir(); picker.attente.resolve(); await tick();
	picker.dispatchEvent(new CustomEvent('emoji-click-sync', { detail: { unicode: '❤️' } })); expect(onChoose).not.toHaveBeenCalled();
	choix(picker); choix(picker); expect(onChoose).toHaveBeenCalledExactlyOnceWith('❤️'); expect(onClose).toHaveBeenCalledOnce();
});
it('refuse un choix sans Unicode et ne valide jamais pendant le chargement', () => {
	const { picker, onChoose } = ouvrir(); choix(picker); expect(onChoose).not.toHaveBeenCalled();
	picker.attente.resolve();
});
it('contexte devenu non éditable ou plage modifiée : aucune commande', async () => {
	const { picker, editor, onChoose } = ouvrir(); picker.attente.resolve(); await tick(); editor.setEditable(false); choix(picker);
	expect(onChoose).not.toHaveBeenCalled();
});
it('une modification de la plage sélectionnée invalide le choix', async () => {
	const { editor, ui } = monter('Un texte'); editor.commands.setTextSelection({ from: 1, to: 3 }); const onChoose = vi.fn(() => true);
	ui.openEmoji({ onChoose }); const picker = instances.at(-1); picker.attente.resolve(); await tick();
	editor.commands.insertContentAt({ from: 1, to: 3 }, 'Autre'); choix(picker); expect(onChoose).not.toHaveBeenCalled();
});
it('une commande refusée laisse le panneau utilisable', async () => {
	const onChoose = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
	const { picker } = ouvrir({ onChoose }); picker.attente.resolve(); await tick(); choix(picker); expect(picker.isConnected).toBe(true);
	choix(picker); expect(onChoose).toHaveBeenCalledTimes(2); expect(picker.isConnected).toBe(false);
});
it('sans recherche, garde le repli interne ; destruction ou remplacement rend les événements inertes', async () => {
	mode = 'sans-champ'; const { picker, ui, editor, onChoose } = ouvrir(); picker.attente.resolve(); await tick();
	expect(document.activeElement).toBe(document.querySelector('.tts-suggestions-panneau__corps'));
	ui.openEmoji({}); choix(picker); expect(onChoose).not.toHaveBeenCalled(); editor.destroy();
	const autre = instances.at(-1); autre.attente.resolve(); await tick(); expect(document.querySelector('emoji-picker')).toBeNull();
});
it('notes et langues de multi ouvrent sur leur propre éditeur sans changer le parent', async () => {
	const { ui } = monter('Un texte'); const note = ui.editNote(null); note.sousUi.openEmoji({});
	instances.at(-1).attente.resolve(); await tick(); expect(note.ouvert).toBe(true); note.close();
	const multi = ui.editMulti(null); const [a, b] = multi.lignes;
	a.sousUi.openEmoji({}); const premier = instances.at(-1); b.sousUi.openEmoji({});
	expect(premier.isConnected).toBe(false); expect(multi.ouvert).toBe(true);
});
it('sans manifeste, propose une erreur locale sans créer de picker', () => {
	delete globalThis.spipConfig.tiptap_spip.emojis;
	const { editor } = ouvrir(); expect(instances).toHaveLength(0);
	expect(document.querySelector('[role=alert]')).not.toBeNull(); expect(editor.isDestroyed).toBe(false);
});
it('un choix sans caractère reste refusé même après ready', async () => {
	const { picker, onChoose } = ouvrir(); picker.attente.resolve(); await tick();
	for (const value of ['', null, ' ', 3]) choix(picker, value);
	picker.dispatchEvent(new CustomEvent('emoji-click', { detail: {} }));
	expect(onChoose).not.toHaveBeenCalled(); expect(picker.isConnected).toBe(true);
});
it('une exception de commande est journalisée, un éditeur détruit ne reçoit plus le focus', async () => {
	const journal = vi.spyOn(console, 'error').mockImplementation(() => {});
	const { picker, editor } = ouvrir({ onChoose: () => { throw new Error('commande'); } });
	picker.attente.resolve(); await tick(); choix(picker); expect(journal).toHaveBeenCalledOnce(); expect(picker.isConnected).toBe(true);
	editor.destroy(); choix(picker); expect(picker.isConnected).toBe(false);
});
it('un ready suspendu donne accès à Réessayer après dix secondes, sans retour tardif', async () => {
	vi.useFakeTimers(); const { picker } = ouvrir();
	await vi.advanceTimersByTimeAsync(10_000);
	expect(document.querySelector('[role=alert]')).not.toBeNull(); expect(picker.isConnected).toBe(false);
	picker.attente.resolve(); await vi.advanceTimersByTimeAsync(0); expect(document.querySelector('[role=alert]')).not.toBeNull();
	document.querySelector('.tts-suggestions-panneau button').click(); const autre = instances.at(-1);
	expect(autre).not.toBe(picker); autre.attente.resolve(); await vi.advanceTimersByTimeAsync(0);
	expect(document.querySelector('[role=alert]')).toBeNull(); expect(autre.shadowRoot.activeElement?.type).toBe('search');
});
it('l’i18n du picker suit la langue SPIP explicite même si html lang diffère', () => {
	document.documentElement.lang = 'fr'; globalThis.spipConfig.tiptap_spip.lang = 'en';
	const { picker } = ouvrir(); expect(picker.i18n.searchLabel).toBe('Search');
});
