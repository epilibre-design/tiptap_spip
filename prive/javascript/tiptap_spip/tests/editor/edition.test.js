// @vitest-environment jsdom
import { CellSelection } from '@tiptap/pm/tables';
import { afterEach, describe, expect, it } from 'vitest';
import { schemaJSON } from '../../src/editor/content.js';
import { createEditor } from '../../src/editor/createEditor.js';
import { alignementActif } from '../../src/editor/edition.js';
import { canon, serialize } from '../../src/spip/index.js';
import { parse } from '../../src/spip/parse.js';

let editor;
afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
});

const monter = (source, ui = {}) => {
	editor?.destroy();
	document.body.innerHTML = '<div></div>';
	editor = createEditor({ element: document.body.firstChild, source, ui });
	return editor;
};
const source = () => serialize(editor.getJSON());
/** Position juste après la première occurrence de `texte`. */
const apres = (texte) => {
	let pos = null;
	editor.state.doc.descendants((n, p) => {
		if (pos === null && n.isText && n.text.includes(texte)) pos = p + n.text.indexOf(texte) + texte.length;
	});
	return pos;
};
const avant = (texte) => apres(texte) - texte.length;
const selectionner = (de, a) => editor.commands.setTextSelection({ from: avant(de), to: apres(a) });
/** Invariant : la source canonique relue redonne le même document. */
const stable = () => {
	const json = editor.getJSON();
	const relu = schemaJSON(parse(serialize(json, { conservative: false })), editor.schema);
	expect(canon(relu.content)).toBe(canon(schemaJSON(json, editor.schema).content));
};

describe('alignement', () => {
	it('appliqué à deux paragraphes, modifié, retiré', () => {
		monter('A\n\nB\n\nC');
		selectionner('A', 'B');
		expect(editor.commands.setAlignement('center')).toBe(true);
		expect(source()).toBe('<div class="text-center">\n\nA\n\nB\n\n</div>\n\nC');
		expect(alignementActif(editor.state)).toBe('center');
		editor.commands.setTextSelection(apres('B'));
		editor.commands.setAlignement('right');
		expect(source()).toBe('<div class="text-right">\n\nA\n\nB\n\n</div>\n\nC');
		editor.commands.setAlignement(null);
		expect(source()).toBe('A\n\nB\n\nC');
		expect(alignementActif(editor.state)).toBe(null);
	});

	it('sélection à cheval sur un bloc aligné et un paragraphe voisin : tous les blocs touchés', () => {
		monter('<div class="text-center">\n\nA\n\n</div>\n\nB\n\nC');
		selectionner('A', 'B');
		editor.commands.setAlignement('right');
		expect(source()).toBe('<div class="text-right">\n\nA\n\nB\n\n</div>\n\nC');
		monter('A\n\n<div class="text-center">\n\nB\n\n</div>\n\nC');
		selectionner('A', 'B');
		// sélection mixte : pas d'alignement commun
		expect(alignementActif(editor.state)).toBe(undefined);
		expect(editor.commands.setAlignement('right')).toBe(true);
		expect(alignementActif(editor.state)).toBe('right');
		expect(source()).toBe('<div class="text-right">\n\nA\n\nB\n\n</div>\n\nC');
		monter('<div class="text-center">\n\nA\n\n</div>\n\nB\n\n<div class="text-left">\n\nC\n\n</div>');
		selectionner('A', 'C');
		editor.commands.setAlignement(null);
		expect(source()).toBe('A\n\nB\n\nC');
	});

	it('sans alignement à retirer : rien', () => {
		monter('A');
		expect(editor.commands.setAlignement(null)).toBe(false);
	});
});

describe('poésie', () => {
	it('appliquée puis retirée', () => {
		monter('A\n\nB');
		selectionner('A', 'B');
		expect(editor.commands.togglePoesie()).toBe(true);
		expect(source()).toBe('<poesie>\nA\n\nB\n</poesie>');
		stable();
		editor.commands.togglePoesie();
		expect(source()).toBe('A\n\nB');
	});

	it('pas dans une liste', () => {
		monter('-* un');
		editor.commands.setTextSelection(apres('un'));
		expect(editor.can().togglePoesie()).toBe(false);
	});
});

describe('guillemets et casse', () => {
	it('guillemets autour d\'une sélection en gras', () => {
		monter('x {{a b}} y');
		selectionner('a', 'b');
		editor.commands.entourer('«', '»');
		expect(source()).toBe('x {{«a b»}} y');
		expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe('a b');
	});

	it('casse changée, marks gardées', () => {
		monter('{{ab}}cd');
		selectionner('b', 'c');
		editor.commands.changerCasse('majuscules');
		expect(source()).toBe('{{aB}}Cd');
		editor.commands.selectAll();
		editor.commands.changerCasse('minuscules');
		expect(source()).toBe('{{ab}}cd');
	});
});

describe('tableaux', () => {
	/** Sélection de cellules de (ligne, colonne) à (ligne, colonne). */
	const cellules = (l1, c1, l2, c2) => {
		const positions = [];
		editor.state.doc.descendants((n, p) => {
			if (n.type.name === 'tableRow') positions.push([]);
			if (['tableCell', 'tableHeader'].includes(n.type.name)) positions.at(-1).push(p);
		});
		const { doc, tr } = editor.state;
		editor.view.dispatch(tr.setSelection(CellSelection.create(doc, positions[l1][c1], positions[l2][c2])));
	};

	it('inséré : trois lignes de trois cellules, sans en-tête ; relu, une première ligne restée vide est un en-tête', () => {
		monter('Avant');
		editor.commands.setTextSelection(apres('Avant'));
		editor.commands.insererTableau();
		expect(source()).toBe('Avant\n\n||||\n||||\n||||');
		// SPIP lit une première ligne de cellules vides comme des en-têtes (<thead>, vérifié avec l'oracle)
		const relu = parse(serialize(editor.getJSON(), { conservative: false }));
		expect(relu.content[1].content[0].content.map((c) => c.type)).toEqual(['tableHeader', 'tableHeader', 'tableHeader']);
		// du texte dans la première ligne : ce n'est plus un en-tête, le tableau est stable
		let cellule = null;
		editor.state.doc.descendants((n, pos) => {
			if (cellule === null && n.type.name === 'tableCell') cellule = pos + 2;
		});
		editor.commands.setTextSelection(cellule);
		editor.commands.insertContent('x');
		expect(source()).toBe('Avant\n\n|x|||\n||||\n||||');
		stable();
	});

	it('lignes et colonnes ajoutées, supprimées : en-têtes seulement en première ligne', () => {
		monter('|{{a}}|{{b}}|\n|c|d|');
		editor.commands.setTextSelection(apres('a'));
		editor.commands.addRowAfter();
		editor.commands.addColumnAfter();
		expect(source()).toBe('|{{a}}||{{b}}|\n||||\n|c||d|');
		stable();
		editor.commands.setTextSelection(apres('c'));
		editor.commands.deleteRow();
		editor.commands.setTextSelection(apres('b'));
		editor.commands.deleteColumn();
		expect(source()).toBe('|{{a}}||\n|||');
		stable();
	});

	it('ligne d\'en-tête ajoutée puis retirée ; colonne d\'en-têtes : seule sa cellule de première ligne compte, la ligne entière devient d\'en-têtes', () => {
		monter('|a|b|\n|c|d|');
		editor.commands.setTextSelection(apres('c'));
		editor.commands.toggleHeaderRow();
		expect(source()).toBe('|{{a}}|{{b}}|\n|c|d|');
		stable();
		editor.commands.toggleHeaderRow();
		expect(source()).toBe('|a|b|\n|c|d|');
		editor.commands.toggleHeaderColumn();
		expect(source()).toBe('|{{a}}|{{b}}|\n|c|d|');
	});

	it('cellules fusionnées puis scindées', () => {
		monter('|a|b|\n|c|d|');
		cellules(0, 0, 0, 1);
		expect(editor.commands.fusionnerCellules()).toBe(true);
		expect(source()).toBe('|a b|<|\n|c|d|');
		stable();
		editor.commands.setTextSelection(apres('a b'));
		editor.commands.splitCell();
		expect(source()).toBe('|a b||\n|c|d|');
		stable();
	});

	it('fusion verticale', () => {
		monter('|a|b|\n|c|d|');
		cellules(0, 0, 1, 0);
		editor.commands.fusionnerCellules();
		expect(source()).toBe('|a c|b|\n|^|d|');
		stable();
	});
});

describe('raccourcis', () => {
	it('Mod-Alt-m ouvre le popover de modèle', () => {
		const appels = [];
		monter('x', { editModel: (pos) => appels.push(pos) });
		editor.commands.keyboardShortcut('Mod-Alt-m');
		expect(appels).toEqual([null]);
	});
});
