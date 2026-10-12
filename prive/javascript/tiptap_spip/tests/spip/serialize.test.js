import { describe, expect, it } from 'vitest';
import { node, raw, stripTech, text } from '../../src/spip/json.js';
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

	// l'éditeur recopie les attributs techniques quand il coupe un bloc ou colle une copie
	const dup = (block, content) => ({ ...block, content });

	it('un bloc coupé en deux reste séparé par une ligne vide', () => {
		const doc = parse('Premier.\n\nSecond.');
		const [first, second] = doc.content;
		doc.content = [dup(first, [text('Pre')]), dup(first, [text('mier.')]), second];
		expect(serialize(doc)).toBe('Pre\n\nmier.\n\nSecond.');
	});

	it('une copie intacte du premier bloc collée plus loin n\'est pas recollée au bloc précédent', () => {
		const doc = parse('Premier.\n\nSecond.');
		doc.content = [...doc.content, doc.content[0]];
		expect(serialize(doc)).toBe('Premier.\n\nSecond.\n\nPremier.');
	});

	it('un bloc déplacé en tête ne garde pas son séparateur', () => {
		const doc = parse('Premier.\n\n\n\nSecond.');
		doc.content = [doc.content[1], doc.content[0]];
		expect(serialize(doc)).toBe('Second.\n\nPremier.');
	});
});

describe('imbrication des marks', () => {
	const S = { type: 'strike' };
	const canonical = (source) => serialize(parse(source), { conservative: false });

	it('une mark qui continue reste ouverte, la mark intérieure s\'imbrique', () => {
		expect(serializeInline([text('a ', [I]), text('b', [B, I]), text(' c', [I])])).toBe('{a <strong>b</strong> c}');
		expect(serializeInline([text('a ', [S]), text('b', [B, S]), text(' c', [S])])).toBe('<del>a {{b}} c</del>');
	});

	it('la mark qui s\'étend le plus loin s\'ouvre en premier', () => {
		expect(serializeInline([text('a', [B, S]), text('b', [B])])).toBe('{{<del>a</del>b}}');
		expect(serializeInline([text('a', [B, S]), text('b', [S])])).toBe('<del>{{a}}b</del>');
	});

	it('la source garde sa structure après réécriture', () => {
		expect(canonical('{a {{b}} c}')).toBe('{a <strong>b</strong> c}');
		expect(canonical('{{a {b} c}}')).toBe('{{a <i>b</i> c}}');
		expect(canonical('<del>a {{b}} c</del>')).toBe('<del>a {{b}} c</del>');
		expect(canonical('{{a <del>b</del> c}}')).toBe('{{a <del>b</del> c}}');
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

	it('saut de ligne au bord du contenu : non écrit (SPIP ne l\'affiche pas en tête, affiche _ en fin)', () => {
		const br = { type: 'hardBreak', attrs: { syntax: 'manual' } };
		expect(serializeInline([br, text('a'), br, text('b'), br, br])).toBe('a\n_ b');
		expect(serializeInline([br])).toBe('');
		// saut dans une mark ({\n}, produit par le parseur) : gardé
		expect(serializeInline([{ ...br, attrs: { syntax: 'autobr' }, marks: [I] }])).toBe('{\n}');
	});

	it('saut autobr suivi d\'un autre saut : écrit forcé (\\n\\n ferait une ligne vide)', () => {
		const auto = { type: 'hardBreak', attrs: { syntax: 'autobr' } };
		expect(serializeInline([text('a'), auto, auto, text('b')])).toBe('a\n_ \nb');
	});

	it('code : backticks, doubles backticks ou <code>', () => {
		expect(serializeInline([text('a {b}', [C])])).toBe('`a {b}`');
		expect(serializeInline([text('a`b', [C])])).toBe('``a`b``');
		expect(serializeInline([text(' a ', [C])])).toBe('<code> a </code>');
		expect(serializeInline([text('a\\`b', [C])])).toBe('<code>a\\\\\\`b</code>');
	});
});

describe('< brut d\'une balise incomplète', () => {
	it('un > du texte qui suit s\'écrit &gt; : il fermerait la balise', () => {
		const doc = node('doc', null, [p(raw('<'), text('https://x.org> a'), raw('<b>'), text('c>'))]);
		// chevrons comptés : le < incomplet reste ouvert après <b>, le > final aussi en entité
		expect(serialize(doc)).toBe('<https://x.org&gt; a<b>c&gt;');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('chevrons comptés : le -> d\'un lien ne referme pas le < (liens masqués avant les balises)', () => {
		const doc = node('doc', null, [p(raw('<'), text('https://x.org'), node('spipLinkAuto', { href: 'art12', newWindow: false }), text('>'))]);
		expect(serialize(doc)).toBe('<https://x.org[->art12]&gt;');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('chevrons comptés : un idiome (<:m:c:>) ne referme pas le < ouvert avant lui', () => {
		const doc = node('doc', null, [p(raw('<'), text('doc'), node('spipIdiome', { module: 'mod', cle: 'cle' }), text('>'))]);
		expect(serialize(doc)).toBe('<doc<:mod:cle:>&gt;');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('chevron resté ouvert dans un bloc précédent, ou modèle juste avant : > en &gt;', () => {
		const model = { name: 'doc', id: '', params: [{ key: null, value: '' }, { key: null, value: '<sup' }], source: '<doc||<sup>' };
		const cas = [
			[[node('spipRaw', { source: '|<art12' }), p(text('>'))], '|<art12\n\n&gt;'],
			[[p(node('spipModel', { model }), text('>'))], '<doc||<sup>&gt;'],
		];
		for (const [content, attendu] of cas) {
			const doc = node('doc', null, content);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});

	it('un | du texte qui suit s\'écrit \\| : il formerait un modèle (<doc|x>)', () => {
		const doc = node('doc', null, [p(raw('<'), text('doc|'), raw('{{'), text('t'), raw('}}'), text('|'), raw('</del>'))]);
		expect(serialize(doc)).toBe('<doc\\|{{t}}\\|</del>');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});
});

describe('-> après un [ resté ouvert', () => {
	it('-> du texte en entité quand un [ reste ouvert avant lui (il fermerait un lien) ; sinon tel quel', () => {
		const abbr = { type: 'spipAbbr', attrs: { title: 'x' } };
		const note = (content) => node('spipNote', { content });
		const cas = [
			// le [[ de la note reste ouvert
			[p(note([p(text('a', [abbr]), text('->b'))])), '[[[a|x]-&gt;b]]'],
			[p(text('a -> b')), 'a -> b'],
		];
		for (const [para, attendu] of cas) {
			const doc = node('doc', null, [para]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});
});

describe('accolades contre un fragment brut', () => {
	it('gras ou italique contre un fragment brut à accolade, dedans ou à côté : en HTML', () => {
		const cas = [
			[p(raw('{{{', [I])), '<i>{{{</i>'],
			[p(text('x', [B]), raw('}}}', [B])), '<strong>x}}}</strong>'],
			// fragment brut juste avant : {{{ orphelin devant un italique
			[p(raw('{{{'), text('SPIP', [I])), '{{{<i>SPIP</i>'],
			[p(text('x', [B]), text('y')), '{{x}}y'],
		];
		for (const [para, attendu] of cas) {
			const doc = node('doc', null, [para]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});
});

describe('marqueur de début de ligne brut', () => {
	it('* # ou - en tête du texte qui suit un - brut : échappé (-* serait une liste, ---- un filet)', () => {
		for (const [t, attendu] of [['*', '-\\*'], ['#', '-\\#'], ['--', '-\\--']]) {
			const doc = node('doc', null, [p(raw('-'), text(t))]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});
});

describe('escapeText', () => {
	it.each([
		['{a}', '\\{a\\}'],
		['a\\b', 'a\\\\b'],
		['~ et  ', '\\~ et ~'],
		['`x`', '\\`x\\`'],
		['<b> <doc1> <:a:b:> a < b', '&lt;b> &lt;doc1> &lt;:a:b:> a < b'],
		// nom de modèle : lettres, - et _ ([a-z_-]{3,})
		['<-----|> <_xy|> <_x|>', '&lt;-----|> &lt;_xy|> <_x|>'],
		['&eacute; & co', '&amp;eacute; & co'],
		// \[ protège un lien et une abréviation (comme dans SPIP), pas une ancre : entité
		['[?g] [[n]] [x->y] [a|b] [#a<-] [b<-] [sic]', '[&#63;g] [&#91;n]] \\[x->y] \\[a|b] &#91;#a<-] &#91;b<-] [sic]'],
	])('%j → %j', (input, expected) => {
		expect(escapeText(input, false)).toBe(expected);
	});

	it('[ sans ] dans le même texte : entité (le ], le ->, le | ou le <- peuvent suivre dans d\'autres nœuds)', () => {
		const abbr = { type: 'spipAbbr', attrs: { title: 'explication', lang: 'fr' } };
		const cas = [
			[p(text('[ABBR|explication'), text('fr', [I]), text(']')), '&#91;ABBR|explication{fr}]'],
			[p(text('[?'), raw('{'), text('->]')), '&#91;&#63;{->]'],
			// ancre : \[ ne la protège pas (pre_liens)
			[p(text('[0'), raw('{'), text('<-]')), '&#91;0{<-]'],
			// [ final devant un raccourci écrit avec [ : \[[ serait une note
			[p(text('['), text('ABBR', [abbr])), '&#91;[ABBR|explication{fr}]'],
		];
		for (const [para, attendu] of cas) {
			const doc = node('doc', null, [para]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});

	it('[ final : \\[, ou entité devant une note ou un fragment brut', () => {
		expect(escapeText('a [', false)).toBe('a \\[');
		expect(escapeText('a [', false, { avantCrochets: true })).toBe('a &#91;');
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

	it('code qui commence par un saut de ligne ou finit par ` : <code> (pas entre backticks)', () => {
		// ou qui finit par un backtick : il se collerait à la clôture
		for (const t of ['\n', '\nabc', '\n\nabc\n', '```', 'a`']) {
			const doc = node('doc', null, [node('codeBlock', { language: 'php' }, [text(t)])]);
			expect(serialize(doc).startsWith('<code>')).toBe(true);
			expect(stripTech(parse(serialize(doc)).content)).toEqual([node('codeBlock', null, [text(t)])]);
		}
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

	it('saut de ligne dans un intertitre : <br /> (il tient sur une ligne)', () => {
		const br = { type: 'hardBreak', attrs: { syntax: 'manual' } };
		for (const [level, attendu] of [[2, '{{{a<br />b}}}'], [3, '<h3>a<br />b</h3>']]) {
			const doc = node('doc', null, [node('heading', { level }, [text('a'), br, text('b')])]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});

	it('saut de ligne dans une cellule : <br /> (\\n_ y ferait un paragraphe, et couperait la ligne)', () => {
		const br = { type: 'hardBreak', attrs: { syntax: 'manual' } };
		const doc = node('doc', null, [node('table', null, [node('tableRow', null, [node('tableCell', { colspan: 1, rowspan: 1 }, [p(text('a'), br, text('b'))])])])]);
		expect(serialize(doc)).toBe('|a<br />b|');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		// au bord du contenu, <br /> reste brut (un saut de bord ne s'écrit pas, SPIP le rend)
		const bord = stripTech(parse('|a|<br />|a|').content[0].content[0].content[1].content[0].content);
		expect(bord).toEqual([raw('<br />')]);
		expect(serialize(parse('|a|<br />|a|'), { conservative: false })).toBe('|a|<br />|a|');
		// hors cellule, <br /> reste un fragment brut
		expect(stripTech(parse('a<br />b').content[0].content)).toEqual([text('a'), raw('<br />'), text('b')]);
	});

	it('cellule dont le texte est < ou ^ : entité (marqueur de fusion sinon)', () => {
		for (const [t, attendu] of [['<', '|&lt;|'], ['^', '|&#94;|'], [' ^ ', '|&#94;|']]) {
			const doc = node('doc', null, [node('table', null, [node('tableRow', null, [node('tableCell', { colspan: 1, rowspan: 1 }, [p(text(t.trim()))])])])]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});

	it('| dans le texte d\'une cellule : \\| (il couperait la cellule)', () => {
		const doc = node('doc', null, [node('table', null, [node('tableRow', null, [node('tableCell', { colspan: 1, rowspan: 1 }, [p(text('<|a|'))])])])]);
		expect(serialize(doc)).toBe('|<\\|a\\||');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('conteneurs', () => {
		expect(serializeBlock(node('blockquote', null, [p(text('a')), p(text('b'))]))).toBe('<quote>\na\n\nb\n</quote>');
		expect(serializeBlock(node('spipAlign', { align: 'center' }, [p(text('a'))]))).toBe('<div class="text-center">\n\na\n\n</div>');
	});
});
