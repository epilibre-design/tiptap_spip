/** Contextes par éditeur ; l'objet tiptapSpip est partagé avec les sous-éditeurs. */
const contextes = new WeakMap();
const couches = new Set();

export const contexteSuggestions = (editor) => contextes.get(editor) ?? null;
export const suggestionsOuvertes = (wrapper) => [...couches].some((c) => c.wrapper === wrapper);

export function lierContexteSuggestions(editor, { wrapper, parent = null }) {
	const precedent = contextes.get(editor);
	if (precedent?.wrapper === wrapper && precedent.parent === parent) return precedent.disposer;
	precedent?.disposer();
	const contexte = { wrapper, parent, disposer: null };
	contexte.disposer = () => {
		if (contextes.get(editor) !== contexte) return;
		fermerSuggestions({ editor, reason: 'destroy' });
		contextes.delete(editor);
		editor.off('destroy', contexte.disposer);
	};
	contextes.set(editor, contexte);
	editor.on('destroy', contexte.disposer);
	return contexte.disposer;
}

/** Enregistrement limité à la durée d'ouverture ; utilisé aussi par la future liste inline. */
export function enregistrerCoucheSuggestions(couche) {
	couches.add(couche);
	return () => couches.delete(couche);
}

export function fermerSuggestions({ parent, wrapper, editor, refocus = false, reason = 'context' } = {}) {
	for (const couche of [...couches]) {
		if (wrapper && couche.wrapper !== wrapper) continue;
		if (editor && couche.editor !== editor) continue;
		if (parent) {
			let ancetre = couche.parent;
			while (ancetre && ancetre !== parent) ancetre = ancetre.parent;
			if (!ancetre) continue;
		}
		couche.fermer({ refocus, reason });
	}
}
