// Formulaire de services de l'éditeur (spec 02 §5) sur un site SPIP JETABLE : appels AJAX réels
// depuis la page d'édition d'un article. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, creerDocument, editer, module } from './site.js';

configure(test);

/** Appelle une opération des services du premier éditeur de la page. */
const appeler = (page, operation, params) => page.evaluate(async ([operation, params]) => {
	const { services } = [...window.__tts.instances][0];
	try {
		return { resultat: await services.call(operation, params) };
	} catch (e) {
		return { erreur: e.name, erreurs: e.erreurs ?? null, disponible: services.available };
	}
}, [operation, params]);

let id;
let idDocument;

test.beforeEach(async ({ page }) => {
	id = await editer(page, 'Texte de test', { avant: (idArticle) => { idDocument = creerDocument(idArticle); } });
	await module(page);
});

test('l\'éditeur est relié au formulaire de services de son champ', async ({ page }) => {
	const lien = await page.evaluate(() => {
		const { services, textarea } = [...window.__tts.instances][0];
		return { services: services?.container.dataset.ttsInstance, form: textarea.form.dataset.ttsInstance, champ: services?.container.dataset.ttsChamp };
	});
	expect(lien.services).toMatch(/^tts-[0-9a-f]{12}$/);
	expect(lien.services).toBe(lien.form);
	expect(lien.champ).toBe('texte');
});

test('titre_lien : titre des objets visibles, rien pour un objet absent', async ({ page }) => {
	const { resultat } = await appeler(page, 'titre_lien', { cibles: [`art${id}`, 'art999999', 'https://www.spip.net/fr', '#ancre'] });
	expect(resultat[0]).toMatchObject({ cible: `art${id}`, titre: 'Test tiptap_spip', objet: 'article', id });
	expect(resultat[1]).toMatchObject({ titre: null, objet: 'article', id: 999999 });
	expect(resultat[2]).toMatchObject({ url: 'https://www.spip.net/fr' });
	expect(resultat[3]).toMatchObject({ titre: null, url: null });
});

test('previsu_modele : HTML du modèle calculé par SPIP', async ({ page }) => {
	const { resultat } = await appeler(page, 'previsu_modele', { modele: `<doc${idDocument}|left>` });
	expect(resultat).toMatch(/<img[^>]+tts-[0-9a-f]{8}\.png/);
	expect(resultat).not.toMatch(/<script/i);
});

test('rechercher : objets dont le titre correspond, les plus récents d\'abord', async ({ page }) => {
	const titre = `Recherche ${Date.now()}`;
	const autre = await editer(page, 'x', { titre });
	await module(page);
	const { resultat } = await appeler(page, 'rechercher', { q: titre.slice(3), objets: ['article', 'rubrique'] });
	expect(resultat).toEqual([{ objet: 'article', id: autre, titre, raccourci: `article${autre}` }]);
	const tous = (await appeler(page, 'rechercher', { q: 'Test tiptap', objets: ['article'] })).resultat;
	expect(tous[0].id).toBe(id);
	expect(tous.length).toBeLessThanOrEqual(20);
});

test('verifier() refuse une demande invalide, le service reste disponible', async ({ page }) => {
	const r = await appeler(page, 'previsu_modele', { modele: '<doc1> <doc2>' });
	expect(r).toMatchObject({ erreur: 'ServiceError', disponible: true });
	expect(r.erreurs.modele).toBe('Raccourci de modèle invalide.');
	expect((await appeler(page, 'operation_inconnue', {})).erreur).toBe('ServiceError');
	expect((await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).resultat).toHaveLength(1);
});

for (const champ of ['formulaire_action_args', 'formulaire_action_sign']) {
	test(`${champ} falsifié : SPIP ne traite pas la demande, mode dégradé`, async ({ page }) => {
		await page.evaluate((champ) => {
			const input = document.querySelector(`.tts-services [name=${champ}]`);
			input.value = `${input.value.slice(0, -4)}${input.value.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`;
		}, champ);
		expect(await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).toMatchObject({ erreur: 'ServiceUnavailable', disponible: false });
	});
}
