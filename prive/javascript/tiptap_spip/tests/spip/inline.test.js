import { describe, expect, it } from 'vitest';
import { parseInline } from '../../src/spip/inline.js';
import { protect } from '../../src/spip/protect.js';
import { raw, text } from '../../src/spip/json.js';

const inl = (source, options) => {
	const { masked, regions } = protect(source);
	return parseInline(source, masked, regions, options);
};
const B = { type: 'bold' };
const I = { type: 'italic' };
const br = (syntax, marks) => ({ type: 'hardBreak', attrs: { syntax }, ...(marks ? { marks } : {}) });

describe('parseInline : marks', () => {
	it('gras et italique', () => {
		expect(inl('a {{b}} {c}')).toEqual([text('a '), text('b', [B]), text(' '), text('c', [I])]);
	});

	it('imbrication', () => {
		expect(inl('{{a {b}}}')).toEqual([raw('{{'), text('a '), raw('{'), text('b'), raw('}}}')]);
		expect(inl('{{a <i>b</i>}}')).toEqual([text('a ', [B]), text('b', [B, I])]);
	});

	it('balises HTML équivalentes sans attribut', () => {
		expect(inl('<strong>a</strong><del>b</del><sup>c</sup><sub>d</sub>')).toEqual([
			text('a', [B]), text('b', [{ type: 'strike' }]), text('c', [{ type: 'superscript' }]), text('d', [{ type: 'subscript' }]),
		]);
	});

	it('marks mal imbriquées : tous les délimiteurs restent bruts', () => {
		expect(inl('{a {{b} c}}')).toEqual([raw('{'), text('a '), raw('{{'), text('b'), raw('}'), text(' c'), raw('}}')]);
	});

	it('accolades orphelines, vides ou triples : brutes', () => {
		expect(inl('a} {} {{}} {{{x')).toEqual([text('a'), raw('}'), text(' '), raw('{}'), text(' '), raw('{{}}'), text(' '), raw('{{{'), text('x')]);
	});
});

describe('parseInline : lignes', () => {
	it('retour à la ligne simple = saut autobr ; \\n_ = saut manuel', () => {
		expect(inl('a\nb\n_ c')).toEqual([text('a'), br('autobr'), text('b'), br('manual'), text('c')]);
	});

	it('les marks restent ouvertes à travers un saut de ligne', () => {
		expect(inl('{{a\nb}}')).toEqual([text('a', [B]), br('autobr', [B]), text('b', [B])]);
	});

	it('marqueurs de début de ligne non gérés : bruts', () => {
		expect(inl('a\n- puce\n-- alinéa\n---- filet', { lineStart: true }))
			.toEqual([text('a'), br('autobr'), raw('- '), text('puce'), br('autobr'), raw('-- '), text('alinéa'), br('autobr'), raw('----'), text(' filet')]);
		expect(inl('_ début', { lineStart: true })).toEqual([raw('_ '), text('début')]);
		expect(inl('- pas en début de ligne')).toEqual([text('- pas en début de ligne')]);
	});
});

describe('parseInline : caractères', () => {
	it('échappements, entités et espace insécable', () => {
		expect(inl('\\{a\\} &lt;b&gt; &amp; &#91;x &#63; ~fin &eacute;'))
			.toEqual([text('{a} <b> & [x ?  fin '), raw('&eacute;')]);
	});

	it('balises HTML inconnues et commentaires : bruts', () => {
		expect(inl('<span class="x">a</span><!-- c -->')).toEqual([raw('<span class="x">'), text('a'), raw('</span>'), raw('<!-- c -->')]);
	});

	it('code : backticks et <code> sur une ligne', () => {
		const C = { type: 'code' };
		expect(inl('`a {b}` et <code>c</code>')).toEqual([text('a {b}', [C]), text(' et '), text('c', [C])]);
	});

	it('notes, glossaire, multi : bruts jusqu\'aux lots L3 et L4', () => {
		expect(inl('voir [[note]] [?terme] <multi>a</multi>')).toEqual([text('voir '), raw('[[note]]'), text(' '), raw('[?terme]'), text(' '), raw('<multi>a</multi>')]);
	});
});
