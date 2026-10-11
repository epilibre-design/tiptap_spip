# Interface des liens et modèles (lot L2.3) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les modèles sont prévisualisés dans l'éditeur, les liens sans texte affichent le titre que SPIP calculera, un popover crée et modifie les liens (avec recherche d'objets SPIP), et un raccourci de modèle s'insère ou se modifie depuis la barre ; sans services serveur, l'éditeur garde l'affichage compact.

**Architecture :** `src/services/cache.js` (prévisualisations et titres, en cache, titres regroupés par lots de 50) au-dessus de `Services` (lot L2.2) ; NodeViews (`src/nodeviews/views.js`) activées par une option `ui` de `coreExtensions()` quand des services existent ; HTML de prévisualisation rendu inerte par `src/ui/sanitize.js` ; popovers DOM sans framework (`src/ui/popover.js`, `LinkPopover.js`, `ModelPopover.js`) ; boutons Lien et Modèle dans `.tts-toolbar`, `Ctrl+K`.

**Tech Stack :** inchangée.

**Specs de référence :** `docs/specs/05-extensions-spip.md` §3–§4, `docs/specs/06-interface.md` §2, §4, §6.

## Global Constraints

- Mêmes contraintes que les lots précédents.
- Les services sont sérialisés (file de `Services`, lot L2.2) : pas de limite de parallélisme propre aux prévisualisations (la spec 05 §3 prévoyait N=4).
- Le HTML d'une prévisualisation, déjà passé par `safehtml()` côté serveur, est rendu inerte côté navigateur (défense en profondeur) : ni script, ni gestionnaire `on*`, ni URL `javascript:`, éléments interactifs hors du clavier, iframes en bac à sable.
- ProseMirror lit la sélection du navigateur sur `selectionchange`, asynchrone dans Chromium : une commande clavier qui suit de près un déplacement de sélection voit l'ancienne. Le popover de lien force cette lecture (`view.domObserver.flush()`) ; les tests de bout en bout attendent la prise en compte de la sélection après une navigation au clavier (`selectionStable`). Vérifié : sans la lecture forcée, `Ctrl+K` juste après `Maj+flèches` pose un lien sans texte au lieu de lier la sélection.
- Hors de ce plan : formulaires YAML de modèles (`#FORMULAIRE_INSERER_MODELES`, dépend de la question Q3 de mutualisation avec markdown_editor), sélecteur de documents pour `doc`/`img`/`emb`, règle de saisie d'un modèle tapé, proposition des ancres du document dans le popover de lien, barre complète (lot L5).

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `prive/javascript/tiptap_spip/src/services/cache.js` | `ModelPreviews`, `LinkTitles` |
| `prive/javascript/tiptap_spip/src/ui/sanitize.js` | `previewFragment(html)` : fragment inerte |
| `prive/javascript/tiptap_spip/src/ui/labels.js` | libellés (config SPIP, français par défaut) |
| `prive/javascript/tiptap_spip/src/nodeviews/views.js` | `modelView(ui)`, `linkAutoView(ui)` |
| `prive/javascript/tiptap_spip/src/ui/popover.js`, `LinkPopover.js`, `ModelPopover.js` | popovers |
| `prive/javascript/tiptap_spip/src/editor/extensions.js`, `createEditor.js`, `src/main.js` | option `ui`, `Ctrl+K`, barre |
| `css/tiptap_spip.css`, `lang/tiptap_spip_fr.php`, `prive/javascript/_inits/09_tiptap_spip_config.js.html` | styles, chaînes |
| `tests/e2e/site.php`, `prive/javascript/tiptap_spip/tests/e2e/site.js`, `interface.e2e.js` | bout en bout |

---

### Task 1 : Caches des services

**Files:**
- Create: `prive/javascript/tiptap_spip/src/services/cache.js`
- Test: `prive/javascript/tiptap_spip/tests/services/cache.test.js`

**Interfaces:**
- Consumes : `services.call(operation, params)` (L2.2).
- Produces : `new ModelPreviews(services).get(source): Promise<html>` ; `new LinkTitles(services).get(cible): Promise<{cible, titre, url, objet, id}>` (cibles d'un même tour regroupées, lots de 50) ; un échec n'est pas gardé en cache.

- [ ] **Step 1 : test qui échoue**

`prive/javascript/tiptap_spip/tests/services/cache.test.js` :

```js
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
```

Run : `npx vitest run tests/services/cache.test.js` → FAIL, `cache.js` introuvable.

- [ ] **Step 2 : implémenter**

`prive/javascript/tiptap_spip/src/services/cache.js` :

```js
/**
 * Résultats des services mis en cache côté navigateur : prévisualisations de modèles et titres de
 * liens. Les appels passent par la file de Services (un à la fois, cf. cvt.js).
 */

/** Prévisualisation HTML d'un modèle, par source exacte du raccourci. */
export class ModelPreviews {
	/** @param {import('./cvt.js').Services} services */
	constructor(services) {
		this.services = services;
		this.cache = new Map();
	}

	/** @returns {Promise<string>} HTML calculé par SPIP (passé par safehtml) */
	get(source) {
		if (!this.cache.has(source)) {
			const promise = this.services.call('previsu_modele', { modele: source });
			this.cache.set(source, promise);
			// un échec n'est pas gardé : la prochaine demande repartira au serveur
			promise.catch(() => this.cache.delete(source));
		}
		return this.cache.get(source);
	}
}

/**
 * Titres des liens [->cible]. Les cibles demandées dans le même tour de boucle d'événements partent
 * ensemble, par lots de 50 (limite de verifier()).
 */
export class LinkTitles {
	/** @param {import('./cvt.js').Services} services */
	constructor(services, { batch = 50 } = {}) {
		this.services = services;
		this.batch = batch;
		this.cache = new Map();
		this.pending = new Map();
		this.scheduled = false;
	}

	/** @returns {Promise<{ cible: string, titre: ?string, url: ?string, objet: ?string, id: ?number }>} */
	get(cible) {
		if (this.cache.has(cible)) return this.cache.get(cible);
		const promise = new Promise((resolve, reject) => this.pending.set(cible, { resolve, reject }));
		this.cache.set(cible, promise);
		promise.catch(() => this.cache.delete(cible));
		if (!this.scheduled) {
			this.scheduled = true;
			queueMicrotask(() => this.flush());
		}
		return promise;
	}

	flush() {
		this.scheduled = false;
		const demandes = [...this.pending];
		this.pending.clear();
		for (let i = 0; i < demandes.length; i += this.batch) {
			const lot = demandes.slice(i, i + this.batch);
			this.services.call('titre_lien', { cibles: lot.map(([cible]) => cible) }).then(
				(resultats) => {
					const parCible = new Map(resultats.map((r) => [r.cible, r]));
					for (const [cible, { resolve }] of lot) resolve(parCible.get(cible) ?? { cible, titre: null, url: null });
				},
				(erreur) => lot.forEach(([, { reject }]) => reject(erreur)),
			);
		}
	}
}
```

- [ ] **Step 3 : vérifier et commiter**

Run : `npx vitest run tests/services/cache.test.js` → PASS, 5 tests.

```bash
git add prive/javascript/tiptap_spip/src/services/cache.js prive/javascript/tiptap_spip/tests/services/cache.test.js
git commit -m "feat(services): prévisualisations et titres de liens en cache, titres par lots"
```

---

### Task 2 : HTML de prévisualisation inerte

**Files:**
- Create: `prive/javascript/tiptap_spip/src/ui/sanitize.js`
- Test: `prive/javascript/tiptap_spip/tests/ui/sanitize.test.js`

- [ ] **Step 1 : test qui échoue**

`prive/javascript/tiptap_spip/tests/ui/sanitize.test.js` :

```js
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { previewFragment } from '../../src/ui/sanitize.js';

const html = (fragment) => {
	const div = document.createElement('div');
	div.append(fragment);
	return div.innerHTML;
};

describe('previewFragment', () => {
	it('garde le rendu du modèle', () => {
		expect(html(previewFragment('<div class="spip_document"><img src="IMG/a.png" alt="A"></div>')))
			.toBe('<div class="spip_document"><img src="IMG/a.png" alt="A"></div>');
	});

	it('retire scripts, styles, gestionnaires d\'événements et URL javascript:', () => {
		const out = html(previewFragment('<p onclick="x()">a<script>alert(1)</script><style>p{}</style><a href="javascript:alert(1)" onmouseover="y()">b</a><img src="x" onerror="z()"></p>'));
		expect(out).not.toMatch(/script|style|onclick|onmouseover|onerror|javascript:/i);
		expect(out).toContain('a');
		expect(out).toContain('b');
	});

	it('éléments interactifs hors du clavier et inactifs, iframes en bac à sable', () => {
		const div = document.createElement('div');
		div.append(previewFragment('<a href="spip.php?article1">l</a><button>b</button><input><iframe src="https://video.example/1"></iframe>'));
		for (const el of div.querySelectorAll('a, button, input, iframe')) expect(el.tabIndex).toBe(-1);
		expect(div.querySelector('button').disabled).toBe(true);
		expect(div.querySelector('input').disabled).toBe(true);
		expect(div.querySelector('iframe').getAttribute('sandbox')).toBe('');
	});
});
```

Run : `npx vitest run tests/ui/sanitize.test.js` → FAIL.

- [ ] **Step 2 : implémenter**

`prive/javascript/tiptap_spip/src/ui/sanitize.js` :

```js
/**
 * HTML d'une prévisualisation de modèle → fragment inerte, à afficher dans l'éditeur.
 * Le serveur l'a déjà passé par safehtml() ; ceci est une défense en profondeur : rien de ce qui
 * est affiché ne doit s'exécuter, ni prendre le focus, ni naviguer.
 */

const RETIRES = 'script, style, link, meta, base, object, embed, form';
const INTERACTIFS = 'a[href], area, button, input, select, textarea, iframe, video, audio, [tabindex], [contenteditable]';

/** @returns {DocumentFragment} */
export function previewFragment(html) {
	const template = document.createElement('template');
	template.innerHTML = String(html);
	const root = template.content;
	root.querySelectorAll(RETIRES).forEach((el) => el.remove());
	for (const el of root.querySelectorAll('*')) {
		for (const { name, value } of [...el.attributes]) {
			if (/^on/i.test(name) || /^\s*(javascript|vbscript|data):/i.test(value) && /^(href|src|action|formaction|xlink:href)$/i.test(name)) {
				el.removeAttribute(name);
			}
		}
	}
	for (const el of root.querySelectorAll(INTERACTIFS)) {
		el.tabIndex = -1;
		if ('disabled' in el) el.disabled = true;
		if (el.isContentEditable || el.hasAttribute('contenteditable')) el.setAttribute('contenteditable', 'false');
	}
	root.querySelectorAll('iframe').forEach((el) => el.setAttribute('sandbox', ''));
	return root;
}
```

- [ ] **Step 3 : vérifier et commiter**

Run : PASS, 3 tests.

```bash
git add prive/javascript/tiptap_spip/src/ui/sanitize.js prive/javascript/tiptap_spip/tests/ui/sanitize.test.js
git commit -m "feat(ui): HTML de prévisualisation rendu inerte"
```

---

### Task 3 : NodeViews, popovers et barre

**Files:**
- Create: `prive/javascript/tiptap_spip/src/ui/labels.js`, `prive/javascript/tiptap_spip/src/nodeviews/views.js`, `prive/javascript/tiptap_spip/src/ui/popover.js`, `prive/javascript/tiptap_spip/src/ui/LinkPopover.js`, `prive/javascript/tiptap_spip/src/ui/ModelPopover.js`
- Modify: `prive/javascript/tiptap_spip/src/editor/extensions.js`, `prive/javascript/tiptap_spip/src/editor/createEditor.js`, `prive/javascript/tiptap_spip/src/main.js`, `css/tiptap_spip.css`, `lang/tiptap_spip_fr.php`, `prive/javascript/_inits/09_tiptap_spip_config.js.html`
- Test: `prive/javascript/tiptap_spip/tests/ui/interface.test.js`

**Interfaces:**
- Consumes : Tasks 1 et 2, `parseModel` (L2.1), `Services` (L2.2).
- Produces : `coreExtensions({ headingLevels, ui })`, `createEditor({ …, ui })` ; `ui = { previews, titles, openLink(), editModel(pos|null) }` construit par `Instance` ; `openLinkPopover({ editor, wrapper, services?, titles? })`, `openModelPopover({ editor, wrapper }, pos?)` ; DOM : `.tts-toolbar .tts-lien`, `.tts-modele`, `.tts-mode` ; `.tts-popover[role=dialog]` avec champs nommés (`cible`, `bulle`, `langue`, `nouvelle_fenetre`, `raccourci`) et boutons nommés (`appliquer`, `retirer`, `ouvrir`, `figer`, `annuler`).

- [ ] **Step 1 : test qui échoue**

`prive/javascript/tiptap_spip/tests/ui/interface.test.js` :

```js
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { LinkTitles, ModelPreviews } from '../../src/services/cache.js';
import { serialize } from '../../src/spip/index.js';
import { openLinkPopover } from '../../src/ui/LinkPopover.js';
import { openModelPopover } from '../../src/ui/ModelPopover.js';
import { Popover } from '../../src/ui/popover.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

// jsdom n'a pas de géométrie : ProseMirror en a besoin pour faire défiler jusqu'à la sélection
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
for (const proto of [Range.prototype, Text.prototype]) {
	proto.getClientRects ??= () => [];
	proto.getBoundingClientRect ??= rect;
}

/** Services simulés : réponses par opération. */
const fakeServices = (reponses = {}) => ({
	available: true,
	call: vi.fn(async (operation, params) => {
		const r = reponses[operation];
		if (r instanceof Error) throw r;
		return typeof r === 'function' ? r(params) : r;
	}),
});

let editor;
let wrapper;

/** Éditeur monté comme par main.js, avec ou sans services. */
const monter = (source, services = null) => {
	document.body.innerHTML = '<div class="tts-editor"><div class="tts-content"></div></div>';
	wrapper = document.querySelector('.tts-editor');
	const contexte = () => ({ editor, wrapper, services, titles: ui.titles });
	const ui = {
		previews: services ? new ModelPreviews(services) : null,
		titles: services ? new LinkTitles(services) : null,
		openLink: () => openLinkPopover(contexte()),
		editModel: (pos) => openModelPopover(contexte(), pos),
	};
	editor = createEditor({ element: wrapper.querySelector('.tts-content'), source, ui });
	return { editor, ui };
};

const source = () => serialize(editor.getJSON());
const champ = (name) => wrapper.querySelector(`.tts-popover [name=${name}]`);
const remplir = (name, value) => {
	const input = champ(name);
	if (input.type === 'checkbox') input.checked = value;
	else input.value = value;
	input.dispatchEvent(new Event('input'));
};
const valider = () => wrapper.querySelector('.tts-popover').requestSubmit();
const cliquer = (name) => wrapper.querySelector(`.tts-popover [name=${name}]`).click();
/** Position juste après la première occurrence de `texte` dans le document. */
const apres = (texte) => {
	let pos = null;
	editor.state.doc.descendants((node, p) => {
		if (pos === null && node.isText && node.text.includes(texte)) pos = p + node.text.indexOf(texte) + texte.length;
	});
	return pos;
};

afterEach(() => {
	Popover.current?.close({ refocus: false });
	editor?.destroy();
	editor = null;
	document.body.innerHTML = '';
});

describe('prévisualisation des modèles', () => {
	it('HTML du serveur, inerte ; la source reste identique', async () => {
		const services = fakeServices({ previsu_modele: ({ modele }) => `<div class="spip_document"><img src="x.png" alt="${modele}" onerror="alert(1)"></div>` });
		monter('Avant\n\n<doc12|center>\n\nUn <img3> ici', services);
		await tick();
		const [bloc, inline] = wrapper.querySelectorAll('.tts-model');
		expect(bloc.classList.contains('tts-model-block')).toBe(true);
		expect(bloc.querySelector('img').alt).toBe('<doc12|center>');
		expect(bloc.querySelector('img').hasAttribute('onerror')).toBe(false);
		expect(bloc.contentEditable).toBe('false');
		expect(inline.querySelector('img').alt).toBe('<img3>');
		expect(services.call).toHaveBeenCalledTimes(2);
		expect(source()).toBe('Avant\n\n<doc12|center>\n\nUn <img3> ici');
	});

	it('rendu vide ou erreur : le raccourci reste affiché', async () => {
		monter('<doc1>\n\n<doc2>', fakeServices({ previsu_modele: ({ modele }) => (modele === '<doc1>' ? '' : Promise.reject(new Error('x'))) }));
		await tick();
		const [vide, erreur] = wrapper.querySelectorAll('.tts-model');
		expect(vide.classList.contains('tts-model--vide')).toBe(true);
		expect(vide.textContent).toContain('<doc1>');
		expect(erreur.classList.contains('tts-model--erreur')).toBe(true);
		expect(erreur.textContent).toContain('<doc2>');
	});

	it('sans services : affichage compact, pas de NodeView', () => {
		monter('<doc12|center>');
		expect(wrapper.querySelector('.tts-model').textContent).toBe('<doc12|center>');
		expect(wrapper.querySelector('.tts-model__modifier')).toBeNull();
	});

	it('bouton « Modifier » : popover prérempli, nouveau raccourci écrit dans la source', async () => {
		monter('Avant\n\n<doc12|center>', fakeServices({ previsu_modele: '<p>doc</p>' }));
		await tick();
		wrapper.querySelector('.tts-model__modifier').click();
		expect(champ('raccourci').value).toBe('<doc12|center>');
		remplir('raccourci', '<doc12|left>');
		valider();
		await tick();
		expect(source()).toBe('Avant\n\n<doc12|left>');
	});
});

describe('titres des liens sans texte', () => {
	it('titre calculé par SPIP, jamais écrit dans la source', async () => {
		const services = fakeServices({ titre_lien: ({ cibles }) => cibles.map((cible) => ({ cible, titre: cible === 'art1' ? 'Un article' : null })) });
		monter('Voir [->art1] et [->art2].', services);
		await tick();
		await tick();
		const [a, b] = wrapper.querySelectorAll('.tts-link-auto');
		expect(a.textContent).toBe('Un article');
		expect(b.textContent).toBe('→ art2');
		expect(services.call).toHaveBeenCalledTimes(1);
		expect(source()).toBe('Voir [->art1] et [->art2].');
	});
});

describe('popover de lien', () => {
	it('Ctrl+K sur une sélection : nouveau lien avec bulle, langue, nouvelle fenêtre', () => {
		monter('Bonjour monde');
		editor.commands.setTextSelection({ from: apres('Bonjour '), to: apres('monde') });
		editor.commands.keyboardShortcut('Mod-k');
		remplir('cible', 'art12');
		remplir('bulle', 'Une bulle');
		remplir('langue', 'en');
		remplir('nouvelle_fenetre', true);
		valider();
		expect(source()).toBe('Bonjour [monde|Une bulle{en}->>art12]');
		expect(wrapper.querySelector('.tts-popover')).toBeNull();
	});

	it('curseur seul : lien sans texte', () => {
		monter('Voir ');
		editor.commands.setTextSelection(apres('Voir '));
		openLinkPopover({ editor, wrapper });
		remplir('cible', 'rub3');
		valider();
		expect(source()).toBe('Voir [->rub3]');
	});

	it('curseur dans un lien : le lien entier est modifié, ou retiré', () => {
		monter('Voir [la doc|bulle->art12].');
		editor.commands.setTextSelection(apres('la d'));
		openLinkPopover({ editor, wrapper });
		expect(champ('cible').value).toBe('art12');
		expect(champ('bulle').value).toBe('bulle');
		remplir('cible', 'art13');
		valider();
		expect(source()).toBe('Voir [la doc|bulle->art13].');
		editor.commands.setTextSelection(apres('la d'));
		openLinkPopover({ editor, wrapper });
		cliquer('retirer');
		expect(source()).toBe('Voir la doc.');
	});

	it('lien sans texte sélectionné : « Figer le titre » écrit le titre résolu', async () => {
		const services = fakeServices({ titre_lien: ({ cibles }) => cibles.map((cible) => ({ cible, titre: 'Mon article', url: 'spip.php?article1' })) });
		const { ui } = monter('Voir [->art1].', services);
		await tick();
		editor.commands.setNodeSelection(apres('Voir '));
		ui.openLink();
		cliquer('figer');
		await tick();
		expect(source()).toBe('Voir [Mon article->art1].');
	});

	it('cible vide : message d\'erreur, le popover reste ouvert', () => {
		monter('Voir');
		openLinkPopover({ editor, wrapper });
		valider();
		expect(wrapper.querySelector('.tts-popover__erreur').hidden).toBe(false);
		expect(wrapper.querySelector('.tts-popover')).not.toBeNull();
		expect(source()).toBe('Voir');
	});

	it('recherche d\'objets : une suggestion choisie devient la cible', async () => {
		vi.useFakeTimers();
		try {
			const services = fakeServices({ rechercher: [{ objet: 'article', id: 7, titre: 'Tiptap', raccourci: 'article7' }] });
			monter('Voir ');
			editor.commands.setTextSelection(apres('Voir '));
			openLinkPopover({ editor, wrapper, services });
			remplir('cible', 'tip');
			await vi.advanceTimersByTimeAsync(300);
			expect(services.call).toHaveBeenCalledWith('rechercher', expect.objectContaining({ q: 'tip' }));
			const suggestion = wrapper.querySelector('.tts-popover__suggestions li');
			expect(suggestion.textContent).toBe('Tiptap (article7)');
			suggestion.click();
			expect(champ('cible').value).toBe('article7');
			valider();
			expect(source()).toBe('Voir [->article7]');
		} finally {
			vi.useRealTimers();
		}
	});

	it('Échap ferme sans rien changer', () => {
		monter('Voir');
		openLinkPopover({ editor, wrapper });
		remplir('cible', 'art1');
		champ('cible').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(wrapper.querySelector('.tts-popover')).toBeNull();
		expect(source()).toBe('Voir');
	});
});

describe('popover de modèle', () => {
	it('insertion : en bloc dans un paragraphe vide, en ligne dans un texte', () => {
		monter('Texte\n\nUn  mot');
		editor.commands.setTextSelection(editor.state.doc.content.size - 1);
		editor.commands.splitBlock();
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<doc12|center>');
		valider();
		editor.commands.setTextSelection(apres('Un '));
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<img3>');
		valider();
		expect(source()).toBe('Texte\n\nUn <img3> mot\n\n<doc12|center>');
	});

	it('raccourci invalide : erreur, rien n\'est inséré', () => {
		monter('Texte');
		openModelPopover({ editor, wrapper });
		remplir('raccourci', '<span>');
		valider();
		expect(wrapper.querySelector('.tts-popover__erreur').textContent).toBe('Ce n’est pas un raccourci de modèle.');
		expect(source()).toBe('Texte');
	});
});
```

Run : `npx vitest run tests/ui/interface.test.js` → FAIL, modules introuvables.

- [ ] **Step 2 : implémenter**

`prive/javascript/tiptap_spip/src/ui/labels.js` :

```js
/**
 * Libellés de l'interface : chaînes de langue SPIP transmises par la configuration
 * (window.spipConfig.tiptap_spip.i18n), français par défaut.
 */
const DEFAUTS = {
	mode_source: 'Source',
	lien: 'Lien',
	modele: 'Modèle',
	lien_cible: 'Cible (art12, rub3, https://…)',
	lien_rechercher: 'Rechercher un contenu',
	lien_bulle: 'Bulle d’aide',
	lien_langue: 'Langue de la cible',
	lien_nouvelle_fenetre: 'Ouvrir dans une nouvelle fenêtre',
	lien_ouvrir: 'Ouvrir',
	lien_retirer: 'Retirer le lien',
	lien_figer: 'Figer le titre',
	lien_cible_obligatoire: 'Indiquez une cible.',
	modele_raccourci: 'Raccourci du modèle',
	modele_modifier: 'Modifier',
	modele_invalide: 'Ce n’est pas un raccourci de modèle.',
	appliquer: 'Appliquer',
	annuler: 'Annuler',
};

export const label = (key) => globalThis.spipConfig?.tiptap_spip?.i18n?.[key] ?? DEFAUTS[key] ?? key;
```
`prive/javascript/tiptap_spip/src/nodeviews/views.js` :

```js
import { label } from '../ui/labels.js';
import { previewFragment } from '../ui/sanitize.js';

/**
 * NodeViews des nœuds qui dépendent des services serveur : prévisualisation des modèles (spec 05 §3)
 * et titre des liens sans texte (spec 05 §4). Sans réponse du serveur, ils gardent l'affichage
 * compact (raccourci, cible).
 */

const chip = (text) => {
	const span = document.createElement('span');
	span.className = 'tts-chip';
	span.textContent = text;
	return span;
};

/**
 * Modèle (spipModel, spipModelBlock) : HTML calculé par SPIP, inerte ; bouton « Modifier ».
 * @param {{ previews: import('../services/cache.js').ModelPreviews, editModel: (pos: number) => void }} ui
 */
export const modelView = (ui) => ({ node, getPos }) => {
	const block = node.type.name === 'spipModelBlock';
	const dom = document.createElement(block ? 'div' : 'span');
	dom.className = `tts-model${block ? ' tts-model-block' : ''}`;
	dom.contentEditable = 'false';
	const preview = document.createElement(block ? 'div' : 'span');
	preview.className = 'tts-model__preview';
	const bouton = document.createElement('button');
	bouton.type = 'button';
	bouton.className = 'tts-model__modifier';
	bouton.textContent = label('modele_modifier');
	bouton.addEventListener('click', () => ui.editModel(getPos()));
	dom.append(preview, bouton);

	let source = null;
	const render = (model) => {
		if (model?.source === source) return;
		source = model?.source ?? '';
		dom.dataset.ttsModel = JSON.stringify(model);
		dom.title = source;
		preview.replaceChildren(chip(source));
		dom.classList.add('tts-model--chargement');
		dom.classList.remove('tts-model--erreur', 'tts-model--vide');
		const demande = source;
		ui.previews.get(demande).then(
			(html) => {
				if (demande !== source) return;
				dom.classList.remove('tts-model--chargement');
				const fragment = previewFragment(html);
				if (fragment.textContent.trim() === '' && !fragment.querySelector('img, svg, iframe, video, audio')) {
					dom.classList.add('tts-model--vide');
					return;
				}
				preview.replaceChildren(fragment);
			},
			() => {
				if (demande !== source) return;
				dom.classList.remove('tts-model--chargement');
				dom.classList.add('tts-model--erreur');
			},
		);
	};
	render(node.attrs.model);

	return {
		dom,
		update(updated) {
			if (updated.type !== node.type) return false;
			render(updated.attrs.model);
			return true;
		},
		// le bouton gère ses événements ; le reste (clic, glisser) revient à ProseMirror
		stopEvent: (event) => event.target === bouton,
		ignoreMutation: () => true,
	};
};

/**
 * Lien sans texte [->cible] : titre que SPIP affichera, jamais écrit dans la source.
 * @param {{ titles: import('../services/cache.js').LinkTitles }} ui
 */
export const linkAutoView = (ui) => ({ node }) => {
	const dom = document.createElement('a');
	dom.className = 'tts-link tts-link-auto';
	dom.contentEditable = 'false';
	let cible = null;
	const render = (attrs) => {
		if (attrs.href === cible) return;
		cible = attrs.href;
		dom.dataset.ttsHref = cible;
		dom.textContent = `→ ${cible}`;
		dom.title = cible;
		const demande = cible;
		ui.titles.get(demande).then(
			(r) => {
				if (demande === cible && r?.titre) dom.textContent = r.titre;
			},
			() => {},
		);
	};
	render(node.attrs);
	return {
		dom,
		update(updated) {
			if (updated.type !== node.type) return false;
			render(updated.attrs);
			return true;
		},
		ignoreMutation: () => true,
	};
};
```
`prive/javascript/tiptap_spip/src/ui/popover.js` :

```js
/**
 * Popover de l'éditeur : petit dialogue non modal ancré dans .tts-editor, près de la sélection.
 * Échap ferme, Entrée valide (spec 06 §4), le focus revient à l'éditeur à la fermeture.
 */
export class Popover {
	/**
	 * @param {{ editor: import('@tiptap/core').Editor, wrapper: HTMLElement, titre: string,
	 *           onSubmit: () => boolean|void }} options  onSubmit renvoie false pour garder le popover ouvert
	 */
	constructor({ editor, wrapper, titre, className, onSubmit }) {
		this.editor = editor;
		this.wrapper = wrapper;
		this.form = document.createElement('form');
		this.form.className = `tts-popover ${className ?? ''}`.trim();
		this.form.setAttribute('role', 'dialog');
		this.form.setAttribute('aria-label', titre);
		this.erreur = document.createElement('p');
		this.erreur.className = 'tts-popover__erreur';
		this.erreur.setAttribute('role', 'alert');
		this.erreur.hidden = true;
		this.actions = document.createElement('div');
		this.actions.className = 'tts-popover__actions';
		this.form.append(this.erreur, this.actions);
		this.form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (onSubmit() !== false) this.close();
		});
		this.form.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				this.close();
			}
		});
	}

	/** Champ libellé ; renvoie l'élément de saisie. */
	field(texte, input) {
		const etiquette = document.createElement('label');
		etiquette.className = 'tts-popover__champ';
		const span = document.createElement('span');
		span.textContent = texte;
		etiquette.append(span, input);
		this.actions.before(etiquette);
		return input;
	}

	input(texte, { value = '', type = 'text', name } = {}) {
		const input = document.createElement('input');
		input.type = type;
		input.name = name ?? '';
		if (type === 'checkbox') input.checked = Boolean(value);
		else input.value = value ?? '';
		return this.field(texte, input);
	}

	/** Bouton d'action ; type submit pour l'action principale. */
	button(texte, onClick, { submit = false, name } = {}) {
		const bouton = document.createElement('button');
		bouton.type = submit ? 'submit' : 'button';
		bouton.textContent = texte;
		if (name) bouton.name = name;
		if (!submit) {
			bouton.addEventListener('click', () => {
				if (onClick() !== false) this.close();
			});
		}
		this.actions.append(bouton);
		return bouton;
	}

	error(message) {
		this.erreur.textContent = message;
		this.erreur.hidden = !message;
	}

	open(focus) {
		Popover.current?.close({ refocus: false });
		Popover.current = this;
		this.wrapper.append(this.form);
		this.place();
		(focus ?? this.form.querySelector('input, button'))?.focus();
	}

	/** Sous la sélection, dans le repère de .tts-editor (sans effet sans moteur de mise en page). */
	place() {
		try {
			const { from } = this.editor.state.selection;
			const coords = this.editor.view.coordsAtPos(from);
			const box = this.wrapper.getBoundingClientRect();
			this.form.style.left = `${Math.max(0, coords.left - box.left)}px`;
			this.form.style.top = `${coords.bottom - box.top + 4}px`;
		} catch {
			// jsdom : pas de géométrie
		}
	}

	close({ refocus = true } = {}) {
		if (Popover.current === this) Popover.current = null;
		this.form.remove();
		if (refocus && !this.editor.isDestroyed) this.editor.commands.focus();
	}
}
Popover.current = null;
```
`prive/javascript/tiptap_spip/src/ui/LinkPopover.js` :

```js
import { NodeSelection } from '@tiptap/pm/state';
import { label } from './labels.js';
import { Popover } from './popover.js';

const VIDE = { href: '', bulle: null, hreflang: null, newWindow: false };

/**
 * Popover de lien (spec 05 §4, 06 §4) : cible avec recherche d'objets SPIP, bulle, langue,
 * nouvelle fenêtre ; ouvrir, retirer ; « Figer le titre » pour un lien sans texte.
 *
 * Selon la sélection :
 * - lien sans texte sélectionné : modification de ses attributs ;
 * - curseur ou sélection dans un lien : modification du lien entier ;
 * - texte sélectionné : nouveau lien sur ce texte ;
 * - curseur seul : insertion d'un lien sans texte [->cible].
 *
 * @param {{ editor, wrapper, services: ?import('../services/cvt.js').Services,
 *           titles: ?import('../services/cache.js').LinkTitles }} context
 */
export function openLinkPopover({ editor, wrapper, services, titles }) {
	// ProseMirror lit la sélection du navigateur sur « selectionchange », asynchrone dans Chromium : un
	// Ctrl+K qui suit de près Maj+flèches verrait l'ancienne sélection. On la lui fait lire maintenant.
	if (editor.view.hasFocus()) editor.view.domObserver?.flush?.();
	const { state } = editor;
	const { selection } = state;
	const auto = selection instanceof NodeSelection && selection.node.type.name === 'spipLinkAuto' ? selection : null;
	const mark = !auto && editor.isActive('spipLink');
	const attrs = auto ? auto.node.attrs : mark ? editor.getAttributes('spipLink') : VIDE;
	const existant = Boolean(auto || mark);

	const popover = new Popover({ editor, wrapper, titre: label('lien'), className: 'tts-popover--lien', onSubmit: () => appliquer() });
	const cible = popover.input(label('lien_cible'), { value: attrs.href, name: 'cible' });
	const suggestions = document.createElement('ul');
	suggestions.className = 'tts-popover__suggestions';
	suggestions.setAttribute('role', 'listbox');
	suggestions.setAttribute('aria-label', label('lien_rechercher'));
	cible.after(suggestions);
	const bulle = popover.input(label('lien_bulle'), { value: attrs.bulle ?? '', name: 'bulle' });
	const langue = popover.input(label('lien_langue'), { value: attrs.hreflang ?? '', name: 'langue' });
	const fenetre = popover.input(label('lien_nouvelle_fenetre'), { value: attrs.newWindow, type: 'checkbox', name: 'nouvelle_fenetre' });

	const valeurs = () => ({
		href: cible.value.trim(),
		bulle: bulle.value === '' ? null : bulle.value,
		hreflang: langue.value.trim() === '' ? null : langue.value.trim(),
		newWindow: fenetre.checked,
	});

	const appliquer = () => {
		const nouveaux = valeurs();
		if (!nouveaux.href) {
			popover.error(label('lien_cible_obligatoire'));
			return false;
		}
		const chain = editor.chain().focus();
		if (auto) {
			chain.command(({ tr }) => {
				tr.setNodeMarkup(auto.from, undefined, nouveaux);
				return true;
			});
		} else if (mark) {
			chain.extendMarkRange('spipLink').setMark('spipLink', nouveaux);
		} else if (selection.empty) {
			chain.insertContent({ type: 'spipLinkAuto', attrs: nouveaux });
		} else {
			chain.setMark('spipLink', nouveaux);
		}
		chain.run();
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	if (existant) {
		popover.button(label('lien_retirer'), () => {
			if (auto) editor.chain().focus().deleteSelection().run();
			else editor.chain().focus().extendMarkRange('spipLink').unsetMark('spipLink').run();
		}, { name: 'retirer' });
		if (titles) {
			const ouvrir = popover.button(label('lien_ouvrir'), () => {
				titles.get(attrs.href).then((r) => r?.url && globalThis.open?.(r.url, '_blank', 'noopener'), () => {});
				return false;
			}, { name: 'ouvrir' });
			ouvrir.classList.add('tts-popover__secondaire');
		}
	}
	if (auto && titles) {
		popover.button(label('lien_figer'), () => {
			titles.get(auto.node.attrs.href).then((r) => {
				if (!r?.titre) return;
				editor.chain().focus().insertContentAt({ from: auto.from, to: auto.to }, {
					type: 'text', text: r.titre, marks: [{ type: 'spipLink', attrs: valeurs() }],
				}).run();
			}, () => {});
		}, { name: 'figer' });
	}
	popover.button(label('annuler'), () => {}, { name: 'annuler' });

	// recherche d'objets SPIP (opération rechercher), à partir de 2 caractères
	let attente = null;
	let derniere = '';
	const rechercher = () => {
		const q = cible.value.trim();
		suggestions.replaceChildren();
		if (!services?.available || q.length < 2 || /^[a-z_]+\d+$|^\w+:\/\/|^#/.test(q)) return;
		derniere = q;
		services.call('rechercher', { q, objets: ['article', 'rubrique', 'breve', 'document', 'auteur', 'mot', 'site'] }).then((resultats) => {
			if (q !== derniere) return;
			suggestions.replaceChildren(...resultats.map((r) => {
				const li = document.createElement('li');
				li.setAttribute('role', 'option');
				li.tabIndex = -1;
				li.dataset.raccourci = r.raccourci;
				li.textContent = `${r.titre} (${r.raccourci})`;
				li.addEventListener('mousedown', (event) => event.preventDefault());
				li.addEventListener('click', () => {
					cible.value = r.raccourci;
					suggestions.replaceChildren();
					cible.focus();
				});
				return li;
			}));
		}, () => {});
	};
	cible.addEventListener('input', () => {
		clearTimeout(attente);
		attente = setTimeout(rechercher, 250);
	});

	popover.open(cible);
	return popover;
}
```
`prive/javascript/tiptap_spip/src/ui/ModelPopover.js` :

```js
import { NodeSelection } from '@tiptap/pm/state';
import { parseModel } from '../spip/models.js';
import { label } from './labels.js';
import { Popover } from './popover.js';

/**
 * Raccourci d'un modèle, saisi ou modifié tel quel (spec 05 §3, cas sans formulaire YAML), validé
 * par le parseur. Modèle sélectionné (ou à `pos`) : modification ; sinon insertion, en bloc si le
 * paragraphe courant est vide.
 */
export function openModelPopover({ editor, wrapper }, pos = null) {
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	const courant = selection instanceof NodeSelection && /^spipModel(Block)?$/.test(selection.node.type.name) ? selection : null;

	const popover = new Popover({ editor, wrapper, titre: label('modele'), className: 'tts-popover--modele', onSubmit: () => appliquer() });
	const raccourci = popover.input(label('modele_raccourci'), { value: courant?.node.attrs.model?.source ?? '', name: 'raccourci' });

	const appliquer = () => {
		const model = parseModel(raccourci.value.trim());
		if (!model) {
			popover.error(label('modele_invalide'));
			return false;
		}
		if (courant) {
			editor.chain().focus().command(({ tr }) => {
				tr.setNodeMarkup(courant.from, undefined, { model });
				return true;
			}).run();
			return true;
		}
		const { $from } = editor.state.selection;
		const paragrapheVide = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && $from.depth === 1;
		if (paragrapheVide) {
			editor.chain().focus().command(({ tr }) => {
				tr.replaceWith($from.before(), $from.after(), editor.schema.nodes.spipModelBlock.create({ model }));
				return true;
			}).run();
		} else {
			editor.chain().focus().insertContent({ type: 'spipModel', attrs: { model } }).run();
		}
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(raccourci);
	return popover;
}
```
`prive/javascript/tiptap_spip/src/editor/extensions.js` :

````js
import { Extension, Mark, Node } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Text from '@tiptap/extension-text';
import { Dropcursor, Gapcursor, UndoRedo } from '@tiptap/extensions';
import { linkAutoView, modelView } from '../nodeviews/views.js';

/**
 * Schéma de l'éditeur (spec 03) : seulement ce que la syntaxe SPIP sait exprimer.
 * Les types et attributs sont exactement ceux que produit src/spip/parse.js.
 */

/** Attribut non rendu dans le DOM (technique ou porté par le JSON seulement). */
const hidden = (fallback = null, keepOnSplit = true) => ({ default: fallback, rendered: false, keepOnSplit });

/** Blocs de premier niveau : seuls ceux-ci portent la carte de segments. */
const TOP_BLOCKS = [
	'paragraph', 'heading', 'horizontalRule', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'table',
	'spipPoesie', 'spipAlign', 'spipCadre', 'spipHtml', 'spipMath', 'spipRaw', 'spipModelBlock',
];

/** Attributs de la sérialisation conservatrice (spec 04 §4) : jamais recopiés sur un bloc coupé. */
const SegmentMap = Extension.create({
	name: 'spipSegmentMap',
	addGlobalAttributes() {
		const attrs = Object.fromEntries(['spipSep', 'spipSrc', 'spipGroup', 'spipHash'].map((a) => [a, hidden(null, false)]));
		return [{ types: TOP_BLOCKS, attributes: attrs }];
	},
});

const SpipDocument = Document.extend({
	addAttributes: () => ({ spipLead: hidden(), spipTrail: hidden() }),
});

/** Saut de ligne : `\n` (autobr) ou `\n_ ` (manuel, valeur des sauts saisis dans l'éditeur). */
const SpipHardBreak = HardBreak.extend({
	addAttributes: () => ({
		syntax: {
			default: 'manual',
			keepOnSplit: false,
			parseHTML: (el) => (el.classList.contains('autobr') ? 'autobr' : 'manual'),
			renderHTML: (attrs) => ({ class: attrs.syntax === 'autobr' ? 'autobr' : 'manualbr' }),
		},
	}),
});

/** Code inline combinable avec les autres marks (`{{`a`}}` existe en SPIP). */
const SpipCode = Code.extend({ excludes: '' });

/** Bloc de code : ```` ``` ```` ou <code> multiligne ; openTag garde un <code …> avec attributs. */
const SpipCodeBlock = CodeBlock.extend({
	addAttributes() {
		return { ...this.parent?.(), openTag: hidden() };
	},
});

/** Un élément de liste SPIP tient sur une ligne : un paragraphe, puis une sous-liste éventuelle. */
const SpipListItem = ListItem.extend({ content: 'paragraph (bulletList | orderedList)?' });

/** Liste numérotée : SPIP ne connaît ni départ ni type de numérotation. */
const SpipOrderedList = OrderedList.extend({
	addAttributes: () => ({}),
	addInputRules: () => [],
});

const SpipTable = Table.extend({
	addAttributes: () => ({ caption: hidden(), summary: hidden() }),
});
const SpipTableHeader = TableHeader.extend({ content: 'paragraph' });
const SpipTableCell = TableCell.extend({ content: 'paragraph' });

/** Fabrique d'un bloc dont le texte n'est pas interprété (<cadre>, <html>, <math>). */
const verbatimBlock = (name, className) => Node.create({
	name,
	group: 'block',
	content: 'text*',
	marks: '',
	code: true,
	defining: true,
	addAttributes: () => ({ openTag: hidden(), closeTag: hidden() }),
	parseHTML: () => [{ tag: `pre[data-tts="${name}"]`, preserveWhitespace: 'full' }],
	renderHTML: () => ['pre', { class: `tts-verbatim ${className}`, 'data-tts': name }, ['code', 0]],
});

const SpipCadre = verbatimBlock('spipCadre', 'spip_cadre');
const SpipHtml = verbatimBlock('spipHtml', 'tts-html');
const SpipMath = verbatimBlock('spipMath', 'tts-math');

/** <poesie> / <poetry> : des paragraphes dont les sauts de ligne comptent. */
const SpipPoesie = Node.create({
	name: 'spipPoesie',
	group: 'block',
	content: 'paragraph+',
	defining: true,
	addAttributes: () => ({ tag: hidden('poesie') }),
	parseHTML: () => [{ tag: 'div[data-tts="spipPoesie"]' }],
	renderHTML: () => ['div', { class: 'spip_poesie', 'data-tts': 'spipPoesie' }, 0],
});

/** Contenu d'un alignement : tout bloc sauf un autre alignement. */
const ALIGNABLE = TOP_BLOCKS.filter((t) => t !== 'spipAlign').join(' | ');

/** <div class="text-center"> … </div> (spec 05 §8). */
const SpipAlign = Node.create({
	name: 'spipAlign',
	group: 'block',
	content: `(${ALIGNABLE})+`,
	defining: true,
	addAttributes: () => ({
		align: {
			default: 'center',
			parseHTML: (el) => el.getAttribute('data-tts-align'),
			renderHTML: (attrs) => ({ class: `text-${attrs.align}`, 'data-tts-align': attrs.align }),
		},
	}),
	parseHTML: () => [{ tag: 'div[data-tts-align]' }],
	renderHTML: ({ HTMLAttributes }) => ['div', HTMLAttributes, 0],
});

/** Construction conservée telle quelle : affichée comme du code, restituée à l'identique. */
const sourceAttr = () => ({
	source: {
		default: '',
		parseHTML: (el) => el.getAttribute('data-tts-source') ?? '',
		renderHTML: (attrs) => ({ 'data-tts-source': attrs.source }),
	},
});

const SpipRaw = Node.create({
	name: 'spipRaw',
	group: 'block',
	atom: true,
	selectable: true,
	addAttributes: sourceAttr,
	parseHTML: () => [{ tag: 'pre[data-tts-source]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['pre', { ...HTMLAttributes, class: 'tts-raw' }, node.attrs.source],
});

const SpipRawInline = Node.create({
	name: 'spipRawInline',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: sourceAttr,
	parseHTML: () => [{ tag: 'code[data-tts-source]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['code', { ...HTMLAttributes, class: 'tts-raw-inline' }, node.attrs.source],
});

/** Attributs d'un lien (spec 03 §3) : cible brute, bulle, langue, nouvelle fenêtre (->>). */
const linkAttributes = () => ({
	href: { default: '', parseHTML: (el) => el.getAttribute('data-tts-href') ?? '', renderHTML: (a) => ({ 'data-tts-href': a.href }) },
	bulle: { default: null, parseHTML: (el) => el.getAttribute('title'), renderHTML: (a) => (a.bulle == null ? {} : { title: a.bulle }) },
	hreflang: { default: null, parseHTML: (el) => el.getAttribute('hreflang'), renderHTML: (a) => (a.hreflang ? { hreflang: a.hreflang } : {}) },
	newWindow: {
		default: false,
		parseHTML: (el) => el.hasAttribute('data-tts-new-window'),
		renderHTML: (a) => (a.newWindow ? { 'data-tts-new-window': '' } : {}),
	},
});

/**
 * Lien [texte->cible]. Pas d'extension-link : sa validation d'URL refuse les cibles SPIP (art12).
 * Pas de href rendu : un clic dans l'éditeur ne doit pas naviguer.
 */
const SpipLink = Mark.create({
	name: 'spipLink',
	inclusive: false,
	addAttributes: linkAttributes,
	// un lien sans texte (data-tts-auto) est un nœud, pas cette mark
	parseHTML: () => [{ tag: 'a[data-tts-href]', getAttrs: (el) => (el.hasAttribute('data-tts-auto') ? false : null) }],
	renderHTML: ({ HTMLAttributes }) => ['a', { ...HTMLAttributes, class: 'tts-link' }, 0],
});

/** Lien sans texte [->art12] : le titre est calculé par SPIP (affiché par L2c), la cible en attendant. */
const SpipLinkAuto = Node.create({
	name: 'spipLinkAuto',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: linkAttributes,
	parseHTML: () => [{ tag: 'a[data-tts-auto]', priority: 60 }],
	renderHTML: ({ node, HTMLAttributes }) => ['a', { ...HTMLAttributes, class: 'tts-link tts-link-auto', 'data-tts-auto': '' }, `→ ${node.attrs.href}`],
});

/** Ancre [#nom<-]. */
const SpipAnchor = Node.create({
	name: 'spipAnchor',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: () => ({
		name: { default: '', parseHTML: (el) => el.getAttribute('data-tts-anchor') ?? '', renderHTML: (a) => ({ 'data-tts-anchor': a.name }) },
	}),
	parseHTML: () => [{ tag: 'span[data-tts-anchor]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'tts-anchor' }, `#${node.attrs.name}`],
});

/** Attribut model (spec 03 §4), transporté en JSON dans le HTML pour le copier-coller interne. */
const modelAttributes = () => ({
	model: {
		default: null,
		parseHTML: (el) => {
			try {
				return JSON.parse(el.getAttribute('data-tts-model'));
			} catch {
				return null;
			}
		},
		renderHTML: (a) => ({ 'data-tts-model': JSON.stringify(a.model) }),
	},
});

/** Modèle dans une phrase ; la prévisualisation (NodeView) vient avec les services serveur (L2c). */
const SpipModel = Node.create({
	name: 'spipModel',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes: modelAttributes,
	parseHTML: () => [{ tag: 'span[data-tts-model]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['span', { ...HTMLAttributes, class: 'tts-model' }, node.attrs.model?.source ?? ''],
});

/** Modèle seul dans son paragraphe. */
const SpipModelBlock = Node.create({
	name: 'spipModelBlock',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes: modelAttributes,
	parseHTML: () => [{ tag: 'div[data-tts-model]' }],
	renderHTML: ({ node, HTMLAttributes }) => ['div', { ...HTMLAttributes, class: 'tts-model tts-model-block' }, node.attrs.model?.source ?? ''],
});

/** Raccourcis clavier de l'interface (spec 06 §6). */
const SpipUi = Extension.create({
	name: 'spipUi',
	addOptions: () => ({ ui: null }),
	addKeyboardShortcuts() {
		return {
			'Mod-k': () => {
				this.options.ui?.openLink?.();
				return true;
			},
		};
	},
});

/**
 * Extensions du cœur, marks dans l'ordre canonique de src/spip/json.js (MARK_ORDER) : le
 * schéma range les marks d'un texte dans l'ordre de déclaration.
 *
 * @param {{ headingLevels?: number[], ui?: { previews?, titles?, editModel?, openLink? } | null }} options
 *        ui : interface de l'instance ; avec `previews` et `titles` (services serveur présents), les
 *        modèles sont prévisualisés et les liens sans texte affichent leur titre
 */
export function coreExtensions({ headingLevels = [2, 3, 4, 5, 6], ui = null } = {}) {
	const withView = (node, view, enabled) => (enabled ? node.extend({ addNodeView: () => view(ui) }) : node);
	return [
		SpipDocument,
		Paragraph,
		Text,
		Heading.configure({ levels: headingLevels, HTMLAttributes: { class: 'spip' } }),
		Blockquote.configure({ HTMLAttributes: { class: 'spip' } }),
		BulletList.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipOrderedList.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipListItem,
		ListKeymap,
		HorizontalRule.configure({ HTMLAttributes: { class: 'spip' } }),
		SpipHardBreak,
		SpipCodeBlock.configure({ HTMLAttributes: { class: 'spip_code spip_code_block' } }),
		SpipTable.configure({ resizable: false, HTMLAttributes: { class: 'table spip' } }),
		TableRow,
		SpipTableHeader,
		SpipTableCell,
		SpipPoesie,
		SpipAlign,
		SpipCadre,
		SpipHtml,
		SpipMath,
		SpipRaw,
		SpipRawInline,
		withView(SpipLinkAuto, linkAutoView, Boolean(ui?.titles)),
		SpipAnchor,
		withView(SpipModel, modelView, Boolean(ui?.previews)),
		withView(SpipModelBlock, modelView, Boolean(ui?.previews)),
		// marks : ordre canonique spipLink, bold, italic, strike, superscript, subscript, code
		SpipLink,
		Bold,
		Italic,
		Strike,
		Superscript,
		Subscript,
		SpipCode,
		SegmentMap,
		Dropcursor,
		Gapcursor,
		UndoRedo,
		SpipUi.configure({ ui }),
	];
}
````
`prive/javascript/tiptap_spip/src/editor/createEditor.js` :

```js
import { Editor, getSchema } from '@tiptap/core';
import { toEditorJSON } from './content.js';
import { coreExtensions } from './extensions.js';

/**
 * Crée un éditeur Tiptap pour une source SPIP.
 * Lève une exception si la source donne un contenu invalide pour le schéma : l'appelant laisse
 * alors le textarea tel quel (jamais d'édition d'un contenu que l'éditeur altérerait).
 *
 * @param {{ element: HTMLElement, source: string, ui?: object, extensions?: object[], editorProps?: object }} options
 *        ui : interface de l'instance (cf. coreExtensions)
 * @returns {Editor}
 */
export function createEditor({ element, source, ui = null, extensions = coreExtensions({ ui }), editorProps = {} }) {
	const content = toEditorJSON(source, getSchema(extensions));
	return new Editor({
		element,
		extensions,
		content,
		editorProps,
		enableContentCheck: true,
		onContentError: ({ error }) => {
			throw error;
		},
	});
}
```
`prive/javascript/tiptap_spip/src/main.js` :

```js
import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { TextareaBridge } from './editor/TextareaBridge.js';
import { LinkTitles, ModelPreviews } from './services/cache.js';
import { Services } from './services/cvt.js';
import { label } from './ui/labels.js';
import { openLinkPopover } from './ui/LinkPopover.js';
import { openModelPopover } from './ui/ModelPopover.js';

/**
 * Textareas équipés (spec 02 §6) : ceux du porte-plume (classes, et champ texte des formulaires
 * SPIP comme le fait son option inserer_auto_name_texte) ou data-tts-toolbar.
 */
const SELECTOR = [
	'textarea.inserer_barre_edition',
	'textarea.inserer_barre_forum',
	'.formulaire_spip textarea[name="texte"]',
	'textarea[data-tts-toolbar]',
].join(', ');

/** Textareas pris par markdown_editor : jamais touchés. */
const MARKDOWN_EDITOR = '[class*="inserer_md_barre"], [data-md-editor-toolbar]';

/** Éditeurs montés dans la page. */
export const instances = new Set();

let observer = null;

/** Détruit les éditeurs dont le textarea a quitté le DOM (rechargement AJAX, crayon fermé). */
function watchRemovals() {
	if (observer || typeof MutationObserver === 'undefined') return;
	observer = new MutationObserver(() => {
		for (const instance of [...instances]) {
			if (!instance.wrapper.isConnected) instance.destroy({ restore: false });
		}
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

/** Retire le porte-plume du textarea : avant son lancement (classes) ou après (markItUp). */
function releasePortePlume(textarea) {
	textarea.classList.add('no_barre', 'no_previsualisation');
	const $ = globalThis.jQuery;
	if (textarea.classList.contains('markItUpEditor') && $?.fn?.markItUpRemove) $(textarea).markItUpRemove();
}

class Instance {
	constructor(textarea, { createEditor }) {
		this.textarea = textarea;
		const rows = Number(textarea.getAttribute('rows')) || 10;

		this.wrapper = document.createElement('div');
		this.wrapper.className = 'tts-editor';
		const toolbar = document.createElement('div');
		toolbar.className = 'tts-toolbar';
		const bouton = (className, texte, onClick) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = className;
			b.textContent = texte;
			b.addEventListener('click', onClick);
			toolbar.append(b);
			return b;
		};
		this.linkButton = bouton('tts-lien', label('lien'), () => this.ui.openLink());
		this.linkButton.title = `${label('lien')} (Ctrl+K)`;
		this.modelButton = bouton('tts-modele', label('modele'), () => this.ui.editModel(null));
		this.modeButton = bouton('tts-mode', label('mode_source'), () => this.toggleMode());
		this.modeButton.setAttribute('aria-pressed', 'false');
		this.content = document.createElement('div');
		this.content.className = 'tts-content';
		this.wrapper.append(toolbar, this.content);

		// formulaire de services du champ (null : mode dégradé, sans services serveur)
		this.services = Services.forTextarea(textarea);
		const contexte = () => ({ editor: this.editor, wrapper: this.wrapper, services: this.services, titles: this.ui.titles });
		this.ui = {
			previews: this.services ? new ModelPreviews(this.services) : null,
			titles: this.services ? new LinkTitles(this.services) : null,
			openLink: () => openLinkPopover(contexte()),
			editModel: (pos) => openModelPopover(contexte(), pos),
		};

		// l'éditeur est créé avant de toucher au DOM : en cas d'échec, rien n'a changé
		this.editor = createEditor({
			element: this.content,
			source: textarea.value,
			ui: this.ui,
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em` } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });

		textarea.before(this.wrapper);
		this.wrapper.append(textarea);
		textarea.hidden = true;
	}

	toggleMode() {
		const mode = this.bridge.mode === 'visual' ? 'source' : 'visual';
		if (!this.bridge.setMode(mode)) return;
		const source = mode === 'source';
		this.textarea.hidden = !source;
		this.content.hidden = source;
		this.linkButton.disabled = source;
		this.modelButton.disabled = source;
		this.modeButton.setAttribute('aria-pressed', String(source));
		(source ? this.textarea : this.editor).focus?.();
	}

	/** @param {{ restore?: boolean }} options  restore : remettre le textarea à sa place */
	destroy({ restore = true } = {}) {
		instances.delete(this);
		this.bridge.destroy();
		if (restore && this.wrapper.isConnected) {
			this.wrapper.before(this.textarea);
			this.wrapper.remove();
			this.textarea.hidden = false;
			delete this.textarea.dataset.ttsMounted;
		}
	}
}

/**
 * Monte l'éditeur sur les textareas équipés de `racine` (document par défaut). Idempotent :
 * appelée au chargement puis à chaque onAjaxLoad (rechargements AJAX de SPIP et Crayons).
 *
 * @param {ParentNode|{ jquery: string, 0: ParentNode }} [racine]
 * @param {{ createEditor?: typeof defaultCreateEditor }} [options]
 */
export function tiptap_spip_init(racine = document, { createEditor = defaultCreateEditor } = {}) {
	// onAjaxLoad passe la racine rechargée dans this, parfois sous forme d'objet jQuery
	const node = racine?.jquery ? racine[0] : racine;
	const root = node?.querySelectorAll ? node : document;
	for (const textarea of root.querySelectorAll(SELECTOR)) {
		if (textarea.dataset.ttsMounted || textarea.matches(MARKDOWN_EDITOR)) continue;
		textarea.dataset.ttsMounted = 'oui';
		releasePortePlume(textarea);
		try {
			instances.add(new Instance(textarea, { createEditor }));
		} catch (error) {
			textarea.dataset.ttsMounted = 'erreur';
			console.warn('tiptap_spip : éditeur non monté, le textarea reste en saisie directe', error);
		}
	}
	if (instances.size) watchRemovals();
}
```
`css/tiptap_spip.css` :

```css
/* Éditeur visuel pour SPIP : interface et éléments propres à l'édition (classes tts-*). */

.tts-editor {
	border: 1px solid #ccc;
	border-radius: 4px;
	background: #fff;
}

.tts-toolbar {
	display: flex;
	justify-content: flex-end;
	gap: 4px;
	padding: 4px;
	border-bottom: 1px solid #ccc;
}

.tts-mode[aria-pressed="true"] {
	font-weight: bold;
}

.tts-content .tts-prosemirror {
	padding: 0.5em 1em;
	outline: none;
}

.tts-editor > textarea {
	display: block;
	width: 100%;
	box-sizing: border-box;
	border: 0;
}

.tts-editor > textarea[hidden],
.tts-content[hidden] {
	display: none;
}

/* Constructions conservées telles quelles : affichées comme du code. */
.tts-raw,
.tts-raw-inline {
	font-family: monospace;
	background: #f4f4f4;
	color: #555;
	white-space: pre-wrap;
}

.tts-raw {
	padding: 0.25em 0.5em;
	border-left: 3px solid #bbb;
}

.tts-verbatim {
	white-space: pre-wrap;
	background: #f8f8f8;
	padding: 0.25em 0.5em;
}

/* Liens, ancres et modèles (affichage compact ; prévisualisation des modèles : lot L2c). */
.tts-link {
	color: #1a5fb4;
	text-decoration: underline;
	cursor: text;
}

.tts-link-auto,
.tts-anchor,
.tts-model {
	font-family: monospace;
	font-size: 0.9em;
	padding: 0 0.25em;
	border-radius: 3px;
	background: #eef3fb;
	white-space: pre-wrap;
}

.tts-anchor {
	background: #f3eefb;
}

.tts-model-block {
	display: block;
	margin: 0.5em 0;
	padding: 0.5em;
	border: 1px dashed #9ab;
}

/* Barre : boutons de l'éditeur à gauche, bascule de mode à droite. */
.tts-toolbar .tts-mode {
	margin-left: auto;
}

/* Modèles prévisualisés (lot L2.3) : rendu calculé par SPIP, inerte. */
.tts-editor {
	position: relative;
}

.tts-model {
	position: relative;
	display: inline-block;
	max-width: 100%;
	vertical-align: middle;
	font-family: inherit;
	font-size: inherit;
	padding: 0;
	background: none;
}

.tts-model-block {
	display: block;
}

.tts-model.ProseMirror-selectednode {
	outline: 2px solid #1a5fb4;
}

.tts-model__preview img {
	max-width: 100%;
	height: auto;
}

.tts-model .tts-chip {
	font-family: monospace;
	font-size: 0.9em;
	padding: 0 0.25em;
	border-radius: 3px;
	background: #eef3fb;
}

.tts-model--chargement .tts-chip {
	opacity: 0.6;
}

.tts-model--erreur .tts-chip {
	background: #fbeeee;
}

.tts-model__modifier {
	position: absolute;
	top: 0;
	right: 0;
	display: none;
	font-size: 0.8em;
}

.tts-model:hover .tts-model__modifier,
.tts-model.ProseMirror-selectednode .tts-model__modifier {
	display: block;
}

/* Popovers (lien, modèle). */
.tts-popover {
	position: absolute;
	z-index: 10;
	min-width: 18em;
	max-width: 28em;
	padding: 0.5em;
	background: #fff;
	border: 1px solid #aaa;
	border-radius: 4px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tts-popover__champ {
	display: block;
	margin-bottom: 0.4em;
}

.tts-popover__champ > span {
	display: block;
	font-size: 0.85em;
}

.tts-popover__champ input:not([type="checkbox"]) {
	width: 100%;
	box-sizing: border-box;
}

.tts-popover__suggestions {
	margin: 0;
	padding: 0;
	list-style: none;
	max-height: 12em;
	overflow-y: auto;
}

.tts-popover__suggestions li {
	padding: 0.15em 0.3em;
	cursor: pointer;
}

.tts-popover__suggestions li:hover {
	background: #eef3fb;
}

.tts-popover__erreur {
	margin: 0 0 0.4em;
	color: #a00;
}

.tts-popover__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
```
`lang/tiptap_spip_fr.php` :

```php
<?php

// Ceci est un fichier langue de SPIP -- This is a SPIP language file

return [
	'annuler' => 'Annuler',
	'appliquer' => 'Appliquer',
	'erreur_autorisation' => 'Vous n’avez pas le droit d’utiliser ces services.',
	'erreur_cibles' => 'Liste de cibles de liens invalide.',
	'erreur_modele' => 'Raccourci de modèle invalide.',
	'erreur_modele_inconnu' => 'Ce modèle n’existe pas.',
	'erreur_objets' => 'Types d’objets invalides.',
	'erreur_operation' => 'Opération inconnue.',
	'erreur_recherche' => 'La recherche doit compter de 2 à 100 caractères.',
	'lien' => 'Lien',
	'lien_bulle' => 'Bulle d’aide',
	'lien_cible' => 'Cible (art12, rub3, https://…)',
	'lien_cible_obligatoire' => 'Indiquez une cible.',
	'lien_figer' => 'Figer le titre',
	'lien_langue' => 'Langue de la cible',
	'lien_nouvelle_fenetre' => 'Ouvrir dans une nouvelle fenêtre',
	'lien_ouvrir' => 'Ouvrir',
	'lien_rechercher' => 'Rechercher un contenu',
	'lien_retirer' => 'Retirer le lien',
	'mode_source' => 'Source',
	'modele' => 'Modèle',
	'modele_invalide' => 'Ce n’est pas un raccourci de modèle.',
	'modele_modifier' => 'Modifier',
	'modele_raccourci' => 'Raccourci du modèle',
];
```
`prive/javascript/_inits/09_tiptap_spip_config.js.html` :

```js
window.spipConfig ??= {};
Object.assign(window.spipConfig, {
	tiptap_spip: {
		css: "@import url('[(#CHEMIN{css/tiptap_spip.css}|timestamp|url_absolue)]')",
		i18n: {
			mode_source: "<:tiptap_spip:mode_source|texte_script:>",
			lien: "<:tiptap_spip:lien|texte_script:>",
			modele: "<:tiptap_spip:modele|texte_script:>",
			lien_cible: "<:tiptap_spip:lien_cible|texte_script:>",
			lien_rechercher: "<:tiptap_spip:lien_rechercher|texte_script:>",
			lien_bulle: "<:tiptap_spip:lien_bulle|texte_script:>",
			lien_langue: "<:tiptap_spip:lien_langue|texte_script:>",
			lien_nouvelle_fenetre: "<:tiptap_spip:lien_nouvelle_fenetre|texte_script:>",
			lien_ouvrir: "<:tiptap_spip:lien_ouvrir|texte_script:>",
			lien_retirer: "<:tiptap_spip:lien_retirer|texte_script:>",
			lien_figer: "<:tiptap_spip:lien_figer|texte_script:>",
			lien_cible_obligatoire: "<:tiptap_spip:lien_cible_obligatoire|texte_script:>",
			modele_raccourci: "<:tiptap_spip:modele_raccourci|texte_script:>",
			modele_modifier: "<:tiptap_spip:modele_modifier|texte_script:>",
			modele_invalide: "<:tiptap_spip:modele_invalide|texte_script:>",
			appliquer: "<:tiptap_spip:appliquer|texte_script:>",
			annuler: "<:tiptap_spip:annuler|texte_script:>"
		}
	}
});
```

- [ ] **Step 3 : vérifier**

Run : `npm test` → PASS, 281 tests. Contrôle de la détection (fait pendant la préparation) : bulle ignorée dans `LinkPopover` (`bulle: null`) → 2 tests échouent ; prévisualisation insérée sans `previewFragment` → 1 test échoue.

- [ ] **Step 4 : bundle et commit**

Run : `npm run build` (≈ 895 ko, 430 ko minifié).

```bash
git add prive/javascript/tiptap_spip/src prive/javascript/tiptap_spip/tests/ui/interface.test.js css/tiptap_spip.css lang/tiptap_spip_fr.php prive/javascript/_inits/09_tiptap_spip_config.js.html prive/javascript/tiptap_spip.js prive/javascript/tiptap_spip.min.js
git commit -m "feat(ui): prévisualisation des modèles, titres des liens, popovers de lien et de modèle"
```

---

### Task 4 : Bout en bout

**Files:**
- Modify: `tests/e2e/site.php` (commande `modifier`), `prive/javascript/tiptap_spip/tests/e2e/site.js` (`ecrireTexte`, `selectionStable`)
- Create: `prive/javascript/tiptap_spip/tests/e2e/interface.e2e.js`

- [ ] **Step 1 : outils**

`tests/e2e/site.php` :

```php
<?php

/**
 * Pilote d'un site SPIP JETABLE pour les tests de bout en bout (jamais un site réel : la
 * commande active le plugin et ouvre une session d'administrateur).
 *
 * Usage :
 *   SPIP_ROOT=<site> php tests/e2e/site.php preparer <agent> [titre] [id_auteur] < texte.spip
 *     active le plugin tiptap_spip, crée un article avec le texte lu sur l'entrée standard, lié à
 *     l'auteur (1 par défaut), et une session pour cet auteur ; écrit
 *     {"id_article": …, "cookie": …} sur la sortie.
 *     <agent> : User-Agent du navigateur de test (la session SPIP en dépend).
 *   SPIP_ROOT=<site> php tests/e2e/site.php texte <id_article>
 *     écrit le texte de l'article, octet pour octet.
 *   SPIP_ROOT=<site> php tests/e2e/site.php modifier <id_article> < texte.spip
 *     remplace le texte de l'article par l'entrée standard.
 *   SPIP_ROOT=<site> php tests/e2e/site.php document <id_article>
 *     crée une image (PNG 1×1) liée à l'article ; écrit son id_document.
 *   SPIP_ROOT=<site> php tests/e2e/site.php auteur <statut>
 *     crée un auteur (0minirezo, 1comite…) ; écrit son id_auteur.
 *   SPIP_ROOT=<site> php tests/e2e/site.php inserer <table> <champs JSON>
 *     insère une ligne telle quelle ; écrit son id.
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$commande = $argv[1] ?? '';
if ($root === '' || !is_dir($root . '/ecrire') || !in_array($commande, ['preparer', 'texte', 'modifier', 'document', 'auteur', 'inserer'], true)) {
	fwrite(STDERR, "Usage : SPIP_ROOT=<site jetable> php tests/e2e/site.php preparer <agent> [titre] [id_auteur] | texte <id_article> | modifier <id_article> | document <id_article> | auteur <statut> | inserer <table> <champs JSON>\n");
	exit(2);
}

// la session SPIP est liée à l'IP et au User-Agent du navigateur
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = $commande === 'preparer' ? (string) ($argv[2] ?? '') : '';

chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('base/abstract_sql');

if ($commande === 'texte') {
	echo (string) sql_getfetsel('texte', 'spip_articles', 'id_article=' . (int) ($argv[2] ?? 0));
	exit(0);
}

if ($commande === 'modifier') {
	sql_updateq('spip_articles', ['texte' => stream_get_contents(STDIN)], 'id_article=' . (int) ($argv[2] ?? 0));
	exit(0);
}

if ($commande === 'auteur') {
	$login = 'tts' . bin2hex(random_bytes(4));
	echo (int) sql_insertq('spip_auteurs', ['nom' => $login, 'login' => $login, 'statut' => (string) ($argv[2] ?? '1comite'), 'email' => $login . '@exemple.test']), "\n";
	exit(0);
}

if ($commande === 'inserer') {
	echo (int) sql_insertq((string) ($argv[2] ?? ''), json_decode((string) ($argv[3] ?? '{}'), true)), "\n";
	exit(0);
}

if ($commande === 'document') {
	$id_article = (int) ($argv[2] ?? 0);
	$fichier = 'png/tts-' . bin2hex(random_bytes(4)) . '.png';
	@mkdir(_DIR_IMG . 'png', 0777, true);
	file_put_contents(_DIR_IMG . $fichier, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
	$id_document = (int) sql_insertq('spip_documents', [
		'extension' => 'png',
		'titre' => 'Image de test',
		'fichier' => $fichier,
		'taille' => filesize(_DIR_IMG . $fichier),
		'largeur' => 1,
		'hauteur' => 1,
		'media' => 'image',
		'mode' => 'document',
		'distant' => 'non',
		'statut' => 'publie',
		'date' => date('Y-m-d H:i:s'),
	]);
	sql_insertq('spip_documents_liens', ['id_document' => $id_document, 'objet' => 'article', 'id_objet' => $id_article, 'vu' => 'non']);
	echo $id_document, "\n";
	exit(0);
}

include_spip('inc/plugin');
ecrire_plugin_actifs(['tiptap_spip'], false, 'ajoute');

$id_rubrique = (int) sql_getfetsel('id_rubrique', 'spip_rubriques', '', '', 'id_rubrique', '0,1');
if (!$id_rubrique) {
	$id_rubrique = (int) sql_insertq('spip_rubriques', ['titre' => 'Tests', 'statut' => 'publie', 'id_secteur' => 0]);
	sql_updateq('spip_rubriques', ['id_secteur' => $id_rubrique], 'id_rubrique=' . $id_rubrique);
}
$id_article = (int) sql_insertq('spip_articles', [
	'titre' => (string) ($argv[3] ?? 'Test tiptap_spip'),
	'texte' => stream_get_contents(STDIN),
	'id_rubrique' => $id_rubrique,
	'id_secteur' => $id_rubrique,
	'statut' => 'prepa',
	'date' => date('Y-m-d H:i:s'),
	'lang' => 'fr',
]);
$id_auteur = (int) ($argv[4] ?? 1);
sql_insertq('spip_auteurs_liens', ['id_auteur' => $id_auteur, 'objet' => 'article', 'id_objet' => $id_article]);

include_spip('inc/session');
$auteur = sql_fetsel('*', 'spip_auteurs', 'id_auteur=' . $id_auteur);
unset($_COOKIE['spip_session']);
$cookie = ajouter_session($auteur);

echo json_encode(['id_article' => $id_article, 'cookie' => $cookie]), "\n";
```
`prive/javascript/tiptap_spip/tests/e2e/site.js` :

```js
// Outils des tests de bout en bout : pilote du site SPIP JETABLE (tests/e2e/site.php) et page
// d'édition d'un article.
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const driver = `${repo}tests/e2e/site.php`;
const env = { ...process.env, SPIP_ROOT: process.env.TTS_SITE };

export const php = (args, input) => execFileSync('php', [driver, ...args], { env, input, encoding: 'utf8' });
export const texte = (id) => php(['texte', String(id)]);
export const ecrireTexte = (id, source) => php(['modifier', String(id)], source);
export const creerDocument = (id) => Number(php(['document', String(id)]));
export const creerAuteur = (statut) => Number(php(['auteur', statut]));
export const inserer = (table, champs) => Number(php(['inserer', table, JSON.stringify(champs)]));

/** Fins de ligne telles que le navigateur les soumet. */
export const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

export const configure = (test) => test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

/**
 * Crée un article, ouvre une session et charge sa page d'édition.
 * @param {{ sansEditeur?: boolean, avant?: (id: number) => void, titre?: string, auteur?: number }} options
 *        sansEditeur : bundle bloqué, textarea natif ; avant : préparation après la création de
 *        l'article (document lié…) ; titre : titre de l'article (défaut « Test tiptap_spip ») ;
 *        auteur : auteur de l'article et de la session (1, l'administrateur, par défaut)
 */
export async function editer(page, source, { sansEditeur = false, avant, titre = 'Test tiptap_spip', auteur = 1 } = {}) {
	const { id_article: id, cookie } = JSON.parse(php(['preparer', 'tts-e2e', titre, String(auteur)], source));
	avant?.(id);
	const url = new URL(process.env.TTS_URL);
	await page.context().addCookies([{ name: 'spip_session', value: cookie, domain: url.hostname, path: '/' }]);
	if (sansEditeur) await page.route(/tiptap_spip(\.min)?\.js/, (route) => route.abort());
	await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
	if (!sansEditeur) await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
	return id;
}

export const enregistrer = async (page) => {
	await Promise.all([
		page.waitForURL(/exec=article&/),
		page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
	]);
};

/**
 * Attend que ProseMirror ait pris en compte la sélection du navigateur (événement selectionchange,
 * asynchrone) : Playwright enchaîne les touches plus vite qu'un humain.
 */
export const selectionStable = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));

/** Le module de l'éditeur chargé par la page (même URL, donc même instance de module). */
export const module = (page) => page.evaluate(async () => {
	const source = [...document.scripts].map((s) => s.textContent).join('\n');
	window.__tts = await import(source.match(/from '([^']*tiptap_spip(?:\.min)?\.js[^']*)'/)[1]);
});
```

- [ ] **Step 2 : tests**

`prive/javascript/tiptap_spip/tests/e2e/interface.e2e.js` :

```js
// Interface des liens et modèles (lot L2.3) sur un site SPIP JETABLE : prévisualisation, titres des
// liens sans texte, popover de lien avec recherche, insertion de modèle, enregistrement.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, creerDocument, crlf, ecrireTexte, editer, enregistrer, selectionStable, texte } from './site.js';

configure(test);

test('un modèle de document est prévisualisé, un lien sans texte affiche le titre de sa cible', async ({ page }) => {
	let doc;
	const titre = `Cible ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, '', {
		avant: (idArticle) => {
			doc = creerDocument(idArticle);
			const source = `Voir [->art${cible}].\n\n<doc${doc}|left>`;
			// texte posé après la création du document (son id est dans le raccourci)
			ecrireTexte(idArticle, source);
		},
	});
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await expect(page.locator('.tts-link-auto')).toHaveText(titre);
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Voir [->art${cible}].\n\n<doc${doc}|left>`));
});

test('Ctrl+K : recherche d\'un article, lien posé sur la sélection et enregistré', async ({ page }) => {
	const titre = `Destination ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, 'Lire la suite');
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	// Ctrl+K juste après Maj+flèches, sans attendre : le popover doit lire la sélection réelle
	for (let i = 0; i < 'la suite'.length; i++) await page.keyboard.press('Shift+ArrowLeft');
	await page.keyboard.press('ControlOrMeta+k');
	const champ = page.locator('.tts-popover input[name=cible]');
	await expect(champ).toBeFocused();
	await champ.fill(titre.slice(0, 15));
	await page.locator('.tts-popover__suggestions li', { hasText: titre }).click();
	await expect(champ).toHaveValue(`article${cible}`);
	await page.locator('.tts-popover button[name=appliquer]').click();
	await expect(page.locator('.ProseMirror a.tts-link')).toHaveText('la suite');
	await enregistrer(page);
	expect(texte(id)).toBe(`Lire [la suite->article${cible}]`);
});

test('bouton Modèle : raccourci inséré en bloc, prévisualisé, enregistré', async ({ page }) => {
	let doc;
	const id = await editer(page, 'Texte', { avant: (idArticle) => { doc = creerDocument(idArticle); } });
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.press('Enter');
	await page.locator('.tts-toolbar .tts-modele').click();
	await page.locator('.tts-popover input[name=raccourci]').fill(`<doc${doc}|center>`);
	await page.keyboard.press('Enter');
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Texte\n\n<doc${doc}|center>`));
});
```

- [ ] **Step 3 : lancer**

Site jetable neuf relié au dépôt, serveur `php -d opcache.revalidate_freq=0 -S 127.0.0.1:18931 -t <site>` (port vérifié libre).
Run : `TTS_SITE=… TTS_URL=http://127.0.0.1:18931 npm run e2e` → `18 passed, 1 skipped`. Contrôle : sans `editor.view.domObserver?.flush?.()` dans `openLinkPopover` (bundle reconstruit), le test « Ctrl+K » échoue.

- [ ] **Step 4 : commit**

```bash
git add tests/e2e/site.php prive/javascript/tiptap_spip/tests/e2e/site.js prive/javascript/tiptap_spip/tests/e2e/interface.e2e.js
git commit -m "test(e2e): prévisualisation, titres, popover de lien et insertion de modèle"
```

---

### Task 5 : Specs

- [ ] **Step 1 : reporter**

- 05 §3 : prévisualisation via `ModelPreviews` (cache par source, appels sérialisés par la file des services, pas de N=4) ; HTML rendu inerte côté navigateur ; rendu vide ou erreur → raccourci affiché ; édition par le raccourci brut (popover « Modèle », bouton « Modifier » du NodeView) ; insertion en bloc dans un paragraphe vide, en ligne sinon ; YAML / `#FORMULAIRE_INSERER_MODELES` (Q3), sélecteur de documents, règle de saisie : plus tard.
- 05 §4 : titres des liens sans texte par `LinkTitles` (lots de 50) ; popover : cible avec recherche (à partir de 2 caractères, 250 ms, hors cibles déjà au format `art12`, URL, `#ancre`), bulle, langue, nouvelle fenêtre, retirer, ouvrir (URL résolue par `titre_lien`), figer le titre ; sélection vide → lien sans texte ; proposition des ancres du document : plus tard.
- 06 §2 et §6 : barre minimale du lot L2.3 (Lien, Modèle, Source ; boutons désactivés en mode source), `Ctrl+K` ; lecture forcée de la sélection avant d'ouvrir le popover.
- 09 : L2.3 fait.

- [ ] **Step 2 : commit**

```bash
git add docs/specs
git commit -m "docs: specs du lot L2.3 (interface des liens et modèles)"
```
