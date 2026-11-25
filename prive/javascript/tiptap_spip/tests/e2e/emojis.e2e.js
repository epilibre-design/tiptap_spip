import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { configure, editer, module, verifierBundleServi, configurer, effacerConfig, lireConfig, activer, repo } from './site.js';

configure(test);
test.beforeEach(async ({ page }, info) => {
	if (info.title.includes('repli sans champ') || info.title.includes('balise incompatible')) {
		await page.addInitScript(({ incompatible }) => {
			class PickerDejaPresent extends HTMLElement {
				dataSource = ''; locale = ''; i18n = {};
				get database() { return incompatible ? {} : { ready: () => Promise.resolve() }; }
				constructor() { super(); this.attachShadow({ mode: 'open' }); }
			}
			customElements.define('emoji-picker', PickerDejaPresent);
		}, { incompatible: info.title.includes('balise incompatible') });
	}
	const bundle = verifierBundleServi(page);
	await editer(page, 'Un texte à conserver.'); await bundle; await module(page);
});
const panneau = (page) => page.locator('.tts-suggestions-panneau');
const recherche = (page) => panneau(page).locator('emoji-picker input[type="search"]');
const ouvrir = (page, { note = true } = {}) => page.evaluate(({ note }) => {
	const instance = [...window.__tts.instances][0]; instance.togglePleinEcran(true);
	const parent = note ? instance.ui.editNote(null) : null;
	const ui = parent?.sousUi ?? instance.ui;
	const controles = document.createElement('div');
	controles.innerHTML = '<button type="button" id="tts-emoji-before">Avant</button><button type="button" id="tts-emoji-open">Ouvrir</button><button type="button" id="tts-emoji-after">Après</button>';
	(parent?.form ?? instance.wrapper).append(controles);
	const trigger = controles.querySelector('#tts-emoji-open');
	const origin = { trigger, onChoose: (unicode) => { window.__emojiChoix.push(unicode); return true; } };
	window.__emojiChoix = [];
	window.__emojiTest = { instance, parent, ui, origin, controles, p: ui.openEmoji(origin) };
}, { note });
const rouvrir = (page) => page.evaluate(() => {
	const t = window.__emojiTest; t.p = t.ui.openEmoji(t.origin);
});
const parentIntact = async (page) => expect(await page.evaluate(() => {
	const t = window.__emojiTest; return t.instance.pleinEcran() && (!t.parent || t.parent.ouvert);
})).toBe(true);

test('note_plein_ecran_tab_echap : navigation réelle, sorties et aucun submit', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	expect(await panneau(page).evaluate((e) => e.parentElement === window.__emojiTest.parent.element && !window.__emojiTest.parent.form.contains(e) && e.matches(':popover-open'))).toBe(true);
	await page.evaluate(() => { window.__submits = 0; document.addEventListener('submit', (e) => { e.preventDefault(); window.__submits++; }, true); });
	await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await page.keyboard.press('Meta+Enter');
	expect(await page.evaluate(() => window.__submits)).toBe(0); await parentIntact(page);
	// Une recherche courte garde le parcours natif tout en évitant de tabuler une catégorie entière.
	await recherche(page).fill('headphones');
	await expect(panneau(page).locator('emoji-picker button[role=option]').first()).toBeVisible();
	// Tab entre dans les commandes du composant, puis atteint la sentinelle avant.
	await page.keyboard.press('Tab'); await expect(panneau(page)).toBeVisible();
	let i = 0;
	while (await panneau(page).count() && i++ < 40) await page.keyboard.press('Tab');
	await expect(panneau(page)).toHaveCount(0); await expect(page.locator('#tts-emoji-after')).toBeFocused();
	await parentIntact(page);
	await rouvrir(page); await expect(recherche(page)).toBeFocused();
	await page.keyboard.press('Shift+Tab'); await expect(page.locator('#tts-emoji-before')).toBeFocused(); await parentIntact(page);
	await rouvrir(page); await expect(recherche(page)).toBeFocused(); await page.keyboard.press('Escape');
	await expect(page.locator('#tts-emoji-open')).toBeFocused(); await parentIntact(page);
});

test('teintes_puis_panneau : le composant consomme le premier Échap', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	const teintes = panneau(page).locator('emoji-picker #skintone-button');
	await teintes.click(); await expect(teintes).toHaveAttribute('aria-expanded', 'true');
	await expect(panneau(page).locator('emoji-picker #skintone-list')).toBeFocused();
	await page.keyboard.press('Escape'); await expect(teintes).toHaveAttribute('aria-expanded', 'false');
	await expect(panneau(page)).toBeVisible(); await parentIntact(page);
	await page.keyboard.press('Escape'); await expect(panneau(page)).toHaveCount(0);
	await expect(page.locator('#tts-emoji-open')).toBeFocused(); await parentIntact(page);
});

test('erreur_tab_reessayer_sortie : erreur persistante et nouvel élément', async ({ page }) => {
	await page.route('**/tiptap_spip_emoji/*/en-emojibase.json', async (r) => { await new Promise((resolve) => setTimeout(resolve, 1200)); await r.abort(); });
	await ouvrir(page); const retry = panneau(page).getByRole('button', { name: 'Réessayer', exact: true });
	await expect(panneau(page).getByRole('alert')).toBeVisible(); await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	expect(await panneau(page).locator('.tts-suggestions-panneau__corps').evaluate((e) => document.activeElement === e)).toBe(true);
	// Dépasser le délai de message natif : notre erreur ne disparaît pas.
	await page.waitForTimeout(1800); await expect(panneau(page).getByRole('alert')).toBeVisible();
	await page.keyboard.press('Tab'); await expect(retry).toBeFocused(); await page.keyboard.press('Tab');
	await expect(page.locator('#tts-emoji-after')).toBeFocused(); await parentIntact(page);
	await rouvrir(page); await expect(panneau(page).getByRole('alert')).toBeVisible();
	await page.unrouteAll({ behavior: 'wait' });
	await panneau(page).getByRole('button', { name: 'Réessayer', exact: true }).click();
	await expect(recherche(page)).toBeFocused(); await expect(panneau(page).getByRole('alert')).toHaveCount(0);
	await page.keyboard.press('Escape'); await parentIntact(page);
});

test('panneau_non_decoupe_par_note : couche supérieure, scroll, nouveau popover', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	const resultat = await panneau(page).evaluate((e) => {
		const parent = window.__emojiTest.parent; parent.element.style.height = '180px'; parent.element.style.overflow = 'auto';
		e.getBoundingClientRect(); const r = e.getBoundingClientRect();
		return { auDessus: e.matches(':popover-open'), horsForm: !parent.form.contains(e), plusGrand: r.height > parent.element.getBoundingClientRect().height,
			visible: document.elementFromPoint(r.left + 10, r.top + Math.min(r.height - 10, 220)) === e || e.contains(document.elementFromPoint(r.left + 10, r.top + Math.min(r.height - 10, 220))) };
	});
	expect(resultat).toEqual({ auDessus: true, horsForm: true, plusGrand: true, visible: true });
	await page.evaluate(() => { window.__emojiTest.parent.element.scrollTop = 100; });
	await expect(recherche(page)).toBeFocused();
	await page.evaluate(() => window.__emojiTest.parent.sousUi.openLink());
	await expect(panneau(page)).toHaveCount(0); await expect(page.locator('.tts-popover--lien input').first()).toBeFocused(); await parentIntact(page);
});

test('choix réel, événements tardifs et instance de chaque langue', async ({ page }) => {
	await ouvrir(page, { note: false }); await expect(recherche(page)).toBeFocused();
	await recherche(page).fill('heart');
	const option = panneau(page).locator('emoji-picker button[role="option"]').first(); await expect(option).toBeVisible();
	await option.dblclick(); await expect(panneau(page)).toHaveCount(0); expect(await page.evaluate(() => window.__emojiChoix.length)).toBe(1);
	await page.evaluate(() => { const t=window.__emojiTest; t.instance.editor.commands.setContent('<p>Texte</p>'); t.multi=t.instance.ui.editMulti(null); t.multi.lignes[0].sousUi.openEmoji({}); });
	await expect(recherche(page)).toBeFocused();
	await page.evaluate(() => window.__emojiTest.multi.lignes[1].sousUi.openEmoji({})); await expect(recherche(page)).toBeFocused();
	expect(await page.evaluate(() => window.__emojiTest.multi.ouvert)).toBe(true);
});

test('repli sans champ : balise compatible déjà définie et sortie du panneau', async ({ page }) => {
	await ouvrir(page);
	await expect(panneau(page).getByRole('status')).toHaveCount(0);
	await expect(panneau(page).locator('.tts-suggestions-panneau__corps')).toBeFocused();
	await page.keyboard.press('Escape'); await parentIntact(page);
});

test('balise incompatible : erreur locale, éditeur et note utilisables', async ({ page }) => {
	await ouvrir(page); await expect(panneau(page).getByRole('alert')).toBeVisible();
	await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	await page.keyboard.press('Escape'); await parentIntact(page);
	await expect(page.locator('.tts-note__texte .ProseMirror')).toBeVisible();
});

test('catalogue paresseux, URL absolue identique en privé et public, octets originaux', async ({ page }) => {
	const config = await page.evaluate(() => window.spipConfig.tiptap_spip.emojis);
	expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('en-emojibase.json')))).toBe(false);
	const retour = await page.request.get(config.url); expect(retour.status()).toBe(200);
	expect((await retour.body()).equals(readFileSync(`${repo}prive/javascript/tiptap_spip/node_modules/emoji-picker-element-data/en/emojibase/data.json`))).toBe(true);
	const avant = lireConfig('tiptap_spip/public'); activer('tts_test'); configurer('tiptap_spip/public', 'oui');
	const id = new URL(page.url()).searchParams.get('id_article');
	try {
		const bundle = verifierBundleServi(page);
		await page.goto(`/spip.php?page=tts_test&id_article=${id}&var_mode=recalcul`); await bundle;
		await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
		expect(await page.evaluate(() => window.spipConfig.tiptap_spip.emojis)).toEqual(config);
	} finally { if (avant) configurer('tiptap_spip/public', avant); else effacerConfig('tiptap_spip/public'); }
});
