import { Editor, getSchema } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { schemaJSON } from '../editor/content.js';
import { noteExtensions } from '../editor/extensions.js';
import { noteSeRelit } from '../spip/valider.js';
import { label } from './labels.js';
import { openLinkPopover } from './LinkPopover.js';
import { openGlossaryPopover } from './MarkPopover.js';
import { Popover, suivrePosition } from './popover.js';

/** Contenu de note sans texte ni objet : paragraphes vides seulement. */
const vide = (content) => content.every((b) => b.type === 'paragraph' && !b.content?.length);

/**
 * Popover de note (spec 05 §1) : nom optionnel (vide : numérotée), case « Sans appel », texte dans
 * un sous-éditeur Tiptap (schéma de noteExtensions : sans notes, blocs permis dans une note) avec
 * une barre réduite. Le lien et le glossaire du sous-éditeur s'ouvrent en popovers enfants.
 *
 * Note sélectionnée (ou à `pos`) : modification ou suppression ; sinon insertion au curseur. Une
 * note ouverte puis appliquée sans que son texte change garde son contenu d'origine, restitué à
 * l'identique.
 *
 * @param {{ editor, wrapper, services?, titles?, previews? }} contexte
 * @param {?number} [pos]
 * @returns {?Popover} null si le contenu de la note n'entre pas dans le sous-éditeur
 */
export function openNotePopover(contexte, pos = null) {
	const { editor, wrapper } = contexte;
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	const existante = selection instanceof NodeSelection && selection.node.type.name === 'spipNote' ? selection : null;
	const origine = existante?.node.attrs.content ?? null;
	const name = existante?.node.attrs.name ?? null;

	let sous = null;
	// la note peut bouger (ou disparaître) pendant que le popover est ouvert
	const suivi = existante ? suivrePosition(editor, existante.from) : null;
	const note = () => {
		const p = suivi?.pos();
		return p != null && editor.state.doc.nodeAt(p)?.type.name === 'spipNote' ? p : null;
	};
	const popover = new Popover({
		editor, wrapper, titre: label('note'), className: 'tts-popover--note',
		onSubmit: () => appliquer(),
		onClose: () => {
			suivi?.fin();
			sous?.destroy();
		},
	});
	const nom = popover.input(label('note_nom'), { value: name ?? '', name: 'nom' });
	const sansAppel = popover.input(label('note_sans_appel'), { value: name === '', type: 'checkbox', name: 'sans_appel' });
	const majNom = () => {
		nom.disabled = sansAppel.checked;
	};
	sansAppel.addEventListener('change', majNom);
	majNom();

	// texte : barre réduite et sous-éditeur
	const bloc = document.createElement('div');
	bloc.className = 'tts-popover__champ tts-note__bloc';
	const titre = document.createElement('span');
	titre.id = `tts-note-${Math.random().toString(36).slice(2)}`;
	titre.textContent = label('note_texte');
	const barre = document.createElement('div');
	barre.className = 'tts-note__barre';
	barre.setAttribute('role', 'toolbar');
	barre.setAttribute('aria-labelledby', titre.id);
	const zone = document.createElement('div');
	zone.className = 'tts-note__texte';
	bloc.append(titre, barre, zone);
	popover.actions.before(bloc);

	const enfant = () => ({ ...contexte, editor: sous, parent: popover });
	const sousUi = {
		previews: contexte.previews ?? null,
		titles: contexte.titles ?? null,
		openLink: () => openLinkPopover(enfant()),
		openGlossary: () => openGlossaryPopover(enfant()),
	};
	const extensions = noteExtensions({ ui: sousUi });
	let content;
	try {
		content = schemaJSON({ type: 'doc', content: origine?.length ? origine : [{ type: 'paragraph' }] }, getSchema(extensions));
	} catch (error) {
		console.warn('tiptap_spip : note non modifiable dans l\'éditeur', error);
		suivi?.fin();
		return null;
	}
	sous = new Editor({
		element: zone,
		extensions,
		content,
		editorProps: { attributes: { class: 'tts-prosemirror', 'aria-labelledby': titre.id, 'aria-multiline': 'true' } },
	});
	// exposé pour les tests et les extensions
	popover.sous = sous;
	let modifie = false;
	sous.on('update', () => {
		modifie = true;
	});

	for (const [texte, action] of [
		[label('gras'), () => sous.chain().focus().toggleBold().run()],
		[label('italique'), () => sous.chain().focus().toggleItalic().run()],
		[label('lien'), () => sousUi.openLink()],
		[label('glossaire'), () => sousUi.openGlossary()],
	]) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = texte;
		// le sous-éditeur garde sa sélection
		b.addEventListener('mousedown', (event) => event.preventDefault());
		b.addEventListener('click', action);
		barre.append(b);
	}

	const appliquer = () => {
		const nouveau = sansAppel.checked ? '' : nom.value.trim() || null;
		const texte = modifie || !origine ? sous.getJSON().content : origine;
		if (vide(texte)) {
			popover.error(label('note_vide'));
			return false;
		}
		if (!noteSeRelit({ name: nouveau, content: texte })) {
			popover.error(label('note_invalide'));
			return false;
		}
		if (existante) {
			const p = note();
			if (p !== null) editor.chain().focus().setNodeSelection(p).updateSpipNote({ name: nouveau, content: texte }).run();
		} else {
			editor.chain().focus().insertSpipNote({ name: nouveau, content: texte }).run();
		}
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	if (existante) {
		popover.button(label('note_retirer'), () => {
			const p = note();
			if (p !== null) editor.chain().focus().setNodeSelection(p).removeSpipNote().run();
		}, { name: 'retirer' });
	}
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(zone.querySelector('[contenteditable]') ?? nom);
	sous.commands.focus('end');
	return popover;
}
