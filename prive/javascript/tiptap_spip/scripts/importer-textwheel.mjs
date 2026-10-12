// Importe dans le corpus les textes des tests de TextWheel (spec 08 §1, « tests du core »).
// Usage : node scripts/importer-textwheel.mjs /chemin/vers/plugins-dist/textwheel
// Chaque tests/data/<jeu>/<cas>.txt devient tests/corpus/textwheel/<jeu>/<cas>.spip ; un texte déjà
// importé depuis un jeu précédent (même contenu) n'est pas recopié.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const JEUX = ['base', 'typo', 'modeles_block', 'modeles_inline'];

const source = process.argv[2];
if (!source) {
	console.error('usage : node scripts/importer-textwheel.mjs /chemin/vers/plugins-dist/textwheel');
	process.exit(2);
}
const cible = fileURLToPath(new URL('../../../../tests/corpus/textwheel/', import.meta.url));

const vus = new Map();
let copies = 0;
for (const jeu of JEUX) {
	const dossier = join(source, 'tests/data', jeu);
	for (const f of readdirSync(dossier).filter((x) => x.endsWith('.txt')).sort()) {
		const texte = readFileSync(join(dossier, f), 'utf8');
		const nom = `${jeu}/${f.slice(0, -4)}.spip`;
		if (vus.has(texte)) {
			console.log(`doublon ${jeu}/${f} = ${vus.get(texte)}`);
			continue;
		}
		vus.set(texte, nom);
		mkdirSync(join(cible, jeu), { recursive: true });
		writeFileSync(join(cible, nom), texte);
		copies++;
	}
}
console.log(`${copies} textes importés dans ${cible}`);
