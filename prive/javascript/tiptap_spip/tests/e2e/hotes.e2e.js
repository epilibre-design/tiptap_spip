// Hôtes de l'éditeur (spec 02 §6, spec 08 « Hôtes ») sur un site SPIP JETABLE : crayons du site
// public, formulaire public déclaré par tiptap_spip_contextes (plugin de test tts_test), réglage sans
// objet, services à la demande et leur sécurité, styles. Usage et serveur : cf. article.e2e.js ;
// le site doit contenir les plugins crayons et tts_test (tests/e2e/plugin/tts_test) dans plugins/.
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { activer, configurer, creerAuteur, ecrireTexte, editer, module, php, publier, selectionStable, texte } from './site.js';

test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

// Crayons n'existe pas pour SPIP 5 : ses tests sont sautés sur un site qui ne l'a pas
const crayons = existsSync(`${process.env.TTS_SITE}/plugins/crayons`);
const sansCrayons = () => test.skip(!crayons, 'plugin crayons absent du site');

test.beforeAll(() => {
	activer(...(crayons ? ['crayons'] : []), 'tts_test');
	configurer('tiptap_spip/public', 'oui');
	configurer('tiptap_spip/crayons', 'oui');
});

const instances = (page) => page.evaluate(() => window.__tts.instances.size);
const servicesCharges = (page) => page.locator('#tts-services .tts-services').count();

/** Article publié ouvert dans le site public, session d'administrateur. */
async function articlePublic(page, source, { chapo } = {}) {
	// crayon du chapeau : champs équipés de la configuration par défaut, pas le seul texte de editer()
	const id = await editer(page, source, { champs: chapo ? 'defaut' : 'texte' });
	if (chapo) ecrireTexte(id, chapo, 'chapo');
	publier(id);
	await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
	await module(page);
	// éditeurs déjà présents dans la page (forum…) : leurs services à la demande sont chargés avant
	// qu'un test ne les compte
	await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
	return id;
}

test('crayon public : éditeur et services à la demande, enregistrement, fermeture puis réouverture sans fuite', async ({ page }) => {
	sansCrayons();
	const id = await articlePublic(page, 'Voir [->art1] et du {{gras}}.');
	const base = await instances(page);
	const servicesAvant = await servicesCharges(page);
	const crayon = page.locator(`.crayon.article-texte-${id}`);

	await crayon.dblclick();
	const editeur = page.locator('.crayon-html .tts-editor');
	await expect(editeur.locator('.ProseMirror')).toBeVisible();
	await expect(editeur.locator('.tts-link-auto')).toHaveText('Test tiptap_spip');
	expect(await instances(page)).toBe(base + 1);
	// site public : ce sont les styles du site qui s'appliquent
	await expect(editeur).not.toHaveClass(/tts-styles-contenu/);

	await editeur.locator('.ProseMirror p').click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.type(' Ajout');
	await page.locator('.crayon-html .crayon-submit').click();
	await expect(page.locator('.crayon-html')).toHaveCount(0);
	expect(texte(id)).toBe('Voir [->art1] et du {{gras}}. Ajout');
	await expect.poll(() => instances(page)).toBe(base);

	await crayon.dblclick();
	await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
	expect(await instances(page)).toBe(base + 1);
	await page.locator('.crayon-html .crayon-cancel').click();
	await expect(page.locator('.crayon-html')).toHaveCount(0);
	await expect.poll(() => instances(page)).toBe(base);
	// les formulaires de services chargés à la demande partent avec leur éditeur
	expect(await servicesCharges(page)).toBe(servicesAvant);
});

test('crayon : contenu modifié sans focus puis enregistré aussitôt, le texte enregistré le contient (form-pre-serialize de cQuery)', async ({ page }) => {
	sansCrayons();
	const id = await articlePublic(page, 'Texte du crayon.');
	await page.locator(`.crayon.article-texte-${id}`).dblclick();
	await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
	// modification hors saisie (insertion d'un document, d'un modèle…) : pas de blur, pas encore de
	// recopie différée (150 ms) quand le crayon est soumis par cQuery(…).ajaxSubmit()
	await page.evaluate(() => {
		const { editor } = [...window.__tts.instances].find((i) => i.textarea.closest('.crayon-html'));
		editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' Ajout');
		document.querySelector('.crayon-html .crayon-submit').click();
	});
	await expect(page.locator('.crayon-html')).toHaveCount(0);
	expect(texte(id)).toBe('Texte du crayon. Ajout');
});

test('crayons sans l\'option publique : bundle chargé, crayon équipé, formulaire de forum laissé', async ({ page }) => {
	sansCrayons();
	configurer('tiptap_spip/public', 'non');
	try {
		const id = await articlePublic(page, 'Texte du crayon.');
		const forum = page.locator('.formulaire_forum textarea[name=texte]');
		await expect(forum).toBeVisible();
		await expect(forum).not.toHaveAttribute('data-tts-mounted');
		expect(await instances(page)).toBe(0);
		await page.locator(`.crayon.article-texte-${id}`).dblclick();
		await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
		expect(await instances(page)).toBe(1);
		await page.locator('.crayon-html .crayon-cancel').click();
		await expect(page.locator('.crayon-html')).toHaveCount(0);
	} finally {
		configurer('tiptap_spip/public', 'oui');
	}
});

test('deux crayons ouverts ensemble : deux éditeurs, chacun ses services', async ({ page }) => {
	sansCrayons();
	const id = await articlePublic(page, 'Le texte [->art1].', { chapo: 'Le chapo [->art1].' });
	const base = await instances(page);
	const servicesAvant = await servicesCharges(page);

	await page.locator(`.crayon.article-texte-${id}`).dblclick();
	await page.locator(`.crayon.article-chapo-${id}`).dblclick();
	await expect(page.locator('.crayon-html .tts-editor')).toHaveCount(2);
	expect(await instances(page)).toBe(base + 2);
	await expect.poll(() => servicesCharges(page)).toBe(servicesAvant + 2);
	const champs = await page.evaluate(() => [...window.__tts.instances]
		.filter((i) => i.textarea.closest('.crayon-html'))
		.map((i) => i.services?.container.dataset.ttsChamp).sort());
	expect(champs).toEqual(['chapo', 'texte']);
	await expect(page.locator('.crayon-html .tts-link-auto')).toHaveText(['Test tiptap_spip', 'Test tiptap_spip']);

	// un crayon annulé quitte le DOM : on annule le premier restant, tant qu'il en reste
	await page.locator('.crayon-html .crayon-cancel').first().click();
	await expect(page.locator('.crayon-html')).toHaveCount(1);
	await page.locator('.crayon-html .crayon-cancel').first().click();
	await expect(page.locator('.crayon-html')).toHaveCount(0);
	await expect.poll(() => instances(page)).toBe(base);
	expect(await servicesCharges(page)).toBe(servicesAvant);
});

test('formulaire public déclaré par tiptap_spip_contextes : services reliés au formulaire', async ({ page }) => {
	const id = await editer(page, 'x');
	await page.goto(`/spip.php?page=tts_test&id_article=${id}`);
	await module(page);
	// le lancement importe les extensions tierces avant de créer les éditeurs : l'instance peut
	// manquer encore quand le module est chargé
	const formulaire = () => page.evaluate(() => {
		const instance = [...window.__tts.instances].find((i) => i.textarea.closest('.formulaire_tts_test'));
		return { form: instance?.textarea.form.dataset.ttsInstance, services: instance?.services?.container.dataset.ttsInstance, objet: instance?.services?.container.dataset.ttsObjet };
	});
	await expect.poll(async () => (await formulaire()).form).toMatch(/^tts-[0-9a-f]{12}$/);
	const lien = await formulaire();
	expect(lien.services).toBe(lien.form);
	expect(lien.objet).toBe('article');
});

test('réglage sans objet (descriptif du site) : éditeur et services sans objet, styles de contenu', async ({ page }) => {
	await editer(page, 'x');
	await page.goto('/ecrire/?exec=configurer_identite');
	await module(page);
	const editeur = page.locator('.formulaire_configurer_identite .tts-editor');
	await expect(editeur.locator('.ProseMirror')).toBeVisible();
	await expect(editeur).toHaveClass(/tts-styles-contenu/);
	const r = await page.evaluate(async () => {
		const instance = [...window.__tts.instances].find((i) => i.textarea.name === 'descriptif_site');
		return { objet: instance.services.container.dataset.ttsObjet, titres: await instance.services.call('titre_lien', { cibles: ['https://www.spip.net/fr'] }) };
	});
	expect(r.objet).toBe('');
	expect(r.titres[0]).toMatchObject({ url: 'https://www.spip.net/fr' });
});

test('services à la demande : rien sans droit sur l\'objet, ni pour un champ qui n\'est pas un texte', async ({ page, request }) => {
	const id = await editer(page, 'x');
	const formulaire = async (cookie, params) => {
		const url = new URL('/spip.php', process.env.TTS_URL);
		url.search = new URLSearchParams({ page: 'tiptap_spip_services', ...params }).toString();
		const html = await (await request.get(url.href, { headers: { Cookie: `spip_session=${cookie}`, 'User-Agent': 'tts-e2e' } })).text();
		return html.includes('<form');
	};
	const admin = JSON.parse(php(['preparer', 'tts-e2e'], 'x')).cookie;
	expect(await formulaire(admin, { objet: 'article', id_objet: String(id), champ: 'texte' })).toBe(true);
	expect(await formulaire(admin, { objet: 'article', id_objet: String(id), champ: 'statut' })).toBe(false);
	const redacteur = JSON.parse(php(['preparer', 'tts-e2e', 'Autre', String(creerAuteur('1comite'))], 'x')).cookie;
	expect(await formulaire(redacteur, { objet: 'article', id_objet: String(id), champ: 'texte' })).toBe(false);
	expect(await formulaire('', { objet: '', id_objet: '0', champ: 'texte' })).toBe(false);
});
