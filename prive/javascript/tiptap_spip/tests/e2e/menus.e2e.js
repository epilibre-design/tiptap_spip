// Menus de la barre dans le formulaire d'édition de l'espace privé, sur un site SPIP JETABLE :
// .cadre-formulaire-editer .formulaire_spip est en overflow: hidden, un menu ouvert ne doit pas en
// dépasser (signalé par l'utilisateur : menus coupés à droite, menu Tableau coupé en bas).
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

/** Ouvre chaque menu de la barre et vérifie qu'il est entièrement affiché. */
async function chaqueMenu(page, { pleinEcran = false } = {}) {
	const menus = page.locator('.tts-editor .tts-toolbar .tts-menu > button');
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
		await editer(page, 'Texte');
		await chaqueMenu(page);
	});
}

// plein écran : la page ne défile plus (html en overflow: hidden), la fenêtre borne la liste ; le
// formulaire de l'espace privé, sous l'éditeur fixe, ne la coupe plus
for (const hauteur of [420, 220]) {
	test(`plein écran, fenêtre de ${hauteur} px de haut : chaque menu tient dans la fenêtre, sans réduction inutile`, async ({ page }) => {
		await page.setViewportSize({ width: 1000, height: hauteur });
		await editer(page, 'Texte');
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('F11');
		await expect(page.locator('.tts-editor--plein-ecran')).toBeVisible();
		await chaqueMenu(page, { pleinEcran: true });
	});
}
