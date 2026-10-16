// Tests de bout en bout sur un site SPIP jetable (voir tests/e2e/article.e2e.js).
// Critère 8 (spec 08) : Chromium, Firefox et WebKit ; un seul : --project=chromium.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '*.e2e.js',
	timeout: 30_000,
	workers: 1,
	globalTeardown: './tests/e2e/nettoyage.js',
	use: {
		baseURL: process.env.TTS_URL,
		userAgent: 'tts-e2e',
	},
	projects: ['chromium', 'firefox', 'webkit'].map((nom) => ({
		name: nom,
		// userAgent fixe (la session SPIP en dépend) : celui du projet n'est pas repris
		// locale française : sans langue d'auteur, SPIP suit Accept-Language (spec 11) ; les tests lisent les libellés français
		use: { ...devices[{ chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' }[nom]], userAgent: 'tts-e2e', locale: 'fr-FR' },
	})),
});
