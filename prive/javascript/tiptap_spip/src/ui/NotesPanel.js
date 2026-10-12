import { langueAffichee, notesDuDocument } from '../editor/extensions.js';
import { apercu } from '../editor/texte.js';
import { label } from './labels.js';

/**
 * Panneau des notes (spec 05 §1) : sous l'éditeur, repliable, la liste des notes du texte comme
 * elles apparaîtront en bas de l'article. Vue dérivée du document, recalculée à chaque changement
 * (rechargement depuis le mode source compris, qui n'émet pas d'update) et quand la langue affichée
 * change (seules comptent les notes de la partie affichée d'un multi). Cliquer sur une note ouvre
 * son popover, ou celui du multi qui la contient. Masqué sans note et en mode source.
 */
export class NotesPanel {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, editNote: (pos: number) => void,
	 *           editMulti?: (pos: number) => void }} options
	 */
	constructor({ editor, editNote, editMulti = () => {} }) {
		this.editor = editor;
		this.element = document.createElement('details');
		this.element.className = 'tts-notes';
		this.resume = document.createElement('summary');
		this.liste = document.createElement('ol');
		this.liste.className = 'tts-notes__liste';
		this.element.append(this.resume, this.liste);
		this.editNote = editNote;
		this.editMulti = editMulti;
		this.source = false;
		this.render = ({ transaction }) => {
			if (transaction.docChanged || langueAffichee(this.editor.state) !== this.langue) this.afficher();
		};
		editor.on('transaction', this.render);
		this.afficher();
	}

	/** Mode source : panneau masqué. */
	setMode(source) {
		this.source = source;
		this.afficher();
	}

	afficher() {
		const { state } = this.editor;
		this.langue = langueAffichee(state);
		const notes = notesDuDocument(state.doc, this.langue);
		this.element.hidden = this.source || notes.length === 0;
		this.resume.textContent = `${label('notes')} (${notes.length})`;
		this.liste.replaceChildren(...notes.map(({ pos, attrs, multi, label: numero }) => {
			const li = document.createElement('li');
			const bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.className = 'tts-notes__note';
			const appel = document.createElement('span');
			appel.className = 'tts-notes__appel';
			appel.textContent = attrs.name === '' ? '•' : `[${numero}]`;
			bouton.append(appel, ` ${apercu(attrs.content, 200)}`);
			bouton.addEventListener('click', () => (multi ? this.editMulti(pos) : this.editNote(pos)));
			li.append(bouton);
			return li;
		}));
	}

	destroy() {
		this.editor.off('transaction', this.render);
		this.element.remove();
	}
}
