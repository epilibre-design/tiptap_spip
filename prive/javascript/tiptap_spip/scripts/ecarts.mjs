// Écarts de rendu acceptés (spec 08 §4) : registre tests/corpus/ecarts.yaml et diffs figés.
import { parse as parseYaml } from 'yaml';

/** Types d'écart tolérés : liste fermée. */
export const TYPES = ['espacement', 'balisage-equivalent'];

const CHAMPS = ['fichier', 'type', 'diff', 'justification', 'accepte_par'];

/**
 * Lit et valide le registre des écarts.
 * @param {string} text  contenu de ecarts.yaml
 * @returns {{ fichier: string, type: string, diff: string, justification: string, accepte_par: string }[]}
 */
export function loadEcarts(text) {
	const entries = parseYaml(text) ?? [];
	if (!Array.isArray(entries)) throw new Error('ecarts.yaml : une liste d\'entrées est attendue');
	const vus = new Set();
	for (const e of entries) {
		for (const champ of CHAMPS) {
			if (typeof e?.[champ] !== 'string' || e[champ].trim() === '') {
				throw new Error(`ecarts.yaml : champ « ${champ} » manquant (${e?.fichier ?? 'entrée sans fichier'})`);
			}
		}
		if (!TYPES.includes(e.type)) throw new Error(`ecarts.yaml : type « ${e.type} » hors liste (${TYPES.join(', ')})`);
		if (vus.has(e.fichier)) throw new Error(`ecarts.yaml : deux entrées pour ${e.fichier}`);
		vus.add(e.fichier);
	}
	return entries;
}

/** Une ligne par balise : le texte qui suit une balise reste sur sa ligne. */
const lignes = (html) => html.split(/(?=<)/).filter((l) => l !== '');

/**
 * Diff de deux rendus HTML normalisés, réduit aux lignes modifiées (pas de contexte, pour qu'un
 * diff figé ne dépende que de l'écart lui-même). Chaque hunk liste ses lignes retirées puis
 * ajoutées ; les hunks sont séparés par « @@ ».
 * @returns {string} chaîne vide si les rendus sont identiques
 */
export function diffHtml(a, b) {
	const x = lignes(a);
	const y = lignes(b);
	let debut = 0;
	while (debut < x.length && debut < y.length && x[debut] === y[debut]) debut++;
	let fin = 0;
	while (fin < x.length - debut && fin < y.length - debut && x[x.length - 1 - fin] === y[y.length - 1 - fin]) fin++;
	const xs = x.slice(debut, x.length - fin);
	const ys = y.slice(debut, y.length - fin);

	// plus longue sous-suite commune sur la partie qui diffère
	const n = xs.length;
	const m = ys.length;
	const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] = xs[i] === ys[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}
	const blocs = [];
	let bloc = null;
	const ajoute = (cote, ligne) => {
		bloc ??= { moins: [], plus: [] };
		bloc[cote].push(ligne);
	};
	const ferme = () => {
		if (bloc) blocs.push(bloc);
		bloc = null;
	};
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && xs[i] === ys[j]) {
			ferme();
			i++;
			j++;
		} else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) {
			ajoute('moins', xs[i++]);
		} else {
			ajoute('plus', ys[j++]);
		}
	}
	ferme();
	if (!blocs.length) return '';
	return blocs
		.map((h) => [...h.moins.map((l) => `- ${l}`), ...h.plus.map((l) => `+ ${l}`)].join('\n'))
		.join('\n@@\n') + '\n';
}

/** Hunks d'un diff produit par diffHtml(). */
export const hunks = (diff) => (diff === '' ? [] : diff.replace(/\n$/, '').split('\n@@\n'));

/** Nombre maximal d'écarts acceptés : 1 % des fichiers examinés, arrondi à l'entier supérieur. */
export const plafond = (total) => Math.ceil(total / 100);

/**
 * Verdict pour un fichier.
 * - fichier du corpus versionné (chemin relatif à tests/corpus) : un écart n'est accepté que
 *   s'il est enregistré et que son diff est exactement le diff figé ;
 * - fichier d'un autre corpus (fichier null) : l'écart est « couvert » si tous ses hunks
 *   figurent dans le diff figé d'une même entrée (le cas a été réduit et enregistré).
 *
 * @param {{ fichier: string|null, diff: string, entries: object[], frozen: Map<string, string> }} args
 * @returns {{ statut: 'equivalent'|'accepte'|'couvert'|'ecart'|'diff-change'|'disparu', entree?: object }}
 */
export function judge({ fichier, diff, entries, frozen }) {
	const entree = fichier === null ? undefined : entries.find((e) => e.fichier === fichier);
	if (entree) {
		if (diff === '') return { statut: 'disparu', entree };
		return { statut: diff === frozen.get(entree.fichier) ? 'accepte' : 'diff-change', entree };
	}
	if (diff === '') return { statut: 'equivalent' };
	if (fichier === null) {
		const h = hunks(diff);
		const couvrante = entries.find((e) => {
			const figes = new Set(hunks(frozen.get(e.fichier) ?? ''));
			return h.every((x) => figes.has(x));
		});
		if (couvrante) return { statut: 'couvert', entree: couvrante };
	}
	return { statut: 'ecart' };
}
