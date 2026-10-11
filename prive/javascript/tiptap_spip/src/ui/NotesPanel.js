import { apercu, notesDuDocument } from '../editor/extensions.js';
import { label } from './labels.js';

/**
 * Panneau des notes (spec 05 §1) : sous l'éditeur, repliable, la liste des notes du texte comme
 * elles apparaîtront en bas de l'article. Vue dérivée du document, recalculée à chaque changement ;
 * cliquer sur une note la sélectionne et ouvre son popover. Masqué sans note.
 */
export class NotesPanel {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, editNote: (pos: number) => void }} options
	 */
	constructor({ editor, editNote }) {
		this.editor = editor;
		this.element = document.createElement('details');
		this.element.className = 'tts-notes';
		this.resume = document.createElement('summary');
		this.liste = document.createElement('ol');
		this.liste.className = 'tts-notes__liste';
		this.element.append(this.resume, this.liste);
		this.editNote = editNote;
		this.render = () => this.afficher();
		editor.on('update', this.render);
		this.afficher();
	}

	afficher() {
		const notes = notesDuDocument(this.editor.state.doc);
		this.element.hidden = notes.length === 0;
		this.resume.textContent = `${label('notes')} (${notes.length})`;
		this.liste.replaceChildren(...notes.map(({ pos, node, label: numero }) => {
			const li = document.createElement('li');
			const bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.className = 'tts-notes__note';
			const appel = document.createElement('span');
			appel.className = 'tts-notes__appel';
			appel.textContent = node.attrs.name === '' ? '•' : `[${numero}]`;
			bouton.append(appel, ` ${apercu(node.attrs.content, 200)}`);
			bouton.addEventListener('click', () => this.editNote(pos));
			li.append(bouton);
			return li;
		}));
	}

	destroy() {
		this.editor.off('update', this.render);
		this.element.remove();
	}
}
