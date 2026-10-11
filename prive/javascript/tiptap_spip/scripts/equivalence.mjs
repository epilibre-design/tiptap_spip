// Équivalence de rendu (spec 04 §5, invariant 3) : propre(source) ≡ propre(forme canonique).
// Usage : SPIP_ROOT=/chemin/vers/spip node scripts/equivalence.mjs [dossier de corpus…]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../src/spip/index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const oracle = join(root, 'tests/equivalence/propre.php');
const dirs = process.argv.length > 2 ? process.argv.slice(2) : [join(root, 'tests/corpus')];

if (!process.env.SPIP_ROOT) {
	console.error('SPIP_ROOT non défini : racine du site SPIP servant d\'oracle');
	process.exit(2);
}

const propre = (text) => execFileSync('php', [oracle], { input: text, encoding: 'utf8' });

/**
 * Normalisation : blancs, identifiants qui dépendent de la source et non du rendu (tableaux :
 * cellules aléatoires, résumé tiré du md5 du bloc ; modèles : classe base64php tirée d'un
 * uniqid), et caractères de contrôle invisibles que SPIP laisse parfois dans sa sortie
 * (marqueurs \x01\x15 de la wheel backticks).
 */
export const normalize = (html) => html
	.replace(/ (?:id|headers)='id[0-9a-f]+_c\d+'/g, '')
	.replace(/\bdby[0-9a-f]{4}\b/g, 'dby')
	.replace(/\bbase64php[0-9a-f.]+/g, 'base64php')
	.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
	.replace(/\s+/g, ' ')
	.replace(/>\s+/g, '>')
	.replace(/\s+</g, '<')
	.trim();

let total = 0;
let failures = 0;
for (const dir of dirs) {
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.spip')).sort()) {
		total++;
		const source = readFileSync(join(dir, file), 'utf8');
		const canonical = serialize(parse(source), { conservative: false });
		const a = normalize(propre(source));
		const b = normalize(propre(canonical));
		if (a !== b) {
			failures++;
			console.log(`DIFF ${join(dir, file)}\n  source    : ${a}\n  canonique : ${b}\n--- forme canonique ---\n${canonical}\n`);
		}
	}
}
console.log(`${total - failures}/${total} fichiers équivalents`);
process.exit(failures ? 1 : 0);
