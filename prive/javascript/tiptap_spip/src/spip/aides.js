import { parseContent } from './blocks.js';
import { parseInline } from './inline.js';
import { protect } from './protect.js';
import * as regex from './regex.js';
import { escapeText, serializeBlocks, serializeInline } from './serialize.js';

/**
 * Aides passées à parseSpip et renderSpip (spec 07 §1) : l'extension réutilise le moteur au lieu
 * d'en réimplémenter une partie. Les règles actives restent celles de l'appel en cours.
 */
export const aides = {
	/** Source → blocs JSON (paragraphes, listes, conteneurs…), sans carte de segments. */
	parseBlocks: (source) => parseContent(source),
	/** Source → nœuds en ligne JSON. */
	parseInline: (source) => {
		const { masked, regions } = protect(source);
		return parseInline(source, masked, regions);
	},
	/** Blocs JSON → source, séparés par une ligne vide. */
	renderBlocks: (content) => serializeBlocks(content),
	/** Nœuds en ligne JSON → source. */
	renderInline: (nodes) => serializeInline(nodes),
	/** Texte → source, raccourcis SPIP échappés. */
	escape: (texte) => escapeText(texte, false),
	/** Expressions régulières du core (regex.js). */
	regex,
};

/**
 * Lecture d'une région par sa règle : nœud JSON (bloc ou en ligne), `{ attrs?, content }` pour une
 * mark ; null si le motif ne couvre pas la région, si parseSpip renvoie autre chose qu'un objet ou
 * lève une exception (la source reste alors brute).
 */
export function lireRegle(regle, source) {
	const m = regle.relire(source);
	if (!m) return null;
	let lu;
	try {
		lu = regle.parseSpip(m, aides);
	} catch (erreur) {
		console.warn(`tiptap_spip : parseSpip de « ${regle.name} » a échoué`, erreur);
		return null;
	}
	if (!lu || typeof lu !== 'object') return null;
	if (regle.type === 'mark') return Array.isArray(lu.content) ? lu : null;
	return typeof lu.type === 'string' ? lu : null;
}

/** Écriture d'un bloc ou d'un nœud en ligne par sa règle. */
export function ecrireRegle(regle, n) {
	const source = regle.renderSpip(n, aides);
	if (typeof source !== 'string') throw new Error(`serialize: renderSpip de « ${regle.name} » doit renvoyer une chaîne`);
	return source;
}

/** Délimiteurs d'une mark par sa règle : renderSpip `{ open, close }`, ou fonction de la mark. */
export function delimiteursRegle(regle, mark) {
	const d = typeof regle.renderSpip === 'function' ? regle.renderSpip(mark, aides) : regle.renderSpip;
	if (typeof d?.open !== 'string' || typeof d?.close !== 'string') throw new Error(`serialize: renderSpip de la mark « ${regle.name} » doit donner open et close`);
	return [d.open, d.close];
}
