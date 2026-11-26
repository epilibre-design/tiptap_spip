import { boutonOutil } from '../ui/boutons.js';
import { label } from '../ui/labels.js';
import { lireSelection } from '../ui/popover.js';
import { emojiAutorise } from './insertion.js';

/** L’éditeur et son ouvreur sont explicites, y compris dans chaque langue d’un multi. */
export function creerBoutonEmoji({ editor, ouvrir }) {
	let detruit = false;
	const element = boutonOutil({ nom: 'emoji', libelle: label('emoji'), action: () => {
		if (!detruit && emojiAutorise({ editor })) ouvrir({ trigger: element });
	} });
	element.setAttribute('aria-haspopup', 'dialog'); element.setAttribute('aria-expanded', 'false');
	const memoriser = () => { if (!detruit) lireSelection(editor); };
	element.addEventListener('pointerdown', memoriser);
	const maj = () => { element.disabled = !emojiAutorise({ editor }); };
	const destroy = () => {
		if (detruit) return;
		detruit = true;
		editor.off('transaction', maj); editor.off('update', maj); editor.off('destroy', destroy);
		element.removeEventListener('pointerdown', memoriser); element.remove();
	};
	editor.on('transaction', maj); editor.on('update', maj); editor.on('destroy', destroy);
	maj();
	return { element, maj, destroy };
}
