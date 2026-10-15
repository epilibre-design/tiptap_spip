// Coller des images (spec 10) sur un site SPIP JETABLE : opération deposer_image du formulaire de
// services, collage dans l'éditeur visuel et en mode source, soumission retenue pendant les envois,
// crayons. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { activer, configure, configurer, creerAuteur, documents, editer, enregistrer, lireConfig, module, publier, selectionStable, texte } from './site.js';

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
		// extension de chaque type, celle que medias reconnaît
		expect(images.extensions).toMatchObject({ 'image/png': 'png', 'image/jpeg': 'jpg' });
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

/**
 * Colle des fichiers dans l'élément : événement paste synthétique avec un vrai DataTransfer
 * (Chromium, Firefox et WebKit le construisent ; clipboardData est posé par defineProperty, que
 * ClipboardEvent n'accepte pas partout).
 */
const coller = (page, selecteur, fichiers, { html = '', texte: brut = '' } = {}) => page.evaluate(([selecteur, fichiers, html, brut, PNG]) => {
	const dt = new DataTransfer();
	for (const { nom = 'image.png', type = 'image/png', base64 = PNG } of fichiers) {
		dt.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	}
	if (html) dt.setData('text/html', html);
	if (brut) dt.setData('text/plain', brut);
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: dt });
	document.querySelector(selecteur).dispatchEvent(event);
}, [selecteur, fichiers, html, brut, PNG]);

/** Curseur à la fin du premier paragraphe de l'éditeur. */
const finDuTexte = async (page, racine = '.tts-editor') => {
	await page.locator(`${racine} .ProseMirror p`).first().click();
	await page.keyboard.press('End');
	await selectionStable(page);
};

const envoisTermines = (page) => expect(page.locator('.tts-envoi')).toHaveCount(0, { timeout: 10_000 });

/** Ralentit les envois deposer_image : la soumission arrive pendant qu'ils sont en cours. */
const ralentirEnvois = (page, url) => page.route(url, async (route) => {
	const corps = route.request().postDataBuffer();
	if (route.request().method() === 'POST' && corps?.includes('deposer_image')) {
		await new Promise((r) => setTimeout(r, 1500));
	}
	await route.continue();
});

test.describe('collage', () => {
	test('un PNG : <docN> dans le texte enregistré, document lié', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}]);
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(1);
		await envoisTermines(page);
		const [doc] = documents('article', id);
		expect(doc.mode).toBe('document');
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('texte sélectionné conservé (comme Crayons), image insérée après lui', async ({ page }) => {
		const id = await editer(page, 'Avant après');
		await module(page);
		// sélection posée par l'éditeur : un double-clic dépend du rendu de chaque navigateur
		const choisi = await page.evaluate(() => {
			const { editor } = [...window.__tts.instances][0];
			editor.commands.focus();
			editor.commands.setTextSelection({ from: 7, to: 12 });
			const { from, to } = editor.state.selection;
			return editor.state.doc.textBetween(from, to);
		});
		expect(choisi).toBe('après');
		await coller(page, '.tts-editor .ProseMirror', [{}]);
		await envoisTermines(page);
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Avant après<doc${doc.id_document}>`);
	});

	test('deux PNG en un geste : deux <docN> dans l\'ordre, deux documents', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{ nom: 'premier.png' }, { nom: 'second.png' }]);
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(2, { timeout: 10_000 });
		await envoisTermines(page);
		const docs = documents('article', id);
		expect(docs).toHaveLength(2);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${docs[0].id_document}><doc${docs[1].id_document}>`);
	});

	test('article nouveau : documents rattachés à l\'article créé', async ({ page }) => {
		await editer(page, 'x');
		await page.goto('/ecrire/?exec=article_edit&new=oui&id_rubrique=1');
		await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
		await page.locator('input[name=titre]').fill('Article nouveau avec images');
		await page.locator('.tts-editor .ProseMirror').click();
		await selectionStable(page);
		await coller(page, '.tts-editor .ProseMirror', [{}, {}]);
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(2, { timeout: 10_000 });
		await envoisTermines(page);
		await Promise.all([
			page.waitForURL(/exec=article&id_article=\d+/),
			page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
		]);
		const id = Number(new URL(page.url()).searchParams.get('id_article'));
		const docs = documents('article', id);
		expect(docs).toHaveLength(2);
		expect(texte(id)).toBe(docs.map((d) => `<doc${d.id_document}>`).join(''));
	});

	test('mode source : <docN> à la place du marqueur', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await module(page);
		await page.evaluate(() => [...window.__tts.instances][0].toggleMode());
		const textarea = page.locator('.tts-editor textarea');
		await expect(textarea).toBeVisible();
		await textarea.press('End');
		await coller(page, '.tts-editor textarea', [{}]);
		await expect(textarea).toHaveValue(/^Texte<doc\d+>$/, { timeout: 10_000 });
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('soumission pendant l\'envoi : retenue, puis relancée, sans marqueur', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await ralentirEnvois(page, /exec=article_edit/);
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}]);
		await page.locator('.formulaire_editer_article .boutons [type=submit]').first().click();
		await expect(page.locator('.tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
		await page.waitForURL(/exec=article&/, { timeout: 15_000 });
		const [doc] = documents('article', id);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('tableau HTML + PNG : tableau collé, rien envoyé', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}], { html: '<table><tr><td>A</td><td>B</td></tr></table>', texte: 'A\tB' });
		await expect(page.locator('.tts-editor table')).toHaveCount(1);
		expect(documents('article', id)).toEqual([]);
	});

	test('type refusé : message, rien inséré', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{ nom: 'doc.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64') }]);
		await expect(page.locator('.tts-etat__message')).toHaveText('Type de fichier non accepté : doc.pdf.');
		expect(documents('article', id)).toEqual([]);
	});

	test('formulaire AJAX à deux boutons : la reprise poste le bouton cliqué', async ({ page }) => {
		configurer('tiptap_spip/public', 'oui');
		activer('tts_test');
		const id = await editer(page, 'x');
		await page.goto(`/spip.php?page=tts_test_ajax&id_article=${id}&var_mode=calcul`);
		const formulaire = '.formulaire_tts_test_ajax';
		await expect(page.locator(`${formulaire} .tts-editor .ProseMirror`)).toBeVisible();
		await module(page);
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		await ralentirEnvois(page, /spip\.php/);
		await page.locator(`${formulaire} .ProseMirror`).click();
		await selectionStable(page);
		await coller(page, `${formulaire} .ProseMirror`, [{}]);
		await page.getByRole('button', { name: 'Publier' }).click();
		await expect(page.locator(`${formulaire} .tts-etat__message`)).toHaveText(/Une image est en cours d’envoi/);
		// réponse AJAX : le formulaire est rechargé dans la page, sans navigation
		await expect(page.locator(`${formulaire} .reponse_formulaire_ok`)).toHaveText(/^Bouton : publier ; texte : <doc\d+>$/, { timeout: 15_000 });
	});
});

const crayons = existsSync(`${process.env.TTS_SITE}/plugins/crayons`);

test.describe('crayon', () => {
	test.skip(!crayons, 'plugin crayons absent du site');
	test.beforeAll(() => {
		if (!crayons) return;
		activer('crayons');
		configurer('tiptap_spip/crayons', 'oui');
	});

	/** Article public, crayon de son texte ouvert, services à la demande arrivés, envois ralentis. */
	const ouvrirCrayon = async (page) => {
		const id = await editer(page, 'Texte du crayon.');
		publier(id);
		await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
		await module(page);
		await page.locator(`.crayon.article-texte-${id}`).dblclick();
		await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		await finDuTexte(page, '.crayon-html .tts-editor');
		await ralentirEnvois(page, /spip\.php/);
		return id;
	};

	test('services à la demande : collage envoyé, document lié, soumission par cQuery retenue puis relancée', async ({ page }) => {
		const id = await ouvrirCrayon(page);
		await coller(page, '.crayon-html .tts-editor .ProseMirror', [{}]);
		await page.locator('.crayon-html .crayon-submit').click();
		await expect(page.locator('.crayon-html .tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
		await expect(page.locator('.crayon-html')).toHaveCount(0, { timeout: 15_000 });
		const [doc] = documents('article', id);
		expect(texte(id)).toBe(`Texte du crayon.<doc${doc.id_document}>`);
	});

	test('soumission retenue puis fermeture du crayon : rien n\'est enregistré', async ({ page }) => {
		const id = await ouvrirCrayon(page);
		await coller(page, '.crayon-html .tts-editor .ProseMirror', [{}]);
		await page.locator('.crayon-html .crayon-submit').click();
		await expect(page.locator('.crayon-html .tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
		await page.locator('.crayon-html .crayon-cancel').click();
		await expect(page.locator('.crayon-html')).toHaveCount(0);
		await page.waitForTimeout(2500);
		expect(texte(id)).toBe('Texte du crayon.');
	});
});
