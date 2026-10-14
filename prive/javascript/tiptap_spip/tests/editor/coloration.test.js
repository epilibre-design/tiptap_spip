// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { serialize } from '../../src/spip/index.js';

/** highlight.js de Coloration Code, réduit : variables `$x` et mots-clés `function`, HTML échappé. */
const fauxHljs = (grammaires) => ({
	getLanguage: (l) => (grammaires.has(l) ? {} : undefined),
	highlight: (code) => ({
		value: code.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/\$\w+/g, (m) => `<span class="hljs-variable">${m}</span>`)
			.replace(/\bfunction\b/g, '<span class="hljs-keyword">function</span>'),
	}),
});

let editor;
const monter = (source) => {
	document.body.innerHTML = '<div></div>';
	editor = createEditor({ element: document.body.firstChild, source });
	return editor;
};
const pres = () => [...document.querySelectorAll('pre')];
const spans = (pre) => [...pre.querySelectorAll('span[class^=hljs]')].map((s) => `${s.className}:${s.textContent}`);
/** Frappe au curseur, en passant par les règles de saisie. */
const taper = (texte) => {
	for (const c of texte) {
		const { from, to } = editor.state.selection;
		const gere = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, c, () => editor.state.tr.insertText(c, from, to)));
		if (!gere) editor.view.dispatch(editor.state.tr.insertText(c, from, to));
	}
};

beforeEach(() => {
	globalThis.spipConfig = { tiptap_spip: { coloration_code: true }, coloration_code: { assets: '/cc/assets/' } };
	globalThis.hljs = fauxHljs(new Set(['php', 'css']));
});
afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
	document.head.innerHTML = '';
	delete globalThis.spipConfig;
	delete globalThis.hljs;
});

describe('coloration syntaxique avec Coloration Code', () => {
	it('bloc ```php : spans highlight.js, thème (hljs) et étiquette, source inchangée', () => {
		const src = '```php\nfunction f($x) { return $x; }\n```';
		monter(src);
		const [pre] = pres();
		expect(pre.classList.contains('hljs')).toBe(true);
		expect(pre.getAttribute('data-language')).toBe('php');
		expect(spans(pre)).toEqual(['hljs-keyword:function', 'hljs-variable:$x', 'hljs-variable:$x']);
		expect(serialize(editor.getJSON())).toBe(src);
	});

	it('recoloré pendant la saisie', () => {
		monter('```php\n$a\n```');
		editor.commands.setTextSelection(editor.state.doc.content.size - 1);
		taper(' = $b');
		expect(spans(pres()[0])).toEqual(['hljs-variable:$a', 'hljs-variable:$b']);
	});

	it('```php puis espace dans un paragraphe : bloc coloré dès la frappe', () => {
		monter('');
		taper('```php ');
		taper('$total');
		expect(spans(pres()[0])).toEqual(['hljs-variable:$total']);
	});

	it('<code class="css"> : langage lu dans la balise, étiquette comme Coloration Code', () => {
		monter('<code class="css">\na { b: $c; }\n</code>');
		const [pre] = pres();
		expect(pre.getAttribute('data-language')).toBe('css');
		expect(spans(pre)).toEqual(['hljs-variable:$c']);
	});

	it('sans langage : étiquette plaintext, pas de coloration', () => {
		monter('<code>\n$brut\n</code>');
		const [pre] = pres();
		expect(pre.getAttribute('data-language')).toBe('plaintext');
		expect(pre.classList.contains('hljs')).toBe(false);
		expect(spans(pre)).toEqual([]);
	});

	it('grammaire absente : chargée depuis Coloration Code (alias js → javascript), puis coloré', async () => {
		const grammaires = new Set(['php']);
		globalThis.hljs = fauxHljs(grammaires);
		monter('```js\nlet $v;\n```');
		const script = document.head.querySelector('script');
		expect(script.getAttribute('src')).toBe('/cc/assets/highlightjs/languages/javascript.min.js');
		expect(spans(pres()[0])).toEqual([]);
		grammaires.add('js');
		script.dispatchEvent(new Event('load'));
		await new Promise((r) => setTimeout(r));
		expect(spans(pres()[0])).toEqual(['hljs-variable:$v']);
	});

	it('grammaire introuvable : bloc laissé sans coloration, sans erreur', async () => {
		monter('```inconnu\n$v\n```');
		document.head.querySelector('script').dispatchEvent(new Event('error'));
		await new Promise((r) => setTimeout(r));
		expect(spans(pres()[0])).toEqual([]);
	});
});

describe('sans Coloration Code', () => {
	it('plugin inactif : ni coloration ni étiquette plaintext', () => {
		globalThis.spipConfig.tiptap_spip.coloration_code = false;
		monter('```php\n$x\n```\n\n<code>\nbrut\n</code>');
		const [php, brut] = pres();
		expect(php.getAttribute('data-language')).toBe('php');
		expect(php.classList.contains('hljs')).toBe(false);
		expect(spans(php)).toEqual([]);
		expect(brut.hasAttribute('data-language')).toBe(false);
	});

	it('plugin actif mais highlight.js absent de la page : rien', () => {
		delete globalThis.hljs;
		monter('```php\n$x\n```');
		expect(spans(pres()[0])).toEqual([]);
	});
});
