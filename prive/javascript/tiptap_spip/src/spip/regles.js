/**
 * Règles tierces du parseur et du sérialiseur (spec 07) : un raccourci ajouté par un plugin, lu par
 * `parseSpip` et écrit par `renderSpip`.
 *
 * Le parseur garde son ordre en dur ; une règle s'insère à l'un de ses trois niveaux, où elle trouve
 * des régions `extension` dans protect() (cf. protect.js) :
 *   protect : après les backticks, avant les blocs protégés du cœur (<code>, <cadre>…) ;
 *   block   : après les échappements, avant les modèles ;
 *   inline  : après les notes, avant les abréviations.
 * À chaque niveau, les règles passent par priorité croissante.
 *
 * Les règles actives sont posées pour la durée d'un appel à parse() ou serialize() (avecRegles) :
 * les analyses et écritures imbriquées (note, conteneur, relecture) en héritent.
 */

const NIVEAUX = ['protect', 'block', 'inline'];
const TYPES = ['block', 'inline', 'mark'];

let actives = [];

/** Règles de l'appel en cours. */
export const reglesActives = () => actives;

/** Règle d'un type de nœud ou de mark ; la dernière déclarée l'emporte. */
export const regleDe = (nom) => actives.findLast((r) => r.name === nom) ?? null;

/** Exécute f avec ces règles actives ; sans règles (undefined), celles de l'appel englobant. */
export function avecRegles(regles, f) {
	if (!regles) return f();
	const avant = actives;
	actives = regles;
	try {
		return f();
	} finally {
		actives = avant;
	}
}

const drapeaux = (regex, ajout) => [...new Set(regex.flags.replace(/[gy]/g, '') + ajout)].join('');

/**
 * Règle normalisée à partir de la définition d'une extension, null (avec un avertissement) si elle
 * est inutilisable.
 *
 * @param {{ name: string, type: 'block'|'inline'|'mark', tokenizer?: { level: string, priority?: number,
 *           start?: string, match: RegExp } | null, parseSpip?: Function, renderSpip?: Function|object }} definition
 *        type : bloc, nœud en ligne ou mark ; sans tokenizer, la règle ne sert qu'à l'écriture
 */
export function creerRegle(definition) {
	const { name, type, tokenizer = null, parseSpip = null, renderSpip = null } = definition;
	const refus = (raison) => {
		console.warn(`tiptap_spip : règle « ${name} » ignorée (${raison})`);
		return null;
	};
	if (!name || !TYPES.includes(type)) return refus('type de nœud ou de mark inconnu');
	if (tokenizer) {
		if (!NIVEAUX.includes(tokenizer.level)) return refus(`niveau « ${tokenizer.level} » inconnu`);
		if (!(tokenizer.match instanceof RegExp)) return refus('motif match absent');
		if (typeof parseSpip !== 'function') return refus('parseSpip absent');
	}
	const { match } = tokenizer ?? {};
	return {
		name,
		type,
		definition,
		niveau: tokenizer?.level ?? null,
		priorite: tokenizer?.priority ?? 0,
		debut: tokenizer?.start ?? '',
		// recherche dans tout le texte : ^ et $ désignent un début et une fin de ligne
		regex: match ? new RegExp(match.source, drapeaux(match, 'gm')) : null,
		// relecture d'une région sur la source : le motif doit la couvrir exactement
		relire: match
			? (source) => {
				const m = new RegExp(match.source, drapeaux(match, 'my')).exec(source);
				return m && m[0].length === source.length ? m : null;
			}
			: () => null,
		parseSpip,
		renderSpip,
	};
}

/** Règles d'un niveau, par priorité croissante (ordre de déclaration à priorité égale). */
export const reglesDuNiveau = (niveau) => actives
	.filter((r) => r.niveau === niveau)
	.map((r, i) => ({ r, i }))
	.sort((a, b) => a.r.priorite - b.r.priorite || a.i - b.i)
	.map(({ r }) => r);
