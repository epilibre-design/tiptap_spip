// Coller des images (spec 10) sur un site SPIP JETABLE : opération deposer_image du formulaire de
// services, collage dans l'éditeur visuel et en mode source, soumission retenue pendant les envois,
// crayons. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, configurer, creerAuteur, documents, editer, lireConfig, publier } from './site.js';

configure(test);

/** PNG 1×1 (le même que tests/e2e/site.php). */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.beforeAll(() => configurer('tiptap_spip/coller_images', 'oui'));

/** Configuration du collage annoncée par le formulaire de services du champ texte. */
const annonce = (page) => page.evaluate(() => {
	const brut = document.querySelector('.tts-services[data-tts-champ=texte] form')?.dataset.ttsImages;
	return brut ? JSON.parse(brut) : null;
});

/**
 * Poste deposer_image avec un fichier, comme cvt.js, et lit la réponse : résultat ou erreurs.
 * Le formulaire de services est remplacé par celui de la réponse.
 */
const deposer = (page, { nom = 'capture.png', base64 = PNG, type = 'image/png' } = {}) => page.evaluate(async ([nom, base64, type]) => {
	const form = document.querySelector('.tts-services[data-tts-champ=texte] form');
	const data = new FormData(form);
	data.set('var_ajax', 'form');
	data.set('operation', 'deposer_image');
	data.set('fichier', new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	const html = await (await fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin' })).text();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const nouveau = doc.querySelector('form');
	if (nouveau) form.replaceWith(document.importNode(nouveau, true));
	const lire = (sel) => (doc.querySelector(sel) ? JSON.parse(doc.querySelector(sel).textContent) : null);
	return { ok: lire('script.tts-resultat'), erreurs: lire('script.tts-erreurs') };
}, [nom, base64, type]);

test.describe('serveur', () => {
	test('annonce : types acceptés et taille maximale ; rien si le réglage est désactivé', async ({ page }) => {
		await editer(page, 'Texte');
		const images = await annonce(page);
		expect(images.types).toEqual(expect.arrayContaining(['image/png', 'image/jpeg', 'image/gif']));
		expect(images.taille).toBeGreaterThan(0);
		configurer('tiptap_spip/coller_images', 'non');
		try {
			await page.reload();
			expect(await annonce(page)).toBeNull();
		} finally {
			configurer('tiptap_spip/coller_images', 'oui');
		}
	});

	test('deposer_image : document lié à l\'article, en mode document, raccourci docN', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const { ok, erreurs } = await deposer(page);
		expect(erreurs).toBeNull();
		expect(ok.operation).toBe('deposer_image');
		expect(ok.resultat.raccourci).toBe(`doc${ok.resultat.id_document}`);
		expect(documents('article', id)).toEqual([{ id_document: ok.resultat.id_document, mode: 'document', extension: 'png' }]);
		// le formulaire renouvelé accepte un second dépôt
		const second = await deposer(page);
		expect(second.ok.resultat.id_document).toBeGreaterThan(ok.resultat.id_document);
	});

	test('deposer_image : PNG renommé .php refusé, rien n\'est lié', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const { ok, erreurs } = await deposer(page, { nom: 'x.php' });
		expect(ok).toBeNull();
		// SPIP entoure le message d'un <span role='alert'> ; cvt.js n'en garde que le texte
		expect(erreurs.message_erreur.replace(/<[^>]+>/g, '')).toBe('Ce type d’image n’est pas accepté.');
		expect(documents('article', id)).toEqual([]);
	});

	test('disponibilité : article même sans documents_objets, rubrique non, sans objet non', async ({ page }) => {
		await editer(page, 'Texte');
		const avant = lireConfig('documents_objets');
		configurer('documents_objets', '');
		try {
			await page.reload();
			expect(await annonce(page)).not.toBeNull();
			// page de services à la demande : même charger(), contexte passé dans l'URL
			const services = async (query) => {
				const html = await (await page.request.get(`/spip.php?page=tiptap_spip_services&${query}`)).text();
				return /data-tts-images=/.test(html);
			};
			expect(await services('objet=rubrique&id_objet=1&champ=texte')).toBe(false);
			expect(await services('objet=&id_objet=0&champ=descriptif_site')).toBe(false);
		} finally {
			configurer('documents_objets', avant);
		}
	});

	test('rédacteur sans droit sur l\'article : pas de services, donc pas de dépôt', async ({ page }) => {
		const redacteur = creerAuteur('1comite');
		// article de l'administrateur publié : un rédacteur ne peut pas le modifier
		const id = await editer(page, 'Texte');
		publier(id);
		await editer(page, 'Autre', { auteur: redacteur });
		await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
		expect(await page.locator('.tts-services[data-tts-champ=texte]').count()).toBe(0);
	});
});
