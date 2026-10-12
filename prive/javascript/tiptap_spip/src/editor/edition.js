import { Extension } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, mergeCells } from '@tiptap/pm/tables';
import { findWrapping } from '@tiptap/pm/transform';

/** Alignements d'un bloc spipAlign (spec 05 §8), dans l'ordre du menu. */
export const ALIGNEMENTS = ['left', 'center', 'right', 'justify'];

/** Bloc spipAlign de premier niveau qui contient la sélection : { node, pos }, ou null. */
function alignementCourant(state) {
	const { selection } = state;
	if (selection.node?.type.name === 'spipAlign') return { node: selection.node, pos: selection.from };
	const { $from } = selection;
	if ($from.depth < 1) return null;
	const node = $from.node(1);
	return node.type.name === 'spipAlign' ? { node, pos: $from.before(1) } : null;
}

/** Alignement de la sélection (left, center, right, justify), null sans alignement. */
export const alignementActif = (state) => alignementCourant(state)?.node.attrs.align ?? null;

/** Blocs où une poésie peut se poser : ceux que le sérialiseur écrit (spec 04). */
const PARENTS_POESIE = ['doc', 'spipAlign'];

/** Remplace le nœud en `pos` par son contenu. */
const deballer = (tr, pos, node) => tr.replaceWith(pos, pos + node.nodeSize, node.content);

/** Un paragraphe avec le contenu inline des paragraphes de `cellules`, séparés par une espace. */
function paragrapheUnique(cellules, schema) {
	const morceaux = [];
	cellules.flatMap((c) => c.content.content).forEach((bloc) => {
		if (bloc.content.size === 0) return;
		if (morceaux.length) morceaux.push(schema.text(' '));
		bloc.content.forEach((n) => morceaux.push(n));
	});
	return schema.nodes.paragraph.create(null, Fragment.from(morceaux));
}

/**
 * Commandes de la barre d'outils (spec 06 §2) qui n'existent pas dans Tiptap : alignement, poésie,
 * guillemets, casse, insertion d'un tableau. Les en-têtes de tableau sont ramenés à ce que SPIP sait
 * écrire : seulement la première ligne, entière.
 */
export const SpipEdition = Extension.create({
	name: 'spipEdition',

	addCommands: () => ({
		/** Aligne les blocs de premier niveau de la sélection ; null retire l'alignement. */
		setAlignement: (align) => ({ state, tr, dispatch }) => {
			const courant = alignementCourant(state);
			if (courant) {
				if (dispatch) {
					if (align) tr.setNodeMarkup(courant.pos, null, { ...courant.node.attrs, align });
					else deballer(tr, courant.pos, courant.node);
				}
				return true;
			}
			if (!align) return false;
			const { $from, $to } = state.selection;
			const range = $from.blockRange($to, (n) => n.type.name === 'doc');
			const wrapping = range && findWrapping(range, state.schema.nodes.spipAlign, { align });
			if (!wrapping) return false;
			if (dispatch) tr.wrap(range, wrapping);
			return true;
		},

		/** Met les paragraphes de la sélection en poésie, ou retire la poésie qui la contient. */
		togglePoesie: () => ({ state, tr, dispatch }) => {
			const { $from, $to } = state.selection;
			for (let d = $from.depth; d > 0; d--) {
				if ($from.node(d).type.name === 'spipPoesie') {
					if (dispatch) deballer(tr, $from.before(d), $from.node(d));
					return true;
				}
			}
			const range = $from.blockRange($to, (n) => PARENTS_POESIE.includes(n.type.name));
			if (!range) return false;
			for (let i = range.startIndex; i < range.endIndex; i++) {
				if (range.parent.child(i).type.name !== 'paragraph') return false;
			}
			if (dispatch) tr.wrap(range, [{ type: state.schema.nodes.spipPoesie }]);
			return true;
		},

		/** Entoure la sélection (d'un même bloc) de `ouvrant` et `fermant`, avec les marks de ses bords. */
		entourer: (ouvrant, fermant) => ({ state, tr, dispatch }) => {
			const { $from, $to, from, to } = state.selection;
			if (!$from.sameParent($to) || !$from.parent.isTextblock) return false;
			if (dispatch) {
				const marques = (noeud) => noeud?.marks ?? $from.marks();
				tr.insert(to, state.schema.text(fermant, marques($to.nodeBefore)));
				tr.insert(from, state.schema.text(ouvrant, marques($from.nodeAfter)));
				tr.setSelection(TextSelection.create(tr.doc, from + ouvrant.length, to + ouvrant.length));
			}
			return true;
		},

		/** Passe le texte sélectionné en majuscules ou en minuscules, marks gardées. */
		changerCasse: (sens) => ({ state, tr, dispatch }) => {
			const { from, to, empty } = state.selection;
			if (empty) return false;
			if (dispatch) {
				state.doc.nodesBetween(from, to, (node, pos) => {
					if (!node.isText) return;
					const debut = Math.max(from, pos);
					const fin = Math.min(to, pos + node.nodeSize);
					const texte = node.text.slice(debut - pos, fin - pos);
					const nouveau = sens === 'majuscules' ? texte.toLocaleUpperCase() : texte.toLocaleLowerCase();
					if (nouveau !== texte) {
						tr.replaceWith(tr.mapping.map(debut), tr.mapping.map(fin), state.schema.text(nouveau, node.marks));
					}
				});
				tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from, -1), tr.mapping.map(to)));
			}
			return true;
		},

		/**
		 * Fusionne les cellules sélectionnées. mergeCells met bout à bout leurs paragraphes, qu'une cellule
		 * SPIP n'admet pas (un seul paragraphe) : leurs textes sont d'abord réunis dans la première.
		 */
		fusionnerCellules: () => ({ state, tr, dispatch }) => {
			const { selection } = state;
			if (!(selection instanceof CellSelection) || !mergeCells(state)) return false;
			if (!dispatch) return true;
			const cellules = [];
			selection.forEachCell((node, pos) => cellules.push({ node, pos }));
			const reunies = paragrapheUnique(cellules.map((c) => c.node), state.schema);
			cellules.forEach(({ node, pos }, i) => {
				const p = tr.mapping.map(pos);
				tr.replaceWith(p + 1, p + node.nodeSize - 1, i === 0 ? reunies : state.schema.nodes.paragraph.create());
			});
			// fusion calculée sur un état qui reprend la transaction (sans plugins), puis rejouée dedans
			let fusion = null;
			const cellulesPreparees = CellSelection.create(tr.doc, tr.mapping.map(selection.$anchorCell.pos), tr.mapping.map(selection.$headCell.pos));
			mergeCells(EditorState.create({ doc: tr.doc, selection: cellulesPreparees }), (t) => {
				fusion = t;
			});
			fusion.steps.forEach((step) => tr.step(step));
			tr.setSelection(Selection.fromJSON(tr.doc, fusion.selection.toJSON()));
			return true;
		},

		/** Tableau de trois lignes de trois cellules, sans en-tête (« Ligne d'en-tête » l'ajoute). */
		insererTableau: () => ({ commands }) => commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false }),
	}),

	addProseMirrorPlugins: () => [new Plugin({
		key: new PluginKey('spipTableaux'),
		// ce qu'un tableau SPIP sait écrire (src/spip/blocks.js) :
		// - des en-têtes seulement en première ligne, toute la ligne : une ligne ajoutée sous les
		//   en-têtes, une colonne ajoutée à côté prennent le bon type de cellule ;
		// - un seul paragraphe par cellule : les cellules fusionnées (mergeCells met bout à bout leurs
		//   paragraphes) ou un collage gardent leurs textes, séparés par une espace
		appendTransaction: (transactions, ancien, state) => {
			if (!transactions.some((t) => t.docChanged)) return null;
			const { tableCell, tableHeader } = state.schema.nodes;
			let tr = null;
			state.doc.descendants((node, pos) => {
				if (node.type.name !== 'table') return node.isBlock && !node.isTextblock;
				node.forEach((ligne, decalage, r) => {
					const enTete = r === 0 && ligne.content.content.some((c) => c.type === tableHeader);
					ligne.forEach((cellule, o) => {
						const type = enTete ? tableHeader : tableCell;
						const p = pos + 2 + decalage + o;
						if (cellule.type !== type) (tr ??= state.tr).setNodeMarkup(p, type, cellule.attrs);
						if (cellule.childCount > 1) {
							(tr ??= state.tr).replaceWith(p + 1, p + cellule.nodeSize - 1, paragrapheUnique([cellule], state.schema));
						}
					});
				});
				return false;
			});
			return tr;
		},
	})],
});
