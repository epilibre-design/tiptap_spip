// Interface des liens et modèles (lot L2.3) sur un site SPIP JETABLE : prévisualisation, titres des
// liens sans texte, popover de lien avec recherche, insertion de modèle, enregistrement.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, creerDocument, crlf, ecrireTexte, editer, enregistrer, selectionStable, texte } from './site.js';

configure(test);

test('un modèle de document est prévisualisé, un lien sans texte affiche le titre de sa cible', async ({ page }) => {
	let doc;
	const titre = `Cible ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, '', {
		avant: (idArticle) => {
			doc = creerDocument(idArticle);
			const source = `Voir [->art${cible}].\n\n<doc${doc}|left>`;
			// texte posé après la création du document (son id est dans le raccourci)
			ecrireTexte(idArticle, source);
		},
	});
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await expect(page.locator('.tts-link-auto')).toHaveText(titre);
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Voir [->art${cible}].\n\n<doc${doc}|left>`));
});

test('Ctrl+K : recherche d\'un article, lien posé sur la sélection et enregistré', async ({ page }) => {
	const titre = `Destination ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, 'Lire la suite');
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	// Ctrl+K juste après Maj+flèches, sans attendre : le popover doit lire la sélection réelle
	for (let i = 0; i < 'la suite'.length; i++) await page.keyboard.press('Shift+ArrowLeft');
	await page.keyboard.press('ControlOrMeta+k');
	const champ = page.locator('.tts-popover input[name=cible]');
	await expect(champ).toBeFocused();
	await champ.fill(titre.slice(0, 15));
	await page.locator('.tts-popover__suggestions li', { hasText: titre }).click();
	await expect(champ).toHaveValue(`article${cible}`);
	await page.locator('.tts-popover button[name=appliquer]').click();
	await expect(page.locator('.ProseMirror a.tts-link')).toHaveText('la suite');
	await enregistrer(page);
	expect(texte(id)).toBe(`Lire [la suite->article${cible}]`);
});

test('bouton Modèle : raccourci inséré en bloc, prévisualisé, enregistré', async ({ page }) => {
	let doc;
	const id = await editer(page, 'Texte', { avant: (idArticle) => { doc = creerDocument(idArticle); } });
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.press('Enter');
	await page.locator('.tts-toolbar .tts-modele').click();
	await page.locator('.tts-popover input[name=raccourci]').fill(`<doc${doc}|center>`);
	await page.keyboard.press('Enter');
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Texte\n\n<doc${doc}|center>`));
});
