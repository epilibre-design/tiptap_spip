// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { NotesPanel } from '../../src/ui/NotesPanel.js';
import { Popover } from '../../src/ui/popover.js';
import { apres, champ, cliquer, demonter, editor, erreur, monter, notePos, popovers, remplir, source, valider, wrapper } from './outils.js';

afterEach(demonter);

/** Sous-éditeur du popover de note ouvert. */
const sousEditeur = () => Popover.current?.parent?.sous ?? Popover.current?.sous;
/** Remplace le texte du sous-éditeur. */
const ecrireNote = (texte) => sousEditeur().commands.setContent(`<p>${texte}</p>`, { emitUpdate: true });

describe('popover de note', () => {
	it('Ctrl+Alt+N : nouvelle note, texte saisi dans le sous-éditeur', () => {
		monter('Texte');
		editor.commands.setTextSelection(apres('Texte'));
		editor.commands.keyboardShortcut('Mod-Alt-n');
		expect(popovers()).toHaveLength(1);
		expect(wrapper.querySelector('.tts-note__texte [contenteditable]')).not.toBeNull();
		ecrireNote('Une <strong>note</strong>.');
		valider();
		expect(source()).toBe('Texte[[Une {{note}}.]]');
		expect(popovers()).toHaveLength(0);
	});

	it('note nommée, note sans appel', () => {
		const { ui } = monter('a b');
		editor.commands.setTextSelection(apres('a'));
		ui.editNote(null);
		remplir('nom', 'A');
		ecrireNote('x');
		valider();
		editor.commands.setTextSelection(apres(' b'));
		ui.editNote(null);
		remplir('nom', 'ignoré');
		remplir('sans_appel', true);
		expect(champ('nom').disabled).toBe(true);
		ecrireNote('y');
		valider();
		expect(source()).toBe('a[[<A>x]] b[[<>y]]');
	});

	it('note vide refusée', () => {
		const { ui } = monter('a');
		ui.editNote(null);
		valider();
		expect(erreur().textContent).toBe('La note est vide.');
	});

	it('note existante ouverte puis appliquée sans changement : restituée à l\'identique', () => {
		const { ui } = monter('Avant[[ Premier.\n\n\nSecond.]] après');
		ui.editNote(notePos());
		expect(sousEditeur().getText()).toContain('Premier.');
		valider();
		expect(source()).toBe('Avant[[ Premier.\n\n\nSecond.]] après');
	});

	it('modification du nom seul : texte restitué à l\'identique', () => {
		const { ui } = monter('Avant[[ Premier.\n\n\nSecond.]] après');
		ui.editNote(notePos());
		remplir('nom', 'B');
		valider();
		expect(source()).toBe('Avant[[<B> Premier.\n\n\nSecond.]] après');
	});

	it('modification du texte, lien ouvert depuis le sous-éditeur en popover enfant', () => {
		const { ui } = monter('a[[Voir.]] b');
		ui.editNote(notePos());
		const sous = sousEditeur();
		sous.commands.selectAll();
		sous.commands.keyboardShortcut('Mod-k');
		expect(popovers()).toHaveLength(2);
		remplir('cible', 'art1');
		valider();
		// le lien appliqué, la note reste ouverte avec le sous-éditeur
		expect(popovers()).toHaveLength(1);
		expect(Popover.current.sous).toBe(sous);
		valider();
		expect(source()).toBe('a[[[Voir.->art1]]] b');
	});

	it('nom qui ne se relirait pas : erreur', () => {
		const { ui } = monter('a[[x]]');
		ui.editNote(notePos());
		remplir('nom', 'a>b');
		valider();
		expect(erreur().textContent).toBe('Cette note ne peut pas s’écrire telle quelle (nom ou texte).');
		expect(source()).toBe('a[[x]]');
	});

	it('« Supprimer la note »', () => {
		const { ui } = monter('a[[x]] b');
		ui.editNote(notePos());
		cliquer('retirer');
		expect(source()).toBe('a b');
	});

	it('clic sur un appel, Entrée sur un appel sélectionné : popover de la note', () => {
		monter('a[[x]] b');
		const appel = wrapper.querySelector('.tts-note');
		editor.view.someProp('handleClickOn', (f) => f(editor.view, notePos(), editor.state.doc.nodeAt(notePos()), notePos(), new MouseEvent('click'), true));
		expect(popovers()).toHaveLength(1);
		expect(sousEditeur().getText()).toBe('x');
		Popover.current.close();
		editor.commands.setNodeSelection(notePos());
		editor.commands.keyboardShortcut('Enter');
		expect(popovers()).toHaveLength(1);
		expect(source()).toBe('a[[x]] b');
		expect(appel.isConnected).toBe(true);
	});

	it('Échap dans le sous-éditeur : popover fermé, sous-éditeur détruit', () => {
		const { ui } = monter('a[[x]]');
		ui.editNote(notePos());
		const sous = sousEditeur();
		sous.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(popovers()).toHaveLength(0);
		expect(sous.isDestroyed).toBe(true);
	});

	it('note supprimée pendant que le popover est ouvert : rien n\'est modifié', () => {
		const { ui } = monter('a[[x]] b[[y]]');
		ui.editNote(notePos(0));
		editor.commands.deleteRange({ from: notePos(0), to: notePos(0) + 1 });
		ecrireNote('z');
		valider();
		expect(source()).toBe('a b[[y]]');
	});
});

describe('panneau des notes', () => {
	const panneau = () => {
		const { ui } = monter('a[[un]] b[[<A>deux]] c[[<>trois]]');
		const panel = new NotesPanel({ editor, editNote: (pos) => ui.editNote(pos) });
		wrapper.append(panel.element);
		return panel;
	};
	const items = (panel) => [...panel.liste.querySelectorAll('li')].map((li) => li.textContent);

	it('notes dans l\'ordre, avec leur appel et leur texte', () => {
		const panel = panneau();
		expect(panel.resume.textContent).toBe('Notes (3)');
		expect(items(panel)).toEqual(['[1] un', '[A] deux', '• trois']);
		panel.destroy();
	});

	it('mis à jour quand une note disparaît ; masqué sans note', () => {
		const panel = panneau();
		editor.commands.deleteRange({ from: notePos(0), to: notePos(0) + 1 });
		expect(items(panel)).toEqual(['[A] deux', '• trois']);
		editor.commands.setContent('<p>rien</p>', { emitUpdate: true });
		expect(panel.element.hidden).toBe(true);
		panel.destroy();
	});

	it('clic sur une note : popover de cette note', () => {
		const panel = panneau();
		panel.liste.querySelectorAll('button')[1].click();
		expect(champ('nom').value).toBe('A');
		panel.destroy();
	});
});
