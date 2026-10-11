# Cœur SPIP (lot L1) — parseur et sérialiseur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** écrire `src/spip/`, le module JavaScript pur qui transforme une source SPIP en document JSON Tiptap et inversement, avec restitution exacte des textes non modifiés et rendu SPIP identique pour les textes réécrits.

**Architecture :** une chaîne en quatre étages sans DOM ni Tiptap — `protect` (masque les zones opaques dans l'ordre du core), `segment` (découpe sur les lignes vides sans perdre un caractère), `blocks`/`inline` (analyse), `serialize` (écriture, conservatrice par segment). L'oracle est SPIP lui-même : un script compare `propre()` de la source et de sa forme canonique.

**Tech Stack :** Node 24, npm, Vitest 3.2.4, PHP 8 CLI + un site SPIP 4.4 local (oracle `propre()`).

**Specs de référence :** `docs/specs/03-schema-json.md`, `docs/specs/04-parseur-serialiseur.md`, `docs/specs/08-tests-recette.md`, lot L1 de `docs/specs/09-lots-roadmap.md`.

## Global Constraints

- Code JS dans `prive/javascript/tiptap_spip/` (package npm privé, `"type": "module"`) ; `src/spip/` ne dépend ni de Tiptap ni du DOM (spec 02 §3).
- Corpus versionné dans `tests/corpus/*.spip` à la racine du dépôt ; corpus réel uniquement dans un dossier local hors dépôt (`TTS_CORPUS`), jamais commité.
- Regex recopiées du core SPIP 4.4 dans `src/spip/regex.js`, chacune avec son fichier PHP d'origine en commentaire.
- `parse()` ne lève jamais d'exception : toute construction non représentable devient `spipRaw` (bloc) ou `spipRawInline` (inline), restitués tels quels.
- Identité : `serialize(parse(s)) === s`, caractère pour caractère, pour toute source non modifiée (spec 04 §4).
- Dans ce lot, liens, notes, modèles, glossaire, abréviations, ancres, `<multi>` et idiomes sont reconnus mais conservés en `spipRawInline` (lots L2 à L4).
- `bun` n'est pas installé sur le poste : le lot L1 n'a besoin que de npm et Vitest ; le choix de l'outil de bundle relève du lot L0.
- Commentaires et messages en français ; indentation par tabulations (comme markdown_editor et le core SPIP).
- Messages de commit sans trailer (`Co-Authored-By`, `Claude-Session`…), le message s'arrête après le corps.
- Comportements du core vérifiés pendant la préparation du plan, à ne pas « corriger » :
  - un retour à la ligne simple dans un paragraphe ou un élément de liste est rendu `<br class='autobr' />` ;
  - `\[` ne protège pas `[?…]` ni `[[…]]` (notes et glossaire passent avant les échappements) : on écrit `[&#63;` et `[&#91;` ;
  - `\<` ne protège pas une balise : on écrit `&lt;` ;
  - dans du code en backticks, SPIP perd `\\` et `` \` `` ; dans `<code>`/`<cadre>`/`<html>`, il les décode en `\` et `` ` `` ;
  - le type d'une liste ne change qu'entre deux éléments de même profondeur ;
  - `<code>` multiligne et ```` ``` ```` ont le même rendu (le JSON ne mémorise pas la forme).

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `prive/javascript/tiptap_spip/package.json` | package npm, scripts `test` et `equivalence` |
| `prive/javascript/tiptap_spip/src/spip/json.js` | constructeurs de nœuds, ordre des marks, forme canonique |
| `prive/javascript/tiptap_spip/src/spip/regex.js` | regex du core SPIP 4.4 |
| `prive/javascript/tiptap_spip/src/spip/protect.js` | zones opaques et texte masqué, codage des échappements de code |
| `prive/javascript/tiptap_spip/src/spip/segment.js` | découpage en segments sans perte, recollage des conteneurs |
| `prive/javascript/tiptap_spip/src/spip/inline.js` | analyse inline : marks, sauts de ligne, échappements, bruts |
| `prive/javascript/tiptap_spip/src/spip/blocks.js` | analyse d'un segment en blocs : paragraphes, titres, listes, conteneurs, code, tableaux |
| `prive/javascript/tiptap_spip/src/spip/parse.js` | `parse()` : document complet + carte de segments |
| `prive/javascript/tiptap_spip/src/spip/serialize.js` | `serialize()` : écriture conservatrice ou canonique, échappements |
| `prive/javascript/tiptap_spip/src/spip/index.js` | API publique du module |
| `prive/javascript/tiptap_spip/tests/spip/*.test.js` | tests Vitest, un fichier par module + invariants sur corpus |
| `prive/javascript/tiptap_spip/scripts/equivalence.mjs` | harnais d'équivalence de rendu |
| `tests/equivalence/propre.php` | oracle : `propre()` d'un site SPIP en ligne de commande |
| `tests/corpus/*.spip` | corpus versionné |
| `tests/corpus/exporter.php` | export d'un corpus réel local depuis un site SPIP |

## Format JSON produit (rappel)

Format `editor.getJSON()` de Tiptap : `{ type, attrs?, content?, marks?, text? }`. Types produits par ce lot :

- blocs : `paragraph`, `heading {level 2–6}`, `horizontalRule`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `spipPoesie {tag}`, `spipAlign {align}`, `codeBlock {language?, openTag?}`, `spipCadre`/`spipHtml`/`spipMath {openTag, closeTag}`, `table {caption?, summary?}`, `tableRow`, `tableHeader`/`tableCell {colspan, rowspan}`, `spipRaw {source}` ;
- inline : `text`, `hardBreak {syntax: 'autobr'|'manual'}`, `spipRawInline {source}` ;
- marks : `bold`, `italic`, `strike`, `superscript`, `subscript`, `code` (dans cet ordre canonique) ;
- attributs techniques (ignorés par la forme canonique) : `doc.attrs.spipLead/spipTrail`, et sur le premier bloc de chaque segment `spipSep`, `spipSrc`, `spipGroup`, `spipHash`.

---

### Task 1 : Package npm et nœuds JSON

**Files:**
- Create: `prive/javascript/tiptap_spip/package.json`
- Create: `prive/javascript/tiptap_spip/.gitignore`
- Create: `prive/javascript/tiptap_spip/src/spip/json.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/json.test.js`

**Interfaces:**
- Consumes : rien.
- Produces (`src/spip/json.js`) :
  - `MARK_ORDER: string[]`, `TECH_ATTRS: string[]`
  - `text(value: string, marks?: Mark[]): TextNode`
  - `node(type: string, attrs?: object|null, content?: Node[]): Node` — omet `attrs` vide et `content` absent
  - `raw(source: string, marks?: Mark[]): Node` — `spipRawInline`
  - `sortMarks(marks: Mark[]): Mark[]`, `sameMark(a, b): boolean`
  - `mergeText(nodes: Node[]): Node[]`
  - `stripTech(value): value` — clés triées, sans attributs techniques ni nuls
  - `canon(value): string` — `JSON.stringify(stripTech(value))`

- [ ] **Step 1 : créer le package**

`prive/javascript/tiptap_spip/package.json` :

```json
{
  "name": "tiptap-spip",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "equivalence": "node scripts/equivalence.mjs"
  },
  "devDependencies": {
    "vitest": "3.2.4"
  }
}
```

`prive/javascript/tiptap_spip/.gitignore` :

```
node_modules/
```

Run : `cd prive/javascript/tiptap_spip && npm install`
Expected : `added … packages`, création de `package-lock.json` (à versionner).

- [ ] **Step 2 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/json.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { canon, mergeText, raw, sortMarks, text } from '../../src/spip/json.js';

describe('mergeText', () => {
	it('fusionne les textes adjacents de mêmes marks et supprime les textes vides', () => {
		const b = [{ type: 'bold' }];
		expect(mergeText([text('a', b), text('', b), text('b', b), text('c'), raw('{')]))
			.toEqual([text('ab', b), text('c'), raw('{')]);
	});
});

describe('sortMarks', () => {
	it('range les marks dans l\'ordre canonique, code en dernier', () => {
		expect(sortMarks([{ type: 'code' }, { type: 'italic' }, { type: 'bold' }]).map((m) => m.type))
			.toEqual(['bold', 'italic', 'code']);
	});
});

describe('canon', () => {
	it('ignore les attributs techniques, les attributs nuls et l\'ordre des clés', () => {
		const a = { type: 'paragraph', attrs: { spipSrc: 'x', spipGroup: 1 }, content: [text('a')] };
		const b = { content: [{ text: 'a', type: 'text' }], type: 'paragraph', attrs: { language: null } };
		expect(canon(a)).toBe(canon(b));
	});

	it('distingue des contenus différents', () => {
		expect(canon([text('a')])).not.toBe(canon([text('a', [{ type: 'bold' }])]));
	});
});
```

- [ ] **Step 3 : vérifier l'échec**

Run : `cd prive/javascript/tiptap_spip && npx vitest run tests/spip/json.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/json.js`.

- [ ] **Step 4 : implémenter**

`prive/javascript/tiptap_spip/src/spip/json.js` :

```js
/**
 * Construction et comparaison des nœuds JSON (format editor.getJSON() de Tiptap).
 */

/** Ordre canonique des marks, de la plus externe à la plus interne. */
export const MARK_ORDER = ['bold', 'italic', 'strike', 'superscript', 'subscript', 'code'];

/** Attributs techniques de la sérialisation conservatrice : exclus de la forme canonique. */
export const TECH_ATTRS = ['spipSrc', 'spipSep', 'spipHash', 'spipGroup', 'spipLead', 'spipTrail'];

export const text = (value, marks = []) => (marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value });

export const node = (type, attrs, content) => {
	const n = { type };
	if (attrs && Object.keys(attrs).length) n.attrs = attrs;
	if (content) n.content = content;
	return n;
};

export const raw = (source, marks = []) => {
	const n = { type: 'spipRawInline', attrs: { source } };
	if (marks.length) n.marks = marks;
	return n;
};

export const sortMarks = (marks) =>
	[...marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

export const sameMark = (a, b) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});

const sameMarks = (a = [], b = []) => a.length === b.length && a.every((m, i) => sameMark(m, b[i]));

/** Fusionne les nœuds texte adjacents portant les mêmes marks, supprime les textes vides. */
export function mergeText(nodes) {
	const out = [];
	for (const n of nodes) {
		if (n.type === 'text' && n.text === '') continue;
		const prev = out[out.length - 1];
		if (n.type === 'text' && prev?.type === 'text' && sameMarks(prev.marks, n.marks)) {
			out[out.length - 1] = text(prev.text + n.text, prev.marks ?? []);
		} else {
			out.push(n);
		}
	}
	return out;
}

/**
 * Forme normalisée : clés triées, sans attributs techniques ni attributs nuls (Tiptap ajoute
 * les valeurs par défaut nulles dans getJSON(), le parseur ne les écrit pas).
 */
export function stripTech(value) {
	if (Array.isArray(value)) return value.map(stripTech);
	if (value && typeof value === 'object') {
		const out = {};
		for (const k of Object.keys(value).sort()) {
			if (k !== 'attrs') {
				out[k] = stripTech(value[k]);
				continue;
			}
			const attrs = {};
			for (const a of Object.keys(value.attrs).sort()) {
				if (TECH_ATTRS.includes(a) || value.attrs[a] === null || value.attrs[a] === undefined) continue;
				attrs[a] = stripTech(value.attrs[a]);
			}
			if (Object.keys(attrs).length) out.attrs = attrs;
		}
		return out;
	}
	return value;
}

/**
 * Forme canonique d'un nœud ou d'une liste de nœuds. Deux contenus de même forme canonique
 * se sérialisent et se rendent à l'identique : c'est l'empreinte de la sérialisation
 * conservatrice (comparaison exacte, pas de hachage, donc pas de collision possible).
 */
export const canon = (value) => JSON.stringify(stripTech(value));
```

- [ ] **Step 5 : vérifier le succès**

Run : `npx vitest run tests/spip/json.test.js`
Expected : PASS, 4 tests.

- [ ] **Step 6 : commit**

```bash
git add prive/javascript/tiptap_spip/package.json prive/javascript/tiptap_spip/package-lock.json prive/javascript/tiptap_spip/.gitignore prive/javascript/tiptap_spip/src/spip/json.js prive/javascript/tiptap_spip/tests/spip/json.test.js
git commit -m "feat(spip): package npm et nœuds JSON canoniques"
```

---

### Task 2 : Regex du core et zones protégées

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/regex.js`
- Create: `prive/javascript/tiptap_spip/src/spip/protect.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/protect.test.js`

**Interfaces:**
- Consumes : rien.
- Produces :
  - `regex.js` : `RE_MODELE`, `RE_LIEN`, `RE_NOTE`, `RE_GLOSSAIRE`, `RE_ANCRE`, `RE_ABBR`, `RE_MULTI`, `RE_IDIOME`, `RE_PROTEGE_BLOCS`, `RE_BACKTICKS: RegExp[]`, `RE_ECHAPPEMENT_CODE`, `RE_ECHAPPEMENT` (toutes globales)
  - `protect.js` :
    - `FILL = ''`
    - `protect(source: string): { masked: string, regions: Region[] }` — `masked` a la même longueur que `source` ; `Region = { start, end, kind, data }` avec `kind` ∈ `escape` (`data.char`), `backtick` (`data.ticks`, `data.code`, `data.language`), `block` (`data.tag`, `data.openTag`, `data.closeTag`, `data.inner`), `model`, `note`, `link`, `anchor`, `glossary`, `abbr`, `multi`, `idiome` ; toujours `data.absorbed: string[]` (types des régions englobées)
    - `regionsIn(regions, start, end): Region[]` — régions entièrement dans `[start, end[`, positions relatives
    - `decodeCode(s)`, `dropCodeEscapes(s)`, `canBacktick(s): boolean`, `encodeCode(s)`

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/protect.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { FILL, protect, regionsIn } from '../../src/spip/protect.js';

const kinds = (source) => protect(source).regions.map((r) => [r.kind, source.slice(r.start, r.end)]);

describe('protect', () => {
	it('produit un texte masqué de même longueur', () => {
		const source = 'a [lien->art1] et <doc3|left> fin';
		const { masked } = protect(source);
		expect(masked).toHaveLength(source.length);
		expect(masked).toBe(`a ${FILL.repeat(12)} et ${FILL.repeat(11)} fin`);
	});

	it('repère les raccourcis non éditables de ce lot', () => {
		expect(kinds('[[note]] [x->art1] [#a<-] [?SPIP] [ABBR|abr] <multi>[fr]a</multi> <:mod:cle:> <img3>'))
			.toEqual([
				['note', '[[note]]'], ['link', '[x->art1]'], ['anchor', '[#a<-]'], ['glossary', '[?SPIP]'],
				['abbr', '[ABBR|abr]'], ['multi', '<multi>[fr]a</multi>'], ['idiome', '<:mod:cle:>'], ['model', '<img3>'],
			]);
	});

	it('ne prend pas une balise HTML pour un modèle', () => {
		expect(kinds('<span> <span|x> <doc12>')).toEqual([['model', '<span|x>'], ['model', '<doc12>']]);
	});

	it('une région englobe celles qu\'elle recouvre', () => {
		const { regions } = protect('[<img3|left>->art1]');
		expect(regions).toHaveLength(1);
		expect(regions[0]).toMatchObject({ kind: 'link', start: 0, end: 19 });
		expect(regions[0].data.absorbed).toEqual(['model']);
	});

	it('échappements : \\{ et \\[ masquent le caractère', () => {
		expect(protect('\\{a\\} \\[x->y]').regions.map((r) => r.data.char ?? r.kind)).toEqual(['{', '}', '[']);
	});

	it('backticks : langage et contenu, \\\\ et \\` perdus comme dans SPIP', () => {
		const [fence, inline] = protect('```php\n$a;\n```\n\n`x\\`y`').regions;
		expect(fence.data).toMatchObject({ ticks: '```', language: 'php', code: '$a;\n' });
		expect(inline.data).toMatchObject({ ticks: '`', code: 'xy' });
	});

	it('blocs protégés : balises exactes et \\\\ décodé dans le contenu', () => {
		const [block] = protect('<code class="php">a\\\\b</code>').regions;
		expect(block.data).toMatchObject({ tag: 'code', openTag: '<code class="php">', closeTag: '</code>', inner: 'a\\b' });
	});

	it('regionsIn renvoie des positions relatives', () => {
		const { regions } = protect('ab [[n]] cd');
		expect(regionsIn(regions, 3, 8)).toMatchObject([{ kind: 'note', start: 0, end: 5 }]);
		expect(regionsIn(regions, 0, 5)).toEqual([]);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run tests/spip/protect.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/protect.js`.

- [ ] **Step 3 : écrire les regex**

`prive/javascript/tiptap_spip/src/spip/regex.js` :

```js
/**
 * Expressions régulières alignées sur le core SPIP 4.4.
 * Chaque constante cite son origine PHP : ne la modifier qu'en suivant le core.
 * Les modificateurs PHP sont traduits : U (ungreedy) → quantificateurs paresseux,
 * s → s, i → i, m → m. Toutes sont globales (g) : utiliser matchAll().
 */

// ecrire/src/Texte/Collecteur/Modeles.php — <modeleN|params>
export const RE_MODELE = /<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>/gi;

// ecrire/src/Texte/Collecteur/Liens.php — _RACCOURCI_LIEN
export const RE_LIEN = /\[([^\][]*?([[][^\]>-]*[\]][^\][]*)*)->(>?)([^\]]*)\]/gs;

// plugins-dist/textwheel/inc/notes.php — _NOTES_RACCOURCI
export const RE_NOTE = /\[\[(\s*(<([^>'"]*)>)?(.*?))\]\]/gs;

// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_GLOSSAIRE, _RACCOURCI_ANCRE
export const RE_GLOSSAIRE = /\[\?+\s*([^\][<>]+)\]/g;
export const RE_ANCRE = /\[#?([^\][]*)<-\]/g;

// plugins-dist/textwheel/wheels/spip/spip.yaml — règle abbr
export const RE_ABBR = /\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]/g;

// ecrire/src/Texte/Collecteur/Multis.php
export const RE_MULTI = /<multi>(.*?)<\/multi>/gs;

// ecrire/src/Texte/Collecteur/Idiomes.php
export const RE_IDIOME = /<:(?:([a-z0-9_]+):)?([a-z0-9_]+):>/gi;

// ecrire/inc/texte_mini.php — _PROTEGE_BLOCS, plus <math> (règle math de spip.yaml)
export const RE_PROTEGE_BLOCS = /<(html|pre|code|cadre|frame|script|style|math)(\b[^>]*)?>(.*?)<\/\1>/gis;

// plugins-dist/textwheel/wheels/spip/backticks.php — replace_backticks(), dans cet ordre
export const RE_BACKTICKS = [
	/(?<!`)(```+)([^`]|[^`].*?[^`])(\1)(?=$|[^`])/gms,
	/(?<!`)(``)([^`]|[^`].*?[^`])(``)(?=$|[^`])/gms,
	/(?<!`)(`)([^`]|[^`].*?[^`])(`)(?=$|[^`])/gms,
];

// backticks.yaml bt-echappe-backticks : traité avant les backticks
export const RE_ECHAPPEMENT_CODE = /\\([\\`])/g;

// spip.yaml echappe-raccourcis
export const RE_ECHAPPEMENT = /\\([{}_\-[\]|<>*#+~])/g;
```

- [ ] **Step 4 : implémenter la protection**

`prive/javascript/tiptap_spip/src/spip/protect.js` (attention : `FILL` est le caractère U+E000, écrit `''` dans la source) :

```js
import {
	RE_ABBR, RE_ANCRE, RE_BACKTICKS, RE_ECHAPPEMENT, RE_ECHAPPEMENT_CODE, RE_GLOSSAIRE, RE_IDIOME,
	RE_LIEN, RE_MODELE, RE_MULTI, RE_NOTE, RE_PROTEGE_BLOCS,
} from './regex.js';

/** Caractère de masquage : zone privée Unicode, jamais produit par une regex de raccourci. */
export const FILL = '\uE000';

/**
 * Repère les zones « opaques » d'un texte SPIP, dans l'ordre de traitement du core,
 * et renvoie un texte masqué de même longueur : chaque zone y est remplacée par FILL.
 * Les positions sont donc identiques dans `source` et `masked`.
 *
 * @param {string} source
 * @returns {{ masked: string, regions: Region[] }}
 *
 * @typedef {{ start: number, end: number, kind: string, data: object }} Region
 */
export function protect(source) {
	let masked = source;
	let regions = [];

	const add = (start, end, kind, data) => {
		// une zone englobe celles qu'elle recouvre (ex. un modèle dans le texte d'un lien)
		const absorbed = regions.filter((r) => r.start >= start && r.end <= end).map((r) => r.kind);
		regions = regions.filter((r) => r.start < start || r.end > end);
		regions.push({ start, end, kind, data: { ...data, absorbed } });
		masked = masked.slice(0, start) + FILL.repeat(end - start) + masked.slice(end);
	};

	const scan = (regex, onMatch) => {
		for (const m of [...masked.matchAll(regex)]) {
			onMatch(m, m.index, m.index + m[0].length);
		}
	};

	// 1. wheel backticks (pre_echappe_html_propre, avant tout le reste) :
	//    d'abord \\ et \`, puis ``` `` ` — sur tout le texte, y compris dans <code> ou <html>
	scan(RE_ECHAPPEMENT_CODE, (m, start, end) => add(start, end, 'escape', { char: m[1] }));
	RE_BACKTICKS.forEach((regex) => scan(regex, (m, start, end) => {
		const ticks = m[1];
		let code = dropCodeEscapes(source.slice(start + ticks.length, end - ticks.length));
		let language = '';
		if (ticks.length >= 3) {
			const l = code.match(/^[\w\t -]+\n/);
			if (l) {
				language = l[0].trim();
				code = code.slice(l[0].length);
			}
			code = code.replace(/^\n/, '');
		}
		add(start, end, 'backtick', { ticks, code, language });
	}));

	// 2. blocs protégés <code>, <cadre>, <html>…
	scan(RE_PROTEGE_BLOCS, (m, start, end) => {
		const openTag = source.slice(start, start + m[0].indexOf('>') + 1);
		const closeLength = m[1].length + 3;
		add(start, end, 'block', {
			tag: m[1].toLowerCase(),
			openTag,
			closeTag: source.slice(end - closeLength, end),
			inner: decodeCode(source.slice(start + openTag.length, end - closeLength)),
		});
	});

	// 3. autres échappements \{ \[ …
	scan(RE_ECHAPPEMENT, (m, start, end) => add(start, end, 'escape', { char: m[1] }));

	// 4. raccourcis encore non éditables dans ce lot : conservés tels quels
	scan(RE_MODELE, (m, start, end) => {
		// condition du core : un id ou des paramètres, sinon c'est une balise HTML
		if (m[2] || m[3]) add(start, end, 'model', {});
	});
	scan(RE_NOTE, (m, start, end) => add(start, end, 'note', {}));
	scan(RE_LIEN, (m, start, end) => add(start, end, 'link', {}));
	scan(RE_ANCRE, (m, start, end) => add(start, end, 'anchor', {}));
	scan(RE_GLOSSAIRE, (m, start, end) => add(start, end, 'glossary', {}));
	scan(RE_ABBR, (m, start, end) => add(start, end, 'abbr', {}));
	scan(RE_MULTI, (m, start, end) => add(start, end, 'multi', {}));
	scan(RE_IDIOME, (m, start, end) => add(start, end, 'idiome', {}));

	regions.sort((a, b) => a.start - b.start);
	return { masked, regions };
}

/** Dans <code>, <cadre>, <html>… la wheel backticks décode \\ en \ et \` en `. */
export const decodeCode = (s) => s.replace(/\\([\\`])/g, '$1');

/** Dans du code en backticks, SPIP perd purement et simplement \\ et \`. */
export const dropCodeEscapes = (s) => s.replace(/\\[\\`]/g, '');

/** Un code sans séquence \\, \` ni \ final peut s'écrire entre backticks. */
export const canBacktick = (s) => !/\\(?=[\\`]|$)/.test(s);

/** Inverse de decodeCode, pour le texte écrit dans <code>, <cadre>, <html>, <math>. */
export const encodeCode = (s) => s.replace(/\\(?=[\\`]|$)/g, '\\\\').replace(/`/g, '\\`');

/**
 * Régions contenues dans [start, end[, avec des positions relatives à start.
 * @param {Region[]} regions
 */
export function regionsIn(regions, start, end) {
	return regions
		.filter((r) => r.start >= start && r.end <= end)
		.map((r) => ({ ...r, start: r.start - start, end: r.end - start }));
}
```

- [ ] **Step 5 : vérifier le succès**

Run : `npx vitest run tests/spip/protect.test.js`
Expected : PASS, 8 tests.

- [ ] **Step 6 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/regex.js prive/javascript/tiptap_spip/src/spip/protect.js prive/javascript/tiptap_spip/tests/spip/protect.test.js
git commit -m "feat(spip): regex du core et masquage des zones protégées"
```

---

### Task 3 : Découpage en segments sans perte

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/segment.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/segment.test.js`

**Interfaces:**
- Consumes : `protect(source).masked` (Task 2).
- Produces : `segment(source: string, masked: string): { lead: string, trail: string, segments: { sep: string, start: number, end: number }[] }` avec `source === lead + Σ(sep + source.slice(start, end)) + trail`.

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/segment.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { protect } from '../../src/spip/protect.js';
import { segment } from '../../src/spip/segment.js';

const cut = (source) => {
	const { lead, trail, segments } = segment(source, protect(source).masked);
	return { lead, trail, parts: segments.map((s) => [s.sep, source.slice(s.start, s.end)]) };
};
const rebuild = (source) => {
	const { lead, trail, parts } = cut(source);
	return lead + parts.map(([sep, src]) => sep + src).join('') + trail;
};

describe('segment', () => {
	it.each([
		'', ' ', '\n\n  \n', 'a', 'a\n\nb', '\n\na  \n\n\n\nb\n', 'a\r\n\r\nb', '<quote>\nx\n\ny\n</quote>\n\nz',
	])('ne perd aucun caractère : %j', (source) => {
		expect(rebuild(source)).toBe(source);
	});

	it('coupe sur les lignes vides et garde les séparateurs exacts', () => {
		expect(cut('\n\na\n\n\nb  \n\n')).toEqual({ lead: '\n\n', trail: '\n\n', parts: [['', 'a'], ['\n\n\n', 'b  ']] });
	});

	it('un texte vide ou blanc n\'a aucun segment', () => {
		expect(cut('  \n ')).toEqual({ lead: '  \n ', trail: '', parts: [] });
	});

	it('ne coupe pas à l\'intérieur d\'une note ou d\'un bloc protégé', () => {
		expect(cut('a[[x\n\ny]]\n\n<code>\n\n</code>').parts.map((p) => p[1])).toEqual(['a[[x\n\ny]]', '<code>\n\n</code>']);
	});

	it('recolle les conteneurs <quote>, <poesie>, <div class="text-…">', () => {
		expect(cut('<quote>\na\n\nb\n</quote>\n\n<div class="text-center">\n\nc\n\n</div>').parts.map((p) => p[1]))
			.toEqual(['<quote>\na\n\nb\n</quote>', '<div class="text-center">\n\nc\n\n</div>']);
	});

	it('laisse un conteneur jamais fermé découpé normalement', () => {
		expect(cut('<quote>\na\n\nb').parts.map((p) => p[1])).toEqual(['<quote>\na', 'b']);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run tests/spip/segment.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/segment.js`.

- [ ] **Step 3 : implémenter**

`prive/javascript/tiptap_spip/src/spip/segment.js` :

```js
/**
 * Découpe une source SPIP en segments séparés par des lignes vides, sans perdre un caractère :
 *   source = lead + Σ (segment.sep + source.slice(segment.start, segment.end)) + trail
 *
 * Le découpage se fait sur le texte masqué (cf. protect.js) : une ligne vide à l'intérieur
 * d'un bloc protégé, d'une note ou d'un lien ne coupe donc pas. Les conteneurs
 * <quote>, <poesie>, <div class="text-…"> qui contiennent des lignes vides sont recollés.
 *
 * @param {string} source
 * @param {string} masked
 * @returns {{ lead: string, trail: string, segments: {sep: string, start: number, end: number}[] }}
 */
export function segment(source, masked) {
	if (masked.trim() === '') {
		return { lead: source, trail: '', segments: [] };
	}
	const lead = masked.match(/^(?:[ \t\r]*\n)*/)[0];
	const trail = masked.slice(lead.length).match(/(?:\n[ \t\r]*)*$/)[0];
	const bodyStart = lead.length;
	const bodyEnd = masked.length - trail.length;

	const raw = [];
	let pos = bodyStart;
	let sep = '';
	const SEP = /\n(?:[ \t\r]*\n)+/g;
	SEP.lastIndex = bodyStart;
	let m;
	while ((m = SEP.exec(masked)) && m.index < bodyEnd) {
		raw.push({ sep, start: pos, end: m.index });
		sep = m[0];
		pos = m.index + m[0].length;
	}
	raw.push({ sep, start: pos, end: bodyEnd });

	return {
		lead: source.slice(0, lead.length),
		trail: source.slice(bodyEnd),
		segments: mergeContainers(raw, masked),
	};
}

const CONTAINERS = [
	{ open: /^<quote>/i, tag: /<(\/?)quote>/gi },
	{ open: /^<poe(?:sie|try)>/i, tag: /<(\/?)poe(?:sie|try)>/gi },
	{ open: /^<div class="text-(?:left|center|right|justify)">/, tag: /<(\/?)div\b[^>]*>/gi },
];

function balance(text, tagRegex) {
	let depth = 0;
	for (const m of text.matchAll(tagRegex)) depth += m[1] ? -1 : 1;
	return depth;
}

function mergeContainers(raw, masked) {
	const out = [];
	for (let i = 0; i < raw.length; i++) {
		const seg = raw[i];
		const text = masked.slice(seg.start, seg.end);
		const container = CONTAINERS.find((c) => c.open.test(text));
		let depth = container ? balance(text, container.tag) : 0;
		if (depth > 0) {
			let j = i;
			while (depth > 0 && j + 1 < raw.length) {
				j++;
				depth += balance(masked.slice(raw[j].start, raw[j].end), container.tag);
			}
			if (depth === 0) {
				out.push({ sep: seg.sep, start: seg.start, end: raw[j].end });
				i = j;
				continue;
			}
		}
		out.push(seg);
	}
	return out;
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run tests/spip/segment.test.js`
Expected : PASS, 13 tests (8 cas paramétrés + 5).

- [ ] **Step 5 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/segment.js prive/javascript/tiptap_spip/tests/spip/segment.test.js
git commit -m "feat(spip): découpage en segments sans perte de caractère"
```

---

### Task 4 : Analyse inline

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/inline.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/inline.test.js`

**Interfaces:**
- Consumes : `protect`, `Region` (Task 2) ; `text`, `raw`, `mergeText`, `sortMarks` (Task 1).
- Produces : `parseInline(source: string, masked: string, regions: Region[], options?: { lineStart?: boolean }): Node[]` — `lineStart: true` pour un paragraphe (les marqueurs `- `, `-- `, `----`, `_ ` de début de ligne deviennent bruts).

Règles (spec 04 §2 étape 4) : `{{`/`}}` gras, `{`/`}` italique, `<strong> <i> <del> <sup> <sub>` sans attribut → marks ; marks mal imbriquées → tous leurs délimiteurs bruts ; runs de 3 accolades ou plus, `{}` et `{{}}` → bruts ; `\n` → `hardBreak autobr`, `\n_ ` → `hardBreak manual` ; entités `&lt; &gt; &amp; &#91; &#63;` décodées, autres entités brutes ; `~` → U+00A0 ; autres balises et commentaires HTML → bruts ; code backtick (une ou deux) et `<code>` sur une ligne → mark `code` ; autres régions → brutes.

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/inline.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { parseInline } from '../../src/spip/inline.js';
import { protect } from '../../src/spip/protect.js';
import { raw, text } from '../../src/spip/json.js';

const inl = (source, options) => {
	const { masked, regions } = protect(source);
	return parseInline(source, masked, regions, options);
};
const B = { type: 'bold' };
const I = { type: 'italic' };
const br = (syntax, marks) => ({ type: 'hardBreak', attrs: { syntax }, ...(marks ? { marks } : {}) });

describe('parseInline : marks', () => {
	it('gras et italique', () => {
		expect(inl('a {{b}} {c}')).toEqual([text('a '), text('b', [B]), text(' '), text('c', [I])]);
	});

	it('imbrication', () => {
		expect(inl('{{a {b}}}')).toEqual([raw('{{'), text('a '), raw('{'), text('b'), raw('}}}')]);
		expect(inl('{{a <i>b</i>}}')).toEqual([text('a ', [B]), text('b', [B, I])]);
	});

	it('balises HTML équivalentes sans attribut', () => {
		expect(inl('<strong>a</strong><del>b</del><sup>c</sup><sub>d</sub>')).toEqual([
			text('a', [B]), text('b', [{ type: 'strike' }]), text('c', [{ type: 'superscript' }]), text('d', [{ type: 'subscript' }]),
		]);
	});

	it('marks mal imbriquées : tous les délimiteurs restent bruts', () => {
		expect(inl('{a {{b} c}}')).toEqual([raw('{'), text('a '), raw('{{'), text('b'), raw('}'), text(' c'), raw('}}')]);
	});

	it('accolades orphelines, vides ou triples : brutes', () => {
		expect(inl('a} {} {{}} {{{x')).toEqual([text('a'), raw('}'), text(' '), raw('{}'), text(' '), raw('{{}}'), text(' '), raw('{{{'), text('x')]);
	});
});

describe('parseInline : lignes', () => {
	it('retour à la ligne simple = saut autobr ; \\n_ = saut manuel', () => {
		expect(inl('a\nb\n_ c')).toEqual([text('a'), br('autobr'), text('b'), br('manual'), text('c')]);
	});

	it('les marks restent ouvertes à travers un saut de ligne', () => {
		expect(inl('{{a\nb}}')).toEqual([text('a', [B]), br('autobr', [B]), text('b', [B])]);
	});

	it('marqueurs de début de ligne non gérés : bruts', () => {
		expect(inl('a\n- puce\n-- alinéa\n---- filet', { lineStart: true }))
			.toEqual([text('a'), br('autobr'), raw('- '), text('puce'), br('autobr'), raw('-- '), text('alinéa'), br('autobr'), raw('----'), text(' filet')]);
		expect(inl('_ début', { lineStart: true })).toEqual([raw('_ '), text('début')]);
		expect(inl('- pas en début de ligne')).toEqual([text('- pas en début de ligne')]);
	});
});

describe('parseInline : caractères', () => {
	it('échappements, entités et espace insécable', () => {
		expect(inl('\\{a\\} &lt;b&gt; &amp; &#91;x &#63; ~fin &eacute;'))
			.toEqual([text('{a} <b> & [x ?  fin '), raw('&eacute;')]);
	});

	it('balises HTML inconnues et commentaires : bruts', () => {
		expect(inl('<span class="x">a</span><!-- c -->')).toEqual([raw('<span class="x">'), text('a'), raw('</span>'), raw('<!-- c -->')]);
	});

	it('code : backticks et <code> sur une ligne', () => {
		const C = { type: 'code' };
		expect(inl('`a {b}` et <code>c</code>')).toEqual([text('a {b}', [C]), text(' et '), text('c', [C])]);
	});

	it('raccourcis non éditables dans ce lot : bruts', () => {
		expect(inl('voir [doc->art1][[note]] <doc2>')).toEqual([text('voir '), raw('[doc->art1]'), raw('[[note]]'), text(' '), raw('<doc2>')]);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run tests/spip/inline.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/inline.js`.

- [ ] **Step 3 : implémenter**

`prive/javascript/tiptap_spip/src/spip/inline.js` :

```js
import { mergeText, raw, sortMarks, text } from './json.js';

/** Balises HTML sans attribut équivalentes à une mark (même rendu que le raccourci SPIP). */
const MARK_TAGS = { strong: 'bold', i: 'italic', del: 'strike', sup: 'superscript', sub: 'subscript' };
const ENTITIES = { lt: '<', gt: '>', amp: '&', '#91': '[', '#63': '?' };

/**
 * Analyse le contenu inline d'un bloc.
 *
 * @param {string} source  texte source du contenu
 * @param {string} masked  même texte masqué (cf. protect.js)
 * @param {import('./protect.js').Region[]} regions  régions, positions relatives à source
 * @param {{ lineStart?: boolean }} options  lineStart : le contenu commence en début de ligne
 *        (paragraphe), donc les marqueurs de début de ligne (`- `, `_ `) s'appliquent
 * @returns {object[]} nœuds inline JSON
 */
export function parseInline(source, masked, regions, { lineStart = false } = {}) {
	return buildNodes(tokenize(source, masked, regions, lineStart));
}

function tokenize(source, masked, regions, lineStart) {
	const tokens = [];
	const regionAt = new Map(regions.map((r) => [r.start, r]));
	let buf = '';
	let i = 0;
	const flush = () => {
		if (buf) tokens.push({ t: 'text', v: buf });
		buf = '';
	};
	const push = (token) => {
		flush();
		tokens.push(token);
	};

	// marqueurs de début de ligne que l'éditeur ne gère pas : conservés bruts
	const lineMarker = () => {
		const m = masked.slice(i).match(/^(?:-{4,}|_{4,}|--? *|_ +)/);
		if (m) {
			push({ t: 'raw', v: source.slice(i, i + m[0].length) });
			i += m[0].length;
		}
	};

	if (lineStart) lineMarker();
	while (i < source.length) {
		const region = regionAt.get(i);
		if (region) {
			const src = source.slice(region.start, region.end);
			if (region.kind === 'escape') {
				buf += region.data.char;
			} else if (region.kind === 'backtick' && region.data.ticks.length < 3 && region.data.code.trim() !== '') {
				push({ t: 'code', v: region.data.code.trim() });
			} else if (region.kind === 'block' && region.data.openTag === '<code>' && !region.data.inner.includes('\n') && region.data.inner !== '' && !region.data.absorbed.includes('backtick')) {
				push({ t: 'code', v: region.data.inner });
			} else {
				push({ t: 'raw', v: src });
			}
			i = region.end;
			continue;
		}

		const c = masked[i];
		const rest = masked.slice(i);
		let m;
		if (c === '\r' && masked[i + 1] === '\n') {
			i++;
		} else if (c === '\n') {
			if ((m = rest.match(/^\n_ +/)) && !rest.startsWith('\n____')) {
				push({ t: 'br', syntax: 'manual' });
				i += m[0].length;
			} else {
				push({ t: 'br', syntax: 'autobr' });
				i++;
				lineMarker();
			}
		} else if (c === '{' || c === '}') {
			const run = rest.match(c === '{' ? /^\{+/ : /^\}+/)[0];
			if (run.length >= 3 || rest.startsWith('{}') || rest.startsWith('{{}}')) {
				const v = run.length >= 3 ? run : rest.startsWith('{{}}') ? '{{}}' : '{}';
				push({ t: 'raw', v });
				i += v.length;
			} else {
				push({ t: c === '{' ? 'open' : 'close', mark: run.length === 2 ? 'bold' : 'italic', src: run });
				i += run.length;
			}
		} else if (c === '<' && (m = rest.match(/^<(\/?)(strong|i|del|sup|sub)>/))) {
			push({ t: m[1] ? 'close' : 'open', mark: MARK_TAGS[m[2]], src: m[0] });
			i += m[0].length;
		} else if (c === '<' && (m = rest.match(/^(?:<!--[\s\S]*?-->|<\/?[a-z][a-z0-9]*\b[^<>]*>)/i))) {
			push({ t: 'raw', v: source.slice(i, i + m[0].length) });
			i += m[0].length;
		} else if (c === '&' && (m = rest.match(/^&(lt|gt|amp|#91|#63);/))) {
			buf += ENTITIES[m[1]];
			i += m[0].length;
		} else if (c === '&' && (m = rest.match(/^&#?[a-z0-9]+;/i))) {
			// autre entité HTML : conservée telle quelle
			push({ t: 'raw', v: m[0] });
			i += m[0].length;
		} else if (c === '~') {
			buf += ' ';
			i++;
		} else {
			buf += source[i];
			i++;
		}
	}
	flush();
	return tokens;
}

/** Les marks doivent être correctement imbriquées ; sinon tous leurs délimiteurs restent bruts. */
function wellNested(tokens) {
	const stack = [];
	for (const tk of tokens) {
		if (tk.t === 'open') {
			if (stack.includes(tk.mark)) return false;
			stack.push(tk.mark);
		} else if (tk.t === 'close') {
			if (stack[stack.length - 1] !== tk.mark) return false;
			stack.pop();
		}
	}
	return stack.length === 0;
}

function buildNodes(tokens) {
	const ok = wellNested(tokens);
	const open = [];
	const nodes = [];
	for (const tk of tokens) {
		const marks = sortMarks(open.map((type) => ({ type })));
		const withMarks = (n) => (marks.length ? { ...n, marks } : n);
		switch (tk.t) {
			case 'open':
				if (ok) open.push(tk.mark);
				else nodes.push(raw(tk.src, marks));
				break;
			case 'close':
				if (ok) open.pop();
				else nodes.push(raw(tk.src, marks));
				break;
			case 'text':
				nodes.push(text(tk.v, marks));
				break;
			case 'raw':
				nodes.push(raw(tk.v, marks));
				break;
			case 'code':
				nodes.push(text(tk.v, sortMarks([...marks, { type: 'code' }])));
				break;
			case 'br':
				nodes.push(withMarks({ type: 'hardBreak', attrs: { syntax: tk.syntax } }));
				break;
		}
	}
	return mergeText(nodes);
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run tests/spip/inline.test.js`
Expected : PASS, 12 tests.

- [ ] **Step 5 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/inline.js prive/javascript/tiptap_spip/tests/spip/inline.test.js
git commit -m "feat(spip): analyse inline (marks, sauts de ligne, échappements)"
```

---

### Task 5 : Analyse des blocs

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/blocks.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/blocks.test.js`

**Interfaces:**
- Consumes : `parseInline` (Task 4), `protect`, `regionsIn` (Task 2), `segment` (Task 3), `node`, `text` (Task 1).
- Produces :
  - `blocksOf(src: string, msk: string, regions: Region[]): Node[]` — un segment → un ou plusieurs blocs ; jamais d'exception (repli `spipRaw`)
  - `parseContent(src: string): Node[]` — contenu complet sans attributs techniques (conteneurs, tests)

Ordre d'essai pour un segment : bloc verbatim (une seule région couvrant tout le segment : ```` ``` ````, `<code>` multiligne, `<cadre>`, `<html>`, `<math>`) → conteneur (`<quote>`, `<poesie>`, `<div class="text-left|center|right|justify">`) → tableau (toutes les lignes en `|…|`) → suite de lignes (filet, intertitre `{{{…}}}` ou `<h3>`–`<h6>`, liste `-*`/`-#`, paragraphe).

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/blocks.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { parseContent } from '../../src/spip/blocks.js';
import { node, raw, text } from '../../src/spip/json.js';

const p = (...content) => node('paragraph', null, content);
const item = (inline, nested) => node('listItem', null, nested ? [p(text(inline)), nested] : [p(text(inline))]);
const cell = (type, value, colspan = 1, rowspan = 1) => node(type, { colspan, rowspan }, [value === '' ? node('paragraph') : p(text(value))]);

describe('blocs simples', () => {
	it('paragraphes, intertitres, filet', () => {
		expect(parseContent('{{{Titre {i}}}}\n\n<h3>Sous</h3>\n\n----\n\nfin')).toEqual([
			node('heading', { level: 2 }, [text('Titre '), text('i', [{ type: 'italic' }])]),
			node('heading', { level: 3 }, [text('Sous')]),
			node('horizontalRule'),
			p(text('fin')),
		]);
	});

	it('un segment peut donner plusieurs blocs, comme le rendu SPIP', () => {
		expect(parseContent('{{{T}}}\ntexte\n----\nfin')).toEqual([
			node('heading', { level: 2 }, [text('T')]), p(text('texte')), node('horizontalRule'), p(text('fin')),
		]);
	});

	it('un intertitre contenant du gras n\'est pas un intertitre éditable', () => {
		expect(parseContent('{{{a {{b}} c}}}')).toEqual([p(raw('{{{'), text('a '), text('b', [{ type: 'bold' }]), text(' c'), raw('}}}'))]);
	});
});

describe('listes', () => {
	it('imbrication et lignes de continuation', () => {
		expect(parseContent('texte\n-* a\n-** b\nsuite\n-* c')).toEqual([
			p(text('texte')),
			node('bulletList', null, [
				item('a', node('bulletList', null, [node('listItem', null, [p(text('b'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('suite'))])])),
				item('c'),
			]),
		]);
	});

	it('changement de type entre éléments de même profondeur : nouvelle liste', () => {
		expect(parseContent('-* a\n-# b')).toEqual([node('bulletList', null, [item('a')]), node('orderedList', null, [item('b')])]);
	});

	it('en remontant d\'un niveau, la liste existante continue (comme SPIP)', () => {
		expect(parseContent('-* a\n-## b\n-# c')).toEqual([
			node('bulletList', null, [item('a', node('orderedList', null, [item('b')])), item('c')]),
		]);
	});

	it('saut de profondeur ou deux sous-listes dans un élément : bloc brut', () => {
		expect(parseContent('-* a\n-*** b')).toEqual([node('spipRaw', { source: '-* a\n-*** b' })]);
		expect(parseContent('-* a\n-** b\n-## c')).toEqual([node('spipRaw', { source: '-* a\n-** b\n-## c' })]);
	});
});

describe('conteneurs', () => {
	it('<quote>, <poesie>, <div class="text-…">', () => {
		expect(parseContent('<quote>\na\n\nb\n</quote>')).toEqual([node('blockquote', null, [p(text('a')), p(text('b'))])]);
		expect(parseContent('<poesie>\nv1\nv2\n</poesie>')).toEqual([
			node('spipPoesie', { tag: 'poesie' }, [p(text('v1'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('v2'))]),
		]);
		expect(parseContent('<div class="text-justify">\n\na\n\n</div>')).toEqual([node('spipAlign', { align: 'justify' }, [p(text('a'))])]);
	});

	it('autre <div> : bloc brut', () => {
		expect(parseContent('<div class="x">\n\na\n\n</div>')).toEqual([
			p(raw('<div class="x">')), p(text('a')), p(raw('</div>')),
		]);
	});
});

describe('blocs verbatim', () => {
	it('code', () => {
		expect(parseContent('```php\n$a;\n```')).toEqual([node('codeBlock', { language: 'php' }, [text('$a;\n')])]);
		expect(parseContent('<code>\nx\n</code>')).toEqual([node('codeBlock', null, [text('x')])]);
		expect(parseContent('<code class="js">\nx\n</code>')).toEqual([node('codeBlock', { openTag: '<code class="js">' }, [text('x')])]);
		expect(parseContent('<code>x</code>')).toEqual([p(text('x', [{ type: 'code' }]))]);
	});

	it('cadre, html, math', () => {
		expect(parseContent('<cadre>\n{x}\n</cadre>')).toEqual([node('spipCadre', { openTag: '<cadre>', closeTag: '</cadre>' }, [text('\n{x}\n')])]);
		expect(parseContent('<html><b>x</b></html>')).toEqual([node('spipHtml', { openTag: '<html>', closeTag: '</html>' }, [text('<b>x</b>')])]);
		expect(parseContent('<math>$x$</math>')).toEqual([node('spipMath', { openTag: '<math>', closeTag: '</math>' }, [text('$x$')])]);
	});

	it('bloc contenant du code en backticks : brut', () => {
		expect(parseContent('<html>`x`</html>')).toEqual([node('spipRaw', { source: '<html>`x`</html>' })]);
	});
});

describe('tableaux', () => {
	it('en-tête, légende, fusions', () => {
		expect(parseContent('||Légende|Résumé||\n|{{A}}||{{C}}|\n|1|<|3|\n|^|^|4|')).toEqual([
			node('table', { caption: 'Légende', summary: 'Résumé' }, [
				node('tableRow', null, [cell('tableHeader', 'A'), cell('tableHeader', ''), cell('tableHeader', 'C')]),
				node('tableRow', null, [cell('tableCell', '1', 2, 2), cell('tableCell', '3')]),
				node('tableRow', null, [cell('tableCell', '4')]),
			]),
		]);
	});

	it('lignes de longueurs différentes ou fusion incohérente : bloc brut', () => {
		expect(parseContent('|a|b|\n|c|')[0].type).toBe('spipRaw');
		expect(parseContent('|a|b|\n|3|<|\n|^|4|')[0].type).toBe('spipRaw');
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run tests/spip/blocks.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/blocks.js`.

- [ ] **Step 3 : implémenter**

`prive/javascript/tiptap_spip/src/spip/blocks.js` :

```js
import { parseInline } from './inline.js';
import { node, text } from './json.js';
import { FILL, protect, regionsIn } from './protect.js';
import { segment } from './segment.js';

/** Signale une construction que l'éditeur ne sait pas représenter : le segment reste brut. */
class Fallback extends Error {}

/**
 * Analyse un segment (texte entre deux lignes vides) en un ou plusieurs blocs JSON.
 * Ne lève jamais d'exception : en cas d'échec, le segment devient un bloc spipRaw.
 *
 * @param {string} src     source du segment
 * @param {string} msk     même texte masqué
 * @param {import('./protect.js').Region[]} regions  positions relatives au segment
 * @returns {object[]}
 */
export function blocksOf(src, msk, regions) {
	try {
		return verbatimBlock(src, regions) ?? containerBlock(src, msk) ?? tableBlock(src, msk, regions) ?? runBlocks(src, msk, regions);
	} catch {
		return [node('spipRaw', { source: src })];
	}
}

/** Contenu d'un conteneur (<quote>, <poesie>, <div>) : analyse complète, sans attributs techniques. */
export function parseContent(src) {
	const { masked, regions } = protect(src);
	const { segments } = segment(src, masked);
	const out = segments.flatMap((s) =>
		blocksOf(src.slice(s.start, s.end), masked.slice(s.start, s.end), regionsIn(regions, s.start, s.end)));
	return out.length ? out : [node('paragraph')];
}

const textContent = (value) => (value === '' ? undefined : [text(value)]);

function verbatimBlock(src, regions) {
	const r = regions.length === 1 && regions[0].start === 0 && regions[0].end === src.length ? regions[0] : null;
	if (!r) return null;
	if (r.kind === 'backtick' && r.data.ticks.length >= 3) {
		return [node('codeBlock', { language: r.data.language || null }, textContent(r.data.code))];
	}
	if (r.kind !== 'block') return null;
	const { tag, openTag, closeTag, inner, absorbed } = r.data;
	// un bloc qui contenait du code en backticks est rendu autrement par SPIP : on le garde brut
	if (absorbed.includes('backtick')) return [node('spipRaw', { source: src })];
	if (tag === 'code') {
		// <code> sur une seule ligne : code inline dans un paragraphe
		if (!inner.includes('\n')) return null;
		// comme SPIP : un saut de ligne retiré au début et à la fin ; openTag seulement s'il a des attributs
		const code = inner.replace(/^\n/, '').replace(/\n$/, '');
		return [node('codeBlock', openTag.toLowerCase() === '<code>' ? null : { openTag }, textContent(code))];
	}
	const type = { cadre: 'spipCadre', frame: 'spipCadre', html: 'spipHtml', math: 'spipMath' }[tag];
	return [type ? node(type, { openTag, closeTag }, textContent(inner)) : node('spipRaw', { source: src })];
}

function containerBlock(src, msk) {
	let m;
	if ((m = msk.match(/^<quote>([\s\S]*)<\/quote>$/i))) {
		return [node('blockquote', null, parseContent(src.slice(7, 7 + m[1].length)))];
	}
	if ((m = msk.match(/^<(poe(?:sie|try))>([\s\S]*)<\/\1>$/i))) {
		const start = m[1].length + 2;
		const content = parseContent(src.slice(start, start + m[2].length));
		if (content.some((b) => b.type !== 'paragraph')) throw new Fallback();
		return [node('spipPoesie', { tag: m[1] }, content)];
	}
	if ((m = msk.match(/^<div class="text-(left|center|right|justify)">([\s\S]*)<\/div>$/))) {
		const start = m[0].indexOf('>') + 1;
		const content = parseContent(src.slice(start, start + m[2].length));
		if (content.some((b) => b.type === 'spipAlign')) throw new Fallback();
		return [node('spipAlign', { align: m[1] }, content)];
	}
	return null;
}

/** Découpe un segment en lignes : positions [start, end[ sans le \n final. */
function linesOf(msk) {
	const lines = [];
	let pos = 0;
	for (const line of msk.split('\n')) {
		lines.push({ start: pos, end: pos + line.length });
		pos += line.length + 1;
	}
	return lines;
}

/** Contenu inline de src[s, e[ ; refuse une région à cheval sur la limite. */
function inlineOf(src, msk, regions, s, e, options) {
	if (regions.some((r) => r.start < e && r.end > s && (r.start < s || r.end > e))) throw new Fallback();
	return parseInline(src.slice(s, e), msk.slice(s, e), regionsIn(regions, s, e), options);
}

const RE_HR = /^(?:-{4,}|_{4,})[ \t\r]*$/;
const RE_H2 = /^\{\{\{(?!\{)(.*?)\}\}\}[ \t\r]*$/;
const RE_HN = /^<h([3-6])>(.*)<\/h\1>[ \t\r]*$/;
const RE_ITEM = /^-(\*+|#+)(?![*#]) ?/;

function special(line) {
	return RE_HR.test(line) || RE_ITEM.test(line) || heading(line) !== null;
}

function heading(line) {
	let m = line.match(RE_H2);
	if (m && !/\{\{|\}\}/.test(m[1])) return { level: 2, offset: 3, length: m[1].length };
	m = line.match(RE_HN);
	if (m) return { level: Number(m[1]), offset: 4, length: m[2].length };
	return null;
}

/** Blocs d'un segment ordinaire : paragraphes, intertitres, filets, listes. */
function runBlocks(src, msk, regions) {
	const lines = linesOf(msk);
	const L = (k) => msk.slice(lines[k].start, lines[k].end);
	const out = [];
	let k = 0;
	while (k < lines.length) {
		const line = L(k);
		const h = heading(line);
		if (RE_HR.test(line)) {
			out.push(node('horizontalRule'));
			k++;
		} else if (h) {
			const s = lines[k].start + h.offset;
			out.push(node('heading', { level: h.level }, inlineOf(src, msk, regions, s, s + h.length)));
			k++;
		} else if (RE_ITEM.test(line)) {
			let j = k + 1;
			while (j < lines.length && !RE_HR.test(L(j)) && heading(L(j)) === null) j++;
			out.push(...listBlocks(src, msk, regions, lines.slice(k, j), L, k));
			k = j;
		} else {
			let j = k + 1;
			while (j < lines.length && !special(L(j))) j++;
			const content = inlineOf(src, msk, regions, lines[k].start, lines[j - 1].end, { lineStart: true });
			out.push(node('paragraph', null, content.length ? content : undefined));
			k = j;
		}
	}
	return out;
}

/** Listes SPIP : -* puces, -# numéros, profondeur = nombre de * ou #. */
function listBlocks(src, msk, regions, lines, L, first) {
	const items = [];
	lines.forEach((line, n) => {
		const m = L(first + n).match(RE_ITEM);
		if (m) items.push({ depth: m[1].length, type: m[1][0] === '*' ? 'bulletList' : 'orderedList', start: line.start + m[0].length, end: line.end });
		else items[items.length - 1].end = line.end; // ligne de continuation
	});

	const tops = [];
	const stack = [];
	let prevDepth = 0;
	for (const it of items) {
		if (it.depth > stack.length + 1) throw new Fallback();
		stack.length = Math.min(stack.length, it.depth);
		let list = stack[it.depth - 1];
		// comme SPIP : le type ne change qu'entre deux éléments de même profondeur ;
		// en remontant d'un niveau plus profond, la liste existante continue
		if (list && list.type !== it.type && prevDepth === it.depth) {
			if (it.depth > 1) throw new Fallback();
			list = null;
			stack.length = 0;
		}
		if (!list) {
			list = node(it.type, null, []);
			if (it.depth === 1) {
				tops.push(list);
			} else {
				const parent = stack[it.depth - 2].content.at(-1);
				if (parent.content.length > 1) throw new Fallback();
				parent.content.push(list);
			}
			stack[it.depth - 1] = list;
		}
		prevDepth = it.depth;
		const content = inlineOf(src, msk, regions, it.start, it.end);
		list.content.push(node('listItem', null, [node('paragraph', null, content.length ? content : undefined)]));
	}
	return tops;
}

/** Tableaux SPIP : |a|b|, légende ||titre|résumé||, en-tête {{…}}, fusions < et ^. */
function tableBlock(src, msk, regions) {
	const lines = linesOf(msk);
	const L = (k) => msk.slice(lines[k].start, lines[k].end).replace(/[ \t\r]+$/, '');
	if (!lines.every((_, k) => /^\|.*\|$/.test(L(k)))) return null;

	const attrs = {};
	let rowLines = lines.map((_, k) => k);
	const cm = L(0).match(/^\|\|([^|]*)(?:\|([^|]*))?\|\|$/);
	if (cm) {
		if (cm[0].includes(FILL)) throw new Fallback();
		attrs.caption = cm[1];
		if (cm[2] !== undefined) attrs.summary = cm[2];
		rowLines = rowLines.slice(1);
		if (!rowLines.length) throw new Fallback();
	}

	const cellsOf = (k) => {
		const line = L(k);
		const cells = [];
		let start = 1;
		for (let p = 1; p < line.length; p++) {
			if (line[p] === '|') {
				cells.push({ start: lines[k].start + start, end: lines[k].start + p });
				start = p + 1;
			}
		}
		return cells;
	};
	const rows = rowLines.map(cellsOf);
	if (rows.some((r) => r.length !== rows[0].length)) throw new Fallback();

	const trimmed = (c) => {
		const t = msk.slice(c.start, c.end);
		const s = c.start + (t.length - t.trimStart().length);
		const e = c.end - (t.length - t.trimEnd().length);
		return { s, e, t: msk.slice(s, e) };
	};
	const RE_TH = /^\{\{[^{}]+\}\}$/;
	const headerRow = rows[0].every((c) => ['', '<'].includes(trimmed(c).t) || RE_TH.test(trimmed(c).t))
		&& rows[0].some((c) => RE_TH.test(trimmed(c).t));

	const grid = [];
	const tableRows = rows.map((cells, r) => {
		const isHeader = r === 0 && headerRow;
		const row = [];
		const real = [];
		const seenAbove = new Set();
		cells.forEach((c, col) => {
			const { s, e, t } = trimmed(c);
			if (t === '<') {
				const left = row[col - 1];
				if (!left || !real.includes(left)) throw new Fallback();
				left.attrs.colspan++;
				row[col] = left;
			} else if (t === '^') {
				const above = grid[r - 1]?.[col];
				if (!above) throw new Fallback();
				if (!seenAbove.has(above)) above.attrs.rowspan++;
				seenAbove.add(above);
				row[col] = above;
			} else {
				const [is, ie] = isHeader && t !== '' ? [s + 2, e - 2] : [s, e];
				const content = inlineOf(src, msk, regions, is, ie);
				const cell = node(isHeader ? 'tableHeader' : 'tableCell', { colspan: 1, rowspan: 1 },
					[node('paragraph', null, content.length ? content : undefined)]);
				row[col] = cell;
				real.push(cell);
			}
		});
		// une fusion verticale doit couvrir toutes les colonnes de la cellule fusionnée
		seenAbove.forEach((above) => {
			const cols = grid[r - 1].flatMap((x, col) => (x === above ? [col] : []));
			if (!cols.every((col) => row[col] === above)) throw new Fallback();
		});
		grid.push(row);
		return node('tableRow', null, real);
	});
	return [node('table', attrs, tableRows)];
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run tests/spip/blocks.test.js`
Expected : PASS, 14 tests.

- [ ] **Step 5 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/blocks.js prive/javascript/tiptap_spip/tests/spip/blocks.test.js
git commit -m "feat(spip): analyse des blocs (titres, listes, conteneurs, code, tableaux)"
```

---

### Task 6 : parse() et serialize()

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/parse.js`
- Create: `prive/javascript/tiptap_spip/src/spip/serialize.js`
- Create: `prive/javascript/tiptap_spip/src/spip/index.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/serialize.test.js`

**Interfaces:**
- Consumes : `blocksOf` (Task 5), `protect`, `regionsIn`, `canBacktick`, `encodeCode` (Task 2), `segment` (Task 3), `canon`, `node` (Task 1).
- Produces :
  - `parse(source: string): DocNode` — `doc.attrs = { spipLead, spipTrail }` ; premier bloc de chaque segment : `{ spipSep, spipSrc, spipGroup, spipHash }` ; document vide → un paragraphe vide portant `spipSrc: ''`
  - `serialize(doc: DocNode, options?: { conservative?: boolean }): string` — `conservative: false` donne la forme canonique (ignore lead, trail, séparateurs et sources)
  - `serializeBlock(block): string`, `serializeInline(nodes, options?: { lineStart?, html? }): string`, `escapeText(value: string, atLineStart: boolean): string`
  - `index.js` exporte `parse`, `serialize`, `canon`, `stripTech`

- [ ] **Step 1 : écrire le test qui échoue**

`prive/javascript/tiptap_spip/tests/spip/serialize.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { node, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { escapeText, serialize, serializeBlock, serializeInline } from '../../src/spip/serialize.js';

const p = (...content) => node('paragraph', null, content);
const B = { type: 'bold' };
const I = { type: 'italic' };
const C = { type: 'code' };

describe('sérialisation conservatrice', () => {
	const source = '\n\nPremier   {{bloc}}\n\n\n\n-* a\n-** b\n\nfin\n';

	it('restitue la source à l\'identique, blancs compris', () => {
		expect(serialize(parse(source))).toBe(source);
		expect(serialize(parse(''))).toBe('');
		expect(serialize(parse(' \n '))).toBe(' \n ');
	});

	it('ne réécrit que le bloc modifié, en gardant son séparateur', () => {
		const doc = parse(source);
		doc.content[2] = { ...doc.content[2], content: [text('modifié')] };
		expect(serialize(doc)).toBe('\n\nPremier   {{bloc}}\n\n\n\n-* a\n-** b\n\nmodifié\n');
	});

	it('un bloc ajouté par l\'éditeur est séparé par une ligne vide', () => {
		const doc = parse('a');
		doc.content.push(p(text('b')));
		expect(serialize(doc)).toBe('a\n\nb');
	});

	it('un segment de plusieurs blocs n\'est restitué que si tous sont intacts', () => {
		const doc = parse('{{{T}}}\ntexte');
		expect(doc.content[0].attrs).toMatchObject({ spipGroup: 2, spipSrc: '{{{T}}}\ntexte', spipSep: '' });
		doc.content[1] = p(text('autre'));
		expect(serialize(doc)).toBe('{{{T}}}\n\nautre');
	});

	it('document vide modifié', () => {
		const doc = parse('');
		doc.content[0] = { ...doc.content[0], content: [text('x')] };
		expect(serialize(doc)).toBe('x');
	});
});

describe('serializeInline', () => {
	it('gras et italique imbriqués : la mark intérieure en HTML, jamais {{{', () => {
		expect(serializeInline([text('a', [B, I])])).toBe('{{<i>a</i>}}');
		expect(serializeInline([text('a', [I]), text('b', [I, B])])).toBe('{a<strong>b</strong>}');
		expect(serializeInline([text('a', [B]), text('b', [I])])).toBe('{{a}}{b}');
	});

	it('sauts de ligne', () => {
		expect(serializeInline([text('a'), { type: 'hardBreak' }, text('b'), { type: 'hardBreak', attrs: { syntax: 'autobr' } }, text('c')]))
			.toBe('a\n_ b\nc');
	});

	it('code : backticks, doubles backticks ou <code>', () => {
		expect(serializeInline([text('a {b}', [C])])).toBe('`a {b}`');
		expect(serializeInline([text('a`b', [C])])).toBe('``a`b``');
		expect(serializeInline([text(' a ', [C])])).toBe('<code> a </code>');
		expect(serializeInline([text('a\\`b', [C])])).toBe('<code>a\\\\\\`b</code>');
	});
});

describe('escapeText', () => {
	it.each([
		['{a}', '\\{a\\}'],
		['a\\b', 'a\\\\b'],
		['~ et  ', '\\~ et ~'],
		['`x`', '\\`x\\`'],
		['<b> <doc1> <:a:b:> a < b', '&lt;b> &lt;doc1> &lt;:a:b:> a < b'],
		['&eacute; & co', '&amp;eacute; & co'],
		['[?g] [[n]] [x->y] [a|b] [#a<-] [sic]', '[&#63;g] [&#91;n]] &#91;x->y] &#91;a|b] &#91;#a<-] [sic]'],
	])('%j → %j', (input, expected) => {
		expect(escapeText(input, false)).toBe(expected);
	});

	it('début de ligne : - _ | échappés', () => {
		expect(escapeText('- a', true)).toBe('\\- a');
		expect(escapeText('_ a', true)).toBe('\\_ a');
		expect(escapeText('|a|', true)).toBe('\\|a|');
		expect(escapeText('- a', false)).toBe('- a');
	});
});

describe('serializeBlock', () => {
	it('intertitres', () => {
		expect(serializeBlock(node('heading', { level: 2 }, [text('T '), text('i', [I])]))).toBe('{{{T <i>i</i>}}}');
		expect(serializeBlock(node('heading', { level: 4 }, [text('T')]))).toBe('<h4>T</h4>');
	});

	it('listes imbriquées', () => {
		const li = (t, nested) => node('listItem', null, nested ? [p(text(t)), nested] : [p(text(t))]);
		expect(serializeBlock(node('bulletList', null, [li('a', node('orderedList', null, [li('b')])), li('c')])))
			.toBe('-* a\n-## b\n-* c');
	});

	it('code : fence allongé si besoin, <code> si \\\\ ou \\`', () => {
		expect(serializeBlock(node('codeBlock', { language: 'php' }, [text('a```b\n')]))).toBe('````php\na```b\n````');
		expect(serializeBlock(node('codeBlock', null, [text('a\\\\b')]))).toBe('<code>\na\\\\\\b\n</code>');
		expect(parse('<code>\na\\\\\\b\n</code>').content[0].content[0].text).toBe('a\\\\b');
		expect(serializeBlock(node('codeBlock', { openTag: '<code class="js">' }, [text('x')]))).toBe('<code class="js">\nx\n</code>');
	});

	it('tableau avec légende, en-tête et fusions', () => {
		const c = (type, v, colspan = 1, rowspan = 1) => node(type, { colspan, rowspan }, [p(text(v))]);
		const table = node('table', { caption: 'L' }, [
			node('tableRow', null, [c('tableHeader', 'A'), c('tableHeader', 'B')]),
			node('tableRow', null, [c('tableCell', '1', 2, 2)]),
			node('tableRow', null, []),
		]);
		expect(serializeBlock(table)).toBe('||L||\n|{{A}}|{{B}}|\n|1|<|\n|^|^|');
	});

	it('conteneurs', () => {
		expect(serializeBlock(node('blockquote', null, [p(text('a')), p(text('b'))]))).toBe('<quote>\na\n\nb\n</quote>');
		expect(serializeBlock(node('spipAlign', { align: 'center' }, [p(text('a'))]))).toBe('<div class="text-center">\n\na\n\n</div>');
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run tests/spip/serialize.test.js`
Expected : FAIL, `Failed to load url ../../src/spip/parse.js`.

- [ ] **Step 3 : implémenter parse()**

`prive/javascript/tiptap_spip/src/spip/parse.js` :

```js
import { blocksOf } from './blocks.js';
import { canon, node } from './json.js';
import { protect, regionsIn } from './protect.js';
import { segment } from './segment.js';

/**
 * Source SPIP → document JSON Tiptap, avec la carte de segments de la sérialisation
 * conservatrice (spec 04 §4) :
 *   doc.attrs.spipLead / spipTrail : blancs avant le premier et après le dernier bloc ;
 *   1er bloc de chaque segment : spipSep (séparateur exact qui le précède), spipSrc (source
 *   exacte du segment), spipGroup (nombre de blocs JSON issus du segment), spipHash (forme
 *   canonique de ces blocs).
 * Ne lève jamais d'exception.
 *
 * @param {string} source
 * @returns {object} nœud doc
 */
export function parse(source) {
	const { masked, regions } = protect(source);
	const { lead, trail, segments } = segment(source, masked);
	const content = [];
	for (const seg of segments) {
		const src = source.slice(seg.start, seg.end);
		const blocks = blocksOf(src, masked.slice(seg.start, seg.end), regionsIn(regions, seg.start, seg.end));
		blocks[0] = withTech(blocks[0], { spipSep: seg.sep, spipSrc: src, spipGroup: blocks.length, spipHash: canon(blocks) });
		content.push(...blocks);
	}
	if (!content.length) {
		content.push(withTech(node('paragraph'), { spipSep: '', spipSrc: '', spipGroup: 1, spipHash: canon([node('paragraph')]) }));
	}
	return node('doc', { spipLead: lead, spipTrail: trail }, content);
}

const withTech = (block, tech) => ({ ...block, attrs: { ...(block.attrs ?? {}), ...tech } });
```

- [ ] **Step 4 : implémenter serialize()**

`prive/javascript/tiptap_spip/src/spip/serialize.js` :

```js
import { canon } from './json.js';
import { canBacktick, encodeCode } from './protect.js';

/**
 * Document JSON → source SPIP.
 * Sérialisation conservatrice : un segment dont les blocs ont gardé leur forme canonique est
 * restitué à l'identique (spipSep + spipSrc), les autres blocs sont sérialisés.
 *
 * @param {object} doc
 * @param {{ conservative?: boolean }} options  conservative:false donne la forme canonique
 * @returns {string}
 */
export function serialize(doc, { conservative = true } = {}) {
	const blocks = doc.content ?? [];
	let out = conservative ? (doc.attrs?.spipLead ?? '') : '';
	let i = 0;
	while (i < blocks.length) {
		const b = blocks[i];
		const a = b.attrs ?? {};
		if (conservative && a.spipGroup && typeof a.spipSrc === 'string' && canon(blocks.slice(i, i + a.spipGroup)) === a.spipHash) {
			out += a.spipSep + a.spipSrc;
			i += a.spipGroup;
			continue;
		}
		const sep = conservative && typeof a.spipSep === 'string' ? a.spipSep : (i === 0 ? '' : '\n\n');
		out += sep + serializeBlock(b);
		i++;
	}
	return out + (conservative ? (doc.attrs?.spipTrail ?? '') : '');
}

const textOf = (n) => (n.content ?? []).map((c) => c.text ?? '').join('');
const blocks = (content = []) => content.map(serializeBlock).join('\n\n');

export function serializeBlock(b) {
	const a = b.attrs ?? {};
	switch (b.type) {
		case 'paragraph':
			return serializeInline(b.content, { lineStart: true });
		case 'heading':
			return a.level === 2
				? `{{{${serializeInline(b.content, { html: true })}}}}`
				: `<h${a.level}>${serializeInline(b.content)}</h${a.level}>`;
		case 'horizontalRule':
			return '----';
		case 'bulletList':
		case 'orderedList':
			return serializeList(b, 1);
		case 'blockquote':
			return `<quote>\n${blocks(b.content)}\n</quote>`;
		case 'spipPoesie':
			return `<${a.tag ?? 'poesie'}>\n${blocks(b.content)}\n</${a.tag ?? 'poesie'}>`;
		case 'spipAlign':
			return `<div class="text-${a.align}">\n\n${blocks(b.content)}\n\n</div>`;
		case 'codeBlock':
			return serializeCodeBlock(b);
		case 'spipCadre':
		case 'spipHtml':
		case 'spipMath':
			return a.openTag + encodeCode(textOf(b)) + a.closeTag;
		case 'spipRaw':
			return a.source;
		case 'table':
			return serializeTable(b);
		default:
			throw new Error(`serialize: type de bloc inconnu « ${b.type} »`);
	}
}

function serializeCodeBlock(b) {
	const a = b.attrs ?? {};
	const code = textOf(b);
	if (a.openTag || !canBacktick(code)) return `${a.openTag ?? '<code>'}\n${encodeCode(code)}\n</code>`;
	let fence = '```';
	while (code.includes(fence)) fence += '`';
	return `${fence}${a.language ?? ''}\n${code}${fence}`;
}

function serializeList(list, depth) {
	const marker = (list.type === 'bulletList' ? '*' : '#').repeat(depth);
	return list.content.map((item) => {
		const [para, nested] = item.content;
		const line = `-${marker} ${serializeInline(para.content)}`;
		return nested ? `${line}\n${serializeList(nested, depth + 1)}` : line;
	}).join('\n');
}

function serializeTable(table) {
	const a = table.attrs ?? {};
	const lines = [];
	if (a.caption != null || a.summary != null) {
		lines.push(`||${a.caption ?? ''}${a.summary != null ? `|${a.summary}` : ''}||`);
	}
	const occ = [];
	table.content.forEach((row, r) => {
		occ[r] ??= [];
		let c = 0;
		for (const cell of row.content) {
			while (occ[r][c] !== undefined) c++;
			const { colspan = 1, rowspan = 1 } = cell.attrs ?? {};
			for (let dr = 0; dr < rowspan; dr++) {
				occ[r + dr] ??= [];
				for (let dc = 0; dc < colspan; dc++) {
					occ[r + dr][c + dc] = dr > 0 ? '^' : dc > 0 ? '<' : cell;
				}
			}
			c += colspan;
		}
	});
	for (const row of occ) {
		const cells = row.map((x) => {
			if (typeof x === 'string') return x;
			const inline = serializeInline(x.content?.[0]?.content);
			return x.type === 'tableHeader' && inline !== '' ? `{{${inline}}}` : inline;
		});
		lines.push(`|${cells.join('|')}|`);
	}
	return lines.join('\n');
}

const OPEN = { bold: ['{{', '}}'], italic: ['{', '}'], strike: ['<del>', '</del>'], superscript: ['<sup>', '</sup>'], subscript: ['<sub>', '</sub>'] };
const HTML = { bold: ['<strong>', '</strong>'], italic: ['<i>', '</i>'] };

/**
 * Contenu inline → SPIP.
 * Gras et italique imbriqués (ou italique dans un intertitre) : la mark intérieure est écrite en
 * HTML (<strong>, <i>, même rendu) pour ne jamais produire {{{ ou }}}.
 *
 * @param {object[]} nodes
 * @param {{ lineStart?: boolean, html?: boolean }} options
 */
export function serializeInline(nodes = [], { lineStart = false, html = false } = {}) {
	let out = '';
	const stack = [];
	let atLineStart = lineStart;
	const closeTo = (k) => {
		while (stack.length > k) out += stack.pop().close;
	};
	for (const n of nodes) {
		const marks = (n.marks ?? []).filter((m) => m.type !== 'code');
		let k = 0;
		while (k < stack.length && k < marks.length && stack[k].type === marks[k].type) k++;
		closeTo(k);
		for (const m of marks.slice(k)) {
			const useHtml = HTML[m.type] && (html || stack.some((s) => OPEN[s.type][0].startsWith('{')));
			const [open, close] = useHtml ? HTML[m.type] : OPEN[m.type];
			out += open;
			stack.push({ type: m.type, close });
			atLineStart = false;
		}
		if (n.type === 'text') {
			const code = n.marks?.find((m) => m.type === 'code');
			out += code ? serializeCode(n.text) : escapeText(n.text, atLineStart);
			atLineStart = false;
		} else if (n.type === 'hardBreak') {
			const autobr = n.attrs?.syntax === 'autobr';
			out += autobr ? '\n' : '\n_ ';
			atLineStart = autobr;
		} else if (n.type === 'spipRawInline') {
			out += n.attrs.source;
			atLineStart = false;
		} else {
			throw new Error(`serialize: type inline inconnu « ${n.type} »`);
		}
	}
	closeTo(0);
	return out;
}

/**
 * Code inline : backticks par défaut (`` si le code contient un backtick) ; <code> si le code a
 * des blancs aux bords (SPIP les retire entre backticks) ou ne tient pas entre backticks.
 */
function serializeCode(code) {
	const backtick = code === code.trim() && canBacktick(code) && !/^`|`$|``/.test(code);
	if (!backtick) return `<code>${encodeCode(code)}</code>`;
	return code.includes('`') ? `\`\`${code}\`\`` : `\`${code}\``;
}

/** Échappe dans du texte ce que SPIP interpréterait comme un raccourci. */
export function escapeText(value, atLineStart) {
	let s = value
		.replace(/\\/g, '\\\\')
		.replace(/[{}`~]/g, (c) => `\\${c}`)
		.replace(/ /g, '~')
		.replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;')
		.replace(/<(?=[a-z/!:])/gi, '&lt;')
		// notes et glossaire sont traités avant les échappements \[ : on passe par des entités
		.replace(/\[\?/g, '[&#63;')
		.replace(/\[\[/g, '[&#91;')
		.replace(/\[(?=#|$|[^\]]*?(?:->|<-|\|)[^\]]*\])/g, '&#91;');
	if (atLineStart) s = s.replace(/^([-|]|_(?= |_))/, '\\$1');
	return s;
}
```

- [ ] **Step 5 : API publique**

`prive/javascript/tiptap_spip/src/spip/index.js` :

```js
export { parse } from './parse.js';
export { serialize } from './serialize.js';
export { canon, stripTech } from './json.js';
```

- [ ] **Step 6 : vérifier le succès**

Run : `npx vitest run tests/spip/serialize.test.js`
Expected : PASS, 21 tests.

- [ ] **Step 7 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/parse.js prive/javascript/tiptap_spip/src/spip/serialize.js prive/javascript/tiptap_spip/src/spip/index.js prive/javascript/tiptap_spip/tests/spip/serialize.test.js
git commit -m "feat(spip): parse() et serialize() avec sérialisation conservatrice"
```

---

### Task 7 : Corpus et invariants

**Files:**
- Create: `tests/corpus/*.spip` (17 fichiers ci-dessous)
- Test: `prive/javascript/tiptap_spip/tests/spip/invariants.test.js`

**Interfaces:**
- Consumes : `parse`, `serialize`, `canon` (`src/spip/index.js`, Task 6).
- Produces : corpus `tests/corpus/` (réutilisé par Task 8) ; variable d'environnement `TTS_CORPUS` = dossier de corpus local supplémentaire.

Chaque fichier est créé avec `printf` pour maîtriser exactement les blancs et l'absence ou la présence du saut de ligne final (le corpus teste justement ces blancs). Depuis la racine du dépôt :

- [ ] **Step 1 : créer le corpus**

```bash
mkdir -p tests/corpus && cd tests/corpus
printf '%s' $'{{{Présentation}}}\n\nSPIP est un {{système de publication}}[[Voir [la doc->https://www.spip.net].]] pour [?Internet].\n\n<doc12|center>\n\n-* Premier point\n-** Sous-point vers [un article->art42]\n' > base.spip
printf '%s' $'\n  \n' > blancs-seuls.spip
printf '%s' $'\n\n  \nTexte avec\nautobr et\n_ manuel.\n\n\n\nFin   \n\n' > blancs.spip
printf '%s' $'code `a\\`b` et <code>x\\\\y</code>\n\n```\nfn(`t`)\n```\n\n<html>`pas code`</html>\n\na [?g] et [[n]]\n' > code-echappements.spip
printf '%s' $'du `code {x}` et <code>a{b}</code>\n\n```php\n$a = 1;\n```\n\n<code class="js">\nx = 1;\n</code>\n\n<cadre>\n{pas} italique\n</cadre>\n\n<html><b>brut</b></html>\n' > code.spip
printf '%s' $'<quote>\nCitation {un}\n\nDeux\n</quote>\n\n<poesie>\nvers un\nvers deux\n\nstrophe\n</poesie>\n' > conteneurs.spip
printf '%s' $'a \\{ \\\\ et ~nbsp et &lt;b> &eacute; [sic] [x|y]\n- puce\n-- alinéa\n---- filet\n' > echappements.spip
printf '%s' $'<div class="text-center">\n\nP1 {{g}}\n\nP2\n\n</div>\n\n<h3>Sous {i}</h3>\n\n<h4>Plus bas</h4>\n' > html.spip
printf '%s' $'-* a\n-*** trop profond\n\n-* a\n-** b\n-## c\n' > listes-invalides.spip
printf '%s' $'-* a\n-# b\n\n-# a\n-* b\n-* c\n' > listes-types.spip
printf '%s' $'{{a {b}}} et {{ {c} }} et {orphelin et }} et {{}} vide\n\n{a} {{b}} <strong>s</strong> <i>i</i> <del>d</del> <sup>2</sup> <sub>x</sub> <span class="x">sp</span>\n' > marques.spip
printf '%s' $'texte\n-* a\n-* b\nsuite\n-## c\n-# d\n\n{{{T}}}\ntexte apres titre\n----\nfin\n' > melanges.spip
printf '%s' $'<multi>[fr]Bonjour [en]Hello</multi> et <:module:cle:> et [#ancre<-] et <img3|left>\n\n[[Note\n\nsur deux paragraphes]]\n' > reserves.spip
printf '%s' $'|a|b|\n|3|<|\n|^|4|\n' > tableau-fusion-invalide.spip
printf '%s' $'||Légende|Résumé||\n|{{Nom}}||\n|x|y|\n' > tableau-legende.spip
printf '%s' $'|{{A}}|{{B}}|\n|1|2|\n|3|<|\n|^|^|\n|5|6|\n' > tableau.spip
printf '' > vide.spip
cd ../..
```

Contrôle : `ls tests/corpus/*.spip | wc -l` → `17`.

- [ ] **Step 2 : écrire le test des invariants**

`prive/javascript/tiptap_spip/tests/spip/invariants.test.js` :

```js
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canon, parse, serialize } from '../../src/spip/index.js';

// corpus versionné + corpus local optionnel (TTS_CORPUS=/chemin, jamais commité)
const dirs = [fileURLToPath(new URL('../../../../../tests/corpus/', import.meta.url)), process.env.TTS_CORPUS].filter(Boolean);
const files = dirs.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.spip')).map((f) => join(dir, f)));

describe.each(files)('%s', (file) => {
	const source = readFileSync(file, 'utf8');

	it('identité : un texte non modifié est restitué caractère pour caractère', () => {
		expect(serialize(parse(source))).toBe(source);
	});

	it('idempotence de la forme canonique', () => {
		const once = serialize(parse(source), { conservative: false });
		expect(serialize(parse(once), { conservative: false })).toBe(once);
	});

	it('stabilité du JSON : la forme canonique re-parsée redonne le même JSON', () => {
		const doc = parse(source);
		expect(canon(parse(serialize(doc, { conservative: false })).content)).toBe(canon(doc.content));
	});
});
```

- [ ] **Step 3 : lancer toute la suite**

Run : `cd prive/javascript/tiptap_spip && npm test`
Expected : PASS, 123 tests (72 tests de modules + 17 × 3 invariants).

Si un invariant échoue sur un fichier, ne pas modifier le corpus pour le faire passer : corriger le module fautif (le message Vitest montre la chaîne attendue et obtenue).

- [ ] **Step 4 : commit**

```bash
git add tests/corpus/*.spip prive/javascript/tiptap_spip/tests/spip/invariants.test.js
git commit -m "test(spip): corpus et invariants identité, idempotence, stabilité"
```

---

### Task 8 : Équivalence de rendu avec SPIP

**Files:**
- Create: `tests/equivalence/propre.php`
- Create: `prive/javascript/tiptap_spip/scripts/equivalence.mjs`

**Interfaces:**
- Consumes : `parse`, `serialize` (Task 6), corpus (Task 7).
- Produces : `npm run equivalence [dossiers…]` (variable `SPIP_ROOT` obligatoire) — code de sortie 0 si tous les fichiers sont équivalents, 1 sinon, 2 si `SPIP_ROOT` manque ; `normalize(html)` exporté.

Pas de test Vitest ici : le livrable est un outil, vérifié en l'exécutant.

- [ ] **Step 1 : écrire l'oracle**

`tests/equivalence/propre.php` :

```php
<?php

/**
 * Oracle de rendu : lit un texte SPIP sur l'entrée standard et écrit propre($texte).
 * Usage : SPIP_ROOT=/chemin/vers/spip php tests/equivalence/propre.php < texte.spip
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
if ($root === '' || !is_dir($root . '/ecrire')) {
	fwrite(STDERR, "SPIP_ROOT doit désigner la racine d'un site SPIP\n");
	exit(2);
}
chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	// SPIP 4.4+ : le noyau est chargé par composer
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('inc/texte');
echo propre(stream_get_contents(STDIN));
```

Contrôle : `printf '{{a}}\nb' | SPIP_ROOT=/src/spip/v4.4.21 php tests/equivalence/propre.php`
Expected : `<p><strong>a</strong><br class='autobr' />` puis `b</p>`.

- [ ] **Step 2 : écrire le harnais**

`prive/javascript/tiptap_spip/scripts/equivalence.mjs` :

```js
// Équivalence de rendu (spec 04 §5, invariant 3) : propre(source) ≡ propre(forme canonique).
// Usage : SPIP_ROOT=/chemin/vers/spip node scripts/equivalence.mjs [dossier de corpus…]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../src/spip/index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const oracle = join(root, 'tests/equivalence/propre.php');
const dirs = process.argv.length > 2 ? process.argv.slice(2) : [join(root, 'tests/corpus')];

if (!process.env.SPIP_ROOT) {
	console.error('SPIP_ROOT non défini : racine du site SPIP servant d\'oracle');
	process.exit(2);
}

const propre = (text) => execFileSync('php', [oracle], { input: text, encoding: 'utf8' });

/**
 * Normalisation : blancs, identifiants aléatoires des tableaux, et caractères de contrôle
 * invisibles que SPIP laisse parfois dans sa sortie (marqueurs \x01\x15 de la wheel backticks).
 */
export const normalize = (html) => html
	.replace(/ (?:id|headers)='id[0-9a-f]+_c\d+'/g, '')
	.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
	.replace(/\s+/g, ' ')
	.replace(/>\s+/g, '>')
	.replace(/\s+</g, '<')
	.trim();

let total = 0;
let failures = 0;
for (const dir of dirs) {
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.spip')).sort()) {
		total++;
		const source = readFileSync(join(dir, file), 'utf8');
		const canonical = serialize(parse(source), { conservative: false });
		const a = normalize(propre(source));
		const b = normalize(propre(canonical));
		if (a !== b) {
			failures++;
			console.log(`DIFF ${join(dir, file)}\n  source    : ${a}\n  canonique : ${b}\n--- forme canonique ---\n${canonical}\n`);
		}
	}
}
console.log(`${total - failures}/${total} fichiers équivalents`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3 : vérifier le harnais sur le corpus**

Run : `cd prive/javascript/tiptap_spip && SPIP_ROOT=/src/spip/v4.4.21 npm run equivalence`
Expected : `17/17 fichiers équivalents`, code de sortie 0.

- [ ] **Step 4 : vérifier qu'il détecte une divergence**

Introduire une erreur temporaire : dans `src/spip/serialize.js`, remplacer `return '----';` (cas `horizontalRule`) par `return '';`.

Run : `SPIP_ROOT=/src/spip/v4.4.21 npm run equivalence`
Expected : une ligne `DIFF …/melanges.spip`, puis `16/17 fichiers équivalents`, code de sortie 1.

Annuler l'erreur (`git checkout -- src/spip/serialize.js`) et relancer : `17/17 fichiers équivalents`.

- [ ] **Step 5 : commit**

```bash
git add tests/equivalence/propre.php prive/javascript/tiptap_spip/scripts/equivalence.mjs
git commit -m "test(spip): harnais d'équivalence de rendu avec propre()"
```

---

### Task 9 : Corpus réel local

**Files:**
- Create: `tests/corpus/exporter.php`

**Interfaces:**
- Consumes : invariants (Task 7, variable `TTS_CORPUS`), harnais (Task 8, dossiers en argument).
- Produces : un dossier de corpus réel **hors dépôt**, jamais commité.

Les textes d'un site réel sont des données de ses auteurs : l'export n'est lancé **qu'avec l'accord explicite du responsable du site**, vers un dossier hors du dépôt.

- [ ] **Step 1 : écrire l'export**

`tests/corpus/exporter.php` :

```php
<?php

/**
 * Exporte les champs chapo, texte et ps des articles d'un site SPIP, un fichier par champ,
 * vers un dossier local NON versionné (corpus réel : jamais commité).
 * Usage : SPIP_ROOT=/chemin/vers/spip php tests/corpus/exporter.php <dossier> [limite=500]
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$out = $argv[1] ?? '';
$limite = max(1, (int) ($argv[2] ?? 500));
if ($root === '' || $out === '') {
	fwrite(STDERR, "Usage : SPIP_ROOT=… php tests/corpus/exporter.php <dossier> [limite]\n");
	exit(2);
}
if (!is_dir($out) && !mkdir($out, 0777, true)) {
	fwrite(STDERR, "Impossible de créer $out\n");
	exit(1);
}
$out = realpath($out);

chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('base/abstract_sql');

$n = 0;
$articles = sql_allfetsel('id_article, chapo, texte, ps', 'spip_articles', '', '', 'id_article DESC', "0,$limite");
foreach ($articles as $article) {
	foreach (['chapo', 'texte', 'ps'] as $champ) {
		$texte = (string) $article[$champ];
		if (trim($texte) === '') {
			continue;
		}
		file_put_contents("$out/article{$article['id_article']}-$champ.spip", $texte);
		$n++;
	}
}
echo "$n fichiers exportés dans $out\n";
```

Contrôle : `php -l tests/corpus/exporter.php` → `No syntax errors detected`.

- [ ] **Step 2 : commit**

```bash
git add tests/corpus/exporter.php
git commit -m "test(spip): export d'un corpus réel local"
```

- [ ] **Step 3 : demander quel site utiliser**

Demander à l'utilisateur la racine du site SPIP à exporter et confirmer le dossier de sortie (proposition : `/tmp/tts-corpus`). Ne rien lancer sans réponse.

- [ ] **Step 4 : exporter et vérifier**

```bash
SPIP_ROOT=<racine du site> php tests/corpus/exporter.php /tmp/tts-corpus 500
cd prive/javascript/tiptap_spip
TTS_CORPUS=/tmp/tts-corpus npm test
SPIP_ROOT=<racine du site> npm run equivalence -- /tmp/tts-corpus
```

Expected : identité 100 % (critère d'acceptation 1 de la spec 08) ; pour l'équivalence, la liste des `DIFF` éventuels.

- [ ] **Step 5 : traiter les écarts**

Pour chaque `DIFF` : réduire le texte au plus petit extrait qui reproduit l'écart, l'ajouter au corpus versionné sous un nom explicite (`tests/corpus/<cas>.spip`, sans donnée personnelle), corriger le module concerné en TDD (test unitaire d'abord), puis relancer les deux commandes. Un écart qui relève d'une limite assumée est consigné dans `tests/corpus/ecarts.yaml` selon la spec 08 §4. Commit par correction : `fix(spip): <cas>`.

---

## Hors de ce plan (lots suivants)

- Extensions Tiptap (schéma réel, `excludes: ''` sur la mark `code`, `node.check()`, `enableContentCheck`) et calcul de `spipHash` sur le JSON obtenu **après** `setContent` : lot L0/L5.
- Tests de propriétés `fast-check` (spec 08 §2) : à ajouter avec le schéma réel, qui définit les JSON valides à générer.
- Liens, notes, modèles, glossaire, multi : lots L2 à L4 (remplacent les `spipRawInline` correspondants).
