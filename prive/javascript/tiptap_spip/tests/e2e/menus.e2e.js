// Menus de la barre dans le formulaire d'édition de l'espace privé, sur un site SPIP JETABLE :
// Le formulaire coupe ce qui dépasse ; le menu doit rester affiché, même près de son bord inférieur.
// Oracle indépendant du code testé : le menu amené dans la vue, ses coins et son dernier élément
// doivent être ceux que le navigateur affiche à ces points (elementFromPoint).
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, editer } from './site.js';

configure(test);

/** Points du menu ouvert que le navigateur n'affiche pas (masqués ou hors de la fenêtre). */
const masques = (liste) => liste.evaluate((l) => {
	l.scrollIntoView({ block: 'nearest' });
	const visible = (x, y) => l.contains(document.elementFromPoint(x, y));
	const rect = l.getBoundingClientRect();
	const points = {
		'haut gauche': [rect.left + 2, rect.top + 2],
		'haut droit': [rect.right - 2, rect.top + 2],
		'bas gauche': [rect.left + 2, rect.bottom - 2],
		'bas droit': [rect.right - 2, rect.bottom - 2],
	};
	const dehors = Object.entries(points).filter(([, [x, y]]) => !visible(x, y)).map(([nom]) => `coin ${nom}`);
	const dernier = [...l.querySelectorAll('[role^=menuitem]')].at(-1);
	dernier.scrollIntoView({ block: 'nearest' });
	const d = dernier.getBoundingClientRect();
	if (!visible(d.left + d.width / 2, d.top + d.height / 2)) dehors.push('dernier élément');
	return dehors;
});

/** En plein écran, la fenêtre borne la liste : une liste qui défile doit en occuper toute la hauteur. */
const reduiteATort = (liste) => liste.evaluate((l) => {
	const rect = l.getBoundingClientRect();
	return l.scrollHeight > l.clientHeight && rect.bottom < window.innerHeight - 20 && rect.top > 20;
});

/**
 * Texte des tests : avec un multi, pour que le menu de la langue affichée (masqué sans multi) soit
 * présent et vérifié comme les autres.
 */
const TEXTE = 'Texte <multi>[fr]un[en]one</multi>';

/** Ouvre chaque menu affiché de la barre et vérifie qu'il est entièrement affiché. */
async function chaqueMenu(page, { pleinEcran = false } = {}) {
	// un menu masqué (langue affichée sans multi, outil absent) ne s'ouvre pas : il n'est pas parcouru
	const menus = page.locator('.tts-editor .tts-toolbar .tts-menu:not([hidden]) > button');
	const n = await menus.count();
	expect(n).toBeGreaterThan(0);
	for (let k = 0; k < n; k++) {
		const bouton = menus.nth(k);
		await bouton.scrollIntoViewIfNeeded();
		await bouton.click();
		const liste = page.locator('.tts-menu__liste:not([hidden])');
		await expect(liste).toBeVisible();
		const nom = `menu ${await bouton.getAttribute('aria-label')}`;
		expect(await masques(liste), nom).toEqual([]);
		if (pleinEcran) expect(await reduiteATort(liste), `${nom} réduit à tort`).toBe(false);
		await page.keyboard.press('Escape');
		await expect(liste).toBeHidden();
	}
}

// 640 et 1440 px : le menu Modèle dépassait à droite du formulaire (reproduit sans le correctif)
for (const largeur of [640, 1440]) {
	test(`fenêtre de ${largeur} px : chaque menu ouvert est entièrement affiché`, async ({ page }) => {
		await page.setViewportSize({ width: largeur, height: 700 });
		await editer(page, TEXTE);
		await expect(page.locator('.tts-toolbar .tts-menu:not([hidden]) > button[aria-label^="Langue affichée"]')).toHaveCount(1);
		await chaqueMenu(page);
	});
}

// plein écran : la page ne défile plus (html en overflow: hidden), la fenêtre borne la liste ; le
// formulaire de l'espace privé, sous l'éditeur fixe, ne la coupe plus
for (const hauteur of [420, 220]) {
	test(`plein écran, fenêtre de ${hauteur} px de haut : chaque menu tient dans la fenêtre, sans réduction inutile`, async ({ page }) => {
		await page.setViewportSize({ width: 1000, height: hauteur });
		await editer(page, TEXTE);
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('F11');
		await expect(page.locator('.tts-editor--plein-ecran')).toBeVisible();
		await chaqueMenu(page, { pleinEcran: true });
	});
}

test('menu Tableau près du bas du formulaire : ses actions restent affichées', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 700 });
	const long = Array.from({ length: 80 }, (_, k) => `Paragraphe ${k + 1} d'un texte assez long pour faire défiler la page.`).join('\n\n');
	await editer(page, long);
	await page.evaluate(() => {
		const formulaire = document.querySelector('.cadre-formulaire-editer .formulaire_spip:has(.tts-toolbar)');
		const suite = document.createElement('div');
		suite.style.height = '3000px';
		formulaire.closest('.cadre-formulaire-editer').after(suite);
		window.scrollTo(0, formulaire.getBoundingClientRect().bottom + window.scrollY - 550);
	});
	const bouton = page.locator('.tts-toolbar button[aria-label="Tableau"][aria-haspopup="menu"]');
	await bouton.click();
	await page.evaluate(() => {
		const formulaire = document.querySelector('.cadre-formulaire-editer .formulaire_spip:has(.tts-toolbar)');
		window.scrollTo(0, formulaire.getBoundingClientRect().bottom + window.scrollY - 120);
	});
	const liste = page.locator('.tts-menu__liste:not([hidden])');
	const derniereVisible = () => liste.evaluate((l) => {
		const dernier = [...l.querySelectorAll('[role^=menuitem]')].at(-1);
		const rect = dernier.getBoundingClientRect();
		return l.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
	});
	await expect.poll(derniereVisible).toBe(true);
	await page.keyboard.press('Escape');
	await bouton.click();
	await expect.poll(derniereVisible).toBe(true);
});

test('redimensionnement : le défilement interne du menu est conservé', async ({ page }) => {
	await page.setViewportSize({ width: 1000, height: 220 });
	await editer(page, 'Texte');
	await page.locator('.ProseMirror').click();
	await page.keyboard.press('F11');
	await page.locator('.tts-toolbar button[aria-label="Tableau"][aria-haspopup="menu"]').click();
	const liste = page.locator('.tts-menu__liste:not([hidden])');
	await liste.evaluate((l) => { l.scrollTop = 100; });
	await page.setViewportSize({ width: 999, height: 220 });
	expect(await liste.evaluate((l) => l.scrollTop)).toBe(100);
});
