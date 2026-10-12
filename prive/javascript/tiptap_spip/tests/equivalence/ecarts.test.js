import { describe, expect, it } from 'vitest';
import { diffFige, diffHtml, hunks, judge, loadEcarts, normalize, plafond } from '../../scripts/ecarts.mjs';

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

	const branche = (contenu) => `- ${ok.replace(/\n/g, '\n  ')}\n  branches:\n    "5":\n${contenu}`;

	it('lit le diff figé et la justification propres à une branche de SPIP', () => {
		const [e] = loadEcarts(branche('      diff: ecarts/a.spip5.diff\n      justification: "rendu de SPIP 5"\n'));
		expect(e.branches).toEqual({ 5: { diff: 'ecarts/a.spip5.diff', justification: 'rendu de SPIP 5' } });
	});

	it('refuse une branche sans diff ou sans justification, ou dont le nom n\'est pas un numéro', () => {
		expect(() => loadEcarts(branche('      diff: ecarts/a.spip5.diff\n'))).toThrow(/justification.*branche 5/);
		expect(() => loadEcarts(branche('      justification: "x"\n'))).toThrow(/diff.*branche 5/);
		expect(() => loadEcarts(branche('      diff: d\n      justification: "x"\n').replace('"5"', 'cinq'))).toThrow(/branche « cinq »/);
	});
});

describe('diffFige', () => {
	const entree = { fichier: 'a.spip', diff: 'ecarts/a.diff', branches: { 5: { diff: 'ecarts/a.spip5.diff', justification: 'x' } } };

	it('donne le diff figé de la branche de l\'oracle, sinon le diff commun', () => {
		expect(diffFige(entree, '5')).toBe('ecarts/a.spip5.diff');
		expect(diffFige(entree, '4')).toBe('ecarts/a.diff');
		expect(diffFige({ fichier: 'a.spip', diff: 'ecarts/a.diff' }, '5')).toBe('ecarts/a.diff');
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

	it('couvre un hunk figé répété : chaque occurrence reproduit le même écart connu', () => {
		expect(judge({ fichier: null, diff: '- x\n+ y\n@@\n- x\n+ y\n', entries: [entry], frozen })).toEqual({ statut: 'couvert', entree: entry });
	});

	it('produit deux hunks identiques pour deux occurrences du même écart dans un fichier', () => {
		const a = `<p>${CODE}&lt;/code</code>${CODE}&gt;</code>, puis ${CODE}&lt;/code</code>${CODE}&gt;</code></p>`;
		const b = `<p>${CODE}&lt;/code&gt;</code>, puis ${CODE}&lt;/code&gt;</code></p>`;
		const [h1, h2, ...reste] = hunks(diffHtml(a, b));
		expect(reste).toEqual([]);
		expect(h1).toBe(h2);
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

describe('normalize', () => {
	const appel = (title) => `<span class="spip_note_ref">&nbsp;[<a href="#nb1" class="spip_note" rel="appendix" title="${title}" id="nh1">1</a>]</span>`;

	it('bulle d\'un appel de note : seul son title est ignoré', () => {
		expect(normalize(appel('a\\]b'))).toBe(normalize(appel('a]b')));
		expect(normalize(appel('x'))).toContain('id="nh1"');
	});

	it('les autres title et le texte des notes restent comparés', () => {
		expect(normalize('<a href="#nh1" class="spip_note" title="Notes 1" rev="appendix">1</a>'))
			.not.toBe(normalize('<a href="#nh1" class="spip_note" title="Notes 2" rev="appendix">1</a>'));
		expect(normalize('<abbr title="a">A</abbr>')).not.toBe(normalize('<abbr title="b">A</abbr>'));
		expect(normalize('<div id="nb1"><p>a]b</p></div>')).not.toBe(normalize('<div id="nb1"><p>a\\]b</p></div>'));
	});

	it('une entité vaut le caractère qu\'elle code (même texte dans le DOM)', () => {
		expect(normalize('<p>&lt;code&gt; in</p>')).toBe(normalize('<p>&lt;code> in</p>'));
		expect(normalize('<a href="x">link|title</a>')).toBe(normalize('<a href="x">link&#124;title</a>'));
		expect(normalize('<p>a&#x5B;b</p>')).toBe(normalize('<p>a[b</p>'));
	});

	it('sauf <, &, les guillemets et les blancs, qui changent l\'analyse du HTML ou ses espaces', () => {
		expect(normalize('<p>&#60;b></p>')).not.toBe(normalize('<p><b></p>'));
		expect(normalize('<p>&#38;lt;</p>')).not.toBe(normalize('<p>&lt;</p>'));
		expect(normalize('<a title="&#34;">x</a>')).not.toBe(normalize('<a title=""">x</a>'));
		expect(normalize('<p>a&#160;b</p>')).not.toBe(normalize('<p>a b</p>'));
		expect(normalize('<p>&#99999999;</p>')).toBe('<p>&#99999999;</p>');
	});
});
