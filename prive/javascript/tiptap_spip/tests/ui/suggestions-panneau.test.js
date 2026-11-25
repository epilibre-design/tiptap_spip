// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contexteSuggestions, suggestionsOuvertes } from '../../src/suggestions/sessions.js';
import { placerDepuisRect } from '../../src/ui/placement.js';
import { Popover } from '../../src/ui/popover.js';
import { demonter, monter, source, wrapper } from './outils.js';

afterEach(demonter);
const contenu = (search = false) => {
	const el = document.createElement('div');
	if (search) {
		const input = document.createElement('input');
		input.type = 'search'; input.setAttribute('aria-label', 'Rechercher'); el.append(input);
	}
	const erreur = document.createElement('p'); erreur.textContent = 'Indisponible';
	const bouton = document.createElement('button'); bouton.type = 'button'; bouton.textContent = 'Réessayer';
	el.append(erreur, bouton);
	return el;
};
const origine = (parent = wrapper) => {
	const avant = document.createElement('button'); avant.type = 'button'; avant.textContent = 'Avant';
	const trigger = document.createElement('button'); trigger.type = 'button'; trigger.textContent = 'Ouvrir';
	const apres = document.createElement('button'); apres.type = 'button'; apres.textContent = 'Après';
	parent.append(avant, trigger, apres);
	return { avant, trigger, apres };
};
const ouvrir = (ui, trigger, options = {}) => ui.openSuggestionsPanel({
	anchor: trigger, origin: { trigger }, content: contenu(), label: 'Suggestions', ...options,
});

describe('panneau de suggestions interne', () => {
	it('panneau_hors_formulaire et repli_entre_sentinelles', () => {
		const { ui } = monter('Un texte');
		const note = ui.editNote(null);
		const { trigger } = origine(note.form);
		const p = ouvrir(note.sousUi, trigger);
		expect(p.element.parentElement).toBe(note.element);
		expect(p.element.closest('form')).toBeNull();
		expect(p.element.getAttribute('popover')).toBe('manual');
		expect(p.element.querySelector('form')).toBeNull();
		expect([...p.element.children]).toEqual([expect.any(HTMLElement), p.corps, expect.any(HTMLElement)]);
		expect(document.activeElement).toBe(p.corps);
		expect(Popover.current).toBe(note);
		expect(note.enfant).toBeNull();
		expect(note.focusables()).not.toContain(p.corps.querySelector('button'));
	});
	it('erreur_tab_reessayer_puis_sortie_avant et sortie_arriere', () => {
		const { ui } = monter('Un texte');
		const { trigger, avant, apres } = origine();
		const p = ouvrir(ui, trigger);
		expect(document.activeElement).toBe(p.corps);
		// La tabulation réelle est vérifiée dans les trois navigateurs ; ici, réception par la borne.
		p.element.lastElementChild.focus();
		expect(document.activeElement).toBe(apres);
		expect(p.element.isConnected).toBe(false);
		const autre = ouvrir(ui, trigger);
		autre.element.firstElementChild.focus();
		expect(document.activeElement).toBe(avant);
	});
	it('Échap consommé en remontée, focus au déclencheur ; recherche prioritaire', () => {
		const { ui } = monter('Un texte');
		const { trigger } = origine();
		const p = ouvrir(ui, trigger, { content: contenu(true) });
		expect(document.activeElement.type).toBe('search');
		const touche = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		const parent = vi.fn(); wrapper.addEventListener('keydown', parent);
		document.activeElement.dispatchEvent(touche);
		expect(touche.defaultPrevented).toBe(true);
		expect(parent).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(trigger);
		expect(p.element.isConnected).toBe(false);
	});
	it('Échap déjà consommé dans le composant laisse le panneau ouvert', () => {
		const { ui } = monter('Un texte'); const { trigger } = origine();
		const content = contenu(true);
		content.addEventListener('keydown', (e) => e.stopPropagation());
		const p = ouvrir(ui, trigger, { content });
		document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(p.element.isConnected).toBe(true);
	});
	it('ouvrir une note puis un panneau ne rend pas le focus à la note à la frame suivante', async () => {
		const { ui } = monter('Un texte'); const note = ui.editNote(null);
		const { trigger } = origine(note.form); const p = ouvrir(note.sousUi, trigger);
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		expect(p.element.isConnected).toBe(true);
		expect(document.activeElement).toBe(p.corps);
	});
	it('autre_popover_sans_ancien_refocus, parent note maintenu', () => {
		const { ui } = monter('Un texte'); const note = ui.editNote(null);
		const { trigger } = origine(note.form); const p = ouvrir(note.sousUi, trigger);
		note.sousUi.openLink();
		expect(p.element.isConnected).toBe(false);
		expect(note.ouvert).toBe(true);
		expect(Popover.current.parent).toBe(note);
		expect(document.activeElement).not.toBe(trigger);
	});
	it('clic et focus extérieurs gardent leur cible, sans mutation ni historique', () => {
		const { ui, editor } = monter('Un texte'); const { trigger, apres } = origine();
		const doc = editor.state.doc; const p = ouvrir(ui, trigger);
		apres.focus();
		expect(p.element.isConnected).toBe(false);
		expect(document.activeElement).toBe(apres);
		expect(editor.state.doc).toBe(doc);
		expect(source()).toBe('Un texte');
		expect(editor.can().undo()).toBe(false);
	});
	it('sortie Tab ignore un contrôle dont un ancêtre est masqué par CSS', () => {
		const { ui } = monter('Un texte'); const { trigger, apres } = origine();
		const cache = document.createElement('div'); cache.style.display = 'none';
		cache.innerHTML = '<button type="button">Caché</button>'; trigger.after(cache);
		const p = ouvrir(ui, trigger); p.element.lastElementChild.focus();
		expect(document.activeElement).toBe(apres);
	});
	it('destruction_idempotente et nettoyage des contextes', () => {
		const { ui, editor } = monter('Un texte'); const { trigger } = origine();
		const onClose = vi.fn(); const p = ouvrir(ui, trigger, { onClose });
		expect(contexteSuggestions(editor).wrapper).toBe(wrapper);
		expect(suggestionsOuvertes(wrapper)).toBe(true);
		editor.destroy(); p.fermer();
		expect(onClose).toHaveBeenCalledOnce();
		expect(p.element.isConnected).toBe(false);
		expect(suggestionsOuvertes(wrapper)).toBe(false);
		expect(contexteSuggestions(editor)).toBeNull();
	});
	it('fermeture parent et remplacement du panneau', () => {
		const { ui } = monter('Un texte'); const note = ui.editNote(null); const { trigger } = origine(note.form);
		const p = ouvrir(note.sousUi, trigger); const suivant = ouvrir(note.sousUi, trigger);
		expect(p.element.isConnected).toBe(false);
		note.close(); expect(suivant.element.isConnected).toBe(false);
	});
	it('multi : un contexte et une interface par ligne, destruction ciblée', () => {
		const { ui } = monter('Un texte'); const multi = ui.editMulti(null);
		expect(multi.lignes).toHaveLength(2);
		const [fr, en] = multi.lignes;
		expect(fr.sous).not.toBe(en.sous);
		expect(contexteSuggestions(fr.sous).parent).toBe(multi);
		const { trigger } = origine(fr.ligne);
		const p = ouvrir(fr.sousUi, trigger);
		fr.sous.destroy();
		expect(p.element.isConnected).toBe(false);
		expect(en.sous.isDestroyed).toBe(false);
	});
	it('source cachée et lecture seule : aucune ouverture', () => {
		const { ui, editor } = monter('Un texte'); const { trigger } = origine();
		editor.setEditable(false); expect(ouvrir(ui, trigger)).toBeNull();
		editor.setEditable(true); editor.view.dom.parentElement.hidden = true;
		expect(ouvrir(ui, trigger)).toBeNull();
	});
	it('placement depuis rectangle indépendant du DOM, borné et défilant', () => {
		const el = document.createElement('div'); wrapper?.append(el);
		Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 600 });
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
		el.getBoundingClientRect = () => ({ width: 200, height: 500 });
		placerDepuisRect(el, () => ({ left: 580, top: 350, bottom: 370 }));
		expect(el.style.left).toBe('392px');
		expect(el.style.top).toBe('8px');
		expect(el.style.maxHeight).toBe('342px');
		expect(el.style.overflowY).toBe('auto');
	});
});
