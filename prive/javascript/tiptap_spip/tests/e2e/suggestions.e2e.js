import { expect, test } from '@playwright/test';
import { configure, editer, module, verifierBundleServi } from './site.js';

configure(test);
test.beforeEach(async ({ page }) => {
	const bundle = verifierBundleServi(page);
	await editer(page, 'Un texte à conserver.');
	await bundle;
	await module(page);
});

test('bundle du checkout servi et module courant accessible', async ({ page }) => {
	expect(await page.evaluate(() => window.__tts.instances.size)).toBe(1);
	await expect(page.locator('.tts-content .ProseMirror')).toHaveText('Un texte à conserver.');
});
