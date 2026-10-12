// Bundle du navigateur : prive/javascript/tiptap_spip.js et sa version minifiée, et le fichier des
// licences des composants tiers qu'ils embarquent (tiptap_spip.LICENSES.txt).
// Usage : node scripts/build.mjs [--watch]
import { build, context } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outdir = fileURLToPath(new URL('../../', import.meta.url));
const modules = fileURLToPath(new URL('../node_modules/', import.meta.url));
const LICENCES = 'tiptap_spip.LICENSES.txt';
const common = {
	entryPoints: [fileURLToPath(new URL('../src/main.js', import.meta.url))],
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	// les paquets embarqués n'ont pas de commentaires de licence : leurs licences sont dans LICENCES
	legalComments: 'none',
	banner: { js: `/*! tiptap_spip, GPL-3.0-or-later. Licences des composants tiers : ${LICENCES} */` },
	logLevel: 'info',
};
const variants = [
	{ ...common, outfile: `${outdir}tiptap_spip.js`, metafile: true },
	{ ...common, outfile: `${outdir}tiptap_spip.min.js`, minify: true },
];

/** Texte de licence d'un paquet de node_modules. */
function licence(paquet) {
	const dossier = `${modules}${paquet}/`;
	const fichier = readdirSync(dossier).find((f) => /^licen[cs]e/i.test(f));
	if (!fichier) throw new Error(`licence introuvable pour ${paquet}`);
	const { version, license } = JSON.parse(readFileSync(`${dossier}package.json`, 'utf8'));
	return `${paquet} ${version} (${license})\n\n${readFileSync(dossier + fichier, 'utf8').trim()}`;
}

/**
 * Fichier des licences : chaque paquet embarqué dans le bundle (d'après le metafile d'esbuild), et
 * Remix Icon, dont les SVG sont recopiés dans src/ui/icones.js.
 */
function ecrireLicences(metafile) {
	const paquets = new Set(Object.keys(metafile.inputs)
		.map((f) => f.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1])
		.filter(Boolean));
	paquets.add('remixicon');
	const textes = [...paquets].sort().map(licence);
	writeFileSync(`${outdir}${LICENCES}`, `Composants tiers embarqués dans tiptap_spip.js et tiptap_spip.min.js.
Généré par scripts/build.mjs : ne pas modifier à la main.

${textes.join(`\n\n${'-'.repeat(72)}\n\n`)}
`);
}

if (process.argv.includes('--watch')) {
	await (await context(variants[0])).watch();
} else {
	const [principal] = await Promise.all(variants.map((options) => build(options)));
	ecrireLicences(principal.metafile);
}
