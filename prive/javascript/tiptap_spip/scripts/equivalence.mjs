// Équivalence de rendu (spec 04 §5, invariant 3) : propre(source) ≡ propre(forme canonique).
// Usage : SPIP_ROOT=/chemin/vers/spip [TTS_PHP=php8.3] node scripts/equivalence.mjs [--figer] [dossier de corpus…]
// TTS_PHP : PHP de l'oracle, celui du site (SPIP 4.2 s'arrête à PHP 8.3), php par défaut.
// --figer : (ré)écrit le diff figé de chaque écart enregistré dans tests/corpus/ecarts.yaml (celui de
// la branche de SPIP de l'oracle si l'entrée en déclare un).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../src/spip/index.js';
import { fichiersCorpus } from './corpus.mjs';
import { diffFige, diffHtml, judge, loadEcarts, normalize, plafond } from './ecarts.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const oracle = join(root, 'tests/equivalence/propre.php');
const corpus = join(root, 'tests/corpus');
const args = process.argv.slice(2);
const figer = args.includes('--figer');
const dirs = args.filter((a) => a !== '--figer').map((d) => resolve(d));
if (!dirs.length) dirs.push(corpus);

if (!process.env.SPIP_ROOT) {
	console.error('SPIP_ROOT non défini : racine du site SPIP servant d\'oracle');
	process.exit(2);
}

const php = process.env.TTS_PHP || 'php';
const propre = (text) => execFileSync(php, [oracle], { input: text, encoding: 'utf8' });
// branche majeure de SPIP de l'oracle : choisit le diff figé d'un écart rendu autrement selon la branche
const branche = execFileSync(php, [oracle, '--branche'], { encoding: 'utf8' }).trim();

const registre = join(corpus, 'ecarts.yaml');
const entries = existsSync(registre) ? loadEcarts(readFileSync(registre, 'utf8')) : [];
const frozen = new Map();
for (const e of entries) {
	const chemin = join(corpus, diffFige(e, branche));
	if (existsSync(chemin)) frozen.set(e.fichier, readFileSync(chemin, 'utf8'));
}

/** Chemin relatif au corpus versionné, ou null pour un fichier d'un autre corpus. */
const versionne = (chemin) => {
	const rel = relative(corpus, chemin);
	return rel.startsWith('..') || isAbsolute(rel) ? null : rel.split('\\').join('/');
};

let total = 0;
let failures = 0;
let acceptes = 0;
let equivalents = 0;
const vus = new Set();
for (const dir of dirs) {
	for (const file of fichiersCorpus(dir)) {
		total++;
		const chemin = join(dir, file);
		const fichier = versionne(chemin);
		vus.add(fichier);
		const source = readFileSync(chemin, 'utf8');
		const canonical = serialize(parse(source), { conservative: false });
		const a = normalize(propre(source));
		const b = normalize(propre(canonical));
		const diff = diffHtml(a, b);
		const entree = entries.find((e) => e.fichier === fichier);
		if (figer && entree && diff !== '') {
			const cible = join(corpus, diffFige(entree, branche));
			mkdirSync(dirname(cible), { recursive: true });
			writeFileSync(cible, diff);
			frozen.set(fichier, diff);
			console.log(`FIGÉ ${cible}`);
		}
		const verdict = judge({ fichier, diff, entries, frozen });
		switch (verdict.statut) {
			case 'equivalent':
				equivalents++;
				break;
			case 'accepte':
			case 'couvert':
				acceptes++;
				console.log(`ÉCART ${verdict.statut === 'accepte' ? 'ACCEPTÉ' : 'COUVERT'} ${chemin} (${verdict.entree.type}, ${verdict.entree.fichier})`);
				break;
			case 'disparu':
				failures++;
				console.log(`DISPARU ${chemin} : rendu désormais équivalent, supprimer l'entrée de ecarts.yaml et son diff\n`);
				break;
			case 'diff-change':
				failures++;
				console.log(`DIFF CHANGÉ ${chemin}\n--- diff figé (${diffFige(verdict.entree, branche)}) ---\n${frozen.get(fichier) ?? '(absent)'}--- diff obtenu ---\n${diff}`);
				break;
			case 'ecart':
				failures++;
				console.log(`DIFF ${chemin}\n  source    : ${a}\n  canonique : ${b}\n--- diff ---\n${diff}--- forme canonique ---\n${canonical}\n`);
				break;
		}
	}
}

// une entrée du registre doit désigner un fichier du corpus versionné examiné
if (dirs.includes(corpus)) {
	for (const e of entries.filter((x) => !vus.has(x.fichier))) {
		failures++;
		console.log(`ENTRÉE ORPHELINE ${e.fichier} : fichier absent du corpus`);
	}
}

const max = plafond(total);
if (acceptes > max) {
	failures++;
	console.log(`PLAFOND DÉPASSÉ : ${acceptes} écarts acceptés pour ${total} fichiers (au plus ${max})`);
}
console.log(`SPIP ${branche} : ${equivalents}/${total} fichiers équivalents, ${acceptes} écart(s) accepté(s) (plafond ${max})`);
process.exit(failures ? 1 : 0);
