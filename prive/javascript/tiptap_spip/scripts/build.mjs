// Bundle du navigateur : prive/javascript/tiptap_spip.js et sa version minifiée.
// Usage : node scripts/build.mjs [--watch]
import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';

const outdir = fileURLToPath(new URL('../../', import.meta.url));
const common = {
	entryPoints: [fileURLToPath(new URL('../src/main.js', import.meta.url))],
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	legalComments: 'none',
	logLevel: 'info',
};
const variants = [
	{ ...common, outfile: `${outdir}tiptap_spip.js` },
	{ ...common, outfile: `${outdir}tiptap_spip.min.js`, minify: true },
];

if (process.argv.includes('--watch')) {
	await (await context(variants[0])).watch();
} else {
	await Promise.all(variants.map((options) => build(options)));
}
