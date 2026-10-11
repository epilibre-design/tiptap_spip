// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { previewFragment } from '../../src/ui/sanitize.js';

const html = (fragment) => {
	const div = document.createElement('div');
	div.append(fragment);
	return div.innerHTML;
};

describe('previewFragment', () => {
	it('garde le rendu du modèle', () => {
		expect(html(previewFragment('<div class="spip_document"><img src="IMG/a.png" alt="A"></div>')))
			.toBe('<div class="spip_document"><img src="IMG/a.png" alt="A"></div>');
	});

	it('retire scripts, styles, gestionnaires d\'événements et URL javascript:', () => {
		const out = html(previewFragment('<p onclick="x()">a<script>alert(1)</script><style>p{}</style><a href="javascript:alert(1)" onmouseover="y()">b</a><img src="x" onerror="z()"></p>'));
		expect(out).not.toMatch(/script|style|onclick|onmouseover|onerror|javascript:/i);
		expect(out).toContain('a');
		expect(out).toContain('b');
	});

	it('éléments interactifs hors du clavier et inactifs, iframes en bac à sable', () => {
		const div = document.createElement('div');
		div.append(previewFragment('<a href="spip.php?article1">l</a><button>b</button><input><iframe src="https://video.example/1"></iframe>'));
		for (const el of div.querySelectorAll('a, button, input, iframe')) expect(el.tabIndex).toBe(-1);
		expect(div.querySelector('button').disabled).toBe(true);
		expect(div.querySelector('input').disabled).toBe(true);
		expect(div.querySelector('iframe').getAttribute('sandbox')).toBe('');
	});
});
