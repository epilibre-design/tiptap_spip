import { describe, expect, it } from 'vitest';
import { node, raw, stripTech, text } from '../../src/spip/json.js';
import { parseNote } from '../../src/spip/notes.js';
import { parse } from '../../src/spip/parse.js';
import { protect } from '../../src/spip/protect.js';
import { serialize } from '../../src/spip/serialize.js';

const inline = (source) => stripTech(parse(source).content[0].content);
const canonical = (source) => serialize(parse(source), { conservative: false });
const p = (...content) => node('paragraph', null, content.length ? content : undefined);
const note = (content, name) => node('spipNote', name === undefined ? { content } : { name, content });
const link = (href) => ({ type: 'spipLink', attrs: { href, newWindow: false } });

describe('parseNote (traiter_raccourci_notes du core)', () => {
	it('automatique, nommée, sans appel', () => {
		expect(parseNote('[[Une note.]]')).toMatchObject({ name: null });
		expect(parseNote('[[<A>Nommée]]')).toMatchObject({ name: 'A' });
		expect(parseNote('[[<>Sans appel]]')).toMatchObject({ name: '' });
		expect(parseNote('[[ <B>x]]')).toMatchObject({ name: 'B' });
	});

	it('une balise HTML en tête n\'est pas un nom si sa fermante suit', () => {
		expect(parseNote('[[<i>x</i> y]]')).toMatchObject({ name: null });
		expect(parseNote('[[<i>x]]')).toMatchObject({ name: 'i' });
		expect(parseNote('[[<i>a <i>b</i>]]')).toMatchObject({ name: 'i' });
	});

	it('un modèle, un lien ou un glossaire en tête ne sont pas un nom (traités avant les notes)', () => {
		const { masked } = protect('[[<doc1>]]').regions[0].data;
		expect(parseNote('[[<doc1>]]', masked)).toMatchObject({ name: null });
		expect(parseNote('[[<doc1>]]', masked).content[0].type).toBe('spipModelBlock');
		expect(inline('x[[<doc1|left>]]')[1]).toMatchObject({ type: 'spipNote', attrs: { content: [{ type: 'spipModelBlock' }] } });
		expect(inline('x[[<doc1|left>]]')[1].attrs.name).toBeUndefined();
	});

	it('nom à caractères spéciaux et fermante présente (regex PHP non échappée) : non représentable', () => {
		expect(parseNote('[[<a.b>x</a.b>]]')).toBeNull();
		expect(parseNote('[[<a.b>x]]')).toMatchObject({ name: 'a.b' });
	});

	it('contenu : paragraphes, listes, modèle seul ; autres blocs non représentables', () => {
		expect(stripTech(parseNote('[[Premier.\n\nSecond.]]').content)).toEqual([p(text('Premier.')), p(text('Second.'))]);
		expect(parseNote('[[-* a\n-* b]]').content[0].type).toBe('bulletList');
		expect(parseNote('[[Voir\n\n<doc1>]]').content[1].type).toBe('spipModelBlock');
		expect(parseNote('[[{{{titre}}}]]')).toBeNull();
	});
});

describe('notes', () => {
	it('appel collé ou non, contenu analysé', () => {
		expect(inline('Texte[[Une note.]] suite')).toEqual([text('Texte'), note([p(text('Une note.'))]), text(' suite')]);
		expect(inline('Voir [[<A>a]] et [[<>b]]')).toEqual([text('Voir '), note([p(text('a'))], 'A'), text(' et '), note([p(text('b'))], '')]);
		expect(inline('x [[Voir [la doc->art1], {{gras}} et [?SPIP].]]')[1]).toEqual(note([p(
			text('Voir '), text('la doc', [link('art1')]), text(', '), text('gras', [{ type: 'bold' }]), text(' et '),
			text('SPIP', [{ type: 'spipGlossary' }]), text('.'),
		)]));
	});

	it('\\ final du texte d\'une note : invisible au rendu (il précède </div>), gardé hors du contenu', () => {
		expect(inline('a [[x\\]] b')[1]).toEqual(note([p(text('x'))]));
		expect(serialize(parse('a [[x\\]] b'))).toBe('a [[x\\]] b');
		expect(canonical('a [[x\\]] b')).toBe('a [[x]] b');
		// \\\\ est un \\ échappé, qui reste
		expect(inline('a [[x\\\\]] b')[1]).toEqual(note([p(text('x\\'))]));
		expect(serialize(parse('a [[x\\ ]] b'))).toBe('a [[x\\ ]] b');
		expect(canonical('a [[x\\ ]] b')).toBe('a [[x]] b');
	});

	it('note vide, nommée vide', () => {
		expect(inline('x[[]]')).toEqual([text('x'), note([p()])]);
		expect(inline('x[[<A>]]')).toEqual([text('x'), note([p()], 'A')]);
	});

	it('[[note->art1]] : un lien entre crochets', () => {
		expect(inline('[[note->art1]]')).toEqual([text('['), text('note', [link('art1')]), text(']')]);
	});

	it('non représentable : brut', () => {
		expect(inline('x[[{{{titre}}}]]')).toEqual([text('x'), raw('[[{{{titre}}}]]')]);
	});

	it('\\] dans une note', () => {
		expect(inline('x[[a\\]b]]')).toEqual([text('x'), note([p(text('a]b'))])]);
		expect(inline('x[[a\\]]')).toEqual([text('x'), note([p(text('a'))])]);
		expect(serialize(parse('x[[a\\]b]]'))).toBe('x[[a\\]b]]');
		// un ] isolé n'a pas besoin d'être échappé
		expect(canonical('x[[a\\]b]]')).toBe('x[[a]b]]');
	});
});

describe('sérialisation des notes', () => {
	it('identité et forme canonique', () => {
		for (const source of ['Texte[[Une note.]]', 'Voir[[<A>a]] et[[<>b]]', 'x[[Premier.\n\nSecond.]]', 'x[[-* a\n-* b]]', 'x[[<doc1|left>]]', 'x[[Voir\n\n<doc1>]]', 'x[[]]']) {
			expect(serialize(parse(source))).toBe(source);
			expect(canonical(source)).toBe(source);
		}
	});

	it('paragraphe modifié : le contenu non modifié de la note est restitué à l\'identique', () => {
		const doc = parse('Avant[[ Premier.\n\n\nSecond.]]');
		doc.content[0].content[0].text = 'Après';
		expect(serialize(doc)).toBe('Après[[ Premier.\n\n\nSecond.]]');
	});

	it('forme canonique : blancs de tête et de fin du contenu retirés (SPIP les retire)', () => {
		expect(canonical('x[[\nTexte\n]]')).toBe('x[[Texte]]');
	});

	it('] en fin de texte ou suivi de ] dans une note : &#93; (\\] ne la protège pas)', () => {
		const doc = node('doc', null, [p(text('x'), note([p(text('a]] b] c]'))]))]);
		expect(serialize(doc)).toBe('x[[a&#93;] b] c&#93;]]');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('[ juste avant une note : entité (\\[[[n]] serait une note de texte [n)', () => {
		const doc = node('doc', null, [p(text('x ['), note([p(text('n'))]))]);
		expect(serialize(doc)).toBe('x &#91;[[n]]');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('note automatique dont le texte commence par <…> : &lt; (SPIP y lirait un nom)', () => {
		for (const debut of ['<>x', '<1> y', '< a >']) {
			const doc = node('doc', null, [p(text('x'), note([p(text(debut))]))]);
			expect(serialize(doc)).toBe(`x[[${debut.replace('<', '&lt;')}]]`);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
		// fermante présente : pas un nom, la balise reste
		const balise = node('doc', null, [p(text('x'), note([p(raw('<span>'), text('a'), raw('</span>'))]))]);
		expect(serialize(balise)).toBe('x[[<span>a</span>]]');
		// note nommée : le nom passe avant
		expect(serialize(node('doc', null, [p(text('x'), note([p(text('<>a'))], 'n'))]))).toBe('x[[<n><>a]]');
	});

	it('-> avant tout crochet ou ? en tête du texte d\'une note : entité (lien ou glossaire entre crochets)', () => {
		const cas = [
			[note([p(text('a -> b'))]), 'x[[a -&gt; b]]'],
			[note([p(text('a -> b'))], 'n'), 'x[[<n>a -&gt; b]]'],
			[note([p(text('<-> z'))]), 'x[[<-&gt; z]]'],
			[note([p(text('a -> b -> c'))]), 'x[[a -&gt; b -&gt; c]]'],
			// <-] : le [ du [[ ferait une ancre [<-] (ancres avant notes)
			[note([p(text('a<-] b'))], 'n'), 'x[[<n>a&lt;-] b]]'],
			// ? en tête : [[? serait un glossaire [?…] (glossaire avant notes)
			[note([p(text('?[[note'))]), 'x[[&#63;&#91;&#91;note]]'],
			// lien de la note : pas touché
			[note([p(text('voir', [link('art1')]))]), 'x[[[voir->art1]]]'],
		];
		for (const [n, attendu] of cas) {
			const doc = node('doc', null, [p(text('x'), n)]);
			expect(serialize(doc)).toBe(attendu);
			expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
		}
	});

	it('contenu qui finit par une abréviation : saut de ligne avant ]] (]]] fermerait la note trop tôt)', () => {
		const abbr = { type: 'spipAbbr', attrs: { title: 'explication' } };
		const doc = node('doc', null, [p(note([p(text('a', [abbr]))]), text('x'))]);
		expect(serialize(doc)).toBe('[[[a|explication]\n]]x');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('] en tête d\'un texte qui suit un ] (abréviation) dans une note : &#93; (]] la fermerait)', () => {
		const abbr = { type: 'spipAbbr', attrs: { title: 'explication' } };
		const doc = node('doc', null, [p(note([p(text('a', [abbr]), text(']aa'))]))]);
		expect(serialize(doc)).toBe('[[[a|explication]&#93;aa]]');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('-> dans du code d\'une note : intact (le code est protégé avant les liens)', () => {
		const abbr = { type: 'spipAbbr', attrs: { title: 'explication' } };
		const doc = node('doc', null, [p(note([p(text('->', [{ type: 'code' }]), text('a', [abbr]))]))]);
		expect(serialize(doc)).toBe('[[`->`[a|explication]\n]]');
		expect(stripTech(parse(serialize(doc)).content)).toEqual(doc.content);
	});

	it('contenu fait seulement d\'espaces : relu vide (forme normale, SPIP n\'en affiche rien)', () => {
		const doc = node('doc', null, [p(text('x'), note([p(text(' '))]))]);
		expect(serialize(doc)).toBe('x[[ ]]');
		expect(stripTech(parse(serialize(doc)).content)).toEqual([p(text('x'), note([p()]))]);
	});

	it('note saisie sans contenu', () => {
		expect(serialize(node('doc', null, [p(text('x'), node('spipNote', { name: null, content: null }))]))).toBe('x[[]]');
	});
});
