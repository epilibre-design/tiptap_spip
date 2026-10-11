import { describe, expect, it } from 'vitest';
import { diffHtml, hunks, judge, loadEcarts, plafond } from '../../scripts/ecarts.mjs';

const CODE = "<code class='spip_code'>";

describe('diffHtml', () => {
	it('ne garde que les lignes modifiées, une ligne par balise, un bloc par hunk', () => {
		const a = `<p>x${CODE}&lt;/code</code>${CODE}&gt;</code>y</p><p>z</p><p>u</p>`;
		const b = `<p>x${CODE}&lt;/code&gt;</code>y</p><p>z</p><p>v</p>`;
		expect(diffHtml(a, b)).toBe([
			`- ${CODE}&lt;/code`,
			`- </code>`,
			`- ${CODE}&gt;`,
			`+ ${CODE}&lt;/code&gt;`,
			'@@',
			'- <p>u',
			'+ <p>v',
			'',
		].join('\n'));
	});

	it('renvoie une chaîne vide pour deux rendus identiques', () => {
		expect(diffHtml('<p>a</p>', '<p>a</p>')).toBe('');
	});
});

describe('hunks', () => {
	it('découpe un diff en hunks', () => {
		expect(hunks('- a\n+ b\n@@\n- c\n')).toEqual(['- a\n+ b', '- c']);
		expect(hunks('')).toEqual([]);
	});
});

describe('loadEcarts', () => {
	const ok = 'fichier: a.spip\ntype: espacement\ndiff: ecarts/a.diff\njustification: "x"\naccepte_par: "m"';

	it('lit une liste d\'entrées valides', () => {
		expect(loadEcarts(`- ${ok.replace(/\n/g, '\n  ')}`)).toEqual([
			{ fichier: 'a.spip', type: 'espacement', diff: 'ecarts/a.diff', justification: 'x', accepte_par: 'm' },
		]);
		expect(loadEcarts('')).toEqual([]);
	});

	it('refuse un type hors de la liste fermée ou un champ manquant', () => {
		expect(() => loadEcarts(`- ${ok.replace('espacement', 'texte-perdu').replace(/\n/g, '\n  ')}`)).toThrow(/type/);
		expect(() => loadEcarts('- fichier: a.spip\n  type: espacement')).toThrow(/diff/);
	});

	it('refuse deux entrées pour le même fichier', () => {
		const e = `- ${ok.replace(/\n/g, '\n  ')}\n`;
		expect(() => loadEcarts(e + e)).toThrow(/a\.spip/);
	});
});

describe('judge', () => {
	const entry = { fichier: 'a.spip', diff: 'ecarts/a.diff' };
	const frozen = new Map([['a.spip', '- x\n+ y\n']]);

	it('accepte un écart enregistré dont le diff est le diff figé', () => {
		expect(judge({ fichier: 'a.spip', diff: '- x\n+ y\n', entries: [entry], frozen })).toEqual({ statut: 'accepte', entree: entry });
	});

	it('refuse un écart enregistré dont le diff a changé', () => {
		expect(judge({ fichier: 'a.spip', diff: '- x\n+ z\n', entries: [entry], frozen }).statut).toBe('diff-change');
	});

	it('signale un écart enregistré qui a disparu', () => {
		expect(judge({ fichier: 'a.spip', diff: '', entries: [entry], frozen }).statut).toBe('disparu');
	});

	it('couvre, hors corpus versionné, un écart fait uniquement de hunks figés', () => {
		expect(judge({ fichier: null, diff: '- x\n+ y\n', entries: [entry], frozen })).toEqual({ statut: 'couvert', entree: entry });
		expect(judge({ fichier: null, diff: '- x\n+ y\n@@\n- w\n', entries: [entry], frozen }).statut).toBe('ecart');
	});

	it('ne couvre jamais un fichier du corpus versionné sans entrée', () => {
		expect(judge({ fichier: 'b.spip', diff: '- x\n+ y\n', entries: [entry], frozen }).statut).toBe('ecart');
		expect(judge({ fichier: 'b.spip', diff: '', entries: [entry], frozen }).statut).toBe('equivalent');
	});
});

describe('plafond', () => {
	it('vaut 1 % des fichiers, arrondi à l\'entier supérieur', () => {
		expect(plafond(20)).toBe(1);
		expect(plafond(100)).toBe(1);
		expect(plafond(101)).toBe(2);
		expect(plafond(0)).toBe(0);
	});
});
