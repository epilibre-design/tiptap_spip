import { Extension, Mark, Node } from '@tiptap/core';
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
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { linkAutoView, modelView } from '../nodeviews/views.js';

/**
 * Schéma de l'éditeur (spec 03) : seulement ce que la syntaxe SPIP sait exprimer.
 * Les types et attributs sont exactement ceux que produit src/spip/parse.js.
 */

/** Attribut non rendu dans le DOM (technique ou porté par le JSON seulement). */
const hidden = (fallback = null, keepOnSplit = true) => ({ default: fallback, rendered: false, keepOnSplit });

/** Blocs de premier niveau : seuls ceux-ci portent la carte de segments. */
const TOP_BLOCKS = [
	'paragraph', 'heading', 'horizontalRule', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'table',
	'spipPoesie', 'spipAlign', 'spipCadre', 'spipHtml', 'spipMath', 'spipRaw', 'spipModelBlock',
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

/**
 * Code inline combinable avec les autres marks (`{{`a`}}` existe en SPIP), sauf glossaire et
 * abréviation (exclusion déclarée des deux côtés : la mark ajoutée remplace l'autre).
 */
const SpipCode = Code.extend({ excludes: 'spipGlossary spipAbbr' });

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

/** Attributs d'un lien (spec 03 §3) : cible brute, bulle, langue, nouvelle fenêtre (->>). */
const linkAttributes = () => ({
	href: { default: '', parseHTML: (el) => el.getAttribute('data-tts-href') ?? '', renderHTML: (a) => ({ 'data-tts-href': a.href }) },
	bulle: { default: null, parseHTML: (el) => el.getAttribute('title'), renderHTML: (a) => (a.bulle == null ? {} : { title: a.bulle }) },
	hreflang: { default: null, parseHTML: (el) => el.getAttribute('hreflang'), renderHTML: (a) => (a.hreflang ? { hreflang: a.hreflang } : {}) },
	newWindow: {
		default: false,
		parseHTML: (el) => el.hasAttribute('data-tts-new-window'),
		renderHTML: (a) => (a.newWindow ? { 'data-tts-new-window': '' } : {}),
	},
});

/**
 * Lien [texte->cible]. Pas d'extension-link : sa validation d'URL refuse les cibles SPIP (art12).
 * Pas de href rendu : un clic dans l'éditeur ne doit pas naviguer.
 */
const SpipLink = Mark.create({
	name: 'spipLink',
	inclusive: false,
	// pas de lien dans un lien, ni sur un glossaire ou une abréviation : le lien les remplace
	excludes: 'spipLink spipGlossary spipAbbr',
	addAttributes: linkAttributes,
	// un lien sans texte (data-tts-auto) est un nœud, pas cette mark
	parseHTML: () => [{ tag: 'a[data-tts-href]', getAttrs: (el) => (el.hasAttribute('data-tts-auto') ? false : null) }],
	renderHTML: ({ HTMLAttributes }) => ['a', { ...HTMLAttributes, class: 'tts-link' }, 0],
});

/**
 * Terme de glossaire [?terme#glossaireN|bulle{lang}] : le texte marqué est le terme. Ni lien, ni code,
 * ni abréviation sur le même texte (spec 03 §3).
 */
const SpipGlossary = Mark.create({
	name: 'spipGlossary',
	inclusive: false,
	excludes: 'spipGlossary spipLink spipAbbr code',
	addAttributes: () => ({
		glossaire: { default: null, parseHTML: (el) => el.getAttribute('data-tts-glossary') || null, renderHTML: (a) => ({ 'data-tts-glossary': a.glossaire ?? '' }) },
		numero: { default: null, parseHTML: (el) => el.getAttribute('data-tts-numero'), renderHTML: (a) => (a.numero ? { 'data-tts-numero': a.numero } : {}) },
		bulle: { default: null, parseHTML: (el) => el.getAttribute('title'), renderHTML: (a) => (a.bulle == null ? {} : { title: a.bulle }) },
		hreflang: { default: null, parseHTML: (el) => el.getAttribute('hreflang'), renderHTML: (a) => (a.hreflang ? { hreflang: a.hreflang } : {}) },
	}),
	parseHTML: () => [{ tag: 'span[data-tts-glossary]' }],
	renderHTML: ({ HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'tts-glossary' }, 0],
});

/** Abréviation [ABBR|explication{lang}]. */
const SpipAbbr = Mark.create({
	name: 'spipAbbr',
	inclusive: false,
	excludes: 'spipAbbr spipLink spipGlossary code',
	addAttributes: () => ({
		title: { default: '', parseHTML: (el) => el.getAttribute('title') ?? '', renderHTML: (a) => ({ title: a.title }) },
		lang: { default: null, parseHTML: (el) => el.getAttribute('lang'), renderHTML: (a) => (a.lang ? { lang: a.lang } : {}) },
	}),
	parseHTML: () => [{ tag: 'abbr[title]' }],
	renderHTML: ({ HTMLAttributes }) => ['abbr', { ...HTMLAttributes, class: 'tts-abbr' }, 0],
});

/** Lien sans texte [->art12] : le titre est calculé par SPIP (affiché par L2c), la cible en attendant. */
const SpipLinkAuto = Node.create({
	name: 'spipLinkAuto',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: linkAttributes,
	parseHTML: () => [{ tag: 'a[data-tts-auto]', priority: 60 }],
	renderHTML: ({ node, HTMLAttributes }) => ['a', { ...HTMLAttributes, class: 'tts-link tts-link-auto', 'data-tts-auto': '' }, `→ ${node.attrs.href}`],
});

/** Ancre [#nom<-]. */
const SpipAnchor = Node.create({
	name: 'spipAnchor',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: () => ({
		name: { default: '', parseHTML: (el) => el.getAttribute('data-tts-anchor') ?? '', renderHTML: (a) => ({ 'data-tts-anchor': a.name }) },
	}),
	parseHTML: () => [{ tag: 'span[data-tts-anchor]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'tts-anchor' }, `#${node.attrs.name}`],
});

/** Attribut model (spec 03 §4), transporté en JSON dans le HTML pour le copier-coller interne. */
const modelAttributes = () => ({
	model: {
		default: null,
		parseHTML: (el) => {
			try {
				return JSON.parse(el.getAttribute('data-tts-model'));
			} catch {
				return null;
			}
		},
		renderHTML: (a) => ({ 'data-tts-model': JSON.stringify(a.model) }),
	},
});

/** Modèle dans une phrase ; la prévisualisation (NodeView) vient avec les services serveur (L2c). */
const SpipModel = Node.create({
	name: 'spipModel',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: modelAttributes,
	parseHTML: () => [{ tag: 'span[data-tts-model]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'tts-model' }, node.attrs.model?.source ?? ''],
});

/** Modèle seul dans son paragraphe. */
const SpipModelBlock = Node.create({
	name: 'spipModelBlock',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes: modelAttributes,
	parseHTML: () => [{ tag: 'div[data-tts-model]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['div', { ...HTMLAttributes, class: 'tts-model tts-model-block' }, node.attrs.model?.source ?? ''],
});

/** Texte d'une note, sans mise en forme, pour l'infobulle de son appel. */
function apercu(content, max = 80) {
	const morceaux = [];
	const parcourir = (n) => {
		if (n.text) morceaux.push(n.text);
		else if (n.attrs?.source) morceaux.push(n.attrs.source);
		else if (n.attrs?.model?.source) morceaux.push(n.attrs.model.source);
		(n.content ?? []).forEach(parcourir);
		if (n.type === 'paragraph') morceaux.push(' ');
	};
	(content ?? []).forEach(parcourir);
	const texte = morceaux.join('').replace(/\s+/g, ' ').trim();
	return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

/**
 * Note [[…]] (spec 05 §1) : appel de note, contenu en attribut (document JSON avec sa carte de
 * segments). Le numéro n'est pas stocké : SpipNoteNumbers le calcule.
 */
const SpipNote = Node.create({
	name: 'spipNote',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: () => ({
		// null : numérotée automatiquement ; '' : sans appel
		name: {
			default: null,
			parseHTML: (el) => el.getAttribute('data-tts-note-name'),
			renderHTML: (a) => (a.name == null ? {} : { 'data-tts-note-name': a.name }),
		},
		content: {
			default: null,
			parseHTML: (el) => {
				try {
					return JSON.parse(el.getAttribute('data-tts-note'));
				} catch {
					return null;
				}
			},
			renderHTML: (a) => ({ 'data-tts-note': JSON.stringify(a.content ?? []) }),
		},
		spipLead: hidden(),
		spipTrail: hidden(),
	}),
	// avant la mark exposant, qui lit aussi <sup>
	parseHTML: () => [{ tag: 'sup[data-tts-note]', priority: 60 }],
	renderHTML: ({ node, HTMLAttributes }) => ['sup', { ...HTMLAttributes, class: 'tts-note', title: apercu(node.attrs.content) }],
});

/** Numéros des appels de note, recalculés à chaque changement du document (décorations). */
const SpipNoteNumbers = Extension.create({
	name: 'spipNoteNumbers',
	addProseMirrorPlugins() {
		const key = new PluginKey('spipNoteNumbers');
		const numeroter = (doc) => {
			const decorations = [];
			let n = 0;
			doc.descendants((node, pos) => {
				if (node.type.name !== 'spipNote') return;
				const { name } = node.attrs;
				// comme SPIP : seules les notes automatiques sont comptées
				const label = name == null ? String(++n) : name;
				const aria = name === '' ? 'Note sans appel' : `Note ${label}`;
				decorations.push(Decoration.node(pos, pos + node.nodeSize, {
					'data-tts-label': label,
					'aria-label': `${aria} : ${apercu(node.attrs.content)}`,
				}));
			});
			return DecorationSet.create(doc, decorations);
		};
		return [new Plugin({
			key,
			state: {
				init: (_, { doc }) => numeroter(doc),
				apply: (tr, set) => (tr.docChanged ? numeroter(tr.doc) : set),
			},
			props: { decorations: (state) => key.getState(state) },
		})];
	},
});

/** Raccourcis clavier de l'interface (spec 06 §6). */
const SpipUi = Extension.create({
	name: 'spipUi',
	addOptions: () => ({ ui: null }),
	addKeyboardShortcuts() {
		return {
			'Mod-k': () => {
				this.options.ui?.openLink?.();
				return true;
			},
		};
	},
});

/**
 * Extensions du cœur, marks dans l'ordre canonique de src/spip/json.js (MARK_ORDER) : le
 * schéma range les marks d'un texte dans l'ordre de déclaration.
 *
 * @param {{ headingLevels?: number[], ui?: { previews?, titles?, editModel?, openLink? } | null }} options
 *        ui : interface de l'instance ; avec `previews` et `titles` (services serveur présents), les
 *        modèles sont prévisualisés et les liens sans texte affichent leur titre
 */
export function coreExtensions({ headingLevels = [2, 3, 4, 5, 6], ui = null } = {}) {
	const withView = (node, view, enabled) => (enabled ? node.extend({ addNodeView: () => view(ui) }) : node);
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
		withView(SpipLinkAuto, linkAutoView, Boolean(ui?.titles)),
		SpipAnchor,
		SpipNote,
		SpipNoteNumbers,
		withView(SpipModel, modelView, Boolean(ui?.previews)),
		withView(SpipModelBlock, modelView, Boolean(ui?.previews)),
		// marks : ordre canonique de MARK_ORDER
		SpipLink,
		Bold,
		Italic,
		Strike,
		Superscript,
		Subscript,
		SpipAbbr,
		SpipGlossary,
		SpipCode,
		SegmentMap,
		Dropcursor,
		Gapcursor,
		UndoRedo,
		SpipUi.configure({ ui }),
	];
}
