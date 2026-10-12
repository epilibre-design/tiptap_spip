import { describe, expect, it } from 'vitest';
import { parseContent } from '../../src/spip/blocks.js';
import { parse } from '../../src/spip/parse.js';
import { node, raw, text } from '../../src/spip/json.js';

const p = (...content) => node('paragraph', null, content);
const item = (inline, nested) => node('listItem', null, nested ? [p(text(inline)), nested] : [p(text(inline))]);
const cell = (type, value, colspan = 1, rowspan = 1) => node(type, { colspan, rowspan }, [value === '' ? node('paragraph') : p(text(value))]);

describe('blocs simples', () => {
	it('paragraphes, intertitres, filet', () => {
		expect(parseContent('{{{Titre {i}}}}\n\n<h3>Sous</h3>\n\n----\n\nfin')).toEqual([
			node('heading', { level: 2 }, [text('Titre '), text('i', [{ type: 'italic' }])]),
			node('heading', { level: 3 }, [text('Sous')]),
			node('horizontalRule'),
			p(text('fin')),
		]);
	});

	it('un segment peut donner plusieurs blocs, comme le rendu SPIP', () => {
		expect(parseContent('{{{T}}}\ntexte\n----\nfin')).toEqual([
			node('heading', { level: 2 }, [text('T')]), p(text('texte')), node('horizontalRule'), p(text('fin')),
		]);
	});

	it('un intertitre contenant du gras n\'est pas un intertitre éditable', () => {
		expect(parseContent('{{{a {{b}} c}}}')).toEqual([p(raw('{{{'), text('a '), text('b', [{ type: 'bold' }]), text(' c'), raw('}}}'))]);
	});
});

describe('listes', () => {
	it('imbrication et lignes de continuation', () => {
		expect(parseContent('texte\n-* a\n-** b\nsuite\n-* c')).toEqual([
			p(text('texte')),
			node('bulletList', null, [
				item('a', node('bulletList', null, [node('listItem', null, [p(text('b'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('suite'))])])),
				item('c'),
			]),
		]);
	});

	it('changement de type entre éléments de même profondeur : nouvelle liste', () => {
		expect(parseContent('-* a\n-# b')).toEqual([node('bulletList', null, [item('a')]), node('orderedList', null, [item('b')])]);
	});

	it('en remontant d\'un niveau, la liste existante continue (comme SPIP)', () => {
		expect(parseContent('-* a\n-## b\n-# c')).toEqual([
			node('bulletList', null, [item('a', node('orderedList', null, [item('b')])), item('c')]),
		]);
	});

	it('saut de profondeur ou deux sous-listes dans un élément : bloc brut', () => {
		expect(parseContent('-* a\n-*** b')).toEqual([node('spipRaw', { source: '-* a\n-*** b' })]);
		expect(parseContent('-* a\n-** b\n-## c')).toEqual([node('spipRaw', { source: '-* a\n-** b\n-## c' })]);
	});

	it('filet ou intertitre sans ligne vide après un élément : il en fait partie pour SPIP, bloc brut', () => {
		// SPIP : <li>a<hr class="spip" /></li><li>b</li> (textwheel base/sparse_list)
		for (const source of ['-* a\n----\n-* b', '-* a\n----', '-* a\n{{{T}}}\n-* b', '-* a\n<h3>T</h3>']) {
			expect(parseContent(source)).toEqual([node('spipRaw', { source })]);
		}
		// avant la liste, le filet reste un bloc
		expect(parseContent('----\n-* a')).toEqual([node('horizontalRule'), node('bulletList', null, [item('a')])]);
	});
});

describe('lignes commençant par |', () => {
	it('tableau mal formé pour le parseur, mais tableau pour SPIP : bloc brut', () => {
		// textwheel (spip-tableaux.json) fait un tableau de toute ligne qui commence et finit par |
		for (const source of ['|a|b\n|c|d|', 'texte\n|a|\nsuite', '|a|\ntexte', '-* a\n|b|']) {
			expect(parseContent(source)).toEqual([node('spipRaw', { source })]);
		}
	});
});

describe('retour chariot seul', () => {
	it('\\r non suivi de \\n : saut de ligne pour SPIP (a\\r\\r\\nb : deux paragraphes), segment brut', () => {
		for (const source of ['a\r\r\nb', 'a\rb', '{\r\r\n{', '{\r\r']) expect(parseContent(source)).toEqual([node('spipRaw', { source })]);
		// \r\n : fin de ligne ordinaire, y compris avant une ligne vide (fins de ligne CRLF des navigateurs) ;
		// \r dans du code : sans effet
		expect(parseContent('a\r\nb')[0].type).toBe('paragraph');
		expect(parseContent('a\r\n\r\nb')).toEqual([p(text('a')), p(text('b'))]);
		expect(parseContent('-* a\r\n-* b\r\n\r\n{{{T}}}\r\n\r\nx').map((b) => b.type)).toEqual(['bulletList', 'heading', 'paragraph']);
		// blocs qui occupent tout leur segment : le \r final appartient au séparateur
		expect(parse('<doc12|left>\r\n').content.map((b) => b.type)).toEqual(['spipModelBlock']);
		expect(parse('<cadre>x</cadre>\r\n\r\nb').content.map((b) => b.type)).toEqual(['spipCadre', 'paragraph']);
		// le \r d'une fin de ligne n'est pas du texte
		expect(parseContent('{{a}}\r\n-# b')).toEqual([p(text('a', [{ type: 'bold' }])), node('orderedList', null, [item('b')])]);
		expect(parseContent('`a\rb`')[0].type).toBe('paragraph');
	});
});

describe('conteneurs', () => {
	it('<quote>, <poesie>, <div class="text-…">', () => {
		expect(parseContent('<quote>\na\n\nb\n</quote>')).toEqual([node('blockquote', null, [p(text('a')), p(text('b'))])]);
		expect(parseContent('<poesie>\nv1\nv2\n</poesie>')).toEqual([
			node('spipPoesie', { tag: 'poesie' }, [p(text('v1'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('v2'))]),
		]);
		expect(parseContent('<div class="text-justify">\n\na\n\n</div>')).toEqual([node('spipAlign', { align: 'justify' }, [p(text('a'))])]);
	});

	it('conteneur dont le contenu porte sa balise fermante : bloc brut', () => {
		for (const source of ['<div class="text-center"></div></div>', '<quote>a</quote></quote>', '<poesie>a</poesie></poesie>']) {
			expect(parseContent(source)).toEqual([node('spipRaw', { source })]);
		}
	});

	it('paragraphe avec une ligne vide (segment recollé autour d\'un conteneur mal fermé) : bloc brut', () => {
		const source = '<quote>\n\n\n</quote>{';
		expect(parseContent(source)).toEqual([node('spipRaw', { source })]);
		// ligne vide dans un lien : masquée, le paragraphe reste
		expect(parseContent('[a\n\nb->art1]')[0].type).toBe('paragraph');
	});

	it('autre <div> : bloc brut', () => {
		expect(parseContent('<div class="x">\n\na\n\n</div>')).toEqual([
			p(raw('<div class="x">')), p(text('a')), p(raw('</div>')),
		]);
	});
});

describe('blocs verbatim', () => {
	it('code', () => {
		expect(parseContent('```php\n$a;\n```')).toEqual([node('codeBlock', { language: 'php' }, [text('$a;\n')])]);
		expect(parseContent('<code>\nx\n</code>')).toEqual([node('codeBlock', null, [text('x')])]);
		expect(parseContent('<code class="js">\nx\n</code>')).toEqual([node('codeBlock', { openTag: '<code class="js">' }, [text('x')])]);
		expect(parseContent('<code>x</code>')).toEqual([p(text('x', [{ type: 'code' }]))]);
	});

	it('cadre, html, math', () => {
		expect(parseContent('<cadre>\n{x}\n</cadre>')).toEqual([node('spipCadre', { openTag: '<cadre>', closeTag: '</cadre>' }, [text('\n{x}\n')])]);
		expect(parseContent('<html><b>x</b></html>')).toEqual([node('spipHtml', { openTag: '<html>', closeTag: '</html>' }, [text('<b>x</b>')])]);
		expect(parseContent('<math>$x$</math>')).toEqual([node('spipMath', { openTag: '<math>', closeTag: '</math>' }, [text('$x$')])]);
	});

	it('bloc contenant du code en backticks : brut', () => {
		expect(parseContent('<html>`x`</html>')).toEqual([node('spipRaw', { source: '<html>`x`</html>' })]);
	});
});

describe('tableaux', () => {
	it('en-tête, légende, fusions', () => {
		expect(parseContent('||Légende|Résumé||\n|{{A}}||{{C}}|\n|1|<|3|\n|^|^|4|')).toEqual([
			node('table', { caption: 'Légende', summary: 'Résumé' }, [
				node('tableRow', null, [cell('tableHeader', 'A'), cell('tableHeader', ''), cell('tableHeader', 'C')]),
				node('tableRow', null, [cell('tableCell', '1', 2, 2), cell('tableCell', '3')]),
				node('tableRow', null, [cell('tableCell', '4')]),
			]),
		]);
	});

	it('légende comme textwheel (ligne sans ses | finaux) : ||x|, résumé avec |, |||| n\'en est pas une', () => {
		const legende = (src) => { const [t] = parseContent(src); return t.type === 'table' ? t.attrs ?? {} : t.type; };
		expect(legende('||x|\n|a|b|')).toEqual({ caption: 'x' });
		expect(legende('|||x||\n|a|b|')).toEqual({ caption: '', summary: 'x' });
		expect(legende('||cap|sum|more||\n|a|b|')).toEqual({ caption: 'cap', summary: 'sum|more' });
		expect(parseContent('||||\n|a|b|c|')[0].content).toHaveLength(2);
	});

	it('lignes de longueurs différentes ou fusion incohérente : bloc brut', () => {
		expect(parseContent('|a|b|\n|c|')[0].type).toBe('spipRaw');
		expect(parseContent('|a|b|\n|3|<|\n|^|4|')[0].type).toBe('spipRaw');
	});
});
