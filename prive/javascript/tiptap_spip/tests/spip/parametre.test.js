import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../../src/spip/index.js';
import { RE_MODELE } from '../../src/spip/regex.js';
import { parseModel } from '../../src/spip/models.js';
import { echapperParametre, lireParametre } from '../../src/spip/parametre.js';

describe('paramètre de modèle', () => {
	it('écrit |, < et > hors des balises en entités, garde les balises', () => {
		expect(echapperParametre('a | b > c < d')).toBe('a &#124; b &gt; c &lt; d');
		expect(echapperParametre('[ici->https://spip.net]')).toBe('[ici-&gt;https://spip.net]');
		expect(echapperParametre('<quote>cit</quote> x<sup>2</sup>')).toBe('<quote>cit</quote> x<sup>2</sup>');
		expect(echapperParametre('&lt;b> et a < b > c')).toBe('&lt;b&gt; et a &lt; b &gt; c');
		expect(echapperParametre('<span title="a|b">x</span>')).toBe('<span title="a&#124;b">x</span>');
	});

	it('est idempotent', () => {
		const une = echapperParametre('a | b -> c <quote>x</quote>');
		expect(echapperParametre(une)).toBe(une);
	});

	it('la valeur échappée reste un seul paramètre du raccourci, sur plusieurs paragraphes', () => {
		const valeur = echapperParametre('{{Un}} | deux -> trois\n\n<quote>quatre</quote>');
		const raccourci = `<encadre|texte=${valeur}>`;
		expect(raccourci.match(RE_MODELE)?.[0]).toBe(raccourci);
		expect(parseModel(raccourci).params).toEqual([{ key: 'texte', value: valeur }]);
	});

	it('à la lecture, &#124; redevient | ; aller-retour par le parseur', () => {
		expect(lireParametre('a &#124; b &#x7C; c')).toBe('a | b | c');
		const valeur = 'a &#124; b &gt; c';
		expect(echapperParametre(serialize(parse(lireParametre(valeur))))).toBe(valeur);
	});
});
