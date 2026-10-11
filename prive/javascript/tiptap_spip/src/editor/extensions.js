import { Extension, Node } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Text from '@tiptap/extension-text';
import { Dropcursor, Gapcursor, UndoRedo } from '@tiptap/extensions';

/**
 * Schéma de l'éditeur (spec 03) : seulement ce que la syntaxe SPIP sait exprimer.
 * Les types et attributs sont exactement ceux que produit src/spip/parse.js.
 */

/** Attribut non rendu dans le DOM (technique ou porté par le JSON seulement). */
const hidden = (fallback = null, keepOnSplit = true) => ({ default: fallback, rendered: false, keepOnSplit });

/** Blocs de premier niveau : seuls ceux-ci portent la carte de segments. */
const TOP_BLOCKS = [
	'paragraph', 'heading', 'horizontalRule', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'table',
	'spipPoesie', 'spipAlign', 'spipCadre', 'spipHtml', 'spipMath', 'spipRaw',
];

/** Attributs de la sérialisation conservatrice (spec 04 §4) : jamais recopiés sur un bloc coupé. */
const SegmentMap = Extension.create({
	name: 'spipSegmentMap',
	addGlobalAttributes() {
		const attrs = Object.fromEntries(['spipSep', 'spipSrc', 'spipGroup', 'spipHash'].map((a) => [a, hidden(null, false)]));
		return [{ types: TOP_BLOCKS, attributes: attrs }];
	},
});

const SpipDocument = Document.extend({
	addAttributes: () => ({ spipLead: hidden(), spipTrail: hidden() }),
});

/** Saut de ligne : `\n` (autobr) ou `\n_ ` (manuel, valeur des sauts saisis dans l'éditeur). */
const SpipHardBreak = HardBreak.extend({
	addAttributes: () => ({
		syntax: {
			default: 'manual',
			keepOnSplit: false,
			parseHTML: (el) => (el.classList.contains('autobr') ? 'autobr' : 'manual'),
			renderHTML: (attrs) => ({ class: attrs.syntax === 'autobr' ? 'autobr' : 'manualbr' }),
		},
	}),
});

/** Code inline combinable avec les autres marks (`{{`a`}}` existe en SPIP). */
const SpipCode = Code.extend({ excludes: '' });

/** Bloc de code : ```` ``` ```` ou <code> multiligne ; openTag garde un <code …> avec attributs. */
const SpipCodeBlock = CodeBlock.extend({
	addAttributes() {
		return { ...this.parent?.(), openTag: hidden() };
	},
});

/** Un élément de liste SPIP tient sur une ligne : un paragraphe, puis une sous-liste éventuelle. */
const SpipListItem = ListItem.extend({ content: 'paragraph (bulletList | orderedList)?' });

/** Liste numérotée : SPIP ne connaît ni départ ni type de numérotation. */
const SpipOrderedList = OrderedList.extend({
	addAttributes: () => ({}),
	addInputRules: () => [],
});

const SpipTable = Table.extend({
	addAttributes: () => ({ caption: hidden(), summary: hidden() }),
});
const SpipTableHeader = TableHeader.extend({ content: 'paragraph' });
const SpipTableCell = TableCell.extend({ content: 'paragraph' });

/** Fabrique d'un bloc dont le texte n'est pas interprété (<cadre>, <html>, <math>). */
const verbatimBlock = (name, className) => Node.create({
	name,
	group: 'block',
	content: 'text*',
	marks: '',
	code: true,
	defining: true,
	addAttributes: () => ({ openTag: hidden(), closeTag: hidden() }),
	parseHTML: () => [{ tag: `pre[data-tts="${name}"]`, preserveWhitespace: 'full' }],
	renderHTML: () => ['pre', { class: `tts-verbatim ${className}`, 'data-tts': name }, ['code', 0]],
});

const SpipCadre = verbatimBlock('spipCadre', 'spip_cadre');
const SpipHtml = verbatimBlock('spipHtml', 'tts-html');
const SpipMath = verbatimBlock('spipMath', 'tts-math');

/** <poesie> / <poetry> : des paragraphes dont les sauts de ligne comptent. */
const SpipPoesie = Node.create({
	name: 'spipPoesie',
	group: 'block',
	content: 'paragraph+',
	defining: true,
	addAttributes: () => ({ tag: hidden('poesie') }),
	parseHTML: () => [{ tag: 'div[data-tts="spipPoesie"]' }],
	renderHTML: () => ['div', { class: 'spip_poesie', 'data-tts': 'spipPoesie' }, 0],
});

/** Contenu d'un alignement : tout bloc sauf un autre alignement. */
const ALIGNABLE = TOP_BLOCKS.filter((t) => t !== 'spipAlign').join(' | ');

/** <div class="text-center"> … </div> (spec 05 §8). */
const SpipAlign = Node.create({
	name: 'spipAlign',
	group: 'block',
	content: `(${ALIGNABLE})+`,
	defining: true,
	addAttributes: () => ({
		align: {
			default: 'center',
			parseHTML: (el) => el.getAttribute('data-tts-align'),
			renderHTML: (attrs) => ({ class: `text-${attrs.align}`, 'data-tts-align': attrs.align }),
		},
	}),
	parseHTML: () => [{ tag: 'div[data-tts-align]' }],
	renderHTML: ({ HTMLAttributes }) => ['div', HTMLAttributes, 0],
});

/** Construction conservée telle quelle : affichée comme du code, restituée à l'identique. */
const sourceAttr = () => ({
	source: {
		default: '',
		parseHTML: (el) => el.getAttribute('data-tts-source') ?? '',
		renderHTML: (attrs) => ({ 'data-tts-source': attrs.source }),
	},
});

const SpipRaw = Node.create({
	name: 'spipRaw',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes: sourceAttr,
	parseHTML: () => [{ tag: 'pre[data-tts-source]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['pre', { ...HTMLAttributes, class: 'tts-raw' }, node.attrs.source],
});

const SpipRawInline = Node.create({
	name: 'spipRawInline',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: sourceAttr,
	parseHTML: () => [{ tag: 'code[data-tts-source]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['code', { ...HTMLAttributes, class: 'tts-raw-inline' }, node.attrs.source],
});

/**
 * Extensions du cœur, marks dans l'ordre canonique de src/spip/json.js (MARK_ORDER) : le
 * schéma range les marks d'un texte dans l'ordre de déclaration.
 */
export function coreExtensions({ headingLevels = [2, 3, 4, 5, 6] } = {}) {
	return [
		SpipDocument,
		Paragraph,
		Text,
		Heading.configure({ levels: headingLevels, HTMLAttributes: { class: 'spip' } }),
		Blockquote.configure({ HTMLAttributes: { class: 'spip' } }),
		BulletList.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipOrderedList.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipListItem,
		ListKeymap,
		HorizontalRule.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipHardBreak,
		SpipCodeBlock.configure({ HTMLAttributes: { class: 'spip_code spip_code_block' } }),
		SpipTable.configure({ resizable: false, HTMLAttributes: { class: 'table spip' } }),
		TableRow,
		SpipTableHeader,
		SpipTableCell,
		SpipPoesie,
		SpipAlign,
		SpipCadre,
		SpipHtml,
		SpipMath,
		SpipRaw,
		SpipRawInline,
		// marks : ordre canonique bold, italic, strike, superscript, subscript, code
		Bold,
		Italic,
		Strike,
		Superscript,
		Subscript,
		SpipCode,
		SegmentMap,
		Dropcursor,
		Gapcursor,
		UndoRedo,
	];
}
