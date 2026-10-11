/**
 * Découpe une source SPIP en segments séparés par des lignes vides, sans perdre un caractère :
 *   source = lead + Σ (segment.sep + source.slice(segment.start, segment.end)) + trail
 *
 * Le découpage se fait sur le texte masqué (cf. protect.js) : une ligne vide à l'intérieur
 * d'un bloc protégé, d'une note ou d'un lien ne coupe donc pas. Les conteneurs
 * <quote>, <poesie>, <div class="text-…"> qui contiennent des lignes vides sont recollés.
 *
 * @param {string} source
 * @param {string} masked
 * @returns {{ lead: string, trail: string, segments: {sep: string, start: number, end: number}[] }}
 */
export function segment(source, masked) {
	if (masked.trim() === '') {
		return { lead: source, trail: '', segments: [] };
	}
	const lead = masked.match(/^(?:[ \t\r]*\n)*/)[0];
	const trail = masked.slice(lead.length).match(/(?:\n[ \t\r]*)*$/)[0];
	const bodyStart = lead.length;
	const bodyEnd = masked.length - trail.length;

	const raw = [];
	let pos = bodyStart;
	let sep = '';
	const SEP = /\n(?:[ \t\r]*\n)+/g;
	SEP.lastIndex = bodyStart;
	let m;
	while ((m = SEP.exec(masked)) && m.index < bodyEnd) {
		raw.push({ sep, start: pos, end: m.index });
		sep = m[0];
		pos = m.index + m[0].length;
	}
	raw.push({ sep, start: pos, end: bodyEnd });

	return {
		lead: source.slice(0, lead.length),
		trail: source.slice(bodyEnd),
		segments: mergeContainers(raw, masked),
	};
}

const CONTAINERS = [
	{ open: /^<quote>/i, tag: /<(\/?)quote>/gi },
	{ open: /^<poe(?:sie|try)>/i, tag: /<(\/?)poe(?:sie|try)>/gi },
	{ open: /^<div class="text-(?:left|center|right|justify)">/, tag: /<(\/?)div\b[^>]*>/gi },
];

function balance(text, tagRegex) {
	let depth = 0;
	for (const m of text.matchAll(tagRegex)) depth += m[1] ? -1 : 1;
	return depth;
}

function mergeContainers(raw, masked) {
	const out = [];
	for (let i = 0; i < raw.length; i++) {
		const seg = raw[i];
		const text = masked.slice(seg.start, seg.end);
		const container = CONTAINERS.find((c) => c.open.test(text));
		let depth = container ? balance(text, container.tag) : 0;
		if (depth > 0) {
			let j = i;
			while (depth > 0 && j + 1 < raw.length) {
				j++;
				depth += balance(masked.slice(raw[j].start, raw[j].end), container.tag);
			}
			if (depth === 0) {
				out.push({ sep: seg.sep, start: seg.start, end: raw[j].end });
				i = j;
				continue;
			}
		}
		out.push(seg);
	}
	return out;
}
