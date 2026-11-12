import { afterEach, describe, expect, it } from 'vitest';
import { parseContent } from '../../src/spip/blocks.js';
import { node, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { serialize, serializeBlock } from '../../src/spip/serialize.js';

const h = (level, ...content) => node('heading', { level }, content);
const I = { type: 'italic' };
const types = (source) => parseContent(source).map((b) => b.type);

// tables de tiptap_spip_intertitres() : défauts des deux plugins
const TYPOENLUMINEE = { 1: 3, 2: 4, 3: 5, 4: 6, 5: null };
const INTERTITRES = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
const site = (intertitres) => {
	globalThis.spipConfig = { tiptap_spip: { intertitres } };
};

afterEach(() => {
	delete globalThis.spipConfig;
});

describe('intertitres du core', () => {
	it('{{{…}}} est un h2, les étoiles sont du texte', () => {
		expect(parseContent('{{{Titre}}}')).toEqual([h(2, text('Titre'))]);
		expect(parseContent('{{{**Titre}}}')).toEqual([h(2, text('**Titre'))]);
		expect(types('<h2>Titre</h2>')).not.toContain('heading');
	});

	it('niveau 2 en raccourci, les suivants en HTML', () => {
		expect(serializeBlock(h(2, text('T')))).toBe('{{{T}}}');
		expect(serializeBlock(h(3, text('T')))).toBe('<h3>T</h3>');
	});
});

describe('Enluminures typographiques', () => {
	it('chaque nombre d’étoiles donne le niveau rendu', () => {
		site(TYPOENLUMINEE);
		expect(parseContent('{{{Partie}}}\n\n{{{*Partie}}}\n\n{{{**Sous {i}}}}\n\n{{{***A}}}\n\n{{{****B}}}')).toEqual([
			h(3, text('Partie')), h(3, text('Partie')), h(4, text('Sous '), text('i', [I])), h(5, text('A')), h(6, text('B')),
		]);
	});

	it('un rendu qui n’est pas un titre reste brut : cinq étoiles (strong), six ou plus', () => {
		site(TYPOENLUMINEE);
		expect(types('{{{*****Gras}}}')).toEqual(['spipRaw']);
		expect(types('{{{******Gras}}}')).toEqual(['spipRaw']);
		site({ ...TYPOENLUMINEE, 2: null });
		expect(types('{{{**Titre}}}')).toEqual(['spipRaw']);
	});

	it('écrit chaque niveau avec ses étoiles, {{{…}}} pour le premier', () => {
		site(TYPOENLUMINEE);
		expect(serializeBlock(h(3, text('T')))).toBe('{{{T}}}');
		expect(serializeBlock(h(4, text('T '), text('i', [I])))).toBe('{{{**T <i>i</i>}}}');
		expect(serializeBlock(h(6, text('T')))).toBe('{{{****T}}}');
	});

	it('niveau sans raccourci : en HTML, relu au même niveau', () => {
		site(TYPOENLUMINEE);
		expect(serializeBlock(h(2, text('T')))).toBe('<h2>T</h2>');
		expect(parseContent('<h2>T</h2>')).toEqual([h(2, text('T'))]);
	});

	it('contenu que les étoiles happeraient : en HTML', () => {
		site(TYPOENLUMINEE);
		expect(serializeBlock(h(3, text('*T')))).toBe('<h3>*T</h3>');
		expect(serializeBlock(h(4, text(' T')))).toBe('<h4> T</h4>');
		expect(serializeBlock(h(4, text('#1')))).toBe('<h4>#1</h4>');
		for (const doc of [h(3, text('*T')), h(4, text('**T'))]) {
			const source = serialize(node('doc', null, [doc]), { conservative: false });
			expect(parse(source).content.map(({ type, attrs, content }) => ({ type, level: attrs.level, content }))).toEqual([
				{ type: 'heading', level: doc.attrs.level, content: doc.content },
			]);
		}
	});

	it('source d’un intertitre non modifié conservée', () => {
		site(TYPOENLUMINEE);
		const source = '{{{* Partie}}}\n\n<h4>Sous</h4>';
		expect(serialize(parse(source))).toBe(source);
	});
});

describe('Intertitres hiérarchiques', () => {
	it('niveau de départ plus une étoile par niveau, blancs après les étoiles ignorés', () => {
		site(INTERTITRES);
		expect(parseContent('{{{Partie}}}\n\n{{{** Sous}}}\n\n{{{*****Fin}}}')).toEqual([h(2, text('Partie')), h(3, text('Sous')), h(6, text('Fin'))]);
		expect(serializeBlock(h(5, text('T')))).toBe('{{{****T}}}');
	});

	it('titre numéroté ({{{#…}}}) : brut', () => {
		site(INTERTITRES);
		expect(types('{{{# Partie}}}')).toEqual(['spipRaw']);
		expect(types('{{{**# Partie}}}')).toEqual(['spipRaw']);
	});
});
