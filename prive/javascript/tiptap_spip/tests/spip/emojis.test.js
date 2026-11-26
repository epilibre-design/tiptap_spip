// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEditor } from '../../src/editor/createEditor.js';
import { parse, serialize, canon } from '../../src/spip/index.js';

const corpus = readFileSync('../../../tests/corpus/emojis.spip', 'utf8');
const exemples = ['[a 😄 b]', '[?a 😄 b]', '[ABBR 😄|explication]', '`code 👍🏽`', '<code>code ❤️</code>',
	'Texte[[ Une note ❤️ {{😄}}. ]]', 'Texte <multi>[fr]cœur ❤️[en]heart ❤️</multi>', '😄 👍🏽 👩‍💻 🇫🇷 ❤️ ❤︎'];
let editor;
afterEach(() => { editor?.destroy(); editor = null; document.body.replaceChildren(); });
const monter = (source) => {
	const element = document.createElement('div'); document.body.append(element); editor = createEditor({ element, source }); return editor;
};
const types = (valeur) => !valeur || typeof valeur !== 'object' ? [] : [valeur.type, ...Object.values(valeur).flatMap(types)].filter(Boolean);
const contenus = (valeur) => !valeur || typeof valeur !== 'object' ? [] : [
	...(['spipNote', 'spipMultiInline'].includes(valeur.type) ? [valeur.attrs] : []),
	...Object.values(valeur).flatMap(contenus),
];

describe('conservation Unicode sans nœud emoji', () => {
	it.each(exemples)('source intacte et relecture canonique stable : %s', (source) => {
		const doc = parse(source); expect(serialize(doc)).toBe(source);
		const texte = serialize(doc, { conservative: false });
		expect(serialize(parse(texte), { conservative: false })).toBe(texte);
		expect(canon(parse(texte))).toBe(canon(doc));
		expect(types(doc).some((t) => /emoji/i.test(t))).toBe(false);
	});
	it.each(exemples)('une édition voisine conserve marks, crochets et empreintes internes : %s', (exemple) => {
		const initial = `${exemple} voisin`;
		monter(initial); const avant = structuredClone(contenus(editor.getJSON()));
		editor.view.dispatch(editor.state.tr.insertText('x', editor.state.doc.content.size - 1));
		// Une modification du même paragraphe réécrit le code en ligne dans sa forme canonique existante.
		const attendu = exemple.startsWith('<code>') ? `${serialize(parse(initial), { conservative: false })}x` : `${initial}x`;
		expect(serialize(editor.getJSON())).toBe(attendu);
		expect(contenus(editor.getJSON())).toEqual(avant);
		expect(types(editor.getJSON()).some((t) => /emoji/i.test(t))).toBe(false);
	});
	it('le corpus garde exactement caractères, sélecteurs de variation et ZWJ', () => {
		monter(corpus); expect(serialize(editor.getJSON())).toBe(corpus);
		expect(corpus).toContain('❤️'); expect(corpus).toContain('❤︎'); expect(corpus).toContain('👩‍💻');
	});
});

it('un autre paragraphe modifié ne réécrit pas la forme HTML du code intact', () => {
	monter('<code>code ❤️</code>\n\nvoisin');
	editor.view.dispatch(editor.state.tr.insertText('x', editor.state.doc.content.size - 1));
	expect(serialize(editor.getJSON())).toBe('<code>code ❤️</code>\n\nvoisinx');
});
