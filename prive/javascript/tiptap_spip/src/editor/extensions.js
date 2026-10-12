import { Extension, InputRule, Mark, Node } from '@tiptap/core';
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
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { idiomeView, linkAutoView, modelView, multiView } from '../nodeviews/views.js';
import { parseGlossary, serializeGlossary } from '../spip/glossary.js';
import { serializeIdiome } from '../spip/multi.js';
import { apercu, partieAffichee } from './texte.js';
import { label as libelle } from '../ui/labels.js';

/**
 * Schéma de l'éditeur (spec 03) : seulement ce que la syntaxe SPIP sait exprimer.
 * Les types et attributs sont exactement ceux que produit src/spip/parse.js.
 */

/** Attribut non rendu dans le DOM (technique ou porté par le JSON seulement). */
const hidden = (fallback = null, keepOnSplit = true) => ({ default: fallback, rendered: false, keepOnSplit });

/** Blocs de premier niveau : seuls ceux-ci portent la carte de segments. */
const TOP_BLOCKS = [
	'paragraph', 'heading', 'horizontalRule', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'table',
	'spipPoesie', 'spipAlign', 'spipCadre', 'spipHtml', 'spipMath', 'spipRaw', 'spipModelBlock', 'spipMultiBlock',
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
	// [?terme…] tapé : le terme marqué, si le raccourci se réécrit à l'identique (sinon le texte reste,
	// comme le parseur le garde brut)
	addInputRules() {
		return [new InputRule({
			find: /\[\?[^\][<>]+\]$/,
			handler: ({ state, range, match }) => {
				const gloss = parseGlossary(match[0]);
				if (!gloss || serializeGlossary(gloss.term, gloss.attrs) !== match[0]) return null;
				const marks = [...state.storedMarks ?? state.doc.resolve(range.from).marks(), this.type.create(gloss.attrs)];
				state.tr.replaceWith(range.from, range.to, state.schema.text(gloss.term, marks));
			},
		})];
	},
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

/** Attribut JSON transporté dans le HTML (copier-coller interne). */
const jsonAttr = (name, dataAttr, fallback) => ({
	[name]: {
		default: fallback,
		parseHTML: (el) => {
			try {
				return JSON.parse(el.getAttribute(dataAttr)) ?? fallback;
			} catch {
				return fallback;
			}
		},
		renderHTML: (a) => ({ [dataAttr]: JSON.stringify(a[name] ?? fallback) }),
	},
});

/** Attribut lang d'une partie de multi (null : partie sans langue). */
const langAttr = () => ({
	lang: {
		default: null,
		parseHTML: (el) => el.getAttribute('data-tts-lang'),
		renderHTML: (a) => (a.lang == null ? {} : { 'data-tts-lang': a.lang }),
	},
});

/**
 * Multi dans une phrase (spec 05 §5) : atome, une partie par langue ; affiché dans la langue de
 * l'interface, les autres en infobulle. Édité dans un popover (lot L4.2).
 */
const SpipMultiInline = Node.create({
	name: 'spipMultiInline',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: () => ({ ...jsonAttr('parts', 'data-tts-multi', []), spipSrc: hidden(), spipHash: hidden() }),
	parseHTML: () => [{ tag: 'span[data-tts-multi]' }],
	// langue affichée : décorations de SpipLangues (sélecteur de la barre)
	addNodeView: () => multiView(),
	renderHTML: ({ node, HTMLAttributes }) => {
		const parts = node.attrs.parts ?? [];
		const affichee = partieAffichee(parts);
		const title = parts.map((p) => `${p.lang ?? '*'} : ${apercu(p.content)}`).join(' · ');
		// texte entier (copier-coller vers l'extérieur) ; la limite d'apercu vaut pour l'infobulle
		return ['span', { ...HTMLAttributes, class: 'tts-multi', title, 'data-tts-lang': affichee?.lang ?? '' }, apercu(affichee?.content ?? [], Infinity)];
	},
});

/** Partie d'un multi bloc : des paragraphes, et sa langue en badge. */
const SpipLangBlock = Node.create({
	name: 'spipLangBlock',
	content: 'paragraph+',
	defining: true,
	addAttributes: langAttr,
	parseHTML: () => [{ tag: 'div[data-tts-lang-block]' }],
	renderHTML: ({ HTMLAttributes }) => ['div', { ...HTMLAttributes, class: 'tts-lang', 'data-tts-lang-block': '' }, 0],
});

/** Multi sur plusieurs paragraphes : ses parties empilées. */
const SpipMultiBlock = Node.create({
	name: 'spipMultiBlock',
	group: 'block',
	content: 'spipLangBlock+',
	defining: true,
	parseHTML: () => [{ tag: 'div[data-tts-multi-block]' }],
	renderHTML: () => ['div', { class: 'tts-multi-block', 'data-tts-multi-block': '' }, 0],
});

/**
 * Idiome <:module:cle:> : chaîne de langue de SPIP, affichée par son raccourci ; avec les services,
 * par sa traduction (NodeView), le raccourci en infobulle.
 */
const SpipIdiome = Node.create({
	name: 'spipIdiome',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: () => ({
		module: { default: null, parseHTML: (el) => el.getAttribute('data-tts-module'), renderHTML: (a) => (a.module ? { 'data-tts-module': a.module } : {}) },
		cle: { default: '', parseHTML: (el) => el.getAttribute('data-tts-idiome') ?? '', renderHTML: (a) => ({ 'data-tts-idiome': a.cle }) },
	}),
	parseHTML: () => [{ tag: 'code[data-tts-idiome]', priority: 60 }],
	renderHTML: ({ node, HTMLAttributes }) => ['code', { ...HTMLAttributes, class: 'tts-idiome' }, serializeIdiome(node.attrs)],
});


/** Note sélectionnée (NodeSelection), ou null. */
export function noteSelectionnee(state) {
	const { selection } = state;
	return selection instanceof NodeSelection && selection.node.type.name === 'spipNote' ? selection : null;
}

const clefLangues = new PluginKey('spipLangues');

/** Langues citées par les multis d'un document, dans l'ordre d'apparition. */
export function languesDuDocument(doc) {
	const langues = new Set();
	doc.descendants((node) => {
		if (node.type.name === 'spipMultiInline') (node.attrs.parts ?? []).forEach((p) => p.lang && langues.add(p.lang));
		if (node.type.name === 'spipLangBlock' && node.attrs.lang) langues.add(node.attrs.lang);
	});
	return [...langues];
}

/** Langue de l'interface : langue affichée par les multis au départ. */
const langueInitiale = () => globalThis.document?.documentElement?.lang ?? '';

/** Langue affichée par les multis (sélecteur de la barre), la langue de l'interface par défaut. */
export const langueAffichee = (state) => clefLangues.getState(state)?.langue ?? '';

/**
 * Langue affichée par les multis (spec 05 §5, à la place des onglets) : un multi en ligne montre sa
 * partie de cette langue ; dans un multi bloc, les autres parties sont estompées. Décorations
 * recalculées quand le document ou la langue change.
 */
const SpipLangues = Extension.create({
	name: 'spipLangues',
	addCommands: () => ({
		setLangueAffichee: (langue) => ({ tr, dispatch }) => {
			if (dispatch) tr.setMeta(clefLangues, langue);
			return true;
		},
	}),
	addProseMirrorPlugins() {
		const decorer = (doc, langue) => {
			const decorations = [];
			doc.descendants((node, pos) => {
				if (node.type.name === 'spipMultiInline') {
					decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, { langue }));
				} else if (node.type.name === 'spipMultiBlock') {
					const parts = [];
					node.forEach((part, offset) => parts.push({ lang: part.attrs.lang, pos: pos + 1 + offset, size: part.nodeSize }));
					const montree = partieAffichee(parts, langue);
					for (const p of parts) {
						if (p !== montree) decorations.push(Decoration.node(p.pos, p.pos + p.size, { class: 'tts-lang--autre' }));
					}
					return false;
				}
			});
			return DecorationSet.create(doc, decorations);
		};
		return [new Plugin({
			key: clefLangues,
			state: {
				init: (_, { doc }) => {
					const langue = langueInitiale();
					return { langue, decorations: decorer(doc, langue) };
				},
				apply: (tr, valeur) => {
					const langue = tr.getMeta(clefLangues) ?? valeur.langue;
					if (!tr.docChanged && langue === valeur.langue) return valeur;
					return { langue, decorations: decorer(tr.doc, langue) };
				},
			},
			props: { decorations: (state) => clefLangues.getState(state).decorations },
		})];
	},
});

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
	addOptions: () => ({ ui: null }),
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
	addCommands() {
		return {
			/** Note au curseur ; sans contenu, ouvre le popover de note (spec 05 §1). */
			insertSpipNote: ({ name = null, content = null } = {}) => ({ commands }) => {
				if (content?.length) return commands.insertContent({ type: this.name, attrs: { name, content } });
				// sans popover (pas d'interface, ou note non modifiable) : rien n'est fait
				return Boolean(this.options.ui?.editNote?.(null));
			},
			/** Nom et contenu de la note sélectionnée ; ses blancs d'origine (spipLead, spipTrail) restent. */
			updateSpipNote: ({ name = null, content }) => ({ state, tr, dispatch }) => {
				const note = noteSelectionnee(state);
				if (!note) return false;
				if (dispatch) tr.setNodeMarkup(note.from, undefined, { ...note.node.attrs, name, content });
				return true;
			},
			removeSpipNote: () => ({ state, tr, dispatch }) => {
				const note = noteSelectionnee(state);
				if (!note) return false;
				if (dispatch) tr.delete(note.from, note.to);
				return true;
			},
		};
	},
});

/**
 * Notes du document dans l'ordre, numérotées comme SPIP : seules les notes automatiques sont
 * comptées, une note nommée porte son nom, une note sans appel n'a pas de libellé. Un multi ne rend
 * qu'une langue : seules comptent les notes de sa partie affichée (en ligne : dans ses attributs,
 * pos est alors celle du multi).
 *
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {string} langue  langue affichée (langueAffichee)
 * @returns {{ pos: number, attrs: { name: ?string, content: object[] }, multi: boolean, label: string, aria: string }[]}
 */
export function notesDuDocument(doc, langue) {
	const notes = [];
	let n = 0;
	const noter = (pos, attrs, multi) => {
		const { name } = attrs;
		const label = name == null ? String(++n) : name;
		const aria = `${name === '' ? libelle('note_aria_sans_appel') : `${libelle('note')} ${label}`} : ${apercu(attrs.content)}`;
		notes.push({ pos, attrs, multi, label, aria });
	};
	doc.descendants((node, pos) => {
		const type = node.type.name;
		if (type === 'spipNote') noter(pos, node.attrs, false);
		else if (type === 'spipMultiInline') {
			const partie = partieAffichee(node.attrs.parts ?? [], langue);
			(partie?.content ?? []).filter((c) => c.type === 'spipNote').forEach((c) => noter(pos, c.attrs ?? {}, true));
		} else if (type === 'spipMultiBlock') {
			const parts = [];
			node.forEach((part, offset) => parts.push({ lang: part.attrs.lang, part, pos: pos + 1 + offset }));
			const montree = partieAffichee(parts, langue);
			montree?.part.descendants((d, p) => {
				if (d.type.name === 'spipNote') noter(montree.pos + 1 + p, d.attrs, false);
			});
			return false;
		}
	});
	return notes;
}

/**
 * Numéros des appels de note, recalculés quand le document ou la langue affichée change
 * (décorations). Un multi en ligne reçoit les libellés des notes de sa partie affichée (spec.notes).
 */
const SpipNoteNumbers = Extension.create({
	name: 'spipNoteNumbers',
	addProseMirrorPlugins() {
		const key = new PluginKey('spipNoteNumbers');
		const numeroter = (doc, langue) => {
			const notes = notesDuDocument(doc, langue);
			const decorations = notes.filter((note) => !note.multi).map(({ pos, label, aria }) =>
				Decoration.node(pos, pos + doc.nodeAt(pos).nodeSize, { 'data-tts-label': label, 'aria-label': aria }));
			const multis = new Map();
			for (const note of notes.filter((nt) => nt.multi)) multis.set(note.pos, [...(multis.get(note.pos) ?? []), note.label]);
			for (const [pos, labels] of multis) decorations.push(Decoration.node(pos, pos + doc.nodeAt(pos).nodeSize, {}, { notes: labels }));
			return { langue, set: DecorationSet.create(doc, decorations) };
		};
		return [new Plugin({
			key,
			state: {
				init: (_, { doc }) => numeroter(doc, langueInitiale()),
				// même langue que SpipLangues (l'ordre des états des plugins n'est pas garanti)
				apply: (tr, valeur) => {
					const langue = tr.getMeta(clefLangues) ?? valeur.langue;
					return tr.docChanged || langue !== valeur.langue ? numeroter(tr.doc, langue) : valeur;
				},
			},
			props: { decorations: (state) => key.getState(state).set },
		})];
	},
});

/** Atomes dont un clic ou Entrée ouvre le popover : action de l'interface. */
const POPOVERS = { spipNote: 'editNote', spipMultiInline: 'editMulti', spipIdiome: 'editIdiome' };

/** Raccourcis clavier de l'interface (spec 06 §6). */
const SpipUi = Extension.create({
	name: 'spipUi',
	addOptions: () => ({ ui: null }),
	addKeyboardShortcuts() {
		// une touche n'est consommée que si le popover s'ouvre
		const ouvrir = (action) => () => Boolean(this.options.ui?.[action]?.(null));
		return {
			'Mod-k': ouvrir('openLink'),
			'Mod-Alt-n': ouvrir('editNote'),
			'Mod-Alt-g': ouvrir('openGlossary'),
			// Entrée sur un atome sélectionné (note, multi, idiome) : son popover (spec 05 §1, §5)
			Enter: ({ editor }) => {
				const { selection } = editor.state;
				const action = selection instanceof NodeSelection && POPOVERS[selection.node.type.name];
				return Boolean(action && this.options.ui?.[action]?.(selection.from));
			},
		};
	},
	// clic sur un atome (note, multi, idiome) : son popover
	addProseMirrorPlugins() {
		const ui = () => this.options.ui;
		return [new Plugin({
			key: new PluginKey('spipUiClic'),
			props: {
				handleClickOn: (view, pos, node, nodePos, event, direct) => {
					const action = direct && POPOVERS[node.type.name];
					return Boolean(action && ui()?.[action]?.(nodePos));
				},
			},
		})];
	},
	// [[ tapé : ouvre une note vide (spec 05 §1), sans laisser les crochets
	addInputRules() {
		return [new InputRule({
			find: /\[\[$/,
			handler: ({ state, range }) => {
				if (!this.options.ui?.editNote) return null;
				state.tr.delete(range.from, range.to);
				// le popover s'ouvre une fois la transaction appliquée
				queueMicrotask(() => this.options.ui.editNote(null));
			},
		})];
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
		SpipNote.configure({ ui }),
		SpipNoteNumbers,
		SpipMultiInline,
		SpipMultiBlock,
		SpipLangBlock,
		withView(SpipIdiome, idiomeView, Boolean(ui?.idiomes)),
		SpipLangues,
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

/** Blocs qu'une note peut contenir (spec 03 §5, src/spip/notes.js). */
const NoteDocument = SpipDocument.extend({ content: '(paragraph | bulletList | orderedList | spipModelBlock)+' });

/**
 * Schéma du sous-éditeur d'une note (spec 05 §1) : celui de l'éditeur, sans notes, avec seulement
 * les blocs permis dans une note.
 *
 * @param {{ ui?: object | null }} options  ui : interface du sous-éditeur (lien, glossaire…)
 */
export function noteExtensions({ ui = null } = {}) {
	return coreExtensions({ ui })
		.filter((e) => !['spipNote', 'spipNoteNumbers'].includes(e.name))
		.map((e) => (e.name === 'doc' ? NoteDocument : e));
}

/** Une partie de multi en ligne : un seul paragraphe. */
const PartieDocument = SpipDocument.extend({ content: 'paragraph' });

/**
 * Schéma du sous-éditeur d'une partie de multi en ligne (spec 05 §5) : celui de l'éditeur, sans
 * multi en ligne (pas de multi dans un multi), avec un seul paragraphe (les blocs, multi bloc
 * compris, restent déclarés mais inaccessibles).
 *
 * @param {{ ui?: object | null }} options  ui : interface du sous-éditeur (lien, glossaire…)
 */
export function partieExtensions({ ui = null } = {}) {
	return coreExtensions({ ui })
		.filter((e) => e.name !== 'spipMultiInline')
		.map((e) => (e.name === 'doc' ? PartieDocument : e));
}
