import { anomaliesDuDocument } from '../editor/anomalies.js';
import { label } from './labels.js';

/** Libellé au singulier pour 1, au pluriel (@nb@) sinon. */
const compte = (n, un, plusieurs) => (n === 1 ? label(un) : label(plusieurs).replace('@nb@', String(n)));

/**
 * Barre d'état sous l'éditeur (spec 06 §1, §5) : nombre de mots, nombre d'anomalies de syntaxe. Le
 * bouton des anomalies ouvre la suivante après la sélection (la première au-delà de la dernière).
 * Recalculée à chaque changement du document. Elle porte aussi un message ponctuel (images collées,
 * spec 10) ; en mode source, seul ce message est affiché, la barre est masquée sans lui.
 */
export class StatusBar {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, editRaw: (pos: number) => void }} options
	 */
	constructor({ editor, editRaw }) {
		this.editor = editor;
		this.editRaw = editRaw;
		this.element = document.createElement('div');
		this.element.className = 'tts-etat';
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', label('etat'));
		this.mots = document.createElement('span');
		this.mots.className = 'tts-etat__mots';
		// annoncé quand le nombre d'anomalies change
		this.annonce = document.createElement('span');
		this.annonce.setAttribute('aria-live', 'polite');
		this.anomalies = document.createElement('button');
		this.anomalies.type = 'button';
		this.anomalies.className = 'tts-etat__anomalies';
		this.anomalies.addEventListener('click', () => this.suivante());
		this.annonce.append(this.anomalies);
		// message ponctuel (envoi d'image refusé, soumission retenue…), visible aussi en mode source
		this.message = document.createElement('span');
		this.message.className = 'tts-etat__message';
		this.message.setAttribute('role', 'status');
		this.message.hidden = true;
		this.element.append(this.message, this.mots, this.annonce);
		this.source = false;
		this.render = ({ transaction }) => {
			if (transaction.docChanged) this.afficher();
		};
		editor.on('transaction', this.render);
		this.afficher();
	}

	/** Mode source : seul le message reste affiché. */
	setMode(source) {
		this.source = source;
		this.afficher();
	}

	/**
	 * Message dans la barre, avec éventuellement un bouton d'action ; remplace le précédent.
	 * @param {string} texte
	 * @param {{ libelle: string, faire: () => void }} [action]
	 */
	signaler(texte, action = null) {
		this.message.replaceChildren(texte);
		if (action) {
			const bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.textContent = action.libelle;
			bouton.addEventListener('click', () => action.faire());
			this.message.append(' ', bouton);
		}
		this.message.hidden = false;
		this.afficher();
	}

	effacer() {
		this.message.replaceChildren();
		this.message.hidden = true;
		this.afficher();
	}

	afficher() {
		this.element.hidden = this.source && this.message.hidden;
		this.mots.hidden = this.source;
		this.annonce.hidden = this.source;
		if (this.source) return;
		const { doc } = this.editor.state;
		const mots = doc.textBetween(0, doc.content.size, ' ', ' ').match(/\S+/g)?.length ?? 0;
		this.mots.textContent = compte(mots, 'etat_mot', 'etat_mots');
		this.liste = anomaliesDuDocument(doc);
		this.anomalies.hidden = this.liste.length === 0;
		this.anomalies.textContent = this.liste.length ? compte(this.liste.length, 'etat_anomalie', 'etat_anomalies') : '';
	}

	/** Anomalie suivante après la sélection : son popover. */
	suivante() {
		const { from } = this.editor.state.selection;
		const cible = this.liste.find((a) => a.pos > from) ?? this.liste[0];
		if (cible) this.editRaw(cible.pos);
	}

	destroy() {
		this.editor.off('transaction', this.render);
		this.element.remove();
	}
}
