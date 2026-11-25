import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, lstatSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Copie les données originales ; le manifeste est l’unique source de version du navigateur. */
export function copierCatalogueEmojis({ modules, destination }) {
	const paquet = join(modules, 'emoji-picker-element-data');
	const { version } = JSON.parse(readFileSync(join(paquet, 'package.json'), 'utf8'));
	const semver = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;
	if (!semver.test(version)) throw new Error('Version du catalogue emoji invalide');
	const donnees = readFileSync(join(paquet, 'en/emojibase/data.json'));
	// Valider avant de remplacer la distribution précédente.
	if (!Array.isArray(JSON.parse(donnees))) throw new Error('Catalogue emoji invalide');
	if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) throw new Error('Destination emoji symbolique');
	mkdirSync(destination, { recursive: true });
	const dossier = join(destination, version);
	if (existsSync(dossier) && lstatSync(dossier).isSymbolicLink()) throw new Error('Version emoji symbolique');
	mkdirSync(dossier, { recursive: true });
	const manifeste = { version, locale: `en-tiptap-spip-${version}`, fichier: `${version}/en-emojibase.json` };
	const fichier = join(destination, manifeste.fichier);
	const temporaire = `${fichier}.tmp`;
	try {
		writeFileSync(temporaire, donnees);
		if (!readFileSync(temporaire).equals(donnees)) throw new Error('Copie du catalogue emoji incomplète');
		renameSync(temporaire, fichier);
		writeFileSync(join(destination, 'manifest.json.tmp'), JSON.stringify(manifeste, null, 2) + '\n');
		renameSync(join(destination, 'manifest.json.tmp'), join(destination, 'manifest.json'));
	} finally {
		rmSync(temporaire, { force: true });
		rmSync(join(destination, 'manifest.json.tmp'), { force: true });
	}
	// Un dossier étranger ou un lien n’est jamais considéré comme une ancienne génération.
	for (const entree of readdirSync(destination, { withFileTypes: true })) {
		if (entree.name === version || !semver.test(entree.name) || !entree.isDirectory()) continue;
		const ancien = join(destination, entree.name);
		const fichiers = readdirSync(ancien, { withFileTypes: true });
		if (fichiers.length === 1 && fichiers[0].name === 'en-emojibase.json' && fichiers[0].isFile()) rmSync(ancien, { recursive: true });
	}
	return manifeste;
}
