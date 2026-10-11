// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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

	it('un lien de la prévisualisation ne mène nulle part : pas de href, cible gardée pour l\'affichage', () => {
		const div = document.createElement('div');
		div.append(previewFragment('<a href="spip.php?article1" target="_blank">l</a><svg><a href="#x" xlink:href="#y"><text>t</text></a></svg><map><area href="spip.php?article2"></map>'));
		document.body.append(div);
		const a = div.querySelector('a');
		expect(a.hasAttribute('href')).toBe(false);
		expect(a.hasAttribute('target')).toBe(false);
		expect(a.dataset.ttsHref).toBe('spip.php?article1');
		expect(div.querySelector('svg a').hasAttribute('href')).toBe(false);
		expect(div.querySelector('svg a').hasAttribute('xlink:href')).toBe(false);
		expect(div.querySelector('area').hasAttribute('href')).toBe(false);
		// un clic n'a rien à suivre : jsdom ne signale aucune navigation
		const navigation = vi.fn();
		window.addEventListener('beforeunload', navigation);
		a.click();
		expect(navigation).not.toHaveBeenCalled();
		div.remove();
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
