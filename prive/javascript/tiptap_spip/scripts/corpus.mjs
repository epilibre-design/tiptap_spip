// Fichiers du corpus (spec 08 §1) : les .spip du dossier et de ses sous-dossiers (cas écrits à la
// main à la racine, cas du cœur, cas pathologiques), commun aux tests Vitest et à l'équivalence.
import { readdirSync } from 'node:fs';

/**
 * @param {string} dossier
 * @returns {string[]} chemins relatifs au dossier, séparés par /, triés
 */
export function fichiersCorpus(dossier) {
	return readdirSync(dossier, { recursive: true })
		.map((f) => String(f).split('\\').join('/'))
		.filter((f) => f.endsWith('.spip'))
		.sort();
}
