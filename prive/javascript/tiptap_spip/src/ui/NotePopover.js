import { Editor, getSchema } from '@tiptap/core';
import { schemaJSON } from '../editor/content.js';
import { noteExtensions, noteSelectionnee } from '../editor/extensions.js';
import { noteSeRelit } from '../spip/valider.js';
import { label } from './labels.js';
import { openLinkPopover } from './LinkPopover.js';
import { openGlossaryPopover } from './MarkPopover.js';
import { openModelPopover } from './ModelPopover.js';
import { openRawPopover } from './RawPopover.js';
import { idUnique, lireSelection, Popover, suivrePosition } from './popover.js';

/** Contenu de note sans texte ni objet : paragraphes vides seulement. */
const vide = (content) => content.every((b) => b.type === 'paragraph' && !b.content?.length);

/**
 * Popover de note (spec 05 §1) : nom optionnel (vide : numérotée), case « Sans appel », texte dans
 * un sous-éditeur Tiptap (schéma de noteExtensions : sans notes, blocs permis dans une note), sans
 * barre d'outils. Le lien (Ctrl+K) et les modèles du sous-éditeur s'ouvrent en popovers enfants.
 *
 * Note sélectionnée (ou à `pos`) : modification ou suppression. Sinon insertion : comme le bouton
 * Note du porte-plume, un texte sélectionné dans un même bloc devient le texte de la note, qui le
 * remplace ; une autre sélection (sur plusieurs blocs, un modèle) est gardée, la note est insérée
 * après. Une note ouverte puis appliquée sans que son texte change garde son contenu d'origine,
 * restitué à l'identique.
 *
 * @param {{ editor, wrapper, services?, titles?, previews? }} contexte
 * @param {?number} [pos]
 * @returns {?Popover} null si le contenu de la note n'entre pas dans le sous-éditeur
 */
export function openNotePopover(contexte, pos = null) {
	const { editor, wrapper } = contexte;
	lireSelection(editor);
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	const { $from, $to } = selection;
	const existante = noteSelectionnee(editor.state);
	// texte sélectionné dans un même bloc, sans note : il devient le texte de la note
	const morceau = !existante && !selection.empty && $from.sameParent($to) && $from.parent.isTextblock
		? $from.parent.slice($from.parentOffset, $to.parentOffset).content
		: null;
	let entoure = Boolean(morceau);
	morceau?.descendants((n) => {
		if (n.type.name === 'spipNote') entoure = false;
	});
	const origine = existante?.node.attrs.content ?? null;
	const initial = entoure ? [{ type: 'paragraph', content: morceau.toJSON() }] : null;
	// plage remplacée par une nouvelle note, suivie pendant que le popover est ouvert
	const debut = existante ? null : suivrePosition(editor, entoure ? selection.from : selection.to);
	const fin = existante ? null : suivrePosition(editor, selection.to);
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
			debut?.fin();
			fin?.fin();
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

	// texte : sous-éditeur, sans barre d'outils
	const bloc = document.createElement('div');
	bloc.className = 'tts-popover__champ tts-note__bloc';
	const titre = document.createElement('span');
	titre.id = idUnique('tts-note');
	titre.textContent = label('note_texte');
	const zone = document.createElement('div');
	zone.className = 'tts-note__texte';
	bloc.append(titre, zone);
	popover.actions.before(bloc);

	const enfant = () => ({ ...contexte, editor: sous, parent: popover });
	const sousUi = {
		previews: contexte.previews ?? null,
		titles: contexte.titles ?? null,
		openLink: () => openLinkPopover(enfant()),
		openGlossary: () => openGlossaryPopover(enfant()),
		editModel: (p) => openModelPopover(enfant(), p),
		editRaw: (p) => openRawPopover(enfant(), p),
	};
	// extensions tierces de l'éditeur : le contenu de la note peut en contenir
	const extensions = noteExtensions({ ui: sousUi, tierces: editor.tiptapSpip?.tierces ?? [] });
	let content;
	try {
		content = schemaJSON({ type: 'doc', content: origine?.length ? origine : initial ?? [{ type: 'paragraph' }] }, getSchema(extensions));
	} catch (error) {
		console.warn('tiptap_spip : note non modifiable dans l\'éditeur', error);
		suivi?.fin();
		debut?.fin();
		fin?.fin();
		return null;
	}
	sous = new Editor({
		element: zone,
		extensions,
		content,
		editorProps: { attributes: { class: 'tts-prosemirror', 'aria-labelledby': titre.id, 'aria-multiline': 'true' } },
	});
	sous.tiptapSpip = editor.tiptapSpip;
	// exposé pour les tests et les extensions
	popover.sous = sous;
	let modifie = false;
	sous.on('update', () => {
		modifie = true;
		if (popover.flottant) popover.replacer();
	});

	const appliquer = () => {
		const nouveau = sansAppel.checked ? '' : nom.value.trim() || null;
		const texte = modifie || !origine ? sous.getJSON().content : origine;
		if (vide(texte)) {
			popover.error(label('note_vide'));
			return false;
		}
		if (!noteSeRelit({ name: nouveau, content: texte }, editor.tiptapSpip?.regles)) {
			popover.error(label('note_invalide'));
			return false;
		}
		if (existante) {
			const p = note();
			if (p !== null) editor.chain().focus().setNodeSelection(p).updateSpipNote({ name: nouveau, content: texte }).run();
		} else {
			const to = fin.pos() ?? editor.state.selection.to;
			const from = Math.min(debut.pos() ?? to, to);
			editor.chain().focus().insertContentAt({ from, to }, { type: 'spipNote', attrs: { name: nouveau, content: texte } }).run();
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
