import { describe, expect, it } from 'vitest';
import { protect } from '../../src/spip/protect.js';
import { segment } from '../../src/spip/segment.js';

const cut = (source) => {
	const { lead, trail, segments } = segment(source, protect(source).masked);
	return { lead, trail, parts: segments.map((s) => [s.sep, source.slice(s.start, s.end)]) };
};
const rebuild = (source) => {
	const { lead, trail, parts } = cut(source);
	return lead + parts.map(([sep, src]) => sep + src).join('') + trail;
};

describe('segment', () => {
	it.each([
		'', ' ', '\n\n  \n', 'a', 'a\n\nb', '\n\na  \n\n\n\nb\n', 'a\r\n\r\nb', '<quote>\nx\n\ny\n</quote>\n\nz',
	])('ne perd aucun caractère : %j', (source) => {
		expect(rebuild(source)).toBe(source);
	});

	it('coupe sur les lignes vides et garde les séparateurs exacts', () => {
		expect(cut('\n\na\n\n\nb  \n\n')).toEqual({ lead: '\n\n', trail: '\n\n', parts: [['', 'a'], ['\n\n\n', 'b  ']] });
	});

	it('un texte vide ou blanc n\'a aucun segment', () => {
		expect(cut('  \n ')).toEqual({ lead: '  \n ', trail: '', parts: [] });
	});

	it('ne coupe pas à l\'intérieur d\'une note ou d\'un bloc protégé', () => {
		expect(cut('a[[x\n\ny]]\n\n<code>\n\n</code>').parts.map((p) => p[1])).toEqual(['a[[x\n\ny]]', '<code>\n\n</code>']);
	});

	it('recolle les conteneurs <quote>, <poesie>, <div class="text-…">', () => {
		expect(cut('<quote>\na\n\nb\n</quote>\n\n<div class="text-center">\n\nc\n\n</div>').parts.map((p) => p[1]))
			.toEqual(['<quote>\na\n\nb\n</quote>', '<div class="text-center">\n\nc\n\n</div>']);
	});

	it('laisse un conteneur jamais fermé découpé normalement', () => {
		expect(cut('<quote>\na\n\nb').parts.map((p) => p[1])).toEqual(['<quote>\na', 'b']);
	});
});
