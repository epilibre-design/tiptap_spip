// Bout en bout dans l'espace privé d'un site SPIP JETABLE : un article est édité avec l'éditeur
// puis enregistré, et le texte en base est comparé octet pour octet à ce que SPIP enregistre pour
// le même formulaire soumis SANS l'éditeur (le navigateur convertit les fins de ligne d'un
// textarea en CRLF à la soumission : c'est la référence, pas la source brute).
// Usage : TTS_SITE=<racine du site jetable> TTS_URL=http://127.0.0.1:<port> npm run e2e
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const driver = `${repo}tests/e2e/site.php`;
const env = { ...process.env, SPIP_ROOT: process.env.TTS_SITE };

const php = (args, input) => execFileSync('php', [driver, ...args], { env, input, encoding: 'utf8' });
const texte = (id) => php(['texte', String(id)]);

/**
 * Crée un article, ouvre une session et charge sa page d'édition.
 * @param {{ sansEditeur?: boolean }} options  sansEditeur : bundle bloqué, textarea natif
 */
async function editer(page, source, { sansEditeur = false } = {}) {
	const { id_article: id, cookie } = JSON.parse(php(['preparer', 'tts-e2e'], source));
	const url = new URL(process.env.TTS_URL);
	await page.context().addCookies([{ name: 'spip_session', value: cookie, domain: url.hostname, path: '/' }]);
	if (sansEditeur) await page.route(/tiptap_spip(\.min)?\.js/, (route) => route.abort());
	await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
	if (!sansEditeur) await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
	return id;
}

/** Fins de ligne telles que le navigateur les soumet. */
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

const enregistrer = async (page) => {
	await Promise.all([
		page.waitForURL(/exec=article&/),
		page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
	]);
};

test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

for (const fichier of ['base.spip', 'melanges.spip', 'blancs.spip', 'liens.spip', 'modeles.spip']) {
	test(`${fichier} : enregistré sans modification, le texte est inchangé`, async ({ page }) => {
		const source = readFileSync(`${repo}tests/corpus/${fichier}`, 'utf8');
		const id = await editer(page, source);
		await expect(page.locator('textarea[name=texte]')).toBeHidden();
		await expect(page.locator('.markItUp')).toHaveCount(0);
		await enregistrer(page);

		const temoin = await editer(page, source, { sansEditeur: true });
		await enregistrer(page);
		// pas texte(temoin) === crlf(source) : un saut de ligne en tête de <textarea> est ignoré
		// par le navigateur (règle HTML), SPIP le perd avec ou sans éditeur
		expect(texte(id)).toBe(texte(temoin));
	});
}

test('une modification ne réécrit que son paragraphe', async ({ page }) => {
	const source = '{{{Titre}}}\n\n\nUn  paragraphe {{gras}}.\n\n\n-* liste\n-* suite\n';
	const id = await editer(page, source);
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('End');
	await page.keyboard.type(' Ajout');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf('{{{Titre}}}\n\n\nUn  paragraphe {{gras}}. Ajout\n\n\n-* liste\n-* suite\n'));
});

test('mode source : la saisie dans le textarea est reprise par l\'éditeur', async ({ page }) => {
	const id = await editer(page, 'Avant');
	await page.locator('.tts-mode').click();
	const textarea = page.locator('textarea[name=texte]');
	await expect(textarea).toBeVisible();
	await textarea.fill('{{Après}}');
	await page.locator('.tts-mode').click();
	await expect(page.locator('.ProseMirror strong')).toHaveText('Après');
	await enregistrer(page);
	expect(texte(id)).toBe('{{Après}}');
});
