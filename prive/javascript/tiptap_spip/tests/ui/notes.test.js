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

	it('texte sélectionné : il devient le texte de la note (bouton Note du porte-plume)', () => {
		const { ui } = monter('Voir {{ceci}} ici');
		editor.commands.setTextSelection({ from: apres('Voir '), to: apres('ceci') });
		ui.editNote(null);
		expect(sousEditeur().getHTML()).toContain('<strong>ceci</strong>');
		valider();
		expect(source()).toBe('Voir [[{{ceci}}]] ici');
	});

	it('sélection sur deux paragraphes : gardée, la note est insérée après', () => {
		const { ui } = monter('un\n\ndeux');
		editor.commands.setTextSelection({ from: 2, to: apres('de') });
		ui.editNote(null);
		ecrireNote('n');
		valider();
		expect(source()).toBe('un\n\nde[[n]]ux');
	});

	it('sous-éditeur sans barre d\'outils : seuls Appliquer, Supprimer et Annuler', () => {
		const { ui } = monter('a[[Voir]]');
		ui.editNote(notePos());
		const note = wrapper.querySelector('.tts-popover--note');
		expect(note.querySelector('[role=toolbar]')).toBeNull();
		expect([...note.querySelectorAll('button[name]')].map((b) => b.name)).toEqual(['appliquer', 'retirer', 'annuler']);
	});

	it('note vide refusée', () => {
		const { ui } = monter('a');
		ui.editNote(null);
		valider();
		expect(erreur().textContent).toBe('La note est vide.');
	});

	it('deux notes de même nom : la seconde sans texte crée un rappel', () => {
		const { ui } = monter('Un puis deux');
		editor.commands.setTextSelection(apres('Un'));
		ui.editNote(null);
		remplir('nom', 'A');
		ecrireNote('Une explication commune.');
		valider();
		editor.commands.setTextSelection(apres('deux'));
		ui.editNote(null);
		remplir('nom', 'A');
		valider();
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe('Un[[<A>Une explication commune.]] puis deux[[<A>]]');
		expect(wrapper.querySelectorAll('.tts-content .tts-note')).toHaveLength(2);
	});

	it.each(['A', '1', '0', 'absente'])('rappel importé %s : réapplication sans changement', (nom) => {
		const initial = `Avant[[ <${nom}> ]] après`;
		const { ui } = monter(initial);
		ui.editNote(notePos());
		valider();
		expect(popovers()).toHaveLength(0);
		expect(source()).toBe(initial);
	});

	it.each([{ type: 'text', text: ' ' }, { type: 'text', text: '\t' }, { type: 'hardBreak' }])('rappel contenant seulement des blancs (%j) : aucune définition vide', (blanc) => {
		const { ui } = monter('a[[<A>définition]] b');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		editor.commands.setTextSelection(apres(' b'));
		ui.editNote(null);
		remplir('nom', 'A');
		sousEditeur().commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [blanc] }] }, { emitUpdate: true });
		valider();
		expect(popovers()).toHaveLength(0);
		expect(wrapper.querySelectorAll('.tts-content .tts-note')).toHaveLength(2);
		expect(panel.resume.textContent).toBe('Notes (1)');
		panel.destroy();
	});

	it('rappel : on peut modifier le nom ou ajouter son propre texte', () => {
		const { ui } = monter('a[[<A>]]');
		ui.editNote(notePos());
		remplir('nom', 'B');
		valider();
		expect(source()).toBe('a[[<B>]]');
		ui.editNote(notePos());
		ecrireNote('Définition');
		valider();
		expect(source()).toBe('a[[<B>Définition]]');
	});

	it('note sans appel vide refusée même si un nom a été saisi', () => {
		const { ui } = monter('a');
		ui.editNote(null);
		remplir('nom', 'A');
		remplir('sans_appel', true);
		valider();
		expect(erreur().textContent).toBe('La note est vide.');
		expect(source()).toBe('a');
	});

	it('rappel dont le nom ne se relit pas : refus sans modifier le document', () => {
		const { ui } = monter('a[[<A>]]');
		ui.editNote(notePos());
		remplir('nom', 'a>b');
		valider();
		expect(erreur().textContent).toBe('Cette note ne peut pas s’écrire telle quelle (nom ou texte).');
		expect(source()).toBe('a[[<A>]]');
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

	it('trois appels nommés : une seule définition dans le panneau', () => {
		monter('Premier[[<A>Une explication commune.]] Autre[[<A>]] Encore[[<A>]]');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		expect(wrapper.querySelectorAll('.tts-content .tts-note')).toHaveLength(3);
		expect(items(panel)).toEqual(['[A] Une explication commune.']);
		expect(panel.resume.textContent).toBe('Notes (1)');
		panel.destroy();
	});

	it('une note avec un objet ou une espace insécable garde sa définition', () => {
		monter('a[[<A><doc1>]] b[[<B>~]] c[[<C>{{ }}]] d[[<D>]]');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		expect(panel.resume.textContent).toBe('Notes (3)');
		expect([...panel.liste.querySelectorAll('.tts-notes__appel')].map((el) => el.textContent))
			.toEqual(['[A]', '[B]', '[C]']);
		panel.destroy();
	});

	it('rappels numériques sans effet sur la numérotation, définitions homonymes conservées', () => {
		monter('a[[première]] b[[<1>]] c[[seconde]] d[[<A>un]] e[[<A>deux]] f[[<A>]]');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		expect(items(panel)).toEqual(['[1] première', '[2] seconde', '[A] un', '[A] deux']);
		expect([...wrapper.querySelectorAll('.tts-content .tts-note')].map((el) => el.dataset.ttsLabel))
			.toEqual(['1', '1', '2', 'A', 'A', 'A']);
		panel.destroy();
	});

	it('suppression de définition : rappel conservé, panneau masqué ; annulation : définition rétablie', () => {
		monter('a[[<A>texte]] b[[<A>]]');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		editor.commands.deleteRange({ from: notePos(), to: notePos() + 1 });
		expect(source()).toBe('a b[[<A>]]');
		expect(panel.element.hidden).toBe(true);
		editor.commands.undo();
		expect(items(panel)).toEqual(['[A] texte']);
		expect(panel.element.hidden).toBe(false);
		editor.commands.redo();
		expect(panel.element.hidden).toBe(true);
		panel.destroy();
	});

	it('retour de source sans update : les rappels seuls ne produisent pas de panneau', () => {
		const panel = panneau();
		const note = { type: 'spipNote', attrs: { name: 'A', content: [{ type: 'paragraph' }] } };
		editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [note] }] }, { emitUpdate: false });
		expect(panel.element.hidden).toBe(true);
		expect(items(panel)).toEqual([]);
		panel.destroy();
	});

	it('multi : seuls les textes des notes de la langue affichée apparaissent', () => {
		monter('x <multi>[fr]a[[<A>définition FR]] b[[<A>]][en]c[[<A>]]</multi>');
		editor.commands.setLangueAffichee('fr');
		const panel = new NotesPanel({ editor, editNote: () => {} });
		expect(items(panel)).toEqual(['[A] définition FR']);
		editor.commands.setLangueAffichee('en');
		expect(panel.element.hidden).toBe(true);
		editor.commands.setLangueAffichee('fr');
		expect(items(panel)).toEqual(['[A] définition FR']);
		panel.destroy();
	});

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

	it('rechargé sans update (retour du mode source) : recalculé', () => {
		const panel = panneau();
		editor.commands.setContent('<p>a</p>', { emitUpdate: false });
		expect(panel.element.hidden).toBe(true);
		panel.destroy();
	});

	it('multi : notes de la partie affichée, mises à jour quand la langue change ; clic : popover du multi', () => {
		const { ui } = monter('x <multi>[fr]a[[note FR]][en]b</multi> y[[autre]]');
		editor.commands.setLangueAffichee('fr');
		const panel = new NotesPanel({ editor, editNote: (pos) => ui.editNote(pos), editMulti: (pos) => ui.editMulti(pos) });
		wrapper.append(panel.element);
		expect(items(panel)).toEqual(['[1] note FR', '[2] autre']);
		panel.liste.querySelector('button').click();
		expect(Popover.current.form.classList.contains('tts-popover--multi')).toBe(true);
		Popover.current.close();
		editor.commands.setLangueAffichee('en');
		expect(items(panel)).toEqual(['[1] autre']);
		panel.destroy();
	});

	it('clic sur une note : popover de cette note', () => {
		const panel = panneau();
		panel.liste.querySelectorAll('button')[1].click();
		expect(champ('nom').value).toBe('A');
		panel.destroy();
	});
});
