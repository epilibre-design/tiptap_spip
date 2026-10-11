/** Textes dérivés du contenu, pour l'affichage (infobulles, panneau des notes, multis). */

/** Texte d'un contenu (note, partie de multi), sans mise en forme, coupé à `max` caractères. */
export function apercu(content, max = 80) {
	const morceaux = [];
	const parcourir = (n) => {
		if (n.text) morceaux.push(n.text);
		else if (n.attrs?.source) morceaux.push(n.attrs.source);
		else if (n.attrs?.model?.source) morceaux.push(n.attrs.model.source);
		(n.content ?? []).forEach(parcourir);
		if (n.type === 'paragraph') morceaux.push(' ');
	};
	(content ?? []).forEach(parcourir);
	const texte = morceaux.join('').replace(/\s+/g, ' ').trim();
	return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

/**
 * Partie d'un multi affichée : celle de la langue de l'interface (code exact, puis langue de base ;
 * la dernière si la langue est en double, comme SPIP), sinon la première.
 */
export function partieAffichee(parts, langue = globalThis.document?.documentElement?.lang ?? '') {
	const l = langue.toLowerCase();
	const base = l.split(/[-_]/)[0];
	return parts.findLast((p) => p.lang?.toLowerCase() === l)
		?? parts.findLast((p) => p.lang?.toLowerCase().split(/[-_]/)[0] === base)
		?? parts[0];
}
