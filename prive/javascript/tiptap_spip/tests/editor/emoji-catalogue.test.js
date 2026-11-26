import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { chargerCatalogueEmojis, filtrerEmojis } from '../../src/emojis/catalogue.js';

const catalogue = JSON.parse(readFileSync(new URL('../../node_modules/emoji-picker-element-data/en/emojibase/data.json', import.meta.url), 'utf8'));
const entree = (emoji, shortcodes, options = {}) => ({ emoji, shortcodes, annotation: 'description', tags: [], order: 1, ...options });
const ids = (items) => items.map((item) => item.id);
let numero = 0;
const url = () => `https://exemple.test/emojis/${++numero}.json`;
const reponse = (data = catalogue) => new Response(JSON.stringify(data), { status: 200 });
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('classement anglais du catalogue emoji', () => {
	it('shortcode_avant_tag : heart, smile et h sur le JSON réel', () => {
		for (const [query, title, unicode] of [['heart', 'heart', '❤️'], ['smile', 'smile', '😄'], ['h', 'halo', '😇']]) {
			expect(filtrerEmojis(catalogue, query)[0]).toMatchObject({ id: unicode, title, context: { unicode } });
		}
	});
	it('respecte les cinq rangs, avant l’ordre numérique des entrées', () => {
		const donnees = [
			entree('💗', ['part_heart_inside'], { order: 0 }),
			entree('😀', ['joy'], { annotation: 'heartwarming', order: 1 }),
			entree('💌', ['letter'], { tags: ['heart'], order: 2 }),
			entree('💕', ['hearts'], { order: 3 }),
			entree('❤️', ['heart'], { order: 100 }),
		];
		expect(ids(filtrerEmojis(donnees, 'heart'))).toEqual(['❤️', '💕', '💌', '😀', '💗']);
	});
	it('annotation et tag exacts partagent un rang, de même pour les préfixes', () => {
		const donnees = [
			entree('😀', ['a'], { annotation: 'heart', order: 2 }),
			entree('😄', ['b'], { tags: ['heart'], order: 1 }),
			entree('😃', ['c'], { tags: ['heartfelt'], order: 3 }),
			entree('😇', ['d'], { annotation: 'hearts', order: 4 }),
		];
		expect(ids(filtrerEmojis(donnees, 'heart'))).toEqual(['😄', '😀', '😃', '😇']);
	});
	it('alias_correspondant_affiche : le titre est l’alias exact sans deux-points', () => {
		const smile = filtrerEmojis(catalogue, 'SMILE')[0];
		expect(smile.title).toBe('smile'); expect(smile.title).not.toContain(':');
		expect(smile.context.annotation).toBe('grinning face with smiling eyes');
		expect(smile.context.tags).toContain('smile');
	});
	it('choisit exact, préfixe, inclusion, puis premier alias, dans l’ordre amont', () => {
		for (const [shortcodes, title] of [
			[['very_heart', 'HeArT', 'heart'], 'HeArT'],
			[['very_heart', 'heart_b', 'heart_a'], 'heart_b'],
			[['none', 'very_heart', 'another_heart'], 'very_heart'],
			[['first', 'second'], 'first'],
		]) {
			expect(filtrerEmojis([entree('❤️', shortcodes, { annotation: 'heart' })], 'heart')[0].title).toBe(title);
		}
	});
	it('ordre_catalogue_stable : order puis position originale, sans tri alphabétique', () => {
		const donnees = [entree('😀', ['hero'], { order: 9 }), entree('😄', ['hello']), entree('😃', ['heart'])];
		expect(ids(filtrerEmojis(donnees, 'h'))).toEqual(['😄', '😃', '😀']);
	});
	it('aucun_doublon : plusieurs alias et champs n’ajoutent pas de résultats', () => {
		for (const query of ['h', 'heart', 'smile']) {
			const resultat = filtrerEmojis(catalogue, query);
			expect(new Set(ids(resultat)).size).toBe(resultat.length);
		}
		const doublon = [entree('❤️', ['other_heart']), entree('❤️', ['heart'])];
		expect(filtrerEmojis(doublon, 'heart')).toMatchObject([{ id: '❤️', title: 'heart' }]);
	});
	it('premier_caractere : h puis he puis h, requêtes indépendantes', () => {
		const h = filtrerEmojis(catalogue, 'h'); const avant = ids(h);
		const he = filtrerEmojis(catalogue, 'he');
		expect(h[0].title).toBe('halo'); expect(he.some((item) => item.title === 'halo')).toBe(false);
		expect(he.length).toBeGreaterThan(6); expect(he.length).toBeLessThan(h.length);
		expect(ids(h)).toEqual(avant); expect(ids(filtrerEmojis(catalogue, 'h'))).toEqual(avant);
	});
	it('sans_alias_local : anglais seul, aucun enrichissement linguistique', () => {
		expect(filtrerEmojis(catalogue, 'coeur')).toEqual([]);
		expect(filtrerEmojis(catalogue, 'cœur')).toEqual([]);
		expect(filtrerEmojis(catalogue, '=')).toEqual([]);
	});
	it('requête vide : la vue sans recherche appartient au picker', () => {
		expect(filtrerEmojis(catalogue, '')).toEqual([]);
	});
	it('ne modifie ni le catalogue ni les résultats d’une requête précédente', () => {
		const donnees = [entree('❤️', ['heart']), entree('😄', ['smile'])];
		const avant = structuredClone(donnees); const coeur = filtrerEmojis(donnees, 'heart');
		filtrerEmojis(donnees, 'smile'); expect(donnees).toEqual(avant);
		expect(coeur).toMatchObject([{ title: 'heart', context: { unicode: '❤️' } }]);
	});
	it('reflète les tableaux ordinaires modifiés entre deux appels du filtre pur', () => {
		const donnees = [entree('❤️', ['heart'])];
		expect(filtrerEmojis(donnees, 'h')).toHaveLength(1);
		donnees[0].shortcodes = ['love']; expect(filtrerEmojis(donnees, 'h')).toEqual([]);
	});
	it('garde les caractères et séquences Unicode sans normalisation', () => {
		const caracteres = ['❤️', '❤', '👍🏽', '👩‍💻'];
		const donnees = caracteres.map((emoji, i) => entree(emoji, [`heart_${i}`]));
		expect(filtrerEmojis(donnees, 'h').map((item) => item.context.unicode)).toEqual(caracteres);
	});
});

describe('chargement partagé à la demande, sans DOM ni IndexedDB', () => {
	it('chargement_mutualise : même promesse et même catalogue pour deux éditeurs', async () => {
		const adresse = url(); let terminer;
		fetch.mockReturnValue(new Promise((resolve) => { terminer = resolve; }));
		const a = chargerCatalogueEmojis({ url: adresse }); const b = chargerCatalogueEmojis({ url: adresse });
		expect(a).toBe(b); await Promise.resolve(); expect(fetch).toHaveBeenCalledExactlyOnceWith(adresse);
		terminer(reponse()); const [premier, second] = await Promise.all([a, b]); expect(premier).toBe(second);
		expect(filtrerEmojis(premier, 'h')[0].title).toBe('halo'); expect(filtrerEmojis(second, 'smile')[0].title).toBe('smile');
		expect(chargerCatalogueEmojis({ url: adresse })).toBe(a);
	});
	it('une autre URL versionnée charge un autre catalogue', async () => {
		fetch.mockImplementation(async () => reponse());
		const a = chargerCatalogueEmojis({ url: url() }), b = chargerCatalogueEmojis({ url: url() });
		expect(a).not.toBe(b); await Promise.all([a, b]); expect(fetch).toHaveBeenCalledTimes(2);
	});
	it('une erreur HTTP est explicite et le prochain appel peut réessayer', async () => {
		const adresse = url(); fetch.mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(reponse());
		const premier = chargerCatalogueEmojis({ url: adresse }); await expect(premier).rejects.toThrow('503');
		const suivant = chargerCatalogueEmojis({ url: adresse }); expect(suivant).not.toBe(premier);
		await expect(suivant).resolves.toHaveLength(catalogue.length); expect(fetch).toHaveBeenCalledTimes(2);
	});
	it('une erreur réseau ne reste pas dans le cache', async () => {
		const adresse = url(); fetch.mockRejectedValueOnce(new TypeError('Réseau')).mockResolvedValueOnce(reponse());
		await expect(chargerCatalogueEmojis({ url: adresse })).rejects.toThrow('Réseau');
		await expect(chargerCatalogueEmojis({ url: adresse })).resolves.toHaveLength(catalogue.length);
	});
	it('un JSON illisible ou un catalogue de forme incorrecte produit une erreur', async () => {
		for (const data of ['{', '{}', '[{}]']) {
			const adresse = url(); fetch.mockResolvedValueOnce(new Response(data)).mockResolvedValueOnce(reponse());
			await expect(chargerCatalogueEmojis({ url: adresse })).rejects.toThrow();
			await expect(chargerCatalogueEmojis({ url: adresse })).resolves.toHaveLength(catalogue.length);
		}
	});
	it('un catalogue chargé est partagé en lecture seule', async () => {
		fetch.mockResolvedValueOnce(reponse()); const data = await chargerCatalogueEmojis({ url: url() });
		expect(Object.isFrozen(data)).toBe(true); expect(Object.isFrozen(data[0].shortcodes)).toBe(true);
		expect(() => data[0].shortcodes.push('alias_local')).toThrow();
	});
	it('aucune API DOM ou IndexedDB n’est nécessaire', async () => {
		expect(typeof HTMLElement).toBe('undefined'); expect(typeof indexedDB).toBe('undefined');
		expect(fetch).not.toHaveBeenCalled(); fetch.mockResolvedValueOnce(reponse());
		expect(filtrerEmojis(await chargerCatalogueEmojis({ url: url() }), 'heart')[0].context.unicode).toBe('❤️');
	});
	it('une URL indisponible rejette sans appeler fetch', async () => {
		await expect(chargerCatalogueEmojis({ url: null })).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
	});
});

it('importe fournisseur et extensions en Node sans HTMLElement ni web component', async () => {
	expect(typeof HTMLElement).toBe('undefined');
	const fournisseur = await import('../../src/emojis/fournisseur.js');
	const extensions = await import('../../src/editor/extensions.js');
	expect(typeof fournisseur.creerFournisseurEmoji).toBe('function'); expect(typeof extensions.coreExtensions).toBe('function');
	expect(fetch).not.toHaveBeenCalled();
});
