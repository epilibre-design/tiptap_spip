// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servicesALaDemande } from '../../src/hosts/aLaDemande.js';
import { contexte } from '../../src/hosts/contexte.js';
import { Services } from '../../src/services/cvt.js';

const conteneur = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../fixtures/cvt/formulaire.html'), 'utf8');

afterEach(() => {
	document.body.innerHTML = '';
});

const textarea = (html) => {
	document.body.innerHTML = html;
	return document.querySelector('textarea');
};

/** Formulaire d'un crayon, tel que le produit le plugin Crayons (action/crayons_html.php). */
const crayon = (nom, champ) => `<div class="crayon-html"><div class="formulaire_spip"><form class="formulaire_crayon">
	<input type="hidden" class="crayon-id" name="crayons[]" value="wid65f1_23">
	<input type="hidden" name="name_wid65f1_23" value="${nom}">
	<textarea class="crayon-active" name="content_wid65f1_23_${champ}"></textarea></form></div></div>`;

describe('contexte', () => {
	it('attributs data-tts-* posés par le squelette', () => {
		expect(contexte(textarea('<textarea name="x" data-tts-objet="rubrique" data-tts-id-objet="3" data-tts-champ="texte"></textarea>')))
			.toEqual({ objet: 'rubrique', id: 3, champ: 'texte' });
	});

	it('crayon : objet et id du nom du crayon, champ du nom du textarea', () => {
		expect(contexte(textarea(crayon('article-texte-12', 'texte')))).toEqual({ objet: 'article', id: 12, champ: 'texte' });
		expect(contexte(textarea(crayon('article-introduction-12', 'chapo')))).toEqual({ objet: 'article', id: 12, champ: 'chapo' });
	});

	it('sinon : mode sans objet, champ = name du textarea', () => {
		expect(contexte(textarea('<form><textarea name="descriptif_site"></textarea></form>'))).toEqual({ objet: '', id: 0, champ: 'descriptif_site' });
	});
});

describe('servicesALaDemande', () => {
	it('charge le formulaire de services du contexte et le place hors de tout formulaire', async () => {
		const fetch = vi.fn(async () => ({ ok: true, text: async () => conteneur }));
		const t = textarea(`<form>${crayon('article-texte-12', 'texte').replace(/<\/?form[^>]*>/g, '')}</form>`);
		const services = await servicesALaDemande(t, { objet: 'article', id: 12, champ: 'texte' }, { fetch, url: 'https://site.test/spip.php?page=tiptap_spip_services' });
		expect(services).toBeInstanceOf(Services);
		const url = new URL(fetch.mock.calls[0][0]);
		expect(Object.fromEntries(url.searchParams)).toEqual({ page: 'tiptap_spip_services', objet: 'article', id_objet: '12', champ: 'texte' });
		expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' });
		expect(services.container.closest('form')).toBeNull();
		expect(services.container.parentElement.id).toBe('tts-services');
		expect(services.container.hidden).toBe(true);
	});

	it('pas de formulaire (non autorisé), réseau coupé ou pas d\'URL : null', async () => {
		const t = textarea('<textarea name="texte"></textarea>');
		const vide = vi.fn(async () => ({ ok: true, text: async () => '\n' }));
		expect(await servicesALaDemande(t, { objet: '', id: 0, champ: 'texte' }, { fetch: vide, url: 'https://site.test/x' })).toBeNull();
		const coupe = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
		expect(await servicesALaDemande(t, { objet: '', id: 0, champ: 'texte' }, { fetch: coupe, url: 'https://site.test/x' })).toBeNull();
		expect(await servicesALaDemande(t, { objet: '', id: 0, champ: 'texte' }, { fetch: vide, url: '' })).toBeNull();
		expect(document.querySelectorAll('#tts-services .tts-services')).toHaveLength(0);
	});
});
