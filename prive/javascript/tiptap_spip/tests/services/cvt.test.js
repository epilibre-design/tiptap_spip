// @vitest-environment jsdom
// Réponses réelles du formulaire de services, enregistrées sur un site SPIP 4.4 jetable
// (tests/fixtures/cvt/, réenregistrées par tests/e2e/fixtures-cvt.e2e.js).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseResponse, ServiceError, Services, ServiceUnavailable } from '../../src/services/cvt.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/cvt');
const fixture = (name) => readFileSync(join(dir, `${name}.html`), 'utf8');
const conteneur = fixture('formulaire');
const instance = conteneur.match(/data-tts-instance="([^"]+)"/)[1];

const page = (formInstance = instance) => {
	document.body.innerHTML = `<form data-tts-instance="${formInstance}"><textarea name="texte"></textarea><textarea name="ps"></textarea></form>${conteneur}`;
	return document.querySelector('textarea[name=texte]');
};

/** fetch simulé : renvoie les réponses données dans l'ordre et garde les requêtes. */
const fakeFetch = (...reponses) => {
	const requetes = [];
	const fn = vi.fn(async (url, init) => {
		requetes.push({ url, body: init.body });
		const r = reponses.shift();
		if (r instanceof Error) throw r;
		return { status: 200, text: async () => r };
	});
	fn.requetes = requetes;
	return fn;
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('parseResponse', () => {
	it('résultat JSON et nouveau formulaire', () => {
		const r = parseResponse(fixture('titre_lien'));
		expect(r.operation).toBe('titre_lien');
		expect(r.resultat[0]).toMatchObject({ titre: 'Test tiptap_spip', objet: 'article' });
		expect(r.resultat[0].cible).toBe(`art${r.resultat[0].id}`);
		expect(r.resultat[1]).toMatchObject({ cible: 'https://www.spip.net/fr', url: 'https://www.spip.net/fr' });
		expect(r.resultat[2]).toMatchObject({ cible: 'art999999', titre: null });
		expect(r.form.tagName).toBe('FORM');
		expect(r.erreurs).toBeNull();
	});

	it('erreurs de verifier(), sans balises', () => {
		const r = parseResponse(fixture('erreurs'));
		expect(r.erreurs.modele).toBe('Ce modèle n’existe pas.');
		expect(r.resultat).toBeUndefined();
	});

	it('réponse sans ajax-form-is-ok (session expirée) : null', () => {
		expect(parseResponse(fixture('sans_session'))).toBeNull();
		expect(parseResponse('')).toBeNull();
	});
});

describe('Services.forTextarea', () => {
	it('trouve le formulaire de services par identifiant d\'instance et champ', () => {
		const services = Services.forTextarea(page());
		expect(services).toBeInstanceOf(Services);
		expect(services.container.dataset.ttsChamp).toBe('texte');
	});

	it('aucun service : autre instance, autre champ, ou formulaire sans instance', () => {
		expect(Services.forTextarea(page('tts-000000000000'))).toBeNull();
		page();
		expect(Services.forTextarea(document.querySelector('textarea[name=ps]'))).toBeNull();
		document.body.innerHTML = `<form><textarea name="texte"></textarea></form>${conteneur}`;
		expect(Services.forTextarea(document.querySelector('textarea'))).toBeNull();
	});
});

describe('Services.call', () => {
	it('poste le formulaire signé en AJAX et renvoie le résultat', async () => {
		const fetch = fakeFetch(fixture('titre_lien'));
		const services = Services.forTextarea(page(), { fetch });
		const signature = services.container.querySelector('[name=formulaire_action_sign]').value;
		const action = services.container.querySelector('form').getAttribute('action');
		const resultat = await services.call('titre_lien', { cibles: ['art1', 'https://www.spip.net/fr', 'art999999'] });
		expect(resultat).toHaveLength(3);
		const { url, body } = fetch.requetes[0];
		expect(url).toBe(action);
		expect(url).toMatch(/^\/ecrire\/\?exec=article_edit&id_article=\d+$/);
		expect(body.get('var_ajax')).toBe('form');
		expect(body.get('operation')).toBe('titre_lien');
		expect(JSON.parse(body.get('cibles'))).toEqual(['art1', 'https://www.spip.net/fr', 'art999999']);
		expect(body.get('formulaire_action')).toBe('tiptap_spip');
		expect(body.get('formulaire_action_sign')).toBe(signature);
		// le formulaire est remplacé par celui de la réponse (champs cachés à jour)
		expect(services.container.querySelector('[name=formulaire_action_sign]').value)
			.toBe(parseResponse(fixture('titre_lien')).form.querySelector('[name=formulaire_action_sign]').value);
	});

	it('erreurs de verifier() : ServiceError, le service reste disponible', async () => {
		const services = Services.forTextarea(page(), { fetch: fakeFetch(fixture('erreurs'), fixture('titre_lien')) });
		const erreur = await services.call('previsu_modele', { modele: '<zzz1>' }).catch((e) => e);
		expect(erreur).toBeInstanceOf(ServiceError);
		expect(erreur.erreurs.modele).toBe('Ce modèle n’existe pas.');
		expect(services.available).toBe(true);
		await expect(services.call('titre_lien', { cibles: ['art1'] })).resolves.toHaveLength(3);
	});

	it('session expirée ou réseau coupé : indisponible, sans nouvel appel', async () => {
		for (const reponse of [fixture('sans_session'), new TypeError('Failed to fetch')]) {
			const fetch = fakeFetch(reponse);
			const services = Services.forTextarea(page(), { fetch });
			await expect(services.call('titre_lien', { cibles: ['art1'] })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(services.available).toBe(false);
			await expect(services.call('titre_lien', { cibles: ['art1'] })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(fetch).toHaveBeenCalledTimes(1);
		}
	});

	it('les appels sont sérialisés : le suivant part avec le formulaire renouvelé', async () => {
		const ordre = [];
		let liberer;
		const fetch = vi.fn((url, init) => {
			ordre.push(init.body.get('operation'));
			if (ordre.length === 1) {
				return new Promise((resolve) => {
					liberer = () => resolve({ status: 200, text: async () => fixture('titre_lien') });
				});
			}
			return Promise.resolve({ status: 200, text: async () => fixture('titre_lien') });
		});
		const services = Services.forTextarea(page(), { fetch });
		const a = services.call('titre_lien', { cibles: ['art1'] });
		const b = services.call('rechercher', { q: 'Test', objets: ['article'] });
		await new Promise((r) => setTimeout(r, 0));
		expect(ordre).toEqual(['titre_lien']);
		liberer();
		await Promise.all([a, b]);
		expect(ordre).toEqual(['titre_lien', 'rechercher']);
	});
});

/** XMLHttpRequest simulé : répond `reponse` (ou échoue) à send(), progression 50 % puis 100 %. */
const fakeXHR = (reponse) => {
	const envois = [];
	const fabrique = () => {
		const xhr = {
			upload: {},
			open: vi.fn((methode, url) => { xhr.url = url; }),
			send: vi.fn((body) => {
				envois.push({ url: xhr.url, body, xhr });
				queueMicrotask(() => {
					if (xhr.aborted) return;
					xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
					xhr.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 2 });
					if (reponse instanceof Error) xhr.onerror?.();
					else { xhr.responseText = reponse; xhr.onload?.(); }
				});
			}),
			abort: vi.fn(() => { xhr.aborted = true; xhr.onabort?.(); }),
		};
		return xhr;
	};
	fabrique.envois = envois;
	return fabrique;
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'capture.png', { type: 'image/png' });

describe('Services.depot', () => {
	it('lit l\'annonce du formulaire courant', () => {
		const services = Services.forTextarea(page());
		expect(services.depot()).toEqual({ images: expect.arrayContaining(['image/png']), extensions: expect.objectContaining({ 'image/png': 'png' }), taille_image: expect.any(Number), documents: expect.arrayContaining(['pdf']), documents_limite_image: expect.arrayContaining(['png']), taille_document: expect.any(Number) });
	});

	it('null sans annonce (opération indisponible)', () => {
		const services = Services.forTextarea(page());
		delete services.container.querySelector('form').dataset.ttsDepot;
		expect(services.depot()).toBeNull();
	});
});

describe('Services.call avec un fichier', () => {
	it('envoi par XHR avec le fichier, progression, résultat', async () => {
		const xhr = fakeXHR(fixture('deposer_document'));
		const services = Services.forTextarea(page(), { fetch: fakeFetch(), xhr });
		const action = services.container.querySelector('form').getAttribute('action');
		const progression = vi.fn();
		const resultat = await services.call('deposer_document', {}, { fichier: png(), progression });
		expect(resultat.raccourci).toBe(`doc${resultat.id_document}`);
		const { body, url } = xhr.envois[0];
		expect(url).toBe(action);
		expect(body.get('operation')).toBe('deposer_document');
		expect(body.get('fichier').name).toBe('capture.png');
		expect(progression.mock.calls).toEqual([[0.5], [1]]);
	});

	it('type refusé : ServiceError avec le message du serveur', async () => {
		const services = Services.forTextarea(page(), { xhr: fakeXHR(fixture('deposer_document_type')) });
		const erreur = await services.call('deposer_document', {}, { fichier: png() }).catch((e) => e);
		expect(erreur).toBeInstanceOf(ServiceError);
		expect(erreur.message).toBe('Ce type de fichier n’est pas accepté.');
		expect(services.available).toBe(true);
	});

	it('session expirée ou réseau coupé : indisponible', async () => {
		for (const reponse of [fixture('sans_session'), new TypeError('réseau')]) {
			const services = Services.forTextarea(page(), { xhr: fakeXHR(reponse) });
			await expect(services.call('deposer_document', {}, { fichier: png() })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(services.available).toBe(false);
		}
	});

	it('abandon : AbortError, le service reste disponible, l\'appel suivant part', async () => {
		const xhr = fakeXHR(fixture('deposer_document'));
		const services = Services.forTextarea(page(), { xhr });
		const controleur = new AbortController();
		const promesse = services.call('deposer_document', {}, { fichier: png(), signal: controleur.signal });
		controleur.abort();
		const erreur = await promesse.catch((e) => e);
		expect(erreur.name).toBe('AbortError');
		expect(services.available).toBe(true);
		await expect(services.call('deposer_document', {}, { fichier: png() })).resolves.toMatchObject({ raccourci: expect.stringMatching(/^doc\d+$/) });
	});

	it('abandon avant son tour dans la file : rien n\'est envoyé', async () => {
		const xhr = fakeXHR(fixture('deposer_document'));
		const services = Services.forTextarea(page(), { xhr });
		const premier = services.call('deposer_document', {}, { fichier: png() });
		const controleur = new AbortController();
		const second = services.call('deposer_document', {}, { fichier: png(), signal: controleur.signal });
		controleur.abort();
		await premier;
		expect((await second.catch((e) => e)).name).toBe('AbortError');
		expect(xhr.envois).toHaveLength(1);
	});
});
