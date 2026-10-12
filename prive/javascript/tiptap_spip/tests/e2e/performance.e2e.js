// Critère d'acceptation 6 (spec 08) : parse + montage d'un texte de 50 000 caractères en moins de
// 150 ms, Chromium. Texte : le corpus d'équivalence répété (paragraphes, listes, tableaux, notes,
// modèles, code, multi…). Médiane de 5 montages, après un montage de chauffe.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { configure, editer, module, repo } from './site.js';

configure(test);

const corpus = `${repo}tests/corpus/`;
const morceaux = readdirSync(corpus).filter((f) => f.endsWith('.spip')).sort().map((f) => readFileSync(corpus + f, 'utf8').trim());
let source = '';
while (source.length < 50_000) source += `${morceaux.join('\n\n')}\n\n`;
source = source.slice(0, 50_000);

test('parse + montage de 50 000 caractères en moins de 150 ms', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'critère mesuré sous Chromium');
	await editer(page, 'x');
	await module(page);
	const { chauffe, mesures } = await page.evaluate((texte) => {
		const { instances, tiptap_spip_init } = window.__tts;
		const monter = () => {
			const conteneur = document.createElement('div');
			conteneur.className = 'formulaire_spip';
			const textarea = document.createElement('textarea');
			textarea.name = 'texte';
			textarea.value = texte;
			conteneur.append(textarea);
			document.body.append(conteneur);
			const debut = performance.now();
			tiptap_spip_init(conteneur);
			const duree = performance.now() - debut;
			const instance = [...instances].find((i) => i.textarea === textarea);
			const ok = Boolean(instance?.editor) && textarea.value === texte;
			instance.destroy();
			conteneur.remove();
			return { duree, ok };
		};
		return { chauffe: monter(), mesures: Array.from({ length: 5 }, monter) };
	}, source);
	expect([chauffe, ...mesures].every((m) => m.ok)).toBe(true);
	const durees = mesures.map((m) => m.duree).sort((a, b) => a - b);
	console.log(`montage de ${source.length} caractères : ${durees.map((d) => d.toFixed(1)).join(', ')} ms (chauffe : ${chauffe.duree.toFixed(1)} ms)`);
	expect(durees[2]).toBeLessThan(150);
});
