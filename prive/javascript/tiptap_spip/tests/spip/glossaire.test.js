import { describe, expect, it } from 'vitest';
import { parseAbbr, serializeAbbr } from '../../src/spip/abbr.js';
import { parseGlossary, serializeGlossary } from '../../src/spip/glossary.js';
import { node, raw, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { serialize } from '../../src/spip/serialize.js';

const inline = (source) => parse(source).content[0].content;
const canonical = (source) => serialize(parse(source), { conservative: false });
const gloss = (extra = {}) => ({ type: 'spipGlossary', attrs: { glossaire: null, numero: null, bulle: null, hreflang: null, ...extra } });
const abbr = (title, lang = null) => ({ type: 'spipAbbr', attrs: { title, lang } });
const link = (href) => ({ type: 'spipLink', attrs: { href, bulle: null, hreflang: null, newWindow: false } });
const B = { type: 'bold' };
const I = { type: 'italic' };
/** Sérialise un paragraphe saisi dans l'éditeur. */
const ecrire = (content) => serialize(node('doc', null, [node('paragraph', null, content)]));

describe('parseGlossary (traiter_raccourci_glossaire du core)', () => {
	it('terme, glossaire nommé, numéro, bulle, langue', () => {
		expect(parseGlossary('[?SPIP]')).toEqual({ term: 'SPIP', attrs: gloss().attrs });
		expect(parseGlossary('[?SPIP#wikipedia]').attrs).toMatchObject({ glossaire: 'wikipedia', numero: null });
		expect(parseGlossary('[?SPIP#mots12]').attrs).toMatchObject({ glossaire: 'mots', numero: '12' });
		expect(parseGlossary('[?SPIP#12]').attrs).toMatchObject({ glossaire: null, numero: '12' });
		expect(parseGlossary('[?SPIP#mots12|bulle{en}]')).toEqual({ term: 'SPIP', attrs: { glossaire: 'mots', numero: '12', bulle: 'bulle', hreflang: 'en' } });
		expect(parseGlossary('[?SPIP|bulle#mots12]')).toEqual({ term: 'SPIP', attrs: { glossaire: 'mots', numero: '12', bulle: 'bulle', hreflang: null } });
	});

	it('pas de lettre ni de chiffre dans le terme, ou {} : pas un glossaire représentable', () => {
		expect(parseGlossary('[?!?]')).toBeNull();
		expect(parseGlossary('[?SPIP{}]')).toBeNull();
	});

	it('serializeGlossary', () => {
		expect(serializeGlossary('SPIP', gloss().attrs)).toBe('[?SPIP]');
		expect(serializeGlossary('SPIP', { glossaire: 'mots', numero: '12', bulle: 'b', hreflang: 'en' })).toBe('[?SPIP#mots12|b{en}]');
		expect(serializeGlossary('SPIP', { glossaire: null, numero: '3', bulle: null, hreflang: null })).toBe('[?SPIP#3]');
	});
});

describe('parseAbbr (règle abbr de la wheel)', () => {
	it('texte, explication, langue', () => {
		expect(parseAbbr('[ABBR|explication]')).toEqual({ text: 'ABBR', attrs: { title: 'explication', lang: null } });
		expect(parseAbbr('[ABBR|explication{fr}]')).toEqual({ text: 'ABBR', attrs: { title: 'explication', lang: 'fr' } });
		expect(serializeAbbr('ABBR', { title: 'x', lang: 'fr' })).toBe('[ABBR|x{fr}]');
	});
});

describe('glossaire', () => {
	it.each([
		['[?SPIP]', {}],
		['[?SPIP#wikipedia]', { glossaire: 'wikipedia' }],
		['[?SPIP#mots12]', { glossaire: 'mots', numero: '12' }],
		['[?SPIP#12]', { numero: '12' }],
		['[?SPIP|Système de publication]', { bulle: 'Système de publication' }],
		['[?SPIP{fr}]', { hreflang: 'fr' }],
		['[?SPIP#mots12|bulle{en}]', { glossaire: 'mots', numero: '12', bulle: 'bulle', hreflang: 'en' }],
	])('%s : mark sur le terme, forme canonique identique', (source, attrs) => {
		expect(inline(`Voir ${source}.`)).toEqual([text('Voir '), text('SPIP', [gloss(attrs)]), text('.')]);
		expect(canonical(`Voir ${source}.`)).toBe(`Voir ${source}.`);
	});

	it.each(['[? SPIP]', '[??SPIP]', '[?SPIP|b#mots]', '[?S{P}]', '[?a&amp;b]', '[?SPIP#]', '[?a\nb]'])(
		'%s : ne se relit pas à l\'identique ou ne s\'écrit pas tel quel, gardé brut',
		(source) => {
			expect(inline(`x ${source}`)).toEqual([text('x '), raw(source)]);
			expect(canonical(`x ${source}`)).toBe(`x ${source}`);
		},
	);

	it('dans le texte d\'un lien : brut (pas de lien dans un lien)', () => {
		expect(inline('[a [?x] b->art1]')).toEqual([text('a ', [link('art1')]), raw('[?x]', [link('art1')]), text(' b', [link('art1')])]);
	});

	it('dans du gras ou de l\'italique', () => {
		expect(inline('{{[?SPIP]}} {[?CMS]}')).toEqual([text('SPIP', [B, gloss()]), text(' '), text('CMS', [I, gloss()])]);
		expect(canonical('{{[?SPIP]}} {[?CMS]}')).toBe('{{[?SPIP]}} {[?CMS]}');
	});
});

describe('abréviations', () => {
	it.each([
		['[ABBR|explication]', abbr('explication')],
		['[ABBR|explication{fr}]', abbr('explication', 'fr')],
		['[W3C|World Wide Web Consortium]', abbr('World Wide Web Consortium')],
	])('%s : mark sur le texte', (source, mark) => {
		const [, mot] = source.match(/^\[([^|]+)/);
		expect(inline(`Le ${source}.`)).toEqual([text('Le '), text(mot, [mark]), text('.')]);
		expect(canonical(`Le ${source}.`)).toBe(`Le ${source}.`);
	});

	it.each(['[{A}|b]', '[A~B|c]', '[a&amp;b|c]'])('%s : gardé brut', (source) => {
		expect(inline(`x ${source}`)).toEqual([text('x '), raw(source)]);
	});

	it('dans le texte d\'un lien : brut', () => {
		expect(inline('[a [B|c] d->art1]')).toEqual([text('a ', [link('art1')]), raw('[B|c]', [link('art1')]), text(' d', [link('art1')])]);
	});

	it('dans de l\'italique', () => {
		expect(inline('{[ABBR|x]}')).toEqual([text('ABBR', [I, abbr('x')])]);
		expect(canonical('{[ABBR|x]}')).toBe('{[ABBR|x]}');
	});
});

describe('sérialisation de marks saisies dans l\'éditeur', () => {
	it('terme qui ne s\'écrit pas tel quel : mark abandonnée, texte échappé', () => {
		expect(ecrire([text('SP{IP}', [gloss()])])).toBe('SP\\{IP\\}');
		expect(ecrire([text('?x', [abbr('y')])])).toBe('?x');
	});

	it('textes voisins sous la même mark : un seul raccourci, avec les marks communes', () => {
		expect(ecrire([text('SP', [B, gloss()]), text('IP', [gloss()])])).toBe('[?SPIP]');
		expect(ecrire([text('SP', [B, gloss()]), text('IP', [B, gloss()]), text(' fin')])).toBe('{{[?SPIP]}} fin');
	});

	it('glossaire ou abréviation sur un lien ou du code : lien ou code seul', () => {
		expect(ecrire([text('x', [link('art1'), gloss()])])).toBe('[x->art1]');
		expect(ecrire([text('x', [abbr('y'), { type: 'code' }])])).toBe('`x`');
	});

	it('attributs qui ne se relisent pas : mark abandonnée', () => {
		expect(ecrire([text('SPIP', [gloss({ bulle: 'a]b' })])])).toBe('SPIP');
		expect(ecrire([text('A', [abbr('x|y')])])).toBe('A');
		expect(ecrire([text('A', [abbr('')])])).toBe('A');
	});

	it('glossaire et abréviation sur le même texte : glossaire seul', () => {
		expect(ecrire([text('SPIP', [abbr('x'), gloss()])])).toBe('[?SPIP]');
	});
});
