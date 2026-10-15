// Bout en bout dans l'espace privé d'un site SPIP JETABLE : un article est édité avec l'éditeur
// puis enregistré, et le texte en base est comparé octet pour octet à ce que SPIP enregistre pour
// le même formulaire soumis SANS l'éditeur (le navigateur convertit les fins de ligne d'un
// textarea en CRLF à la soumission : c'est la référence, pas la source brute).
// Usage : TTS_SITE=<racine du site jetable> TTS_URL=http://127.0.0.1:<port> [TTS_PHP=php8.3] npm run e2e
// (Chromium, Firefox et WebKit, installés par `npx playwright install` ; un seul : -- --project=chromium ;
// TTS_PHP : PHP du pilote site.php, celui du site, php par défaut)
// Serveur : PHP_CLI_SERVER_WORKERS=4 php -d opcache.revalidate_freq=0 -S 127.0.0.1:<port> -t <racine du site jetable>
// (plusieurs processus : SPIP 4.2 s'appelle lui-même au premier rendu public)
// (site.php active le plugin en ligne de commande, ce qui réécrit les caches de plugins de SPIP ;
// sans cette option, OPcache du serveur PHP sert encore l'ancien charger_pipelines.php pendant
// 2 secondes et la première page s'affiche sans l'éditeur)
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { configure, crlf, editer, enregistrer, repo, texte } from './site.js';

configure(test);

for (const fichier of ['base.spip', 'melanges.spip', 'blancs.spip', 'liens.spip', 'modeles.spip', 'notes.spip', 'glossaire.spip', 'multi.spip']) {
	test(`${fichier} : enregistré sans modification, le texte est inchangé`, async ({ page }) => {
		const source = readFileSync(`${repo}tests/corpus/${fichier}`, 'utf8');
		const id = await editer(page, source);
		await expect(page.locator('textarea[name=texte]')).toBeHidden();
		// porte-plume retiré du texte ; les autres champs (chapeau…) peuvent le garder
		await expect(page.locator('.editer_texte .markItUp')).toHaveCount(0);
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
	await page.locator('.tts-outil--source').click();
	const textarea = page.locator('textarea[name=texte]');
	await expect(textarea).toBeVisible();
	await textarea.fill('{{Après}}');
	await page.locator('.tts-outil--source').click();
	await expect(page.locator('.ProseMirror strong')).toHaveText('Après');
	await enregistrer(page);
	expect(texte(id)).toBe('{{Après}}');
});
