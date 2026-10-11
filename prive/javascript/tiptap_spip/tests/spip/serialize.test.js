import { describe, expect, it } from 'vitest';
import { node, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { escapeText, serialize, serializeBlock, serializeInline } from '../../src/spip/serialize.js';

const p = (...content) => node('paragraph', null, content);
const B = { type: 'bold' };
const I = { type: 'italic' };
const C = { type: 'code' };

describe('sérialisation conservatrice', () => {
	const source = '\n\nPremier   {{bloc}}\n\n\n\n-* a\n-** b\n\nfin\n';

	it('restitue la source à l\'identique, blancs compris', () => {
		expect(serialize(parse(source))).toBe(source);
		expect(serialize(parse(''))).toBe('');
		expect(serialize(parse(' \n '))).toBe(' \n ');
	});

	it('ne réécrit que le bloc modifié, en gardant son séparateur', () => {
		const doc = parse(source);
		doc.content[2] = { ...doc.content[2], content: [text('modifié')] };
		expect(serialize(doc)).toBe('\n\nPremier   {{bloc}}\n\n\n\n-* a\n-** b\n\nmodifié\n');
	});

	it('un bloc ajouté par l\'éditeur est séparé par une ligne vide', () => {
		const doc = parse('a');
		doc.content.push(p(text('b')));
		expect(serialize(doc)).toBe('a\n\nb');
	});

	it('un segment de plusieurs blocs n\'est restitué que si tous sont intacts', () => {
		const doc = parse('{{{T}}}\ntexte');
		expect(doc.content[0].attrs).toMatchObject({ spipGroup: 2, spipSrc: '{{{T}}}\ntexte', spipSep: '' });
		doc.content[1] = p(text('autre'));
		expect(serialize(doc)).toBe('{{{T}}}\n\nautre');
	});

	it('document vide modifié', () => {
		const doc = parse('');
		doc.content[0] = { ...doc.content[0], content: [text('x')] };
		expect(serialize(doc)).toBe('x');
	});
});

describe('serializeInline', () => {
	it('gras et italique imbriqués : la mark intérieure en HTML, jamais {{{', () => {
		expect(serializeInline([text('a', [B, I])])).toBe('{{<i>a</i>}}');
		expect(serializeInline([text('a', [I]), text('b', [I, B])])).toBe('{a<strong>b</strong>}');
		expect(serializeInline([text('a', [B]), text('b', [I])])).toBe('{{a}}{b}');
	});

	it('sauts de ligne', () => {
		expect(serializeInline([text('a'), { type: 'hardBreak' }, text('b'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('c')]))
			.toBe('a\n_ b\nc');
	});

	it('code : backticks, doubles backticks ou <code>', () => {
		expect(serializeInline([text('a {b}', [C])])).toBe('`a {b}`');
		expect(serializeInline([text('a`b', [C])])).toBe('``a`b``');
		expect(serializeInline([text(' a ', [C])])).toBe('<code> a </code>');
		expect(serializeInline([text('a\\`b', [C])])).toBe('<code>a\\\\\\`b</code>');
	});
});

describe('escapeText', () => {
	it.each([
		['{a}', '\\{a\\}'],
		['a\\b', 'a\\\\b'],
		['~ et  ', '\\~ et ~'],
		['`x`', '\\`x\\`'],
		['<b> <doc1> <:a:b:> a < b', '&lt;b> &lt;doc1> &lt;:a:b:> a < b'],
		['&eacute; & co', '&amp;eacute; & co'],
		['[?g] [[n]] [x->y] [a|b] [#a<-] [sic]', '[&#63;g] [&#91;n]] &#91;x->y] &#91;a|b] &#91;#a<-] [sic]'],
	])('%j → %j', (input, expected) => {
		expect(escapeText(input, false)).toBe(expected);
	});

	it('début de ligne : - _ | échappés', () => {
		expect(escapeText('- a', true)).toBe('\\- a');
		expect(escapeText('_ a', true)).toBe('\\_ a');
		expect(escapeText('|a|', true)).toBe('\\|a|');
		expect(escapeText('- a', false)).toBe('- a');
	});
});

describe('serializeBlock', () => {
	it('intertitres', () => {
		expect(serializeBlock(node('heading', { level: 2 }, [text('T '), text('i', [I])]))).toBe('{{{T <i>i</i>}}}');
		expect(serializeBlock(node('heading', { level: 4 }, [text('T')]))).toBe('<h4>T</h4>');
	});

	it('listes imbriquées', () => {
		const li = (t, nested) => node('listItem', null, nested ? [p(text(t)), nested] : [p(text(t))]);
		expect(serializeBlock(node('bulletList', null, [li('a', node('orderedList', null, [li('b')])), li('c')])))
			.toBe('-* a\n-## b\n-* c');
	});

	it('code : fence allongé si besoin, <code> si \\\\ ou \\`', () => {
		expect(serializeBlock(node('codeBlock', { language: 'php' }, [text('a```b\n')]))).toBe('````php\na```b\n````');
		expect(serializeBlock(node('codeBlock', null, [text('a\\\\b')]))).toBe('<code>\na\\\\\\b\n</code>');
		expect(parse('<code>\na\\\\\\b\n</code>').content[0].content[0].text).toBe('a\\\\b');
		expect(serializeBlock(node('codeBlock', { openTag: '<code class="js">' }, [text('x')]))).toBe('<code class="js">\nx\n</code>');
	});

	it('tableau avec légende, en-tête et fusions', () => {
		const c = (type, v, colspan = 1, rowspan = 1) => node(type, { colspan, rowspan }, [p(text(v))]);
		const table = node('table', { caption: 'L' }, [
			node('tableRow', null, [c('tableHeader', 'A'), c('tableHeader', 'B')]),
			node('tableRow', null, [c('tableCell', '1', 2, 2)]),
			node('tableRow', null, []),
		]);
		expect(serializeBlock(table)).toBe('||L||\n|{{A}}|{{B}}|\n|1|<|\n|^|^|');
	});

	it('conteneurs', () => {
		expect(serializeBlock(node('blockquote', null, [p(text('a')), p(text('b'))]))).toBe('<quote>\na\n\nb\n</quote>');
		expect(serializeBlock(node('spipAlign', { align: 'center' }, [p(text('a'))]))).toBe('<div class="text-center">\n\na\n\n</div>');
	});
});
