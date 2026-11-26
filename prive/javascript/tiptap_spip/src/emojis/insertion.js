import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

const exclus = new Set(['codeBlock', 'spipCadre', 'spipHtml', 'spipMath', 'spipMarkdown', 'spipRaw', 'spipRawInline']);

/** Même garde pour le bouton, le picker et le fournisseur ; aucune sélection d’atome remplacée. */
export function emojiAutorise({ editor, state = editor?.state, range = state?.selection }) {
	if (!editor || editor.isDestroyed || !editor.isEditable || editor.view.dom.closest('[hidden]')
		|| state.selection instanceof NodeSelection || !range || !Number.isInteger(range.from) || !Number.isInteger(range.to)
		|| range.from < 0 || range.to < range.from || range.to > state.doc.content.size) return false;
	const { doc } = state, a = doc.resolve(range.from), b = doc.resolve(range.to);
	if (!a.parent.isTextblock || !a.sameParent(b)) return false;
	for (let d = 0; d <= a.depth; d++) if (exclus.has(a.node(d).type.name)) return false;
	let interdit = (range.from === range.to ? state.storedMarks ?? a.marks() : a.marks()).some((m) => m.type.name === 'code');
	doc.nodesBetween(range.from, range.to, (n) => {
		interdit ||= exclus.has(n.type.name) || (n.isAtom && !n.isText && n.type.name !== 'hardBreak')
			|| n.marks.some((m) => m.type.name === 'code');
	});
	return !interdit;
}

/** Une seule insertion de texte, avec ses marks et ses limites d’historique avant/après. */
export function insererEmoji({ editor, range, unicode }) {
	if (typeof unicode !== 'string' || !unicode.trim() || !emojiAutorise({ editor, range })) return false;
	const { state } = editor;
	const a = state.doc.resolve(range.from), b = state.doc.resolve(range.to);
	const marks = range.from === range.to ? state.storedMarks ?? a.marks() : a.marksAcross(b) ?? a.marks();
	const tr = closeHistory(state.tr).replaceWith(range.from, range.to, state.schema.text(unicode, marks));
	tr.setSelection(TextSelection.create(tr.doc, range.from + unicode.length));
	editor.view.dispatch(tr);
	if (!editor.isDestroyed) editor.view.dispatch(closeHistory(editor.state.tr));
	return true;
}
