import { Extension } from '@tiptap/core';
import { Fragment, NodeRange } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, mergeCells } from '@tiptap/pm/tables';

/** Alignements d'un bloc spipAlign (spec 05 §8), dans l'ordre du menu. */
export const ALIGNEMENTS = ['left', 'center', 'right', 'justify'];

/** Blocs de premier niveau touchés par la sélection : [{ node, pos }]. */
function blocsSelectionnes(state) {
	const { doc, selection } = state;
	const premier = doc.resolve(selection.from).index(0);
	// fin de sélection juste après un bloc (sélection de nœud) : ce bloc est le dernier
	const dernier = selection.to > selection.from ? doc.resolve(selection.to - 1).index(0) : premier;
	const blocs = [];
	doc.forEach((node, pos, i) => {
		if (i >= premier && i <= dernier) blocs.push({ node, pos });
	});
	return blocs;
}

/**
 * Alignement commun des blocs de premier niveau touchés par la sélection : left, center, right, justify ;
 * null si aucun n'est aligné ; undefined si la sélection est mixte (alignements différents, ou blocs
 * alignés et non alignés).
 */
export function alignementActif(state) {
	const valeurs = new Set(blocsSelectionnes(state).map(({ node }) => (node.type.name === 'spipAlign' ? node.attrs.align : null)));
	return valeurs.size === 1 ? [...valeurs][0] : undefined;
}

/** Vrai si un bloc touché par la sélection est aligné. */
export const selectionAlignee = (state) => blocsSelectionnes(state).some(({ node }) => node.type.name === 'spipAlign');

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
		/**
		 * Aligne les blocs de premier niveau touchés par la sélection, alignés ou non : les alignements
		 * existants sont dépliés, puis l'ensemble est entouré d'un seul alignement (refusé si un bloc ne
		 * peut pas être aligné) ; null les déplie.
		 */
		setAlignement: (align) => ({ state, tr, dispatch }) => {
			const blocs = blocsSelectionnes(state);
			if (!blocs.length) return false;
			const type = state.schema.nodes.spipAlign;
			const alignes = blocs.filter((b) => b.node.type === type);
			if (!align && !alignes.length) return false;
			const contenu = Fragment.fromArray(blocs.flatMap((b) => (b.node.type === type ? b.node.content.content : [b.node])));
			if (align && !type.validContent(contenu)) return false;
			if (!dispatch) return true;
			// un seul bloc aligné : son alignement change, ses attributs (carte de segments) restent
			if (align && blocs.length === 1 && alignes.length === 1) {
				tr.setNodeMarkup(blocs[0].pos, null, { ...blocs[0].node.attrs, align });
				return true;
			}
			// étapes structurelles (lift, wrap) : la sélection suit les blocs déplacés
			const debut = blocs[0].pos;
			const fin = blocs.at(-1).pos + blocs.at(-1).node.nodeSize;
			for (const { node, pos } of [...alignes].reverse()) {
				tr.lift(tr.doc.resolve(pos + 1).blockRange(tr.doc.resolve(pos + node.nodeSize - 1)), 0);
			}
			if (align) {
				const range = new NodeRange(tr.doc.resolve(tr.mapping.map(debut)), tr.doc.resolve(tr.mapping.map(fin)), 0);
				tr.wrap(range, [{ type, attrs: { align } }]);
			}
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
