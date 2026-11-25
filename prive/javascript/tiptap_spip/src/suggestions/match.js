/**
 * findSuggestionMatch : lire le bloc entier, pas seulement nodeBefore (limites de marks).
 * Un caractère par position de texte ; les atomes gardent leur taille et sont infranchissables.
 */
export function trouverSuggestion({
	char, $position, allowedPrefixes = [' '], startOfLine = false,
	allowSpaces = false, minQueryLength = 0, queryPattern,
}) {
	if (!$position.parent.isTextblock || !char) return null;
	let avant = '';
	$position.parent.forEach((node, offset) => {
		if (offset >= $position.parentOffset) return;
		const taille = Math.min(node.nodeSize, $position.parentOffset - offset);
		avant += node.isText ? node.text.slice(0, taille)
			: node.type.name === 'hardBreak' ? '\n' : '\ufffc'.repeat(taille);
	});
	const debut = avant.lastIndexOf(char);
	if (debut < 0 || (startOfLine && debut !== 0)) return null;
	if (debut > 0 && !(allowedPrefixes ?? []).includes(avant[debut - 1])) return null;
	const query = avant.slice(debut + char.length);
	if (query.length < minQueryLength || /[\n\r\ufffc]/.test(query) || (!allowSpaces && /\s/.test(query))) return null;
	if (queryPattern) {
		const motif = new RegExp(`^(?:${queryPattern.source})$`, queryPattern.flags.replace(/[gy]/g, ''));
		if (!motif.test(query)) return null;
	}
	return { range: { from: $position.start() + debut, to: $position.pos }, query, text: char + query };
}
