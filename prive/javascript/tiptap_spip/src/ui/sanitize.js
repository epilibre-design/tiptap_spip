/**
 * HTML d'une prévisualisation de modèle → fragment inerte, à afficher dans l'éditeur.
 * Le serveur l'a déjà passé par safehtml() ; ceci est une défense en profondeur : rien de ce qui
 * est affiché ne doit s'exécuter, ni prendre le focus, ni naviguer.
 */

const RETIRES = 'script, style, link, meta, base, object, embed, form';
const INTERACTIFS = 'a, area, button, input, select, textarea, iframe, video, audio, [tabindex], [contenteditable]';

/** @returns {DocumentFragment} */
export function previewFragment(html) {
	const template = document.createElement('template');
	template.innerHTML = String(html);
	const root = template.content;
	root.querySelectorAll(RETIRES).forEach((el) => el.remove());
	for (const el of root.querySelectorAll('*')) {
		for (const { name, value } of [...el.attributes]) {
			if (/^on/i.test(name) || /^\s*(javascript|vbscript|data):/i.test(value) && /^(href|src|action|formaction|xlink:href)$/i.test(name)) {
				el.removeAttribute(name);
			}
		}
	}
	// un lien ne doit mener nulle part : sans href, un clic (ou Ctrl+clic, clic du milieu) n'a rien à
	// suivre ; la cible reste dans data-tts-href pour l'affichage
	for (const el of root.querySelectorAll('a, area')) {
		const href = el.getAttribute('href') ?? el.getAttribute('xlink:href');
		if (href !== null) el.dataset.ttsHref = href;
		for (const name of ['href', 'xlink:href', 'target', 'ping', 'download']) el.removeAttribute(name);
	}
	for (const el of root.querySelectorAll(INTERACTIFS)) {
		el.tabIndex = -1;
		if ('disabled' in el) el.disabled = true;
		if (el.isContentEditable || el.hasAttribute('contenteditable')) el.setAttribute('contenteditable', 'false');
	}
	root.querySelectorAll('iframe').forEach((el) => el.setAttribute('sandbox', ''));
	return root;
}
