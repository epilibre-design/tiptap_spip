import { describe, expect, it } from 'vitest';
import { node, raw, stripTech, text } from '../../src/spip/json.js';
import { parseMulti } from '../../src/spip/multi.js';
import { parse } from '../../src/spip/parse.js';
import { protect } from '../../src/spip/protect.js';
import { serialize } from '../../src/spip/serialize.js';

const canonical = (source) => serialize(parse(source), { conservative: false });
const inline = (source) => stripTech(parse(source).content[0].content);
const parts = (src, masked) => parseMulti(src, masked).map(({ lang, start, end }) => [lang, src.slice(start, end)]);
const p = (...content) => node('paragraph', null, content.length ? content : undefined);
const multi = (...parties) => node('spipMultiInline', { parts: parties.map(([lang, content]) => ({ lang, content })) });

describe('parseMulti (Multis::extraire_trads du core)', () => {
	it('parties par langue, partie initiale sans langue si elle n\'est pas vide', () => {
		expect(parts('<multi>[fr]chat[en]cat</multi>')).toEqual([['fr', 'chat'], ['en', 'cat']]);
		expect(parts('<multi>chat[en]cat</multi>')).toEqual([[null, 'chat'], ['en', 'cat']]);
		expect(parts('<multi>sans langue</multi>')).toEqual([[null, 'sans langue']]);
		expect(parts('<multi>[pt_br]a[FR]b[en]</multi>')).toEqual([['pt_br', 'a'], ['FR', 'b'], ['en', '']]);
		expect(parts('<multi></multi>')).toEqual([[null, '']]);
	});

	it('marqueurs cherchés dans le texte que voit le core : pas dans un lien', () => {
		const src = '<multi>[fr]voir [[en]->art1][en]see</multi>';
		const { regions } = protect(src);
		expect(parts(src, regions[0].data.masked)).toEqual([['fr', 'voir [[en]->art1]'], ['en', 'see']]);
	});
});

describe('multi en ligne', () => {
	it('parties analysées : liens, gras, notes', () => {
		expect(inline('Un <multi>[fr]{{chat}}[en]cat</multi> ici')).toEqual([
			text('Un '), multi(['fr', [text('chat', [{ type: 'bold' }])]], ['en', [text('cat')]]), text(' ici'),
		]);
		const [, m] = inline('x <multi>[fr]a [->art1][en]b[[n]]</multi>');
		expect(m.attrs.parts[0].content[1].type).toBe('spipLinkAuto');
		expect(m.attrs.parts[1].content[1].type).toBe('spipNote');
	});

	it('identité et forme canonique', () => {
		for (const source of ['Un <multi>[fr]chat[en]cat</multi> ici', 'x <multi>sans[en]b[de]</multi>', 'x <multi>[fr]a [->art1][en]b[[n]]</multi>']) {
			expect(serialize(parse(source))).toBe(source);
			expect(canonical(source)).toBe(source);
		}
	});

	it('paragraphe modifié : multi inchangé réécrit tel quel', () => {
		const doc = parse('Avant <multi> [fr]a  b[en]c</multi>');
		doc.content[0].content[0].text = 'Après ';
		expect(serialize(doc)).toBe('Après <multi> [fr]a  b[en]c</multi>');
	});

	it('[xx] dans le texte d\'une partie : entité (\\[ ne protège pas un marqueur)', () => {
		const doc = node('doc', null, [p(multi(['fr', [text('a[en]b')]], ['en', [text('c')]]))]);
		expect(serialize(doc)).toBe('<multi>[fr]a&#91;en]b[en]c</multi>');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('dans le texte d\'un lien : brut', () => {
		expect(inline('[<multi>[fr]a[en]b</multi>->art1]')[0]).toMatchObject({ type: 'spipRawInline' });
	});
});

describe('multi bloc', () => {
	const bloc = (...parties) => node('spipMultiBlock', null, parties.map(([lang, paras]) => node('spipLangBlock', { lang }, paras)));

	it('multi seul dans son segment, parties de plusieurs paragraphes', () => {
		const source = '<multi>[fr]Bonjour\n\nDeux {{gras}}[en]Hello\n\nTwo</multi>';
		expect(stripTech(parse(source).content)).toEqual([bloc(
			['fr', [p(text('Bonjour')), p(text('Deux '), text('gras', [{ type: 'bold' }]))]],
			['en', [p(text('Hello')), p(text('Two'))]],
		)]);
		expect(serialize(parse(source))).toBe(source);
		expect(canonical(source)).toBe(source);
	});

	it('partie qui n\'est pas faite de paragraphes : brut', () => {
		const source = '<multi>[fr]Un\n\n-* liste[en]One\n\nTwo</multi>';
		expect(parse(source).content[0].type).toBe('spipRaw');
		expect(serialize(parse(source))).toBe(source);
	});

	it('multi avec ligne vide au milieu d\'un paragraphe : brut', () => {
		expect(inline('Intro <multi>[fr]a\n\nb[en]c</multi>')[1]).toEqual(raw('<multi>[fr]a\n\nb[en]c</multi>'));
	});

	it('partie vide', () => {
		expect(canonical('<multi>[fr]a\n\nb[en]</multi>')).toBe('<multi>[fr]a\n\nb[en]</multi>');
	});
});

describe('idiomes', () => {
	it('module facultatif, identité', () => {
		expect(inline('Voir <:tiptap_spip:lien:> et <:info_titre:>.')).toEqual([
			text('Voir '), node('spipIdiome', { module: 'tiptap_spip', cle: 'lien' }), text(' et '), node('spipIdiome', { cle: 'info_titre' }), text('.'),
		]);
		expect(canonical('Voir <:tiptap_spip:lien:> et <:info_titre:>.')).toBe('Voir <:tiptap_spip:lien:> et <:info_titre:>.');
	});
});
