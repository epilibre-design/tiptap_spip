// Outils des tests de l'interface (jsdom) : éditeur monté comme par main.js, services simulés,
// saisie dans les popovers.
import { vi } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { serialize } from '../../src/spip/index.js';
import { creerInterface } from '../../src/ui/interface.js';
import { Popover } from '../../src/ui/popover.js';

export const tick = () => new Promise((r) => setTimeout(r, 0));

// jsdom n'a pas de géométrie : ProseMirror en a besoin pour faire défiler jusqu'à la sélection
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
for (const proto of [Range.prototype, Text.prototype]) {
	proto.getClientRects ??= () => [];
	proto.getBoundingClientRect ??= rect;
}

/** Services simulés : réponses par opération. */
export const fakeServices = (reponses = {}) => ({
	available: true,
	call: vi.fn(async (operation, params) => {
		const r = reponses[operation];
		if (r instanceof Error) throw r;
		return typeof r === 'function' ? r(params) : r;
	}),
});

/** Éditeur et conteneur du test en cours (liaisons vivantes). */
export let editor = null;
export let wrapper = null;

/**
 * Éditeur monté comme par main.js, avec ou sans services, avec ou sans extensions tierces, avec ou
 * sans catalogue des modèles ({ url, modeles }).
 */
export const monter = (source, services = null, { tierces = [], catalogue = null } = {}) => {
	document.body.innerHTML = '<div class="tts-editor"><div class="tts-content"></div></div>';
	wrapper = document.querySelector('.tts-editor');
	const ui = creerInterface({ editor: () => editor, wrapper, services, catalogue });
	editor = createEditor({ element: wrapper.querySelector('.tts-content'), source, ui, tierces });
	return { editor, ui };
};

/** À appeler dans afterEach. */
export const demonter = () => {
	Popover.current?.close({ refocus: false });
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
};

export const source = () => serialize(editor.getJSON(), { regles: editor.tiptapSpip.regles });
/** Champ d'un popover : le dernier ouvert (popovers imbriqués). */
export const champ = (name) => [...wrapper.querySelectorAll(`.tts-popover [name=${name}]`)].pop();
export const remplir = (name, value) => {
	const input = champ(name);
	if (input.type === 'checkbox') {
		input.checked = value;
		input.dispatchEvent(new Event('change'));
	} else {
		input.value = value;
	}
	input.dispatchEvent(new Event('input'));
};
export const popovers = () => [...wrapper.querySelectorAll('.tts-popover')];
export const valider = () => popovers().pop().requestSubmit();
export const cliquer = (name) => champ(name).click();
export const erreur = () => popovers().pop().querySelector('.tts-popover__erreur');
/** Position juste après la première occurrence de `texte` dans le document. */
export const apres = (texte) => {
	let pos = null;
	editor.state.doc.descendants((node, p) => {
		if (pos === null && node.isText && node.text.includes(texte)) pos = p + node.text.indexOf(texte) + texte.length;
	});
	return pos;
};
/** Position de la n-ième note du document. */
export const notePos = (n = 0) => {
	const positions = [];
	editor.state.doc.descendants((node, p) => {
		if (node.type.name === 'spipNote') positions.push(p);
	});
	return positions[n];
};
