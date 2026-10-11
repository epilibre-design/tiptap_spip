import { describe, expect, it } from 'vitest';
import { canon, mergeText, raw, sortMarks, text } from '../../src/spip/json.js';

describe('mergeText', () => {
	it('fusionne les textes adjacents de mêmes marks et supprime les textes vides', () => {
		const b = [{ type: 'bold' }];
		expect(mergeText([text('a', b), text('', b), text('b', b), text('c'), raw('{')]))
			.toEqual([text('ab', b), text('c'), raw('{')]);
	});
});

describe('sortMarks', () => {
	it('range les marks dans l\'ordre canonique, code en dernier', () => {
		expect(sortMarks([{ type: 'code' }, { type: 'italic' }, { type: 'bold' }]).map((m) => m.type))
			.toEqual(['bold', 'italic', 'code']);
	});
});

describe('canon', () => {
	it('ignore les attributs techniques, les attributs nuls et l\'ordre des clés', () => {
		const a = { type: 'paragraph', attrs: { spipSrc: 'x', spipGroup: 1 }, content: [text('a')] };
		const b = { content: [{ text: 'a', type: 'text' }], type: 'paragraph', attrs: { language: null } };
		expect(canon(a)).toBe(canon(b));
	});

	it('distingue des contenus différents', () => {
		expect(canon([text('a')])).not.toBe(canon([text('a', [{ type: 'bold' }])]));
	});
});
