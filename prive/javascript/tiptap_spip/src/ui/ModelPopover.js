import { NodeSelection } from '@tiptap/pm/state';
import { parseModel } from '../spip/models.js';
import { label } from './labels.js';
import { Popover } from './popover.js';

/**
 * Raccourci d'un modèle, saisi ou modifié tel quel (spec 05 §3, cas sans formulaire YAML), validé
 * par le parseur. Modèle sélectionné (ou à `pos`) : modification ; sinon insertion, en bloc si le
 * paragraphe courant est vide.
 */
export function openModelPopover({ editor, wrapper, parent }, pos = null) {
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	const courant = selection instanceof NodeSelection && /^spipModel(Block)?$/.test(selection.node.type.name) ? selection : null;

	const popover = new Popover({ editor, wrapper, parent, titre: label('modele'), className: 'tts-popover--modele', onSubmit: () => appliquer() });
	const raccourci = popover.input(label('modele_raccourci'), { value: courant?.node.attrs.model?.source ?? '', name: 'raccourci' });

	const appliquer = () => {
		const model = parseModel(raccourci.value.trim());
		if (!model) {
			popover.error(label('modele_invalide'));
			return false;
		}
		if (courant) {
			editor.chain().focus().command(({ tr }) => {
				tr.setNodeMarkup(courant.from, undefined, { model });
				return true;
			}).run();
			return true;
		}
		const { $from } = editor.state.selection;
		const paragrapheVide = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && $from.depth === 1;
		if (paragrapheVide) {
			editor.chain().focus().command(({ tr }) => {
				tr.replaceWith($from.before(), $from.after(), editor.schema.nodes.spipModelBlock.create({ model }));
				return true;
			}).run();
		} else {
			editor.chain().focus().insertContent({ type: 'spipModel', attrs: { model } }).run();
		}
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(raccourci);
	return popover;
}
