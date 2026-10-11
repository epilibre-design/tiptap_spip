import { describe, expect, it, vi } from 'vitest';
import { LinkTitles, ModelPreviews } from '../../src/services/cache.js';

/** Services simulés : chaque appel est gardé et se résout à la demande. */
const fakeServices = (repondre) => {
	const appels = [];
	return {
		appels,
		available: true,
		call: vi.fn((operation, params) => new Promise((resolve, reject) => {
			appels.push({ operation, params, resolve, reject });
			if (repondre) Promise.resolve().then(() => resolve(repondre(operation, params)));
		})),
	};
};

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ModelPreviews', () => {
	it('une prévisualisation par source, mise en cache', async () => {
		const services = fakeServices((op, { modele }) => `<p>${modele}</p>`);
		const previews = new ModelPreviews(services);
		const [a, b] = await Promise.all([previews.get('<doc1>'), previews.get('<doc1>')]);
		expect(a).toBe('<p><doc1></p>');
		expect(b).toBe(a);
		await previews.get('<doc1>');
		expect(services.call).toHaveBeenCalledTimes(1);
	});

	it('un échec n\'est pas mis en cache', async () => {
		const services = fakeServices();
		const previews = new ModelPreviews(services);
		const p = previews.get('<doc1>');
		await tick();
		services.appels[0].reject(new Error('non'));
		await expect(p).rejects.toThrow('non');
		const q = previews.get('<doc1>');
		await tick();
		services.appels[1].resolve('ok');
		await expect(q).resolves.toBe('ok');
	});
});

describe('LinkTitles', () => {
	it('regroupe les cibles demandées ensemble en un seul appel, met en cache', async () => {
		const services = fakeServices((op, { cibles }) => cibles.map((cible) => ({ cible, titre: `Titre ${cible}` })));
		const titles = new LinkTitles(services);
		const [a, b, c] = await Promise.all([titles.get('art1'), titles.get('rub2'), titles.get('art1')]);
		expect([a.titre, b.titre, c.titre]).toEqual(['Titre art1', 'Titre rub2', 'Titre art1']);
		expect(services.call).toHaveBeenCalledTimes(1);
		expect(services.call).toHaveBeenCalledWith('titre_lien', { cibles: ['art1', 'rub2'] });
		await titles.get('rub2');
		expect(services.call).toHaveBeenCalledTimes(1);
	});

	it('lots de 50 cibles au plus', async () => {
		const services = fakeServices((op, { cibles }) => cibles.map((cible) => ({ cible, titre: cible })));
		const titles = new LinkTitles(services);
		await Promise.all(Array.from({ length: 120 }, (_, i) => titles.get(`art${i}`)));
		expect(services.call.mock.calls.map(([, { cibles }]) => cibles.length)).toEqual([50, 50, 20]);
	});

	it('échec d\'un lot : chaque cible du lot est rejetée, puis redemandable', async () => {
		const services = fakeServices();
		const titles = new LinkTitles(services);
		const p = titles.get('art1');
		await tick();
		services.appels[0].reject(new Error('indisponible'));
		await expect(p).rejects.toThrow('indisponible');
		const q = titles.get('art1');
		await tick();
		services.appels[1].resolve([{ cible: 'art1', titre: 'Un' }]);
		await expect(q).resolves.toMatchObject({ titre: 'Un' });
	});
});

describe('services arrivés plus tard ou absents', () => {
	it('attend les services chargés à la demande', async () => {
		let fournir;
		const services = fakeServices((op, { modele }) => `<p>${modele}</p>`);
		const previews = new ModelPreviews(new Promise((r) => { fournir = r; }));
		const p = previews.get('<doc1>');
		fournir(services);
		await expect(p).resolves.toBe('<p><doc1></p>');
	});

	it('sans services : rejet, pour l\'affichage de repli', async () => {
		await expect(new ModelPreviews(Promise.resolve(null)).get('<doc1>')).rejects.toThrow();
		await expect(new LinkTitles(null).get('art1')).rejects.toThrow();
	});
});
