/**
 * Construction et comparaison des nœuds JSON (format editor.getJSON() de Tiptap).
 */

/** Ordre canonique des marks, de la plus externe à la plus interne. */
// glossaire et abréviation juste avant le code : leur texte ne porte aucune autre mark écrite à l'intérieur
export const MARK_ORDER = ['spipLink', 'bold', 'italic', 'strike', 'superscript', 'subscript', 'spipAbbr', 'spipGlossary', 'code'];

/** Attributs techniques de la sérialisation conservatrice : exclus de la forme canonique. */
export const TECH_ATTRS = ['spipSrc', 'spipSep', 'spipHash', 'spipGroup', 'spipLead', 'spipTrail'];

export const text = (value, marks = []) => (marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value });

export const node = (type, attrs, content) => {
	const n = { type };
	if (attrs && Object.keys(attrs).length) n.attrs = attrs;
	if (content) n.content = content;
	return n;
};

export const raw = (source, marks = []) => {
	const n = { type: 'spipRawInline', attrs: { source } };
	if (marks.length) n.marks = marks;
	return n;
};

/** Rang d'une mark : celles des règles tierces après celles du cœur, comme dans le schéma de l'éditeur. */
const rang = (type) => {
	const i = MARK_ORDER.indexOf(type);
	return i < 0 ? MARK_ORDER.length : i;
};

export const sortMarks = (marks) => [...marks].sort((a, b) => rang(a.type) - rang(b.type));

export const sameMark = (a, b) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});

const sameMarks = (a = [], b = []) => a.length === b.length && a.every((m, i) => sameMark(m, b[i]));

/** Fusionne les nœuds texte adjacents portant les mêmes marks, supprime les textes vides. */
export function mergeText(nodes) {
	const out = [];
	for (const n of nodes) {
		if (n.type === 'text' && n.text === '') continue;
		const prev = out[out.length - 1];
		if (n.type === 'text' && prev?.type === 'text' && sameMarks(prev.marks, n.marks)) {
			out[out.length - 1] = text(prev.text + n.text, prev.marks ?? []);
		} else {
			out.push(n);
		}
	}
	return out;
}

/**
 * Forme normalisée : clés triées, sans attributs techniques ni attributs nuls (Tiptap ajoute
 * les valeurs par défaut nulles dans getJSON(), le parseur ne les écrit pas).
 */
export function stripTech(value) {
	if (Array.isArray(value)) return value.map(stripTech);
	if (value && typeof value === 'object') {
		const out = {};
		for (const k of Object.keys(value).sort()) {
			if (k !== 'attrs') {
				out[k] = stripTech(value[k]);
				continue;
			}
			const attrs = {};
			for (const a of Object.keys(value.attrs).sort()) {
				if (TECH_ATTRS.includes(a) || value.attrs[a] === null || value.attrs[a] === undefined) continue;
				attrs[a] = stripTech(value.attrs[a]);
			}
			if (Object.keys(attrs).length) out.attrs = attrs;
		}
		return out;
	}
	return value;
}

/**
 * Forme canonique d'un nœud ou d'une liste de nœuds. Deux contenus de même forme canonique
 * se sérialisent et se rendent à l'identique : c'est l'empreinte de la sérialisation
 * conservatrice (comparaison exacte, pas de hachage, donc pas de collision possible).
 */
export const canon = (value) => JSON.stringify(stripTech(value));
