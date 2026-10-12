// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { anomaliesDuDocument } from '../../src/editor/anomalies.js';
import { Popover } from '../../src/ui/popover.js';
import { StatusBar } from '../../src/ui/StatusBar.js';
import { apres, champ, demonter, editor, erreur, monter, notePos, popovers, source, valider, wrapper } from './outils.js';

afterEach(demonter);

/** Position du premier nœud brut (en ligne ou bloc) dont la source vaut `src`. */
const brutPos = (src) => {
	let pos = null;
	editor.state.doc.descendants((n, p) => {
		if (pos === null && n.type.name.startsWith('spipRaw') && n.attrs.source === src) pos = p;
	});
	return pos;
};

describe('anomalies signalées', () => {
	it('raccourci cassé souligné avec son explication ; HTML inconnu et entités non signalés', () => {
		monter('a {b et <span>c</span> &nbsp;');
		const signales = [...wrapper.querySelectorAll('.tts-anomalie')];
		expect(signales.map((e) => e.textContent)).toEqual(['{']);
		expect(signales[0].dataset.ttsAnomalie).toBe('ouverture');
		expect(signales[0].title).toMatch(/fin du paragraphe/);
		expect(anomaliesDuDocument(editor.state.doc).map((a) => a.cle)).toEqual(['ouverture']);
	});
});

describe('popover du nœud brut', () => {
	it('clic : source exacte du segment, explication ; réparée, elle devient éditable', () => {
		const { ui } = monter('X\n\n\n\na  {b\n\nY');
		ui.editRaw(brutPos('{'));
		const zone = champ('source');
		expect(zone.value).toBe('a  {b');
		expect(popovers()[0].querySelector('.tts-popover__explication').textContent).toMatch(/fin du paragraphe/);
		zone.value = 'a  {b}';
		valider();
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe('X\n\n\n\na  {b}\n\nY');
		expect(wrapper.querySelector('.ProseMirror em').textContent).toBe('b');
		expect(wrapper.querySelector('.tts-anomalie')).toBeNull();
	});

	it('source inchangée : document intact ; Mod-Entrée applique', () => {
		const { ui } = monter('a <span>b</span>');
		ui.editRaw(brutPos('<span>'));
		expect(popovers()[0].querySelector('.tts-popover__explication')).toBeNull();
		valider();
		expect(source()).toBe('a <span>b</span>');
		ui.editRaw(brutPos('<span>'));
		champ('source').value = 'a b';
		champ('source').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
		expect(source()).toBe('a b');
	});

	it('bloc brut (tableau incohérent) réparé en tableau', () => {
		const { ui } = monter('Avant\n\n|a|b|\n|c|\n\nAprès');
		ui.editRaw(brutPos('|a|b|\n|c|'));
		champ('source').value = '|a|b|\n|c|d|';
		valider();
		expect(editor.state.doc.child(1).type.name).toBe('table');
		expect(source()).toBe('Avant\n\n|a|b|\n|c|d|\n\nAprès');
	});

	it('clic ou Entrée sur un nœud brut sélectionné ouvrent le popover', () => {
		monter('a {b');
		editor.commands.setNodeSelection(brutPos('{'));
		editor.commands.keyboardShortcut('Enter');
		expect(Popover.current?.form.classList.contains('tts-popover--brut')).toBe(true);
	});

	it('segment raccourci après une suppression : le bloc suivant n\'est jamais englobé', () => {
		const { ui } = monter('a {\n{{{T}}}\n\nY');
		expect(editor.state.doc.child(0).attrs.spipGroup).toBe(2);
		// le titre T supprimé : le premier bloc garde spipGroup 2
		const titre = editor.state.doc.child(0).nodeSize;
		editor.commands.deleteRange({ from: titre, to: titre + editor.state.doc.child(1).nodeSize });
		expect(editor.state.doc.child(1).textContent).toBe('Y');
		ui.editRaw(brutPos('{'));
		expect(champ('source').value).toBe('a {');
		champ('source').value = 'a {b}';
		valider();
		expect(source()).toBe('a {b}\n\nY');
	});

	it('segment modifié dans l\'éditeur : le bloc seul, sans déborder', () => {
		const { ui } = monter('a {\n{{{T}}}\n\nY');
		editor.commands.insertContentAt(apres('T'), 'itre');
		ui.editRaw(brutPos('{'));
		expect(champ('source').value).toBe('a {');
		champ('source').value = 'a {b}';
		valider();
		expect(source()).toBe('a {b}\n\n{{{Titre}}}\n\nY');
	});

	it('segment disparu pendant que le popover est ouvert : fermé sans rien faire', () => {
		const { ui } = monter('a {b');
		ui.editRaw(brutPos('{'));
		editor.commands.setContent('<p>autre</p>');
		champ('source').value = 'x';
		valider();
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe('autre');
	});

	it('dans une note : popover enfant ; une source qui ne peut pas s\'y placer est refusée', () => {
		const { ui } = monter('Texte[[a {b]]');
		ui.editNote(notePos());
		const { sous } = Popover.current;
		let pos = null;
		sous.state.doc.descendants((n, p) => {
			if (n.type.name === 'spipRawInline') pos = p;
		});
		sous.view.someProp('handleClickOn', (f) => f(sous.view, pos, sous.state.doc.nodeAt(pos), pos, new MouseEvent('click'), true));
		expect(popovers()).toHaveLength(2);
		champ('source').value = '|x|y|';
		valider();
		expect(erreur().textContent).toBe('Ce texte ne peut pas remplacer la source à cet endroit.');
		champ('source').value = 'a {b}';
		valider();
		expect(popovers()).toHaveLength(1);
		valider();
		expect(source()).toBe('Texte[[a {b}]]');
	});
});

describe('barre d\'état', () => {
	it('mots et anomalies ; le bouton ouvre l\'anomalie suivante', () => {
		const { ui } = monter('Un deux {trois\n\nquatre} cinq');
		const etat = new StatusBar({ editor, editRaw: (pos) => ui.editRaw(pos) });
		wrapper.append(etat.element);
		expect(etat.mots.textContent).toBe('5 mots');
		expect(etat.anomalies.textContent).toBe('2 anomalies de syntaxe');
		editor.commands.setTextSelection(1);
		etat.anomalies.click();
		expect(champ('source').value).toBe('Un deux {trois');
		Popover.current.close();
		etat.anomalies.click();
		expect(champ('source').value).toBe('quatre} cinq');
		Popover.current.close();
		editor.commands.setContent('<p>seul</p>', { emitUpdate: true });
		expect(etat.mots.textContent).toBe('1 mot');
		expect(etat.anomalies.hidden).toBe(true);
		etat.setMode(true);
		expect(etat.element.hidden).toBe(true);
		etat.destroy();
	});
});

describe('piège de focus des popovers', () => {
	const tab = (cible, shiftKey = false) => {
		const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
		cible.dispatchEvent(event);
		return event;
	};

	it('Tab sur le dernier élément revient au premier, Maj+Tab sur le premier va au dernier', () => {
		const { ui } = monter('a <span>b</span>');
		ui.editRaw(brutPos('<span>'));
		const [premier, ...reste] = Popover.current.focusables();
		const dernier = reste.at(-1);
		expect(document.activeElement).toBe(premier);
		expect(tab(premier, true).defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(dernier);
		expect(tab(dernier).defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(premier);
		// au milieu : tabulation du navigateur
		expect(tab(premier).defaultPrevented).toBe(false);
	});

	it('tabulation déjà traitée (liste du sous-éditeur d\'une note) : laissée telle quelle', () => {
		const { ui } = monter('Texte[[-* un\n-* deux]]');
		ui.editNote(notePos());
		const { sous } = Popover.current;
		sous.commands.focus('end');
		const event = tab(sous.view.dom);
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(sous.view.dom);
	});
});

describe('atomes annoncés', () => {
	it('modèle : « Modèle doc 12 » ; appel de note : role note et aria-label', () => {
		monter('Voir <doc12|left> et[[une note]]');
		const modele = wrapper.querySelector('.tts-model');
		expect(modele.getAttribute('role')).toBe('group');
		expect(modele.getAttribute('aria-label')).toBe('Modèle doc 12');
		const note = wrapper.querySelector('.tts-note');
		expect(note.getAttribute('role')).toBe('note');
		expect(note.getAttribute('aria-label')).toBe('Note 1 : une note');
	});
});
