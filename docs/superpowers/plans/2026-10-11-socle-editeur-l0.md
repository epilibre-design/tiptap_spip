# Socle de l'éditeur (lot L0) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** monter un éditeur Tiptap 3 sur le textarea `texte` d'un article dans l'espace privé SPIP 4, qui lit et réécrit les raccourcis SPIP avec le cœur du lot L1, et enregistre exactement le même texte que le textarea natif tant qu'on ne modifie rien.

**Architecture :** un schéma Tiptap (`src/editor/extensions.js`) qui reproduit exactement les types JSON de `src/spip/parse.js` ; `toEditorJSON()` fait passer le JSON par le schéma et recalcule les empreintes `spipHash` sur la forme que l'éditeur renverra ; `TextareaBridge` synchronise textarea et éditeur ; `main.js` monte l'éditeur sur les textareas du porte-plume. Côté SPIP, un paquet minimal charge le bundle esbuild par `header_prive` (SPIP 4) ou l'importmap (SPIP 5).

**Tech Stack :** Tiptap 3.31.4 (extensions déclarées une à une, sans StarterKit), esbuild 0.28.2, Vitest 3.2.4 + jsdom 30.1.2, Playwright 1.61.0 (Chromium en cache, révision 1228), PHPUnit 12, PHP 8.4, site SPIP 4.4.21 jetable (`/src/spip/site-jetable-v4.4.21.tgz`, SQLite).

**Specs de référence :** `docs/specs/02-architecture.md` (§2 à §4, §6 lancement), `docs/specs/03-schema-json.md` §2–§3, `docs/specs/04-parseur-serialiseur.md` §4, `docs/specs/08-tests-recette.md`, lot L0 de `docs/specs/09-lots-roadmap.md`.

## Global Constraints

- Plugin SPIP à la racine du dépôt (`paquet.xml`, préfixe `tiptap_spip`, `compatibilite="[4.2.0;5.*]"`) ; code JS dans `prive/javascript/tiptap_spip/` ; bundles générés `prive/javascript/tiptap_spip.js` et `.min.js`, versionnés (comme markdown_editor, le plugin s'installe sans build).
- `src/spip/` ne dépend ni de Tiptap ni du DOM ; `src/editor/` et `src/main.js` dépendent de Tiptap.
- Versions épinglées exactement dans `package.json`, lockfiles versionnés.
- Bundle : **esbuild** (bun n'est pas installé ; esbuild s'installe par npm et produit le même ESM).
- Pas de StarterKit : les extensions sont déclarées une à une, les marks dans l'ordre canonique de `MARK_ORDER` (`bold, italic, strike, superscript, subscript, code`), sinon `getJSON()` ne range pas les marks comme le parseur et l'empreinte d'un bloc intact ne correspond plus.
- Pas de `TrailingNode` (il ajoute un paragraphe vide en fin de document, donc modifie la source) ; `Gapcursor` permet d'écrire après un tableau ou un bloc de code final.
- Identité : un texte enregistré sans modification dans l'éditeur est **octet pour octet** celui qu'enregistre le formulaire sans l'éditeur. Le navigateur soumet les fins de ligne d'un textarea en CRLF et ignore un saut de ligne en tête de `<textarea>` : c'est la référence, avec ou sans éditeur.
- Le site jetable est décompressé dans le scratchpad ; jamais de test sur une base locale réelle. Le port du serveur PHP est vérifié libre avant usage (8765 est occupé par un autre site du poste).
- Commentaires et messages en français, indentation par tabulations ; commits sans trailer.

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `prive/javascript/tiptap_spip/src/spip/serialize.js` | (modifié) séparateur valide à sa place, robustesse aux attributs recopiés |
| `prive/javascript/tiptap_spip/src/editor/extensions.js` | schéma Tiptap : nœuds et marks SPIP, attributs techniques |
| `prive/javascript/tiptap_spip/src/editor/content.js` | `toEditorJSON()` : parse, contrôle par le schéma, empreintes recalculées |
| `prive/javascript/tiptap_spip/src/editor/createEditor.js` | création d'un éditeur pour une source, refus si contenu invalide |
| `prive/javascript/tiptap_spip/src/editor/TextareaBridge.js` | synchronisation textarea ⇄ éditeur, mode source |
| `prive/javascript/tiptap_spip/src/main.js` | `tiptap_spip_init()` : découverte des textareas, montage, bascule, destruction |
| `prive/javascript/tiptap_spip/scripts/build.mjs` | bundles esbuild |
| `prive/javascript/tiptap_spip/playwright.config.js`, `prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` | bout en bout sur site jetable |
| `paquet.xml`, `tiptap_spip_pipelines.php` | paquet et chargement SPIP 4 / SPIP 5 |
| `prive/javascript/_inits/09_tiptap_spip_config.js.html`, `80_tiptap_spip.js` | configuration et lancement |
| `css/tiptap_spip.css`, `lang/tiptap_spip_fr.php` | interface minimale |
| `composer.json`, `phpunit.xml`, `tests/bootstrap.php`, `tests/unit/PipelinesTest.php` | PHPUnit |
| `tests/e2e/site.php` | pilote du site jetable : activation, article, session, lecture du texte |

---

### Task 1 : Séparateurs robustes aux attributs recopiés

ProseMirror recopie tous les attributs d'un bloc quand il le coupe en son milieu (`keepOnSplit: false` n'agit que sur une coupure en fin de bloc) ; un bloc déplacé garde aussi les siens. Le nouveau bloc hérite alors d'un `spipSep` vide et se recolle au précédent : `Pre` + `mier.` redonne `Premier.`, la coupure de paragraphe est perdue. Le sérialiseur ne doit donc reprendre un `spipSep` que s'il est valide à sa place.

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/spip/serialize.js` (fonction `serialize`, nouvelle fonction `separator`)
- Test: `prive/javascript/tiptap_spip/tests/spip/serialize.test.js` (fin du `describe('sérialisation conservatrice')`)

**Interfaces:**
- Consumes : `parse`, `serialize` (lot L1).
- Produces : même signature `serialize(doc, { conservative })`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à la fin du `describe('sérialisation conservatrice', …)`, après le test « document vide modifié » :

```js
	// l'éditeur recopie les attributs techniques quand il coupe un bloc ou colle une copie
	const dup = (block, content) => ({ ...block, content });

	it('un bloc coupé en deux reste séparé par une ligne vide', () => {
		const doc = parse('Premier.\n\nSecond.');
		const [first, second] = doc.content;
		doc.content = [dup(first, [text('Pre')]), dup(first, [text('mier.')]), second];
		expect(serialize(doc)).toBe('Pre\n\nmier.\n\nSecond.');
	});

	it('une copie intacte du premier bloc collée plus loin n\'est pas recollée au bloc précédent', () => {
		const doc = parse('Premier.\n\nSecond.');
		doc.content = [...doc.content, doc.content[0]];
		expect(serialize(doc)).toBe('Premier.\n\nSecond.\n\nPremier.');
	});

	it('un bloc déplacé en tête ne garde pas son séparateur', () => {
		const doc = parse('Premier.\n\n\n\nSecond.');
		doc.content = [doc.content[1], doc.content[0]];
		expect(serialize(doc)).toBe('Second.\n\nPremier.');
	});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `cd prive/javascript/tiptap_spip && npx vitest run tests/spip/serialize.test.js`
Expected : FAIL, 3 tests (`'Premier.\n\nSecond.'` au lieu de `'Pre\n\nmier.\n\nSecond.'`, etc.).

- [ ] **Step 3 : implémenter**

Dans `prive/javascript/tiptap_spip/src/spip/serialize.js`, remplacer la fonction `serialize` par :

```js
export function serialize(doc, { conservative = true } = {}) {
	const blocks = doc.content ?? [];
	let out = conservative ? (doc.attrs?.spipLead ?? '') : '';
	let i = 0;
	while (i < blocks.length) {
		const b = blocks[i];
		const a = b.attrs ?? {};
		const sep = separator(i, conservative ? a.spipSep : null);
		if (conservative && a.spipGroup && typeof a.spipSrc === 'string' && canon(blocks.slice(i, i + a.spipGroup)) === a.spipHash) {
			out += sep + a.spipSrc;
			i += a.spipGroup;
			continue;
		}
		out += sep + serializeBlock(b);
		i++;
	}
	return out + (conservative ? (doc.attrs?.spipTrail ?? '') : '');
}
```

et ajouter, juste avant `const textOf = …` :

```js
/**
 * Séparateur avant le bloc i. L'éditeur recopie les attributs techniques quand il coupe un bloc
 * ou colle une copie : un spipSep n'est donc repris que s'il reste valide à cette place, c'est-à-
 * dire vide en tête de document, contenant une ligne vide ailleurs.
 */
function separator(i, spipSep) {
	if (i === 0) return '';
	return typeof spipSep === 'string' && /\n[ \t\r]*\n/.test(spipSep) ? spipSep : '\n\n';
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npm test`
Expected : PASS, 149 tests (146 + 3).

- [ ] **Step 5 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/serialize.js prive/javascript/tiptap_spip/tests/spip/serialize.test.js
git commit -m "fix(spip): séparateur valide à sa place, même avec des attributs recopiés"
```

---

### Task 2 : Schéma Tiptap et aller-retour par l'éditeur

**Files:**
- Modify: `prive/javascript/tiptap_spip/package.json`, `prive/javascript/tiptap_spip/package-lock.json`, `prive/javascript/tiptap_spip/.gitignore`
- Create: `prive/javascript/tiptap_spip/src/editor/extensions.js`, `prive/javascript/tiptap_spip/src/editor/content.js`
- Test: `prive/javascript/tiptap_spip/tests/editor/roundtrip.test.js`

**Interfaces:**
- Consumes : `parse`, `serialize`, `canon` (lot L1).
- Produces :
  - `coreExtensions({ headingLevels = [2,3,4,5,6] }): Extension[]`
  - `toEditorJSON(source: string, schema: Schema): object` — lève une exception si le contenu viole le schéma.

- [ ] **Step 1 : dépendances**

```bash
cd prive/javascript/tiptap_spip
npm install --save-exact @tiptap/core@3.31.4 @tiptap/pm@3.31.4 @tiptap/extensions@3.31.4 @tiptap/extension-table@3.31.4 @tiptap/extension-subscript@3.31.4 @tiptap/extension-superscript@3.31.4 $(for e in document paragraph text heading bold italic strike code code-block blockquote list horizontal-rule hard-break; do printf '@tiptap/extension-%s@3.31.4 ' $e; done)
npm install --save-dev --save-exact esbuild@0.28.2 jsdom@30.1.2 @playwright/test@1.61.0
```

Playwright 1.61.0 est choisi parce qu'il utilise le Chromium déjà en cache (`~/.cache/ms-playwright/chromium-1228`) : pas de téléchargement. `package.json` attendu :

`prive/javascript/tiptap_spip/package.json` :

```json
{
  "name": "tiptap-spip",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "watch": "node scripts/build.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "equivalence": "node scripts/equivalence.mjs",
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "1.61.0",
    "esbuild": "0.28.2",
    "jsdom": "30.1.2",
    "vitest": "3.2.4",
    "yaml": "2.8.1"
  },
  "dependencies": {
    "@tiptap/core": "3.31.4",
    "@tiptap/extension-blockquote": "3.31.4",
    "@tiptap/extension-bold": "3.31.4",
    "@tiptap/extension-code": "3.31.4",
    "@tiptap/extension-code-block": "3.31.4",
    "@tiptap/extension-document": "3.31.4",
    "@tiptap/extension-hard-break": "3.31.4",
    "@tiptap/extension-heading": "3.31.4",
    "@tiptap/extension-horizontal-rule": "3.31.4",
    "@tiptap/extension-italic": "3.31.4",
    "@tiptap/extension-list": "3.31.4",
    "@tiptap/extension-paragraph": "3.31.4",
    "@tiptap/extension-strike": "3.31.4",
    "@tiptap/extension-subscript": "3.31.4",
    "@tiptap/extension-superscript": "3.31.4",
    "@tiptap/extension-table": "3.31.4",
    "@tiptap/extension-text": "3.31.4",
    "@tiptap/extensions": "3.31.4",
    "@tiptap/pm": "3.31.4"
  }
}
```

`prive/javascript/tiptap_spip/.gitignore` :

```
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 2 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/editor/roundtrip.test.js` :

```js
// @vitest-environment jsdom
import { Editor, getSchema } from '@tiptap/core';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { toEditorJSON } from '../../src/editor/content.js';
import { coreExtensions } from '../../src/editor/extensions.js';
import { parse, serialize } from '../../src/spip/index.js';

// jsdom remplace URL : on part de la chaîne import.meta.url
const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../../../tests/corpus');
const dirs = [corpus, ...(process.env.TTS_CORPUS ? [process.env.TTS_CORPUS] : [])];
const files = dirs.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.spip')).sort().map((f) => join(dir, f)));

const schema = getSchema(coreExtensions());
let editor;
afterEach(() => editor?.destroy());

const mount = (source) => {
	editor = new Editor({
		extensions: coreExtensions(),
		content: toEditorJSON(source, schema),
		enableContentCheck: true,
		onContentError: ({ error }) => {
			throw error;
		},
	});
	return editor;
};

describe.each(files)('%s', (file) => {
	const source = readFileSync(file, 'utf8');

	it('le JSON du parseur est valide pour le schéma (node.check)', () => {
		expect(() => schema.nodeFromJSON(parse(source)).check()).not.toThrow();
	});

	it('identité à travers l\'éditeur : serialize(editor.getJSON()) === source', () => {
		expect(serialize(mount(source).getJSON())).toBe(source);
	});
});

describe('modification d\'un bloc', () => {
	it('ne réécrit que le segment modifié', () => {
		const source = '{{{Titre}}}\n\n\nUn  paragraphe {{gras}}.\n\n\n-* liste\n-* suite\n';
		const ed = mount(source);
		// curseur à la fin du paragraphe (2e bloc), insertion d'un texte
		let end = 0;
		ed.state.doc.forEach((n, offset, index) => {
			if (index === 1) end = offset + n.nodeSize - 1;
		});
		ed.chain().setTextSelection(end).insertContent(' Ajout').run();
		expect(serialize(ed.getJSON())).toBe('{{{Titre}}}\n\n\nUn  paragraphe {{gras}}. Ajout\n\n\n-* liste\n-* suite\n');
	});

	it('un nouveau bloc créé par Entrée ne reprend pas la source du bloc coupé', () => {
		const ed = mount('Premier.\n\nSecond.');
		ed.chain().setTextSelection(4).splitBlock().run();
		expect(serialize(ed.getJSON())).toBe('Pre\n\nmier.\n\nSecond.');
	});
});
```

Run : `npx vitest run tests/editor/roundtrip.test.js`
Expected : FAIL, `Failed to load url ../../src/editor/content.js`.

- [ ] **Step 3 : implémenter le schéma**

`prive/javascript/tiptap_spip/src/editor/extensions.js` :

````js
import { Extension, Node } from '@tiptap/core';
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

/**
 * Schéma de l'éditeur (spec 03) : seulement ce que la syntaxe SPIP sait exprimer.
 * Les types et attributs sont exactement ceux que produit src/spip/parse.js.
 */

/** Attribut non rendu dans le DOM (technique ou porté par le JSON seulement). */
const hidden = (fallback = null, keepOnSplit = true) => ({ default: fallback, rendered: false, keepOnSplit });

/** Blocs de premier niveau : seuls ceux-ci portent la carte de segments. */
const TOP_BLOCKS = [
	'paragraph', 'heading', 'horizontalRule', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'table',
	'spipPoesie', 'spipAlign', 'spipCadre', 'spipHtml', 'spipMath', 'spipRaw',
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

/**
 * Extensions du cœur, marks dans l'ordre canonique de src/spip/json.js (MARK_ORDER) : le
 * schéma range les marks d'un texte dans l'ordre de déclaration.
 */
export function coreExtensions({ headingLevels = [2, 3, 4, 5, 6] } = {}) {
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
		// marks : ordre canonique bold, italic, strike, superscript, subscript, code
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
	];
}
````

`prive/javascript/tiptap_spip/src/editor/content.js` :

```js
import { canon } from '../spip/json.js';
import { parse } from '../spip/parse.js';

/**
 * Source SPIP → JSON prêt pour editor.commands.setContent().
 *
 * Le JSON passe par le schéma (nodeFromJSON puis check(), qui lève une exception si le contenu
 * viole le schéma), puis les empreintes spipHash sont recalculées sur la forme que l'éditeur
 * renverra dans getJSON() : attributs par défaut compris. Sans cela, un bloc non modifié dont
 * le schéma ajoute un attribut par défaut ne serait plus reconnu par la sérialisation
 * conservatrice.
 *
 * @param {string} source
 * @param {import('@tiptap/pm/model').Schema} schema
 * @returns {object} document JSON
 */
export function toEditorJSON(source, schema) {
	const doc = schema.nodeFromJSON(parse(source));
	doc.check();
	const json = doc.toJSON();
	const blocks = json.content ?? [];
	blocks.forEach((block, i) => {
		const group = block.attrs?.spipGroup;
		if (group) block.attrs.spipHash = canon(blocks.slice(i, i + group));
	});
	return json;
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run tests/editor/roundtrip.test.js`
Expected : PASS, 42 tests (20 fichiers du corpus × 2, plus 2). Avec le corpus de démo : `TTS_CORPUS=<dossier> npm test` → 48 fichiers de plus, tous verts.

- [ ] **Step 5 : commit**

```bash
git add prive/javascript/tiptap_spip/package.json prive/javascript/tiptap_spip/package-lock.json prive/javascript/tiptap_spip/.gitignore prive/javascript/tiptap_spip/src/editor/extensions.js prive/javascript/tiptap_spip/src/editor/content.js prive/javascript/tiptap_spip/tests/editor/roundtrip.test.js
git commit -m "feat(editor): schéma Tiptap des raccourcis SPIP, aller-retour exact par l'éditeur"
```

---

### Task 3 : Création de l'éditeur et TextareaBridge

**Files:**
- Create: `prive/javascript/tiptap_spip/src/editor/createEditor.js`, `prive/javascript/tiptap_spip/src/editor/TextareaBridge.js`
- Test: `prive/javascript/tiptap_spip/tests/editor/bridge.test.js`

**Interfaces:**
- Consumes : `coreExtensions`, `toEditorJSON` (Task 2), `serialize` (L1).
- Produces :
  - `createEditor({ element, source, extensions?, editorProps? }): Editor` — lève une exception si la source donne un contenu invalide.
  - `class TextareaBridge({ textarea, editor, delay = 150 })` : `mode` (`'visual'|'source'`), `flush()`, `load()`, `setMode(mode): boolean`, `destroy()`.

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/editor/bridge.test.js` :

```js
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../src/editor/createEditor.js';
import { TextareaBridge } from '../../src/editor/TextareaBridge.js';

let form;
let textarea;
let bridge;

const setup = (value) => {
	document.body.innerHTML = '<form><textarea name="texte"></textarea><div id="ed"></div></form>';
	form = document.querySelector('form');
	textarea = form.querySelector('textarea');
	textarea.value = value;
	const editor = createEditor({ element: document.getElementById('ed'), source: value });
	bridge = new TextareaBridge({ textarea, editor });
	return bridge;
};

const typeAtEnd = (text) => {
	const { editor } = bridge;
	editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent(text).run();
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	bridge?.destroy();
	vi.useRealTimers();
});

describe('TextareaBridge', () => {
	it('ne touche pas au textarea tant que rien n\'est modifié', () => {
		const source = 'Un  texte {{gras}}\n\n\n';
		setup(source);
		const onInput = vi.fn();
		textarea.addEventListener('input', onInput);
		vi.advanceTimersByTime(1000);
		bridge.flush();
		expect(textarea.value).toBe(source);
		expect(onInput).not.toHaveBeenCalled();
	});

	it('sérialise une modification après 150 ms et prévient les scripts SPIP', () => {
		setup('Texte');
		const events = [];
		textarea.addEventListener('input', () => events.push('input'));
		textarea.addEventListener('change', () => events.push('change'));
		typeAtEnd(' ajouté');
		vi.advanceTimersByTime(149);
		expect(textarea.value).toBe('Texte');
		vi.advanceTimersByTime(1);
		expect(textarea.value).toBe('Texte ajouté');
		expect(events).toEqual(['input', 'change']);
	});

	it('sérialise immédiatement à la soumission du formulaire', () => {
		setup('Texte');
		typeAtEnd('!');
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(textarea.value).toBe('Texte!');
	});

	it('mode source : le textarea est la référence, rechargé une seule fois au retour', () => {
		setup('Texte');
		typeAtEnd('!');
		bridge.setMode('source');
		expect(textarea.value).toBe('Texte!');
		expect(bridge.mode).toBe('source');
		const load = vi.spyOn(bridge, 'load');
		textarea.value = '{{Gras}}\n\nSuite';
		textarea.dispatchEvent(new Event('input'));
		textarea.value = '{{Gras}}\n\nSuite.';
		textarea.dispatchEvent(new Event('input'));
		vi.advanceTimersByTime(1000);
		expect(load).not.toHaveBeenCalled();
		bridge.setMode('visual');
		expect(load).toHaveBeenCalledTimes(1);
		expect(bridge.editor.getText()).toContain('Gras');
		// pas de réécriture du textarea par l'éditeur rechargé
		vi.advanceTimersByTime(1000);
		expect(textarea.value).toBe('{{Gras}}\n\nSuite.');
	});

	it('retour en visuel avec une source non représentable : reste en mode source', () => {
		setup('Texte');
		bridge.setMode('source');
		vi.spyOn(bridge, 'load').mockImplementation(() => {
			throw new Error('contenu invalide');
		});
		textarea.value = 'autre';
		textarea.dispatchEvent(new Event('input'));
		expect(bridge.setMode('visual')).toBe(false);
		expect(bridge.mode).toBe('source');
	});

	it('destroy() sérialise ce qui reste et détache tout', () => {
		setup('Texte');
		typeAtEnd('!');
		const { editor } = bridge;
		bridge.destroy();
		expect(textarea.value).toBe('Texte!');
		expect(editor.isDestroyed).toBe(true);
		bridge = null;
	});
});
```

Run : `npx vitest run tests/editor/bridge.test.js`
Expected : FAIL, `Failed to load url ../../src/editor/createEditor.js`.

- [ ] **Step 2 : implémenter**

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
 * @param {{ element: HTMLElement, source: string, extensions?: object[], editorProps?: object }} options
 * @returns {Editor}
 */
export function createEditor({ element, source, extensions = coreExtensions(), editorProps = {} }) {
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

`prive/javascript/tiptap_spip/src/editor/TextareaBridge.js` :

```js
import { serialize } from '../spip/serialize.js';
import { toEditorJSON } from './content.js';

/**
 * Synchronisation textarea ⇄ éditeur (spec 02 §4).
 * Le textarea reste la source de vérité pour la soumission du formulaire : l'éditeur ne fait
 * qu'en produire le contenu, et n'y écrit que si la sérialisation diffère.
 */
export class TextareaBridge {
	/**
	 * @param {{ textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor, delay?: number }} options
	 */
	constructor({ textarea, editor, delay = 150 }) {
		this.textarea = textarea;
		this.editor = editor;
		this.delay = delay;
		this.mode = 'visual';
		this.timer = null;
		this.dispatching = false;
		this.sourceDirty = false;

		this.onUpdate = () => this.schedule();
		this.onFlush = () => this.flush();
		this.onInput = () => {
			if (!this.dispatching && this.mode === 'source') this.sourceDirty = true;
		};

		editor.on('update', this.onUpdate);
		editor.on('blur', this.onFlush);
		textarea.addEventListener('input', this.onInput);
		textarea.form?.addEventListener('submit', this.onFlush, true);
		globalThis.window?.addEventListener('beforeunload', this.onFlush);
	}

	schedule() {
		clearTimeout(this.timer);
		this.timer = setTimeout(this.onFlush, this.delay);
	}

	/** Écrit la sérialisation dans le textarea si elle diffère, avec événements input et change. */
	flush() {
		clearTimeout(this.timer);
		this.timer = null;
		if (this.mode !== 'visual' || this.editor.isDestroyed) return;
		const value = serialize(this.editor.getJSON());
		if (value === this.textarea.value) return;
		this.textarea.value = value;
		this.dispatching = true;
		try {
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
			this.textarea.dispatchEvent(new Event('change', { bubbles: true }));
		} finally {
			this.dispatching = false;
		}
	}

	/** Recharge l'éditeur depuis le textarea, sans émettre de mise à jour (pas de réécriture). */
	load() {
		const json = toEditorJSON(this.textarea.value, this.editor.schema);
		this.editor.commands.setContent(json, { emitUpdate: false });
	}

	/**
	 * Bascule visuel ⇄ source. Au retour en visuel, l'éditeur est rechargé une seule fois si la
	 * source a changé. Renvoie false si la source n'est pas représentable (on reste en source).
	 * @param {'visual'|'source'} mode
	 * @returns {boolean}
	 */
	setMode(mode) {
		if (mode === this.mode) return true;
		if (mode === 'source') {
			this.flush();
			this.mode = 'source';
			this.sourceDirty = false;
			return true;
		}
		if (this.sourceDirty) {
			try {
				this.load();
			} catch (error) {
				console.warn('tiptap_spip : source non représentable, mode source conservé', error);
				return false;
			}
		}
		this.mode = 'visual';
		this.sourceDirty = false;
		return true;
	}

	destroy() {
		this.flush();
		this.editor.off('update', this.onUpdate);
		this.editor.off('blur', this.onFlush);
		this.textarea.removeEventListener('input', this.onInput);
		this.textarea.form?.removeEventListener('submit', this.onFlush, true);
		globalThis.window?.removeEventListener('beforeunload', this.onFlush);
		this.editor.destroy();
	}
}
```

- [ ] **Step 3 : vérifier le succès**

Run : `npx vitest run tests/editor/bridge.test.js`
Expected : PASS, 6 tests (un avertissement « source non représentable » est attendu dans la sortie).

- [ ] **Step 4 : commit**

```bash
git add prive/javascript/tiptap_spip/src/editor/createEditor.js prive/javascript/tiptap_spip/src/editor/TextareaBridge.js prive/javascript/tiptap_spip/tests/editor/bridge.test.js
git commit -m "feat(editor): création de l'éditeur et synchronisation avec le textarea"
```

---

### Task 4 : Montage dans la page

Le porte-plume se lance sur `window.load` et ignore les textareas `.no_barre` / `.no_previsualisation` ; le module de l'éditeur s'exécute avant (script `type="module"`, différé), il pose donc ces classes à temps. `onAjaxLoad` passe la racine rechargée dans `this`, parfois sous forme d'objet jQuery (Crayons). Dans `editer_article`, le textarea `texte` n'a pas de classe : le porte-plume le prend par `.formulaire_spip textarea[name=texte]` (option `inserer_auto_name_texte`), l'éditeur fait de même.

**Files:**
- Create: `prive/javascript/tiptap_spip/src/main.js`
- Test: `prive/javascript/tiptap_spip/tests/editor/main.test.js`

**Interfaces:**
- Consumes : `createEditor`, `TextareaBridge` (Task 3).
- Produces : `tiptap_spip_init(racine?, { createEditor? })`, `instances: Set<Instance>` ; DOM : `.tts-editor > .tts-toolbar > button.tts-mode[aria-pressed]`, `.tts-content`, textarea déplacé dans `.tts-editor` et masqué ; `data-tts-mounted="oui"|"erreur"`.

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/editor/main.test.js` :

```js
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instances, tiptap_spip_init } from '../../src/main.js';

const page = (html) => {
	document.body.innerHTML = html;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
});

describe('tiptap_spip_init', () => {
	it('monte l\'éditeur sur les textareas du porte-plume et data-tts-toolbar, une seule fois', () => {
		page(`<form>
			<textarea class="inserer_barre_edition" name="texte">{{a}}</textarea>
			<textarea class="inserer_barre_forum" name="forum">b</textarea>
			<textarea data-tts-toolbar="minimale" name="ps">c</textarea>
			<textarea name="autre">d</textarea>
		</form>`);
		tiptap_spip_init();
		tiptap_spip_init();
		expect(instances.size).toBe(3);
		expect(document.querySelectorAll('.tts-editor').length).toBe(3);
		expect(document.querySelector('textarea[name=autre]').dataset.ttsMounted).toBeUndefined();
	});

	it('laisse les textareas de markdown_editor', () => {
		page('<textarea class="inserer_barre_edition inserer_md_barre_edition">a</textarea><textarea data-tts-toolbar="edition" data-md-editor-toolbar="edition">b</textarea>');
		tiptap_spip_init();
		expect(instances.size).toBe(0);
	});

	it('écarte le porte-plume : classes no_barre et no_previsualisation', () => {
		page('<textarea class="inserer_barre_edition">a</textarea>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		expect(textarea.classList.contains('no_barre')).toBe(true);
		expect(textarea.classList.contains('no_previsualisation')).toBe(true);
	});

	it('remplace le textarea par l\'éditeur, le textarea reste dans le formulaire', () => {
		page('<form><textarea class="inserer_barre_edition" name="texte" rows="5">Un {{texte}}</textarea></form>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		const wrapper = textarea.closest('.tts-editor');
		expect(wrapper.parentElement.tagName).toBe('FORM');
		expect(textarea.hidden).toBe(true);
		expect(wrapper.querySelector('.ProseMirror strong').textContent).toBe('texte');
	});

	it('bascule source / visuel avec le bouton de mode', () => {
		page('<textarea class="inserer_barre_edition">Texte</textarea>');
		tiptap_spip_init();
		const textarea = document.querySelector('textarea');
		const content = document.querySelector('.tts-content');
		const button = document.querySelector('.tts-mode');
		button.click();
		expect(textarea.hidden).toBe(false);
		expect(content.hidden).toBe(true);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		button.click();
		expect(textarea.hidden).toBe(true);
		expect(content.hidden).toBe(false);
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	it('ne monte rien si la source n\'est pas représentable', () => {
		page('<textarea class="inserer_barre_edition">Texte</textarea>');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		tiptap_spip_init(document, { createEditor: () => {
			throw new Error('invalide');
		} });
		const textarea = document.querySelector('textarea');
		expect(instances.size).toBe(0);
		expect(textarea.hidden).toBe(false);
		expect(textarea.dataset.ttsMounted).toBe('erreur');
		expect(document.querySelector('.tts-editor')).toBeNull();
		expect(warn).toHaveBeenCalled();
	});

	it('détruit l\'éditeur quand le textarea quitte le DOM (rechargement AJAX, crayon fermé)', async () => {
		page('<div id="bloc"><textarea class="inserer_barre_edition">Texte</textarea></div>');
		tiptap_spip_init();
		const [instance] = instances;
		document.getElementById('bloc').remove();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(instances.size).toBe(0);
		expect(instance.editor.isDestroyed).toBe(true);
	});

	it('ne cherche que dans la racine fournie (onAjaxLoad)', () => {
		page('<div id="a"><textarea class="inserer_barre_edition">a</textarea></div><div id="b"><textarea class="inserer_barre_edition">b</textarea></div>');
		tiptap_spip_init(document.getElementById('b'));
		expect(instances.size).toBe(1);
		expect(document.querySelector('#a textarea').dataset.ttsMounted).toBeUndefined();
	});

	it('accepte une racine jQuery (triggerAjaxLoad de Crayons)', () => {
		page('<div id="a"><textarea class="inserer_barre_edition">a</textarea></div><div id="b"><textarea class="inserer_barre_edition">b</textarea></div>');
		const b = document.getElementById('b');
		tiptap_spip_init({ jquery: '3.7.1', 0: b, length: 1 });
		expect(instances.size).toBe(1);
		expect(document.querySelector('#b textarea').dataset.ttsMounted).toBe('oui');
	});

	it('monte aussi sur le champ texte des formulaires SPIP, comme le porte-plume (editer_article)', () => {
		page('<div class="formulaire_spip formulaire_editer"><form><textarea name="texte">a</textarea><textarea name="ps">b</textarea></form></div>');
		tiptap_spip_init();
		expect(instances.size).toBe(1);
		expect(document.querySelector('textarea[name=texte]').dataset.ttsMounted).toBe('oui');
	});
});
```

Run : `npx vitest run tests/editor/main.test.js`
Expected : FAIL, `Failed to load url ../../src/main.js`.

- [ ] **Step 2 : implémenter**

`prive/javascript/tiptap_spip/src/main.js` :

```js
import { createEditor as defaultCreateEditor } from './editor/createEditor.js';
import { TextareaBridge } from './editor/TextareaBridge.js';

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

const config = () => globalThis.spipConfig?.tiptap_spip ?? {};
const label = (key, fallback) => config().i18n?.[key] ?? fallback;

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
		this.modeButton = document.createElement('button');
		this.modeButton.type = 'button';
		this.modeButton.className = 'tts-mode';
		this.modeButton.textContent = label('mode_source', 'Source');
		this.modeButton.setAttribute('aria-pressed', 'false');
		toolbar.append(this.modeButton);
		this.content = document.createElement('div');
		this.content.className = 'tts-content';
		this.wrapper.append(toolbar, this.content);

		// l'éditeur est créé avant de toucher au DOM : en cas d'échec, rien n'a changé
		this.editor = createEditor({
			element: this.content,
			source: textarea.value,
			editorProps: { attributes: { class: 'tts-prosemirror', style: `min-height: ${rows * 1.5}em` } },
		});
		this.bridge = new TextareaBridge({ textarea, editor: this.editor });

		textarea.before(this.wrapper);
		this.wrapper.append(textarea);
		textarea.hidden = true;
		this.modeButton.addEventListener('click', () => this.toggleMode());
	}

	toggleMode() {
		const mode = this.bridge.mode === 'visual' ? 'source' : 'visual';
		if (!this.bridge.setMode(mode)) return;
		const source = mode === 'source';
		this.textarea.hidden = !source;
		this.content.hidden = source;
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

- [ ] **Step 3 : vérifier le succès**

Run : `npm test`
Expected : PASS, 207 tests (11 fichiers).

- [ ] **Step 4 : commit**

```bash
git add prive/javascript/tiptap_spip/src/main.js prive/javascript/tiptap_spip/tests/editor/main.test.js
git commit -m "feat(editor): montage sur les textareas du porte-plume, bascule source, destruction"
```

---

### Task 5 : Bundle esbuild

**Files:**
- Create: `prive/javascript/tiptap_spip/scripts/build.mjs`
- Create (générés, versionnés) : `prive/javascript/tiptap_spip.js`, `prive/javascript/tiptap_spip.min.js`

**Interfaces:**
- Consumes : `src/main.js` (Task 4).
- Produces : module ESM exportant `tiptap_spip_init` et `instances`.

- [ ] **Step 1 : écrire le script**

`prive/javascript/tiptap_spip/scripts/build.mjs` :

```js
// Bundle du navigateur : prive/javascript/tiptap_spip.js et sa version minifiée.
// Usage : node scripts/build.mjs [--watch]
import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';

const outdir = fileURLToPath(new URL('../../', import.meta.url));
const common = {
	entryPoints: [fileURLToPath(new URL('../src/main.js', import.meta.url))],
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	legalComments: 'none',
	logLevel: 'info',
};
const variants = [
	{ ...common, outfile: `${outdir}tiptap_spip.js` },
	{ ...common, outfile: `${outdir}tiptap_spip.min.js`, minify: true },
];

if (process.argv.includes('--watch')) {
	await (await context(variants[0])).watch();
} else {
	await Promise.all(variants.map((options) => build(options)));
}
```

- [ ] **Step 2 : construire**

Run : `npm run build`
Expected : `../tiptap_spip.js  863.4kb`, `../tiptap_spip.min.js  412.1kb` (à quelques ko près).

Contrôle : `node -e "import('../tiptap_spip.min.js').then((m) => console.log(Object.keys(m)))"` → `[ 'instances', 'tiptap_spip_init' ]` (le module s'importe sans DOM).

- [ ] **Step 3 : commit**

```bash
git add prive/javascript/tiptap_spip/scripts/build.mjs prive/javascript/tiptap_spip.js prive/javascript/tiptap_spip.min.js
git commit -m "build: bundle esbuild de l'éditeur"
```

---

### Task 6 : Paquet SPIP et chargement

**Files:**
- Create: `paquet.xml`, `tiptap_spip_pipelines.php`, `prive/javascript/_inits/09_tiptap_spip_config.js.html`, `prive/javascript/_inits/80_tiptap_spip.js`, `css/tiptap_spip.css`, `lang/tiptap_spip_fr.php`, `.gitignore`
- Create: `composer.json`, `composer.lock`, `phpunit.xml`, `tests/bootstrap.php`
- Test: `tests/unit/PipelinesTest.php`

**Interfaces:**
- Consumes : bundle (Task 5).
- Produces : `tiptap_spip_header_prive($flux)`, `tiptap_spip_importmap($flux)` ; `window.spipConfig.tiptap_spip = { css, i18n: { mode_source } }`.

- [ ] **Step 1 : PHPUnit**

`composer.json` :

```json
{
	"name": "spip-contrib-extensions/tiptap_spip",
	"description": "Éditeur visuel Tiptap pour les raccourcis SPIP",
	"type": "spip-plugin",
	"license": "GPL-3.0-or-later",
	"require": {
		"php": ">=8.1"
	},
	"require-dev": {
		"phpunit/phpunit": "^12.0"
	},
	"scripts": {
		"tests-unit": "vendor/bin/phpunit --colors --testsuite unit"
	},
	"config": {
		"sort-packages": true
	}
}
```

`phpunit.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit
	bootstrap="tests/bootstrap.php"
	cacheDirectory=".phpunit.cache"
	colors="true"
>
	<testsuites>
		<testsuite name="unit">
			<directory suffix="Test.php">tests/unit</directory>
		</testsuite>
	</testsuites>
</phpunit>
```

`tests/bootstrap.php` :

```php
<?php

declare(strict_types=1);

/**
 * Tests unitaires sans SPIP : les fonctions du core utilisées par le plugin sont simulées.
 * Chaque simulation est gardée par function_exists() pour rester compatible avec un futur
 * bootstrap d'intégration qui chargerait le vrai SPIP.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

if (!defined('_ECRIRE_INC_VERSION')) {
	define('_ECRIRE_INC_VERSION', 'test');
}

/** Remet à zéro l'état des simulations ; à appeler dans setUp(). */
function test_reset_globals(): void {
	$GLOBALS['spip_version_branche'] = '4.4.21';
	$GLOBALS['_test_fonds'] = [];
	$GLOBALS['_test_chemins'] = [];
}

test_reset_globals();

if (!function_exists('recuperer_fond')) {
	function recuperer_fond(string $fond, array $contexte = [], array $options = []): string {
		return $GLOBALS['_test_fonds'][$fond] ?? '';
	}
}

if (!function_exists('find_in_path')) {
	function find_in_path(string $fichier) {
		return $GLOBALS['_test_chemins'][$fichier] ?? false;
	}
}

if (!function_exists('timestamp')) {
	function timestamp(string $fichier): string {
		return $fichier . '?1700000000';
	}
}

if (!function_exists('url_absolue')) {
	function url_absolue(string $url): string {
		return 'https://exemple.test/' . ltrim($url, './');
	}
}

if (!function_exists('protocole_implicite')) {
	function protocole_implicite(string $url): string {
		return preg_replace(',^https?:,', '', $url);
	}
}
```

`.gitignore` :

```
vendor/
.phpunit.cache/
```

Run : `composer install`

- [ ] **Step 2 : écrire le test qui échoue**

`tests/unit/PipelinesTest.php` :

```php
<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_pipelines.php';

final class PipelinesTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
		$GLOBALS['_test_fonds']['prive/javascript/_inits/09_tiptap_spip_config.js'] = 'window.spipConfig ??= {};';
		$GLOBALS['_test_chemins'] = [
			'prive/javascript/tiptap_spip.min.js' => 'plugins/tiptap_spip/prive/javascript/tiptap_spip.min.js',
			'prive/javascript/tiptap_spip.js' => 'plugins/tiptap_spip/prive/javascript/tiptap_spip.js',
			'css/tiptap_spip.css' => 'plugins/tiptap_spip/css/tiptap_spip.css',
		];
	}

	public function testHeaderPriveSpip4ChargeConfigCssEtModule(): void {
		$flux = tiptap_spip_header_prive('<head>');

		$this->assertStringStartsWith('<head>', $flux);
		$this->assertStringContainsString('<script>' . "\n" . 'window.spipConfig ??= {};', $flux);
		$this->assertStringContainsString('href="plugins/tiptap_spip/css/tiptap_spip.css?1700000000"', $flux);
		$this->assertStringContainsString(
			"import { tiptap_spip_init } from '//exemple.test/plugins/tiptap_spip/prive/javascript/tiptap_spip.min.js?1700000000';",
			$flux
		);
		$this->assertStringContainsString('onAjaxLoad(function () { tiptap_spip_init(this); });', $flux);
	}

	public function testHeaderPriveSansBundleMinifiePrendLeBundleNormal(): void {
		unset($GLOBALS['_test_chemins']['prive/javascript/tiptap_spip.min.js']);

		$this->assertStringContainsString('/prive/javascript/tiptap_spip.js?', tiptap_spip_header_prive(''));
	}

	public function testHeaderPriveSansBundleNeChargeRien(): void {
		$GLOBALS['_test_chemins'] = [];

		$this->assertSame('<head>', tiptap_spip_header_prive('<head>'));
	}

	public function testHeaderPriveSpip5LaissePasserLeFlux(): void {
		$GLOBALS['spip_version_branche'] = '5.0.0';

		$this->assertSame('<head>', tiptap_spip_header_prive('<head>'));
	}

	public function testImportmapDeclareLeBundle(): void {
		$flux = tiptap_spip_importmap(['args' => [], 'data' => ['autre.js']]);

		$this->assertSame(['autre.js', 'tiptap_spip.js'], $flux['data']);
	}
}
```

Run : `vendor/bin/phpunit`
Expected : erreur, `tiptap_spip_pipelines.php` introuvable.

- [ ] **Step 3 : implémenter**

`paquet.xml` :

```xml
<paquet
	prefix="tiptap_spip"
	categorie="edition"
	version="0.1.0"
	etat="dev"
	compatibilite="[4.2.0;5.*]"
	documentation=""
>
	<nom>Éditeur visuel pour SPIP</nom>
	<!-- Éditeur visuel Tiptap qui lit et écrit les raccourcis SPIP -->

	<credit lien="https://tiptap.dev">Tiptap</credit>
	<licence lien="http://www.gnu.org/licenses/gpl-3.0.html">GPL 3</licence>

	<utilise nom="porte_plume" />

	<pipeline nom="header_prive" inclure="tiptap_spip_pipelines.php" />
	<pipeline nom="importmap" inclure="tiptap_spip_pipelines.php" />

	<chemin path="" />
	<chemin path="prive" />
</paquet>
```

`tiptap_spip_pipelines.php` :

```php
<?php

/**
 * Pipelines du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/**
 * SPIP 4 : charge la configuration, la feuille de style et le bundle de l'éditeur.
 * SPIP 5 passe par l'importmap et les scripts prive/javascript/_inits/.
 */
function tiptap_spip_header_prive($flux) {
	if ((int) substr($GLOBALS['spip_version_branche'] ?? '4', 0, 1) >= 5) {
		return $flux;
	}
	$config = recuperer_fond('prive/javascript/_inits/09_tiptap_spip_config.js');
	$lib = find_in_path('prive/javascript/tiptap_spip.min.js') ?: find_in_path('prive/javascript/tiptap_spip.js');
	if (!$config || !$lib) {
		return $flux;
	}
	if ($css = find_in_path('css/tiptap_spip.css')) {
		$flux .= '<link rel="stylesheet" href="' . timestamp($css) . '" type="text/css" />' . "\n";
	}
	$flux .= "<script>\n" . $config . "\n</script>\n";
	$flux .= "<script type=\"module\">\n"
		. "import { tiptap_spip_init } from '" . protocole_implicite(url_absolue(timestamp($lib))) . "';\n"
		. "tiptap_spip_init();\n"
		. "onAjaxLoad(function () { tiptap_spip_init(this); });\n"
		. "</script>\n";

	return $flux;
}

/**
 * SPIP 5 : déclare le bundle dans l'importmap.
 */
function tiptap_spip_importmap($flux) {
	$flux['data'][] = 'tiptap_spip.js';

	return $flux;
}
```

`prive/javascript/_inits/09_tiptap_spip_config.js.html` :

```js
window.spipConfig ??= {};
Object.assign(window.spipConfig, {
	tiptap_spip: {
		css: "@import url('[(#CHEMIN{css/tiptap_spip.css}|timestamp|url_absolue)]')",
		i18n: {
			mode_source: "<:tiptap_spip:mode_source|texte_script:>"
		}
	}
});
```

`prive/javascript/_inits/80_tiptap_spip.js` :

```js
import { tiptap_spip_init } from "tiptap_spip.js";
addCSS(spip.tiptap_spip.css, 'tiptap_spip');
tiptap_spip_init();
onAjaxLoad(function () { tiptap_spip_init(this); });
```

`lang/tiptap_spip_fr.php` :

```php
<?php

// Ceci est un fichier langue de SPIP -- This is a SPIP language file

return [
	'mode_source' => 'Source',
];
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
```

- [ ] **Step 4 : vérifier le succès**

Run : `vendor/bin/phpunit` → `OK (5 tests, 9 assertions)` ; `php -l tiptap_spip_pipelines.php` → `No syntax errors detected`.

- [ ] **Step 5 : commit**

```bash
git add paquet.xml tiptap_spip_pipelines.php prive/javascript/_inits css lang .gitignore composer.json composer.lock phpunit.xml tests/bootstrap.php tests/unit/PipelinesTest.php
git commit -m "feat: paquet SPIP, chargement SPIP 4 et 5, tests PHPUnit"
```

---

### Task 7 : Bout en bout sur un site SPIP jetable

**Files:**
- Create: `tests/e2e/site.php`, `prive/javascript/tiptap_spip/playwright.config.js`
- Test: `prive/javascript/tiptap_spip/tests/e2e/article.e2e.js`

**Interfaces:**
- Consumes : plugin complet (Tasks 1 à 6).
- Produces : `npm run e2e` (variables `TTS_SITE`, `TTS_URL`).

- [ ] **Step 1 : le pilote du site jetable**

`tests/e2e/site.php` :

```php
<?php

/**
 * Pilote d'un site SPIP JETABLE pour les tests de bout en bout (jamais un site réel : la
 * commande active le plugin et ouvre une session d'administrateur).
 *
 * Usage :
 *   SPIP_ROOT=<site> php tests/e2e/site.php preparer <agent> < texte.spip
 *     active le plugin tiptap_spip, crée un article avec le texte lu sur l'entrée standard et
 *     une session pour l'auteur 1 ; écrit {"id_article": …, "cookie": …} sur la sortie.
 *     <agent> : User-Agent du navigateur de test (la session SPIP en dépend).
 *   SPIP_ROOT=<site> php tests/e2e/site.php texte <id_article>
 *     écrit le texte de l'article, octet pour octet.
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$commande = $argv[1] ?? '';
if ($root === '' || !is_dir($root . '/ecrire') || !in_array($commande, ['preparer', 'texte'], true)) {
	fwrite(STDERR, "Usage : SPIP_ROOT=<site jetable> php tests/e2e/site.php preparer <agent> | texte <id_article>\n");
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

include_spip('inc/plugin');
ecrire_plugin_actifs(['tiptap_spip'], false, 'ajoute');

$id_rubrique = (int) sql_getfetsel('id_rubrique', 'spip_rubriques', '', '', 'id_rubrique', '0,1');
if (!$id_rubrique) {
	$id_rubrique = (int) sql_insertq('spip_rubriques', ['titre' => 'Tests', 'statut' => 'publie', 'id_secteur' => 0]);
	sql_updateq('spip_rubriques', ['id_secteur' => $id_rubrique], 'id_rubrique=' . $id_rubrique);
}
$id_article = (int) sql_insertq('spip_articles', [
	'titre' => 'Test tiptap_spip',
	'texte' => stream_get_contents(STDIN),
	'id_rubrique' => $id_rubrique,
	'id_secteur' => $id_rubrique,
	'statut' => 'prepa',
	'date' => date('Y-m-d H:i:s'),
	'lang' => 'fr',
]);
sql_insertq('spip_auteurs_liens', ['id_auteur' => 1, 'objet' => 'article', 'id_objet' => $id_article]);

include_spip('inc/session');
$auteur = sql_fetsel('*', 'spip_auteurs', 'id_auteur=1');
unset($_COOKIE['spip_session']);
$cookie = ajouter_session($auteur);

echo json_encode(['id_article' => $id_article, 'cookie' => $cookie]), "\n";
```

- [ ] **Step 2 : préparer le site**

Le site est décompressé dans le scratchpad (`$S` ci-dessous), le plugin y est relié par un lien symbolique vers le dépôt, et un serveur PHP intégré le sert sur un port libre :

```bash
S=<scratchpad>
mkdir -p $S/jetable && tar xzf /src/spip/site-jetable-v4.4.21.tgz -C $S/jetable
mkdir -p $S/jetable/v4.4.21/plugins && ln -sfn /src/tiptap-spip $S/jetable/v4.4.21/plugins/tiptap_spip
ss -ltn | grep -q ':18931 ' && echo "port pris" || echo "port libre"
php -S 127.0.0.1:18931 -t $S/jetable/v4.4.21     # en arrière-plan
```

- [ ] **Step 3 : écrire le test**

`prive/javascript/tiptap_spip/playwright.config.js` :

```js
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
```

`prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` :

```js
// Bout en bout dans l'espace privé d'un site SPIP JETABLE : un article est édité avec l'éditeur
// puis enregistré, et le texte en base est comparé octet pour octet à ce que SPIP enregistre pour
// le même formulaire soumis SANS l'éditeur (le navigateur convertit les fins de ligne d'un
// textarea en CRLF à la soumission : c'est la référence, pas la source brute).
// Usage : TTS_SITE=<racine du site jetable> TTS_URL=http://127.0.0.1:<port> npm run e2e
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const driver = `${repo}tests/e2e/site.php`;
const env = { ...process.env, SPIP_ROOT: process.env.TTS_SITE };

const php = (args, input) => execFileSync('php', [driver, ...args], { env, input, encoding: 'utf8' });
const texte = (id) => php(['texte', String(id)]);

/**
 * Crée un article, ouvre une session et charge sa page d'édition.
 * @param {{ sansEditeur?: boolean }} options  sansEditeur : bundle bloqué, textarea natif
 */
async function editer(page, source, { sansEditeur = false } = {}) {
	const { id_article: id, cookie } = JSON.parse(php(['preparer', 'tts-e2e'], source));
	const url = new URL(process.env.TTS_URL);
	await page.context().addCookies([{ name: 'spip_session', value: cookie, domain: url.hostname, path: '/' }]);
	if (sansEditeur) await page.route(/tiptap_spip(\.min)?\.js/, (route) => route.abort());
	await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
	if (!sansEditeur) await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
	return id;
}

/** Fins de ligne telles que le navigateur les soumet. */
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

const enregistrer = async (page) => {
	await Promise.all([
		page.waitForURL(/exec=article&/),
		page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
	]);
};

test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

for (const fichier of ['base.spip', 'melanges.spip', 'blancs.spip']) {
	test(`${fichier} : enregistré sans modification, le texte est inchangé`, async ({ page }) => {
		const source = readFileSync(`${repo}tests/corpus/${fichier}`, 'utf8');
		const id = await editer(page, source);
		await expect(page.locator('textarea[name=texte]')).toBeHidden();
		await expect(page.locator('.markItUp')).toHaveCount(0);
		await enregistrer(page);

		const temoin = await editer(page, source, { sansEditeur: true });
		await enregistrer(page);
		// pas texte(temoin) === crlf(source) : un saut de ligne en tête de <textarea> est ignoré
		// par le navigateur (règle HTML), SPIP le perd avec ou sans éditeur
		expect(texte(id)).toBe(texte(temoin));
	});
}

test('une modification ne réécrit que son paragraphe', async ({ page }) => {
	const source = '{{{Titre}}}\n\n\nUn  paragraphe {{gras}}.\n\n\n-* liste\n-* suite\n';
	const id = await editer(page, source);
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('End');
	await page.keyboard.type(' Ajout');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf('{{{Titre}}}\n\n\nUn  paragraphe {{gras}}. Ajout\n\n\n-* liste\n-* suite\n'));
});

test('mode source : la saisie dans le textarea est reprise par l\'éditeur', async ({ page }) => {
	const id = await editer(page, 'Avant');
	await page.locator('.tts-mode').click();
	const textarea = page.locator('textarea[name=texte]');
	await expect(textarea).toBeVisible();
	await textarea.fill('{{Après}}');
	await page.locator('.tts-mode').click();
	await expect(page.locator('.ProseMirror strong')).toHaveText('Après');
	await enregistrer(page);
	expect(texte(id)).toBe('{{Après}}');
});
```

- [ ] **Step 4 : lancer**

Run : `cd prive/javascript/tiptap_spip && TTS_SITE=$S/jetable/v4.4.21 TTS_URL=http://127.0.0.1:18931 npm run e2e`
Expected : `5 passed`.

Contrôle de la détection : dans `TextareaBridge.flush()`, remplacer `serialize(this.editor.getJSON())` par `serialize(this.editor.getJSON()) + ' '`, reconstruire (`npm run build`) et relancer → `5 failed` ; annuler, reconstruire → `5 passed`.

- [ ] **Step 5 : commit**

```bash
git add tests/e2e/site.php prive/javascript/tiptap_spip/playwright.config.js prive/javascript/tiptap_spip/tests/e2e/article.e2e.js
git commit -m "test(e2e): article édité et enregistré sur un site SPIP jetable"
```

---

### Task 8 : Specs alignées sur le socle

**Files:**
- Modify: `docs/specs/02-architecture.md`, `docs/specs/03-schema-json.md`, `docs/specs/04-parseur-serialiseur.md`, `docs/specs/08-tests-recette.md`, `docs/specs/09-lots-roadmap.md`

- [ ] **Step 1 : reporter ce que le socle a établi**

- 02 §3 : bundle **esbuild** (bun absent du poste) ; configuration lue dans `window.spipConfig.tiptap_spip` (rempli par `09_tiptap_spip_config.js.html` en SPIP 4 comme en SPIP 5), plus d'import de `config.js` ; `src/editor/content.js` (`toEditorJSON`) dans l'arborescence ; dépendances : extensions déclarées une à une, pas de StarterKit ni de `TrailingNode`.
- 02 §4 : montage = `createEditor()` avec le JSON de `toEditorJSON()` (empreintes recalculées après le schéma) ; mode source : pas de re-parse pendant la saisie, rechargement unique au retour en visuel s'il y a eu saisie, refus de revenir en visuel (et mode source conservé) si la source n'est pas représentable ; flush sur `submit`, `blur` de l'éditeur, bascule de mode, `beforeunload`.
- 02 §6 : textareas équipés : ajouter `.formulaire_spip textarea[name=texte]` (option `inserer_auto_name_texte` du porte-plume) ; le porte-plume est écarté par les classes `no_barre no_previsualisation`, ou `markItUpRemove()` s'il est déjà monté ; `onAjaxLoad` passe la racine dans `this`.
- 03 §2 : titre « Extensions standard retenues (déclarées une à une) » ; `trailingNode` retiré (ajoute un paragraphe vide, modifie la source) ; `orderedList` sans attributs `start`/`type` ; `hardBreak` saisi dans l'éditeur = `manual` (`\n_ `).
- 04 §4, algorithme point 2 : le séparateur d'un bloc est son `spipSep` s'il est valide à sa place (vide pour le premier bloc, contenant une ligne vide ailleurs), sinon `\n\n` (rien pour le premier) ; point 5 réécrit : les attributs techniques ne sont pas rendus en HTML, donc perdus au copier-coller, mais ProseMirror les **recopie** quand il coupe un bloc ou le déplace ; le sérialiseur n'en reprend que ce qui reste valide (`spipSrc` si la forme canonique correspond, `spipSep` si valide à sa place).
- 08 §2, ligne E2E : la référence d'identité est le texte enregistré par le même formulaire **sans** l'éditeur (CRLF du navigateur, saut de ligne initial ignoré par `<textarea>`) ; outillage : Playwright 1.61.0, site jetable SQLite.
- 09 : L0 « bundle esbuild » ; mesure du critère 6 (non bloquante pour L0) : 50 000 caractères, montage à froid 256 ms, à chaud 102–127 ms dans Chromium 149 → optimisation à prévoir avant la recette (L5).

- [ ] **Step 2 : commit**

```bash
git add docs/specs
git commit -m "docs: specs alignées sur le socle (esbuild, schéma, séparateurs, bout en bout)"
```

---

## Hors de ce plan

- SPIP 5 : le chargement par importmap et `_inits` reprend celui de markdown_editor, mais aucun SPIP 5 n'est installé sur le poste : à vérifier avec le premier site SPIP 5 disponible.
- Barres d'outils, raccourcis clavier (`Mod-Shift-E`), i18n complète, styles de contenu : lot L5. Configuration (champs, objets, public) : lots L2b et L5.
- Performance du premier montage (critère 6 de la spec 08).
