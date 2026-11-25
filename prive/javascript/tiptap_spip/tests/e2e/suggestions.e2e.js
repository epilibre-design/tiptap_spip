import { expect, test } from '@playwright/test';
import { configure, editer, module, verifierBundleServi } from './site.js';
import AxeBuilder from '@axe-core/playwright';

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

const ouvrir = (page, { note = false, erreur = false, shadow = false } = {}) => page.evaluate(({ note, erreur, shadow }) => {
	const instance = [...window.__tts.instances][0];
	if (note) instance.togglePleinEcran(true);
	const parent = note ? instance.ui.editNote(null) : null;
	const ui = parent?.sousUi ?? instance.ui;
	const controls = document.createElement('div');
	controls.innerHTML = '<button type="button" id="tts-test-before">Avant</button><button type="button" id="tts-test-open">Ouvrir</button><button type="button" id="tts-test-after">Après</button>';
	(parent?.form ?? instance.wrapper).append(controls);
	const trigger = controls.querySelector('#tts-test-open');
	const content = document.createElement('div');
	const dedans = shadow ? content.attachShadow({ mode: 'open' }) : content;
	dedans.innerHTML = (erreur ? '<p role="alert">Recherche indisponible</p>' : '<input type="search" aria-label="Rechercher suggestions">')
		+ '<button type="button">Réessayer</button>';
	const panneau = ui.openSuggestionsPanel({ anchor: trigger, origin: { trigger }, content, label: 'Suggestions de test' });
	if (shadow) dedans.querySelector('input').focus();
	window.__panneauTest = { instance, parent, panneau, content };
}, { note, erreur, shadow });

test('note_plein_ecran_tab_echap : sortie avant et arrière, parent conservé', async ({ page }) => {
	await ouvrir(page, { note: true });
	await expect(page.getByRole('searchbox', { name: 'Rechercher suggestions' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert && window.__panneauTest.instance.pleinEcran())).toBe(true);
	await page.evaluate(() => {
		const { parent, content } = window.__panneauTest;
		parent.sousUi.openSuggestionsPanel({ anchor: document.querySelector('#tts-test-open'), origin: { trigger: document.querySelector('#tts-test-open') }, content, label: 'Suggestions de test' });
	});
	await page.keyboard.press('Shift+Tab');
	await expect(page.locator('#tts-test-before')).toBeFocused();
});

test('erreur_tab_reessayer_sortie : cible de repli entre sentinelles', async ({ page }) => {
	await ouvrir(page, { note: true, erreur: true });
	expect(await page.evaluate(() => document.activeElement === window.__panneauTest.panneau.corps)).toBe(true);
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
});

test('plein écran sans note : Échap ferme le panneau avant le plein écran', async ({ page }) => {
	await page.evaluate(() => [...window.__tts.instances][0].togglePleinEcran(true));
	await ouvrir(page);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(true);
	await page.keyboard.press('Escape');
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(false);
});

test('Échap en remontée après consommation interne, puis panneau seul', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => window.__panneauTest.content.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
	}, { once: true }));
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#tts-test-open')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert && window.__panneauTest.instance.pleinEcran())).toBe(true);
});

test('Tab traverse le Shadow DOM natif sans inventaire des contrôles', async ({ page }) => {
	await ouvrir(page, { note: true, shadow: true });
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
});

test('Entrée et Ctrl/Cmd+Entrée ne soumettent ni note ni formulaire extérieur', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => {
		window.__soumissions = 0;
		document.addEventListener('submit', (e) => { window.__soumissions++; e.preventDefault(); }, true);
	});
	for (const key of ['Enter', 'Control+Enter', 'Meta+Enter']) await page.keyboard.press(key);
	expect(await page.evaluate(() => window.__soumissions)).toBe(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert)).toBe(true);
});

test('panneau_non_decoupe_par_note et placement après défilement', async ({ page }) => {
	await ouvrir(page, { note: true });
	expect(await page.evaluate(() => {
		const { parent, panneau } = window.__panneauTest;
		parent.element.style.maxHeight = '120px'; parent.element.style.overflowY = 'auto';
		parent.element.scrollTop = 100;
		return panneau.element.matches(':popover-open') && panneau.element.parentElement === parent.element;
	})).toBe(true);
	await page.waitForTimeout(50);
	expect(await page.evaluate(() => {
		const el = window.__panneauTest.panneau.element; const r = el.getBoundingClientRect();
		return r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
	})).toBe(true);
});

test('autre popover, changement de mode et destruction ferment sans ancien refocus', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => window.__panneauTest.parent.sousUi.openLink());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await expect(page.locator('.tts-popover--lien input').first()).toBeFocused();
	await page.evaluate(() => {
		window.__tts.ui.Popover.current.close({ refocus: false });
		window.__tts.ui.Popover.current.close({ refocus: false });
	});
	await ouvrir(page);
	await page.evaluate(() => window.__panneauTest.instance.toggleMode());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await page.evaluate(() => window.__panneauTest.instance.toggleMode());
	await ouvrir(page);
	await page.evaluate(() => window.__panneauTest.instance.destroy());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
});

test('panneau accessible sans nouvelle violation axe', async ({ page }) => {
	await ouvrir(page);
	const result = await new AxeBuilder({ page }).include('.tts-suggestions-panneau').analyze();
	expect(result.violations).toEqual([]);
});

test('sortie Tab ignore les contrôles cachés et boucle dans la note', async ({ page }) => {
	await ouvrir(page, { note: true, erreur: true });
	await page.evaluate(() => {
		const cache = document.createElement('div'); cache.style.display = 'none';
		cache.innerHTML = '<button type="button">Caché</button>';
		document.querySelector('#tts-test-open').after(cache);
	});
	await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await page.evaluate(() => {
		const { parent, content } = window.__panneauTest;
		document.querySelector('#tts-test-after').remove();
		parent.sousUi.openSuggestionsPanel({ anchor: document.querySelector('#tts-test-open'), origin: { trigger: document.querySelector('#tts-test-open') }, content, label: 'Suggestions de test' });
	});
	await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
	await expect(page.locator('.tts-popover--note input[name="nom"]')).toBeFocused();
});

test('clic extérieur conserve sa cible sans modifier le document', async ({ page }) => {
	await ouvrir(page);
	await page.locator('#tts-test-after').click();
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await expect(page.locator('.tts-content .ProseMirror')).toHaveText('Un texte à conserver.');
});

test('multi : accès par ligne et nettoyage indépendant des deux éditeurs', async ({ page }) => {
	expect(await page.evaluate(() => {
		const instance = [...window.__tts.instances][0]; const multi = instance.ui.editMulti(null);
		const [premiere, seconde] = multi.lignes;
		const content = document.createElement('div'); content.innerHTML = '<input type="search" aria-label="Test multi">';
		const p = premiere.sousUi.openSuggestionsPanel({ content, label: 'Panneau multi' });
		seconde.sous.destroy();
		const independant = p.element.isConnected && !premiere.sous.isDestroyed;
		premiere.sous.destroy();
		return independant && !p.element.isConnected && multi.ouvert;
	})).toBe(true);
});
