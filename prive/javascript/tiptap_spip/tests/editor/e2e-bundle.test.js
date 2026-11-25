import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { verifierBundleServi } from '../e2e/site.js';

const reponse = (nom, body) => ({
	url: () => `http://site.test/plugins/tiptap_spip/prive/javascript/${nom}?123`,
	status: () => 200,
	body: async () => body ?? readFileSync(new URL(`../../../${nom}`, import.meta.url)),
});

it.each(['tiptap_spip.js', 'tiptap_spip.min.js'])('bundle réellement reçu identique à %s', async (nom) => {
	const r = reponse(nom);
	const page = { waitForResponse: vi.fn(async (predicat) => { expect(predicat(r)).toBe(true); return r; }) };
	await verifierBundleServi(page);
	expect(page.waitForResponse).toHaveBeenCalledOnce();
});

it('une réponse du mauvais checkout fait échouer le contrôle', async () => {
	await expect(verifierBundleServi({ waitForResponse: async () => reponse('tiptap_spip.min.js', Buffer.from('ancien code')) }))
		.rejects.toThrow(/bundle servi/i);
});

it('une absence de réponse ne donne pas un faux succès', async () => {
	await expect(verifierBundleServi({ waitForResponse: async () => { throw new Error('aucun bundle reçu'); } }))
		.rejects.toThrow('aucun bundle reçu');
});
