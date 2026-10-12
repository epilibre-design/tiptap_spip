import { describe, expect, it } from 'vitest';
import { anomalie } from '../../src/spip/anomalies.js';
import { parse } from '../../src/spip/index.js';

/** Sources des nœuds bruts en ligne d'un texte. */
const bruts = (source) => {
	const out = [];
	const parcourir = (n) => {
		if (n.type === 'spipRawInline') out.push(n.attrs.source);
		n.content?.forEach(parcourir);
	};
	parcourir(parse(source));
	return out;
};

describe('anomalie', () => {
	it('ouverture sans fermeture : accolades, balises de mise en forme, <code>', () => {
		for (const s of ['{', '{{', '<i>', '<strong>', '<del>', '<sup>', '<sub>', '<code>', '<I>']) expect(anomalie(s)).toBe('ouverture');
	});

	it('fermeture sans ouverture', () => {
		for (const s of ['}', '}}', '}}}', '</i>', '</strong>', '</quote>', '</multi>', '</code>']) expect(anomalie(s)).toBe('fermeture');
	});

	it('intertitre incomplet, citation et balises de bloc non fermées', () => {
		expect(anomalie('{{{')).toBe('intertitre');
		expect(anomalie('{{{{')).toBe('intertitre');
		expect(anomalie('<quote>')).toBe('citation');
		for (const s of ['<multi>', '<cadre>', '<frame>', '<poesie>', '<poetry>', '<html>', '<math>']) expect(anomalie(s)).toBe('balise');
	});

	it('bruts légitimes : HTML inconnu, entités, {}, commentaires', () => {
		for (const s of ['<span>', '</span>', '<span class="x">', '&nbsp;', '{}', '{{}}', '<!-- x -->', '<html>x</html>', '<div class="x">']) expect(anomalie(s)).toBe(null);
	});

	it('sur les bruts produits par le parseur', () => {
		expect(bruts('a {b').map(anomalie)).toEqual(['ouverture']);
		expect(bruts('{{a} b}').map(anomalie)).toEqual(['ouverture', 'fermeture', 'fermeture']);
		expect(bruts('<quote>a').map(anomalie)).toEqual(['citation']);
		expect(bruts('x <span>y</span> &nbsp;').map(anomalie)).toEqual([null, null, null]);
	});
});
