// Enregistre les réponses réelles du formulaire de services utilisées par tests/services/cvt.test.js.
// Usage : TTS_FIXTURES=1 TTS_SITE=… TTS_URL=… npx playwright test fixtures-cvt
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { configure, editer } from './site.js';

configure(test);
test.skip(!process.env.TTS_FIXTURES, 'TTS_FIXTURES=1 pour réenregistrer les fixtures');

const dossier = new URL('../fixtures/cvt/', import.meta.url);

/** Poste le formulaire de services comme cvt.js, sans passer par lui, et renvoie la réponse brute. */
const poster = (page, params, { sansSession = false } = {}) => page.evaluate(async ([params, sansSession]) => {
	const form = document.querySelector('.tts-services[data-tts-champ=texte] form');
	const data = new FormData(form);
	data.set('var_ajax', 'form');
	for (const [k, v] of Object.entries(params)) data.set(k, v);
	const res = await fetch(form.action, { method: 'POST', body: data, credentials: sansSession ? 'omit' : 'same-origin' });
	const html = await res.text();
	const nouveau = new DOMParser().parseFromString(html, 'text/html').querySelector('form');
	if (nouveau) form.replaceWith(document.importNode(nouveau, true));
	return html;
}, [params, sansSession]);

test('fixtures de cvt.js', async ({ page }) => {
	const id = await editer(page, 'Texte');
	mkdirSync(dossier, { recursive: true });
	const ecrire = (nom, html) => writeFileSync(new URL(`${nom}.html`, dossier), html);
	ecrire('formulaire', await page.evaluate(() => document.querySelector('.tts-services[data-tts-champ=texte]').outerHTML));
	ecrire('titre_lien', await poster(page, { operation: 'titre_lien', cibles: JSON.stringify([`art${id}`, 'https://www.spip.net/fr', 'art999999']) }));
	ecrire('erreurs', await poster(page, { operation: 'previsu_modele', modele: '<zzz1>' }));
	ecrire('sans_session', await poster(page, { operation: 'titre_lien', cibles: JSON.stringify([`art${id}`]) }, { sansSession: true }));
});
