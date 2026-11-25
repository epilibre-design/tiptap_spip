// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { coreExtensions, noteExtensions, partieExtensions } from '../../src/editor/extensions.js';
import { createEditor } from '../../src/editor/createEditor.js';
import { creerSuggestions, oublierDiagnosticsSuggestions, retenirFournisseurs } from '../../src/suggestions/fabrique.js';
import { lierContexteSuggestions } from '../../src/suggestions/sessions.js';
import { demonter, monter, source, tick, wrapper } from '../ui/outils.js';

afterEach(() => { demonter(); oublierDiagnosticsSuggestions(); vi.restoreAllMocks(); });
const labels = { suggestions: 'Formules', loading: 'Recherche…', empty: 'Aucune formule', error: 'Indisponible' };
const items = [{ id: 'bon', title: 'Bonjour', context: 'Bonjour !' }, { id: 'soir', title: 'Bonsoir', context: 'Bonsoir !' }];
const config = (autres = {}) => ({ name: 'ttsFormules', char: '@', labels, items: () => items,
	command: ({ editor, range, item }) => editor.commands.insertContentAt(range, { type: 'text', text: item.context }), ...autres });
const installer = (autres = {}, initial = '') => {
	const fournisseur = creerSuggestions(config(autres));
	const { editor, ui } = monter(initial, null, { tierces: [fournisseur] });
	lierContexteSuggestions(editor, { wrapper }); editor.view.focus();
	editor.commands.setTextSelection(editor.state.doc.content.size - 1);
	return { editor, ui, fournisseur };
};
const saisir = async (ed, text) => { ed.commands.insertContent(text); await tick(); };
const touche = (ed, key, autres = {}) => {
	const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...autres });
	ed.view.dom.dispatchEvent(e); return e;
};
const options = () => [...document.querySelectorAll('.tts-suggestions [role="option"]')];
const actif = () => document.querySelector('.tts-suggestions [aria-selected="true"]');

it('priorite_10000 et validation du contrat', () => {
	expect(creerSuggestions(config()).config.priority).toBe(10000);
	expect(() => creerSuggestions(config({ char: 'xx' }))).toThrow();
	expect(() => creerSuggestions(config({ minQueryLength: -1 }))).toThrow();
});

it('seuil_empeche_ouverture_et_recherche ; motif entier sans g/y instable', async () => {
	const recherche = vi.fn(() => items); const { editor } = installer({ minQueryLength: 2, queryPattern: /[a-z]+/g, items: recherche });
	await saisir(editor, '@b'); expect(recherche).not.toHaveBeenCalled(); expect(options()).toHaveLength(0);
	await saisir(editor, 'o'); expect(recherche).toHaveBeenCalledOnce(); expect(options()).toHaveLength(2);
	await saisir(editor, '!'); expect(options()).toHaveLength(0);
});

it('entree_sans_option garde le comportement du paragraphe, sans insertion implicite', async () => {
	const { editor } = installer(); await saisir(editor, '@bo'); expect(actif()).toBeNull();
	touche(editor, 'Enter'); expect(source()).toContain('@bo'); expect(source()).not.toContain('Bonjour');
});

it('requete_reinitialise_actif ; Haut/Bas et insertion exacte sans second filtrage', async () => {
	const { editor } = installer(); await saisir(editor, '@b');
	touche(editor, 'ArrowDown'); expect(actif().textContent).toBe('Bonjour');
	await saisir(editor, 'o'); expect(actif()).toBeNull();
	touche(editor, 'ArrowUp'); expect(actif().textContent).toBe('Bonsoir');
	touche(editor, 'Enter'); expect(source()).toBe('Bonsoir !'); expect(options()).toHaveLength(0);
});

it('commande_false_sans_mutation laisse le menu utilisable', async () => {
	const commande = vi.fn(() => false); const { editor } = installer({ command: commande });
	await saisir(editor, '@bo'); touche(editor, 'ArrowDown'); touche(editor, 'Enter');
	expect(commande).toHaveBeenCalledWith(expect.objectContaining({ editor, range: { from: 1, to: 4 }, item: items[0] }));
	expect(source()).toBe('@bo'); expect(options()).toHaveLength(2);
});

it('undo_validation_et_frappe : restauration indépendante de la requête et des marques', async () => {
	const { editor } = installer(); editor.commands.toggleBold(); await saisir(editor, '@bo');
	touche(editor, 'ArrowDown'); touche(editor, 'Enter'); await saisir(editor, 'x');
	expect(source()).toBe('{{Bonjour !x}}');
	editor.commands.undo(); expect(source()).toBe('{{Bonjour !}}');
	editor.commands.undo(); expect(source()).toBe('{{@bo}}');
});

it('ouvrir/rechercher/fermer ne crée aucune entrée d’historique', async () => {
	const { editor } = installer(); await saisir(editor, '@bo'); touche(editor, 'Escape');
	editor.commands.undo(); expect(source()).toBe('');
});

it('echap_rejete_jusqua_espace et Tab conserve sa fonction', async () => {
	const { editor } = installer(); await saisir(editor, '@b');
	expect(touche(editor, 'Escape').defaultPrevented).toBe(true);
	await saisir(editor, 'o'); expect(options()).toHaveLength(0);
	await saisir(editor, ' @bo'); expect(options()).toHaveLength(2);
	touche(editor, 'Tab'); expect(options()).toHaveLength(0); expect(source()).toBe('@bo @bo');
});

it('même avec allowSpaces, un espace inséré lève le rejet explicite', async () => {
	const { editor } = installer({ allowSpaces: true }); await saisir(editor, '@b');
	touche(editor, 'Escape'); await saisir(editor, 'o'); expect(options()).toHaveLength(0);
	await saisir(editor, ' '); expect(options()).toHaveLength(2);
});

it('reponses_inversees, signal annulé et aucun ancien résultat sélectionnable', async () => {
	const demandes = [];
	const { editor } = installer({ items: ({ query, signal }) => new Promise((resolve) => demandes.push({ query, signal, resolve })) });
	await saisir(editor, '@b'); expect(document.querySelector('[role="status"]').textContent).toContain('Recherche');
	expect(touche(editor, 'ArrowDown').defaultPrevented).toBe(false);
	await saisir(editor, 'o'); expect(demandes[0].signal.aborted).toBe(true);
	demandes[1].resolve([items[1]]); await tick(); expect(options()[0].textContent).toBe('Bonsoir');
	demandes[0].resolve([items[0]]); await tick(); expect(options()[0].textContent).toBe('Bonsoir');
});

it('erreur_distincte_vide, Haut/Bas disponibles et récupération après nouvelle requête', async () => {
	const recherche = vi.fn().mockRejectedValueOnce(new Error('indisponible')).mockResolvedValueOnce([]).mockResolvedValue(items);
	const { editor } = installer({ items: recherche }); await saisir(editor, '@b');
	expect(document.querySelector('[role="status"]').textContent).toBe('Indisponible');
	expect(touche(editor, 'ArrowDown').defaultPrevented).toBe(false);
	await saisir(editor, 'o'); expect(document.querySelector('[role="status"]').textContent).toBe('Aucune formule');
	expect(touche(editor, 'ArrowUp').defaultPrevented).toBe(false);
	await saisir(editor, 'n'); expect(options()).toHaveLength(2);
});

it('reponse_apres_destroy ou fermeture ne rouvre ni ne modifie rien', async () => {
	let terminer; const { editor } = installer({ items: () => new Promise((r) => { terminer = r; }) });
	await saisir(editor, '@bo'); touche(editor, 'Escape'); terminer(items); await tick(); expect(options()).toHaveLength(0);
	await saisir(editor, ' @bo'); editor.destroy(); terminer(items); await tick(); expect(options()).toHaveLength(0);
});

it('deux_editeurs_isoles et destruction ciblée', async () => {
	const { editor, fournisseur } = installer();
	const el = document.createElement('div'); wrapper.append(el);
	const second = createEditor({ element: el, source: '', tierces: [fournisseur] });
	lierContexteSuggestions(second, { wrapper });
	try {
		await saisir(editor, '@bo'); expect(options()).toHaveLength(2);
		second.destroy(); expect(options()).toHaveLength(2); touche(editor, 'ArrowDown'); touche(editor, 'Enter');
		expect(source()).toBe('Bonjour !');
	} finally { if (!second.isDestroyed) second.destroy(); }
});

it('composition IME, code et sélection non vide interdisent les suggestions', async () => {
	const { editor } = installer(); editor.commands.toggleCode(); await saisir(editor, '@bo'); expect(options()).toHaveLength(0);
	editor.commands.clearContent(); editor.commands.unsetCode(); await saisir(editor, '@bo');
	touche(editor, 'Escape', { isComposing: true }); expect(options()).toHaveLength(2);
	touche(editor, 'ArrowDown', { isComposing: true }); expect(actif()).toBeNull();
	editor.commands.setTextSelection({ from: 1, to: 3 }); expect(options()).toHaveLength(0);
});

it('perte de focus et passage en lecture seule ferment la session', async () => {
	const { editor } = installer(); await saisir(editor, '@bo');
	const bouton = document.createElement('button'); wrapper.append(bouton); bouton.focus(); expect(options()).toHaveLength(0);
	editor.view.focus(); await saisir(editor, ' @bo'); editor.setEditable(false); expect(options()).toHaveLength(0);
});

it('conflit_averti_une_fois_notes_multis et priorité au cœur dans la composition finale', () => {
	const coeur = creerSuggestions(config({ name: 'ttsCoeur' })); const tiers = creerSuggestions(config({ name: 'ttsTiers' }));
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	for (let n = 0; n < 3; n++) {
		expect(retenirFournisseurs([tiers, coeur], { duCoeur: new Set([coeur]) })).toEqual([coeur]);
	}
	expect(warn).toHaveBeenCalledOnce(); expect(warn.mock.calls[0][0]).toContain('ttsCoeur');
	for (const construire of [coreExtensions, noteExtensions, partieExtensions]) {
		const liste = construire({ tierces: [coeur, tiers] });
		expect(liste.filter((e) => ['ttsCoeur', 'ttsTiers'].includes(e.name))).toHaveLength(1);
	}
	expect(retenirFournisseurs([tiers], { duCoeur: new Set() })).toEqual([tiers]);
});

it('un conflit reste non fatal et ne réavertit pas aux ouvertures réelles de notes et multis', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const { ui } = monter('Texte', null, { tierces: [creerSuggestions(config()), creerSuggestions(config({ name: 'ttsAutre' }))] });
	for (let i = 0; i < 3; i++) {
		const note = ui.editNote(null); expect(note.sous.isDestroyed).toBe(false); note.close();
		const multi = ui.editMulti(null); expect(multi.lignes).toHaveLength(2); multi.close();
	}
	expect(warn).toHaveBeenCalledOnce();
});

it.each(['liste', 'tableau', 'titre'])('le choix actif passe avant le raccourci Entrée du bloc %s', async (type) => {
	const { editor } = installer(); const p = { type: 'paragraph' };
	const bloc = type === 'liste' ? { type: 'bulletList', content: [{ type: 'listItem', content: [p] }] }
		: type === 'tableau' ? { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p] }] }] }
			: { type: 'heading', attrs: { level: 2 } };
	editor.commands.setContent({ type: 'doc', content: [bloc] });
	let debut;
	editor.state.doc.descendants((n, pos) => { if (debut === undefined && n.isTextblock) debut = pos + 1; });
	editor.commands.setTextSelection(debut);
	await saisir(editor, '@bo'); touche(editor, 'ArrowDown'); touche(editor, 'Enter');
	expect(editor.state.doc.textContent).toBe('Bonjour !');
	expect(editor.state.doc.childCount).toBe(1);
	if (type === 'liste') expect(editor.state.doc.firstChild.childCount).toBe(1);
	if (type === 'tableau') expect(editor.state.doc.firstChild.firstChild.childCount).toBe(1);
});

it('deux déclencheurs distincts cohabitent sans partage de résultats', async () => {
	const { editor } = monter('', null, { tierces: [creerSuggestions(config()), creerSuggestions(config({ name: 'ttsAutre', char: '#', items: () => [items[1]] }))] });
	lierContexteSuggestions(editor, { wrapper }); editor.view.focus();
	await saisir(editor, '@bo'); expect(options()).toHaveLength(2);
	await saisir(editor, ' #bo'); expect(options()).toHaveLength(1);
	expect(options()[0].textContent).toBe('Bonsoir'); touche(editor, 'ArrowDown'); touche(editor, 'Enter');
	expect(source()).toBe('@bo Bonsoir !');
});
