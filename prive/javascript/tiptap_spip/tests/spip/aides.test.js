import { describe, expect, it } from 'vitest';
import { aides } from '../../src/spip/aides.js';

describe('aides.lignes', () => {
	it.each([
		['vide', '', ['']],
		['lignes vides gardées', 'a\n\nb\n', ['a', '', 'b', '']],
		['CRLF : \\r gardé', 'a\r\nb', ['a\r', 'b']],
		['code', 'x\n<code>\n? p\n</code>\ny', ['x', '<code>\n? p\n</code>', 'y']],
		['backticks', '```\n? p\n```\nb', ['```\n? p\n```', 'b']],
		['note', 'R[[n\n? x]]\nf', ['R[[n\n? x]]', 'f']],
		['modèle', 'R <emb1|titre=a\n? b>\nf', ['R <emb1|titre=a\n? b>', 'f']],
		['lien : coupé', '[l\n? s->http://a.b]', ['[l', '? s->http://a.b]']],
		['multi : coupé', '<multi>[fr]a\n? b</multi>', ['<multi>[fr]a', '? b</multi>']],
	])('%s', (_, source, attendu) => {
		expect(aides.lignes(source)).toEqual(attendu);
		expect(aides.lignes(source).join('\n')).toBe(source);
	});
});
