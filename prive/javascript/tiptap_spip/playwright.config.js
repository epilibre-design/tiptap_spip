// Tests de bout en bout sur un site SPIP jetable (voir tests/e2e/article.e2e.js).
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '*.e2e.js',
	timeout: 30_000,
	workers: 1,
	use: {
		baseURL: process.env.TTS_URL,
		userAgent: 'tts-e2e',
	},
});
