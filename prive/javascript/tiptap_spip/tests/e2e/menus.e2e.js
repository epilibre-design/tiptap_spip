// Menus de la barre dans le formulaire d'édition de l'espace privé, sur un site SPIP JETABLE :
// .cadre-formulaire-editer .formulaire_spip est en overflow: hidden, un menu ouvert ne doit pas en
// dépasser (signalé par l'utilisateur : menus coupés à droite, menu Tableau coupé en bas).
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, editer } from './site.js';

configure(test);

// 640 et 1440 px : le menu Modèle dépassait à droite du formulaire (reproduit sans le correctif)
for (const largeur of [640, 1440]) {
	test(`fenêtre de ${largeur} px : chaque menu ouvert reste dans les bornes visibles de son formulaire`, async ({ page }) => {
		await page.setViewportSize({ width: largeur, height: 700 });
		await editer(page, 'Texte');
		const menus = page.locator('.tts-toolbar .tts-menu > button');
		const n = await menus.count();
		expect(n).toBeGreaterThan(0);
		for (let k = 0; k < n; k++) {
			const bouton = menus.nth(k);
			await bouton.scrollIntoViewIfNeeded();
			await bouton.click();
			const liste = page.locator('.tts-menu__liste:not([hidden])');
			await expect(liste).toBeVisible();
			// bornes : fenêtre et ancêtres qui coupent ; coins et dernier élément atteignables
			const hors = await liste.evaluate((l) => {
				// la page défile : en hauteur, seuls les ancêtres qui coupent comptent
				let b = { left: 0, top: -Infinity, right: document.documentElement.clientWidth, bottom: Infinity };
				for (let p = l.parentElement; p && p !== document.body; p = p.parentElement) {
					const s = getComputedStyle(p);
					if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
					const r = p.getBoundingClientRect();
					b = { left: Math.max(b.left, r.left), top: Math.max(b.top, r.top), right: Math.min(b.right, r.right), bottom: Math.min(b.bottom, r.bottom) };
				}
				l.scrollIntoView({ block: 'nearest' });
				const r = l.getBoundingClientRect();
				const dehors = [];
				if (r.left < b.left || r.right > b.right) dehors.push(`horizontal ${r.left}-${r.right} hors de ${b.left}-${b.right}`);
				if (r.bottom > b.bottom) dehors.push(`bas ${r.bottom} > ${b.bottom}`);
				for (const [x, y] of [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]]) {
					if (!l.contains(document.elementFromPoint(x, y))) dehors.push(`coin ${x},${y} masqué`);
				}
				const dernier = [...l.querySelectorAll('[role^=menuitem]')].at(-1);
				dernier.scrollIntoView({ block: 'nearest' });
				const d = dernier.getBoundingClientRect();
				if (!l.contains(document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2))) dehors.push('dernier élément masqué');
				return dehors;
			});
			expect(hors, `menu ${await bouton.getAttribute('aria-label')}`).toEqual([]);
			await page.keyboard.press('Escape');
			await expect(liste).toBeHidden();
		}
	});
}
