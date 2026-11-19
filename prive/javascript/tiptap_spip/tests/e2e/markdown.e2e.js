// Blocs <md> du plugin Markdown (spec 05 §6) sur un site SPIP JETABLE 4.4 (le plugin exige
// [4.4.0;4.*]). Usage et serveur : cf. article.e2e.js ; le site doit contenir le plugin markdown
// (spip-contrib-extensions/markdown) dans plugins/, en syntaxe SPIP par défaut.
import { expect, test } from '@playwright/test';
import { activer, configure, crlf, editer, enregistrer, publier, selectionStable, texte } from './site.js';

configure(test);
test.beforeAll(() => activer('markdown'));

const SOURCE = 'Intro {{SPIP}}.\n\n<md>\n## Titre md\n\nDu **gras** et une liste :\n\n- un\n- deux\n</md>\n\nFin.';

test('bloc <md> en texte brut, restitué à l\'identique, rendu par le plugin', async ({ page }) => {
	const id = await editer(page, SOURCE);
	expect(await page.evaluate(() => window.spipConfig.tiptap_spip.markdown)).toBe(true);
	const bloc = page.locator('.ProseMirror pre.tts-markdown');
	await expect(bloc).toHaveCount(1);
	await expect(bloc).toHaveText('\n## Titre md\n\nDu **gras** et une liste :\n\n- un\n- deux\n');
	// le texte SPIP autour reste du SPIP
	await expect(page.locator('.ProseMirror > p strong')).toHaveText('SPIP');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(SOURCE));
	publier(id);
	await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
	await expect(page.locator('h2', { hasText: 'Titre md' })).toBeVisible();
	await expect(page.locator('strong', { hasText: 'gras' })).toBeVisible();
	await expect(page.locator('li', { hasText: 'deux' })).toBeVisible();
});

test('Markdown saisi dans le bloc écrit tel quel ; gras de la barre sans effet', async ({ page }) => {
	const id = await editer(page, 'Intro\n\n<md>Du *texte*</md>');
	const bloc = page.locator('.ProseMirror pre.tts-markdown');
	await bloc.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.type(' et **plus**');
	// sélection dans le bloc : la mark gras n'y est pas permise
	await page.keyboard.press('Shift+Home');
	await page.keyboard.press('Control+b');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf('Intro\n\n<md>Du *texte* et **plus**</md>'));
});
