import { describe, expect, it } from 'vitest';
import { FILL, protect, regionsIn } from '../../src/spip/protect.js';

const kinds = (source) => protect(source).regions.map((r) => [r.kind, source.slice(r.start, r.end)]);

describe('protect', () => {
	it('produit un texte masqué de même longueur', () => {
		const source = 'a [lien->art1] et <doc3|left> fin';
		const { masked } = protect(source);
		expect(masked).toHaveLength(source.length);
		expect(masked).toBe(`a ${FILL.repeat(12)} et ${FILL.repeat(11)} fin`);
	});

	it('repère les raccourcis non éditables de ce lot', () => {
		expect(kinds('[[note]] [x->art1] [#a<-] [?SPIP] [ABBR|abr] <multi>[fr]a</multi> <:mod:cle:> <img3>'))
			.toEqual([
				['note', '[[note]]'], ['link', '[x->art1]'], ['anchor', '[#a<-]'], ['glossary', '[?SPIP]'],
				['abbr', '[ABBR|abr]'], ['multi', '<multi>[fr]a</multi>'], ['idiome', '<:mod:cle:>'], ['model', '<img3>'],
			]);
	});

	it('ordre du core : les liens passent avant les notes', () => {
		expect(kinds('[[note->art1]]')).toEqual([['link', '[note->art1]']]);
	});

	it('\\[ ne protège ni une note, ni un glossaire, ni une ancre : le \\ reste brut', () => {
		expect(kinds('x\\[[n]]')).toEqual([['raw', '\\'], ['note', '[[n]]']]);
		expect(kinds('x\\[?SPIP]')).toEqual([['raw', '\\'], ['glossary', '[?SPIP]']]);
		expect(kinds('\\[#a<-]')).toEqual([['raw', '\\'], ['anchor', '[#a<-]']]);
		expect(protect('\\[#a<-]').regions[1].data.name).toBe('a');
	});

	it('\\] dans une note : la note s\'arrête au premier ]] du texte', () => {
		expect(kinds('[[a\\]]')).toEqual([['note', '[[a\\]]']]);
		expect(kinds('[[a\\]b]]')).toEqual([['note', '[[a\\]b]]']]);
	});

	it('\\[ protège un lien et une abréviation', () => {
		expect(kinds('\\[a->b]').map(([k]) => k)).toEqual(['escape']);
		expect(kinds('\\[A|b]').map(([k]) => k)).toEqual(['escape']);
	});

	it('une note absorbe ses liens et termes de glossaire', () => {
		const { regions } = protect('[[voir [a->b] et [?x]]]');
		expect(regions).toHaveLength(1);
		expect(regions[0]).toMatchObject({ kind: 'note', start: 0, end: 23 });
		expect(regions[0].data.absorbed.sort()).toEqual(['glossary', 'link']);
	});

	it('ne prend pas une balise HTML pour un modèle', () => {
		expect(kinds('<span> <span|x> <doc12>')).toEqual([['model', '<span|x>'], ['model', '<doc12>']]);
	});

	it('une région englobe celles qu\'elle recouvre', () => {
		const { regions } = protect('[<img3|left>->art1]');
		expect(regions).toHaveLength(1);
		expect(regions[0]).toMatchObject({ kind: 'link', start: 0, end: 19 });
		expect(regions[0].data.absorbed).toEqual(['model']);
	});

	it('échappements : \\{ et \\[ masquent le caractère', () => {
		expect(protect('\\{a\\} \\[x->y]').regions.map((r) => r.data.char ?? r.kind)).toEqual(['{', '}', '[']);
	});

	it('backticks : langage et contenu, \\\\ et \\` perdus comme dans SPIP', () => {
		const [fence, inline] = protect('```php\n$a;\n```\n\n`x\\`y`').regions;
		expect(fence.data).toMatchObject({ ticks: '```', language: 'php', code: '$a;\n' });
		expect(inline.data).toMatchObject({ ticks: '`', code: 'xy' });
	});

	it('blocs protégés : balises exactes et \\\\ décodé dans le contenu', () => {
		const [block] = protect('<code class="php">a\\\\b</code>').regions;
		expect(block.data).toMatchObject({ tag: 'code', openTag: '<code class="php">', closeTag: '</code>', inner: 'a\\b' });
	});

	it('regionsIn renvoie des positions relatives', () => {
		const { regions } = protect('ab [[n]] cd');
		expect(regionsIn(regions, 3, 8)).toMatchObject([{ kind: 'note', start: 0, end: 5 }]);
		expect(regionsIn(regions, 0, 5)).toEqual([]);
	});
});
