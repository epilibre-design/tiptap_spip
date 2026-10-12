import { afterEach, describe, expect, it, vi } from 'vitest';
import { node, stripTech, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { creerRegle } from '../../src/spip/regles.js';
import { serialize } from '../../src/spip/serialize.js';

// Règles tierces de test (spec 07) : un bloc, une mark, un nœud en ligne
const faq = creerRegle({
	name: 'faqItem',
	type: 'block',
	tokenizer: { level: 'block', priority: 100, start: '<faq', match: /^<faq\|q=([^>]*)>\n([\s\S]*?)\n<\/faq>/ },
	parseSpip: (m, h) => ({ type: 'faqItem', attrs: { question: m[1] }, content: h.parseBlocks(m[2]) }),
	renderSpip: (n, h) => `<faq|q=${n.attrs.question}>\n${h.renderBlocks(n.content)}\n</faq>`,
});
const sc = creerRegle({
	name: 'sc',
	type: 'mark',
	tokenizer: { level: 'inline', start: '<sc>', match: /<sc>(.*?)<\/sc>/ },
	parseSpip: (m, h) => ({ content: h.parseInline(m[1]) }),
	renderSpip: { open: '<sc>', close: '</sc>' },
});
const emoji = creerRegle({
	name: 'emoji',
	type: 'inline',
	tokenizer: { level: 'inline', start: ':', match: /:([a-z_]+):/ },
	parseSpip: (m) => ({ type: 'emoji', attrs: { nom: m[1] } }),
	renderSpip: (n) => `:${n.attrs.nom}:`,
});
const regles = [faq, sc, emoji];

const lire = (source, r = regles) => stripTech(parse(source, { regles: r }).content);
const canonique = (source, r = regles) => serialize(parse(source, { regles: r }), { conservative: false, regles: r });
const conserve = (source, r = regles) => serialize(parse(source, { regles: r }), { regles: r });
const p = (...content) => node('paragraph', null, content.length ? content : undefined);

afterEach(() => vi.restoreAllMocks());

describe('règles tierces : bloc', () => {
	it('sans la règle, rien ne change ; avec, un bloc FAQ, même sur plusieurs paragraphes', () => {
		const source = '<faq|q=Pourquoi ?>\nParce que.\n\nVoilà.\n</faq>\n\nFin';
		expect(lire(source, []).some((b) => b.type === 'faqItem')).toBe(false);
		expect(lire(source)).toEqual([
			node('faqItem', { question: 'Pourquoi ?' }, [p(text('Parce que.')), p(text('Voilà.'))]),
			p(text('Fin')),
		]);
	});

	it('aller-retour : source restituée à l\'identique, forme canonique stable, attribut modifié écrit', () => {
		const source = 'Avant\n\n\n<faq|q=Q>\nUn {{gras}}\n</faq>\n';
		expect(conserve(source)).toBe(source);
		expect(canonique(source)).toBe('Avant\n\n<faq|q=Q>\nUn {{gras}}\n</faq>');
		const doc = parse(source, { regles });
		doc.content[1].attrs.question = 'Autre';
		expect(serialize(doc, { regles })).toBe('Avant\n\n\n<faq|q=Autre>\nUn {{gras}}\n</faq>\n');
	});

	it('dans une citation ; dans une note (blocs limités, spec 03 §5) : note gardée brute ; protégée par le code et les échappements', () => {
		expect(lire('<quote>\n<faq|q=Q>\nA\n</faq>\n</quote>')).toEqual([
			node('blockquote', null, [node('faqItem', { question: 'Q' }, [p(text('A'))])]),
		]);
		const dansNote = 'Texte[[Note\n\n<faq|q=Q>\nA\n</faq>]]';
		expect(lire(dansNote)[0].content[1]).toEqual(node('spipRawInline', { source: '[[Note\n\n<faq|q=Q>\nA\n</faq>]]' }));
		expect(conserve(dansNote)).toBe(dansNote);
		expect(JSON.stringify(lire('<code>\n<faq|q=Q>\nA\n</faq>\n</code>'))).not.toContain('faqItem');
		expect(JSON.stringify(lire('\\<faq|q=Q>\nA\n</faq>'))).not.toContain('faqItem');
	});

	it('bloc qui n\'occupe pas tout son segment, ou parseSpip nul : source gardée brute', () => {
		const source = 'Avant\n<faq|q=Q>\nA\n</faq>';
		expect(JSON.stringify(lire(source))).not.toContain('faqItem');
		expect(lire(source)[0].content.at(-1)).toEqual(node('spipRawInline', { source: '<faq|q=Q>\nA\n</faq>' }));
		expect(conserve(source)).toBe(source);
		const nulle = creerRegle({ ...faq.definition, parseSpip: () => null });
		expect(lire('<faq|q=Q>\nA\n</faq>', [nulle])).toEqual([node('spipRaw', { source: '<faq|q=Q>\nA\n</faq>' })]);
	});
});

describe('règles tierces : en ligne', () => {
	it('mark : contenu analysé, marks combinées ; aller-retour', () => {
		expect(lire('a <sc>b {c}</sc> d')).toEqual([p(
			text('a '),
			text('b ', [{ type: 'sc' }]),
			text('c', [{ type: 'italic' }, { type: 'sc' }]),
			text(' d'),
		)]);
		expect(conserve('a <sc>b {c}</sc> d')).toBe('a <sc>b {c}</sc> d');
		expect(canonique('a <sc>b {c}</sc> d')).toBe('a <sc>b {c}</sc> d');
	});

	it('nœud en ligne : atome ; aller-retour ; pas dans le code', () => {
		expect(lire('Salut :smile: !')).toEqual([p(text('Salut '), node('emoji', { nom: 'smile' }), text(' !'))]);
		expect(canonique('Salut :smile: !')).toBe('Salut :smile: !');
		expect(lire('`:smile:`')).toEqual([p(text(':smile:', [{ type: 'code' }]))]);
	});

	it('priorité : la plus basse passe d\'abord', () => {
		const tout = creerRegle({ ...emoji.definition, name: 'tout', tokenizer: { ...emoji.definition.tokenizer, priority: -10 }, parseSpip: (m) => ({ type: 'tout', attrs: { nom: m[1] } }) });
		expect(lire(':a:', [emoji, tout])[0].content).toEqual([node('tout', { nom: 'a' })]);
	});
});

describe('règle tierce portant le nom d\'une extension du cœur : prioritaire à l\'écriture', () => {
	const gras = creerRegle({
		name: 'bold',
		type: 'mark',
		tokenizer: { level: 'inline', start: '<x>', match: /<x>(.*?)<\/x>/ },
		parseSpip: (m, h) => ({ content: h.parseInline(m[1]) }),
		renderSpip: { open: '<x>', close: '</x>' },
	});
	const filet = creerRegle({ name: 'horizontalRule', type: 'block', renderSpip: () => '<hr-x>' });
	const ancre = creerRegle({ name: 'spipAnchor', type: 'inline', renderSpip: (n) => `[ancre ${n.attrs.name}]` });

	it('mark : lue et écrite par la règle ; le raccourci du cœur se lit encore, s\'écrit par la règle', () => {
		expect(lire('a <x>b</x>', [gras])).toEqual([p(text('a '), text('b', [{ type: 'bold' }]))]);
		expect(canonique('a <x>b</x>', [gras])).toBe('a <x>b</x>');
		expect(canonique('a {{b}}', [gras])).toBe('a <x>b</x>');
		// italique dans le gras : plus d'écriture HTML de secours, propre aux accolades du cœur
		expect(canonique('<x>{b}</x>', [gras])).toBe('<x>{b}</x>');
	});

	it('bloc et nœud en ligne du cœur écrits par la règle', () => {
		expect(canonique('a\n\n----', [filet])).toBe('a\n\n<hr-x>');
		expect(canonique('a [#n<-] b', [ancre])).toBe('a [ancre n] b');
	});
});

describe('creerRegle', () => {
	it('niveau inconnu ou sans motif : ignorée avec un avertissement', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(creerRegle({ ...faq.definition, tokenizer: { ...faq.definition.tokenizer, level: 'autre' } })).toBeNull();
		expect(creerRegle({ ...faq.definition, tokenizer: { level: 'block' } })).toBeNull();
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('règle d\'écriture seule (sans tokenizer) : sérialisée, jamais lue', () => {
		const ecriture = creerRegle({ name: 'faqItem', type: 'block', renderSpip: (n) => `FAQ ${n.attrs.question}` });
		const doc = node('doc', null, [node('faqItem', { question: 'Q' }, [p(text('A'))])]);
		expect(serialize(doc, { regles: [ecriture] })).toBe('FAQ Q');
		expect(() => serialize(doc)).toThrow(/inconnu/);
	});
});
