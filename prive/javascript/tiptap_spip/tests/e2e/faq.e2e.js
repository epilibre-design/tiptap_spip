// Plugin d'exemple exemples/tiptap_spip_faq (lot L6, spec 07) sur un site SPIP JETABLE : une
// extension tierce ajoutée sans modifier tiptap_spip (script, bouton, libellés, rendu). Usage et
// serveur : cf. article.e2e.js ; le site doit contenir exemples/tiptap_spip_faq dans plugins/.
import { expect, test } from '@playwright/test';
import { activer, configure, crlf, editer, enregistrer, publier, selectionStable, texte } from './site.js';

configure(test);
test.beforeAll(() => activer('tiptap_spip_faq'));

const FAQ = 'Intro\n\n<faq|q=Pourquoi SPIP ?>\nParce que {{SPIP}}.\n\nEt voilà.\n</faq>\n\nFin';

test('FAQ lue par l\'extension du plugin, restituée à l\'identique, rendue par le plugin', async ({ page }) => {
	const id = await editer(page, FAQ);
	const faq = page.locator('.ProseMirror .faq-tiptap');
	await expect(faq).toHaveAttribute('data-question', 'Pourquoi SPIP ?');
	await expect(faq.locator('p')).toHaveText(['Parce que SPIP.', 'Et voilà.']);
	await expect(faq.locator('strong')).toHaveText('SPIP');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(FAQ));
	publier(id);
	await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
	await expect(page.locator('.faq .faq__question')).toHaveText('Pourquoi SPIP ?');
});

test('bouton FAQ : réponse sélectionnée mise en FAQ, question modifiée, source enregistrée', async ({ page }) => {
	const id = await editer(page, 'Intro\n\nLa réponse.');
	const bouton = page.locator('.tts-toolbar .tts-outil--faq');
	await expect(bouton).toHaveText('FAQ');
	await page.locator('.ProseMirror p').nth(1).click();
	await selectionStable(page);
	await bouton.click();
	const question = page.locator('.tts-popover--faq input[name=question]');
	await expect(question).toBeFocused();
	// question invalide : refusée avec le libellé du plugin
	await question.fill('a > b');
	await page.keyboard.press('Enter');
	await expect(page.locator('.tts-popover--faq .tts-popover__erreur')).toHaveText('La question est obligatoire, sur une ligne, sans >.');
	await question.fill('Une question ?');
	await page.keyboard.press('Enter');
	await expect(page.locator('.ProseMirror .faq-tiptap')).toHaveAttribute('data-question', 'Une question ?');
	await expect(bouton).toHaveClass(/tts-outil--actif/);
	// dans la FAQ : le bouton modifie la question
	await bouton.click();
	await expect(question).toHaveValue('Une question ?');
	await question.fill('Autre question ?');
	await page.keyboard.press('Enter');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf('Intro\n\n<faq|q=Autre question ?>\nLa réponse.\n</faq>'));
});

test('configuration : bouton dans la barre edition seulement, script et libellés du plugin transmis', async ({ page }) => {
	await editer(page, 'x');
	const { forum, edition } = await page.evaluate(() => ({
		forum: window.spipConfig.tiptap_spip.toolbars.forum.includes('faq'),
		edition: window.spipConfig.tiptap_spip.toolbars.edition.includes('faq'),
	}));
	expect({ forum, edition }).toEqual({ forum: false, edition: true });
	expect(await page.evaluate(() => window.spipConfig.tiptap_spip.extensions.some((u) => u.includes('tiptap_spip_faq.js')))).toBe(true);
	expect(await page.evaluate(() => window.spipConfig.tiptap_spip.i18n.faq)).toBe('FAQ');
});
