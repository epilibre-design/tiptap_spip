# Liens, ancres et modèles dans le cœur (lot L2.1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le parseur et le sérialiseur reconnaissent les liens `[texte|bulle{lang}->cible]`, les liens sans texte `[->art12]`, les ancres `[#ancre<-]` et les modèles `<doc12|center>`, que le lot L1 gardait bruts, et l'éditeur les affiche sous forme compacte, sans perte et avec un rendu SPIP identique.

**Architecture :** `protect.js` transmet les morceaux des raccourcis (relus dans la source, pas dans le texte masqué) ; `links.js` découpe le texte d'un lien comme `traiter_raccourci_lien_atts()` du core ; `models.js` structure un modèle (nom, id, paramètres ordonnés, source) ; `inline.js` analyse récursivement le texte d'un lien et pose la mark `spipLink` ; le sérialiseur imbrique les marks selon leur étendue. Côté éditeur, une mark et quatre nœuds, sans NodeView (la prévisualisation dépend des services serveur, lot L2.3).

**Tech Stack :** inchangée (Tiptap 3.31.4, Vitest 3.2.4, Playwright 1.61.0, oracle `propre()` de SPIP 4.4.21).

**Découpage du lot L2 :** L2.1 (ce plan) cœur et schéma ; L2.2 formulaire CVT de services (`previsu_modele`, `titre_lien`, `rechercher`, `glossaire`) ; L2.3 interface (prévisualisation des modèles, titres des liens sans texte, popover de lien avec recherche, insertion de modèles). « L2b » reste le lot Hôtes de la feuille de route.

## Global Constraints

- Mêmes contraintes que les lots L1 et L0 : `src/spip/` sans Tiptap ni DOM, `parse()` sans exception (construction non représentable → `spipRawInline`), identité caractère pour caractère d'un texte non modifié, commentaires en français, tabulations, commits sans trailer.
- Comportements du core vérifiés avec `propre()` pendant la préparation (ne pas « corriger ») :
  - dans le texte d'un lien, `\|` n'échappe rien (les liens sont collectés avant les échappements) : `|` s'écrit `&#124;`, `]` `&#93;`, `[` `&#91;`, `->` `-&gt;` ; `\{` y fonctionne ;
  - `{xx}` final du texte d'un lien : langue si `xx` est un code connu de `$GLOBALS['codes_langues']` (197 codes), sinon italique (`[a{zz}->art1]`) ou suite de la bulle (`|b{zz}`) ; `{}` = langue de l'objet, dépend du contexte → brut ;
  - le titre d'un lien est rogné (`trim`) : `[ ->art1]` est un lien sans texte ;
  - `[ancre<-]` et `[#ancre<-]` donnent le même rendu ;
  - les paramètres d'un modèle sont coupés sur chaque `|`, même dans une balise (`inclure_modele()`).
- Imbrication des marks : sans information dans le JSON, un lien qui couvre exactement le même texte qu'une autre mark est écrit à l'extérieur (`{{[a->b]}}` devient `[{{a}}->b]`, rendu `<a><strong>` au lieu de `<strong><a>`, même affichage) ; aucun cas dans les corpus.

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `prive/javascript/tiptap_spip/src/spip/serialize.js` | imbrication des marks par étendue ; liens, ancres, modèles ; échappements du texte de lien |
| `prive/javascript/tiptap_spip/src/spip/regex.js` | + `LANGUES`, `RE_ATTRIBUTS_LIEN`, `RE_MODELE_SEUL` |
| `prive/javascript/tiptap_spip/src/spip/links.js` | `parseLinkAtts()`, `linkAtts()`, `linkEnd()` |
| `prive/javascript/tiptap_spip/src/spip/models.js` | `parseModel()`, `serializeModel()` |
| `prive/javascript/tiptap_spip/src/spip/protect.js` | données des régions lien, ancre, modèle |
| `prive/javascript/tiptap_spip/src/spip/inline.js` | lien (analyse récursive, mark), lien sans texte, ancre, modèle |
| `prive/javascript/tiptap_spip/src/spip/blocks.js` | modèle seul dans son bloc → `spipModelBlock` |
| `prive/javascript/tiptap_spip/src/spip/json.js` | `spipLink` en tête de `MARK_ORDER` |
| `prive/javascript/tiptap_spip/src/editor/extensions.js` | mark `spipLink`, nœuds `spipLinkAuto`, `spipAnchor`, `spipModel`, `spipModelBlock` |
| `css/tiptap_spip.css` | affichage compact |
| `tests/corpus/marks-imbriquees.spip`, `liens.spip`, `modeles.spip` | corpus |

---

### Task 1 : Imbrication des marks selon leur étendue

Le sérialiseur du lot L1 compare la pile des marks ouvertes position par position : une mark rangée avant une mark déjà ouverte la fait fermer et rouvrir. `{a {{b}} c}` devient `{a }{{<i>b</i>}}{ c}`, au rendu différent ; aucun fichier du corpus ne le montrait. Avec les liens (une mark de plus), le défaut couperait un lien en trois. Nouvel algorithme : les marks ouvertes qui continuent restent ouvertes, les autres s'ouvrent de la plus étendue (à partir du nœud courant) à la moins étendue, l'ordre canonique départageant les égalités.

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/spip/serialize.js` (`serializeInline`, import de `MARK_ORDER`, `sameMark`)
- Test: `prive/javascript/tiptap_spip/tests/spip/serialize.test.js`, `tests/corpus/marks-imbriquees.spip`

**Interfaces:**
- Consumes : `MARK_ORDER`, `sameMark` (`json.js`).
- Produces : même signature `serializeInline(nodes, { lineStart, html })`.

- [ ] **Step 1 : test et corpus qui échouent**

Ajouter avant `describe('serializeInline', …)` dans `prive/javascript/tiptap_spip/tests/spip/serialize.test.js` le `describe('imbrication des marks', …)` (texte complet dans le fichier final, Task 2 Step 1), et créer depuis `tests/corpus/` :

```bash
printf '%s' $'Un {texte {{très}} important}.\n\nUn {{texte {plutôt} gras}}.\n\n<del>Barré {{en partie}} seulement</del>, {{gras <del>barré</del> gras}}.\n\n{{<del>Les deux</del> puis gras}}.\n' > marks-imbriquees.spip
```

Run : `npx vitest run tests/spip/serialize.test.js` → FAIL, 3 tests ; `SPIP_ROOT=/src/spip/v4.4.21 npm run equivalence` → `DIFF …/marks-imbriquees.spip`.

- [ ] **Step 2 : implémenter**

Remplacer `serializeInline` par la version du fichier final (Task 2 Step 3), sans les lignes propres aux liens (`delimiters` remplacé par `OPEN[m.type]`, pas de `inLink`) :

```js
	nodes.forEach((n, i) => {
		const marks = marksOf(n);
		// les marks déjà ouvertes qui continuent restent ouvertes (du bas de la pile vers le haut)
		let k = 0;
		while (k < stack.length && marks.some((m) => sameMark(m, stack[k].mark))) k++;
		closeTo(k);
		// les autres s'ouvrent de la plus longue à la plus courte : la plus longue est extérieure
		const toOpen = marks
			.filter((m) => !stack.some((s) => sameMark(s.mark, m)))
			.map((m) => ({ m, run: runLength(i, m) }))
			.sort((a, b) => b.run - a.run || MARK_ORDER.indexOf(a.m.type) - MARK_ORDER.indexOf(b.m.type));
		…
```

- [ ] **Step 3 : vérifier**

Run : `npm test` → PASS ; `npm run equivalence` → `20/21 fichiers équivalents, 1 écart(s) accepté(s)`. Contrôle : sur `main` (ancien sérialiseur), `npm run equivalence -- <dossier contenant marks-imbriquees.spip>` → `DIFF`.

- [ ] **Step 4 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip/serialize.js prive/javascript/tiptap_spip/tests/spip/serialize.test.js tests/corpus/marks-imbriquees.spip
git commit -m "fix(spip): imbrication des marks selon leur étendue"
```

---

### Task 2 : Liens, ancres et modèles dans le cœur

**Files:**
- Create: `prive/javascript/tiptap_spip/src/spip/links.js`, `prive/javascript/tiptap_spip/src/spip/models.js`
- Modify: `prive/javascript/tiptap_spip/src/spip/regex.js`, `protect.js`, `inline.js`, `blocks.js`, `json.js`, `serialize.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/liens.test.js`, `prive/javascript/tiptap_spip/tests/spip/inline.test.js` (test « raccourcis bruts » mis à jour), `tests/corpus/liens.spip`, `tests/corpus/modeles.spip`

**Interfaces:**
- Consumes : `protect`, `parseInline`, `serialize` (L1), Task 1.
- Produces :
  - `parseLinkAtts(part): { text, bulle, hreflang } | null`, `linkAtts(attrs)`, `linkEnd(attrs)`
  - `parseModel(source): { name, id, params: { key, value }[], source } | null`, `serializeModel(model)`
  - JSON : mark `{ type: 'spipLink', attrs: { href, bulle, hreflang, newWindow } }` ; nœuds `spipLinkAuto` (mêmes attrs), `spipAnchor { name }`, `spipModel { model }`, `spipModelBlock { model }`.

- [ ] **Step 1 : tests qui échouent**

`prive/javascript/tiptap_spip/tests/spip/liens.test.js` :

```js
import { describe, expect, it } from 'vitest';
import { node, text } from '../../src/spip/json.js';
import { parseLinkAtts } from '../../src/spip/links.js';
import { parseModel, serializeModel } from '../../src/spip/models.js';
import { parse } from '../../src/spip/parse.js';
import { serialize, serializeInline } from '../../src/spip/serialize.js';

const inline = (source) => parse(source).content[0].content;
const canonical = (source) => serialize(parse(source), { conservative: false });
const link = (href, extra = {}) => ({ type: 'spipLink', attrs: { href, bulle: null, hreflang: null, newWindow: false, ...extra } });
const B = { type: 'bold' };

describe('parseLinkAtts (traiter_raccourci_lien_atts du core)', () => {
	it('texte seul, bulle, langue', () => {
		expect(parseLinkAtts('texte')).toEqual({ text: 'texte', bulle: null, hreflang: null });
		expect(parseLinkAtts('texte|bulle')).toEqual({ text: 'texte', bulle: 'bulle', hreflang: null });
		expect(parseLinkAtts('texte|bulle{en}')).toEqual({ text: 'texte', bulle: 'bulle', hreflang: 'en' });
		expect(parseLinkAtts('texte{en}')).toEqual({ text: 'texte', bulle: null, hreflang: 'en' });
	});

	it('une accolade qui n\'est pas une langue connue reste dans le texte ou la bulle', () => {
		expect(parseLinkAtts('a{zz}')).toEqual({ text: 'a{zz}', bulle: null, hreflang: null });
		expect(parseLinkAtts('a|b{zz}')).toEqual({ text: 'a', bulle: 'b{zz}', hreflang: null });
	});

	it('{} (langue de l\'objet, dépend du contexte) : non représentable', () => {
		expect(parseLinkAtts('a{}')).toBeNull();
	});
});

describe('liens', () => {
	it('lien avec texte : mark spipLink sur le contenu analysé', () => {
		expect(inline('Voir [la {{doc}}->art12].')).toEqual([
			text('Voir '),
			text('la ', [link('art12')]),
			text('doc', [link('art12'), B]),
			text('.'),
		]);
	});

	it('bulle, langue, nouvelle fenêtre', () => {
		expect(inline('[a|b{en}->>https://x.org]')).toEqual([text('a', [link('https://x.org', { bulle: 'b', hreflang: 'en', newWindow: true })])]);
	});

	it('lien sans texte : nœud spipLinkAuto', () => {
		expect(inline('[->art12]')).toEqual([node('spipLinkAuto', { href: 'art12', bulle: null, hreflang: null, newWindow: false })]);
		expect(inline('[|bulle->rub3]')).toEqual([node('spipLinkAuto', { href: 'rub3', bulle: 'bulle', hreflang: null, newWindow: false })]);
	});

	it('entités du texte de lien décodées : | ] ->', () => {
		expect(inline('[a&#124;b&#93;c-&gt;d->art1]')).toEqual([text('a|b]c->d', [link('art1')])]);
	});

	it('lien non représentable : conservé brut', () => {
		expect(inline('[a{}->art1]')).toEqual([node('spipRawInline', { source: '[a{}->art1]' })]);
	});

	it('modèle dans un lien', () => {
		const [model] = inline('[<img3|left>->art12]');
		expect(model.type).toBe('spipModel');
		expect(model.marks).toEqual([link('art12')]);
	});

	it('sérialisation : texte de lien échappé, attributs dans l\'ordre du core', () => {
		expect(serializeInline([text('a|b]c->d[e', [link('art1')])])).toBe('[a&#124;b&#93;c-&gt;d&#91;e->art1]');
		expect(serializeInline([text('a', [link('x', { bulle: 'b', hreflang: 'en', newWindow: true })])])).toBe('[a|b{en}->>x]');
		expect(serializeInline([node('spipLinkAuto', { href: 'art1', bulle: 'b', hreflang: null, newWindow: false })])).toBe('[|b->art1]');
	});

	it('deux liens voisins restent deux liens', () => {
		expect(serializeInline([text('a', [link('art1')]), text('b', [link('art2')])])).toBe('[a->art1][b->art2]');
	});

	it('gras autour d\'une partie du lien, lien autour du gras', () => {
		expect(canonical('[voir {{la}} doc->art1]')).toBe('[voir {{la}} doc->art1]');
		expect(canonical('{{voir [la doc->art1] ici}}')).toBe('{{voir [la doc->art1] ici}}');
	});
});

describe('ancres', () => {
	it('[#ancre<-] et [ancre<-] : nœud spipAnchor, écrit [#ancre<-]', () => {
		expect(inline('[#sec<-]Titre')).toEqual([node('spipAnchor', { name: 'sec' }), text('Titre')]);
		expect(canonical('[sec<-]Titre')).toBe('[#sec<-]Titre');
	});
});

describe('modèles', () => {
	it('parseModel : nom, id, paramètres ordonnés', () => {
		expect(parseModel('<doc12|center|largeur=300>')).toEqual({
			name: 'doc', id: '12',
			params: [{ key: null, value: 'center' }, { key: 'largeur', value: '300' }],
			source: '<doc12|center|largeur=300>',
		});
		expect(parseModel('<span>')).toBeNull();
	});

	it('serializeModel : source conservée tant que le modèle n\'a pas changé', () => {
		const m = parseModel('<doc12 | center />');
		expect(serializeModel(m)).toBe('<doc12 | center />');
		expect(serializeModel({ ...m, params: [{ key: null, value: 'left' }] })).toBe('<doc12|left>');
	});

	it('seul dans son paragraphe : spipModelBlock ; dans une phrase : spipModel', () => {
		expect(parse('<doc12|center>').content[0].type).toBe('spipModelBlock');
		expect(inline('Voir <doc12|center> ici')[1].type).toBe('spipModel');
		expect(canonical('Texte\n\n<doc12|center>\n\nSuite <img3> ici')).toBe('Texte\n\n<doc12|center>\n\nSuite <img3> ici');
	});
});
```

Dans `prive/javascript/tiptap_spip/tests/spip/inline.test.js`, le test « raccourcis non éditables dans ce lot : bruts » devient :

```js
	it('notes, glossaire, multi : bruts jusqu\'aux lots L3 et L4', () => {
		expect(inl('voir [[note]] [?terme] <multi>a</multi>')).toEqual([text('voir '), raw('[[note]]'), text(' '), raw('[?terme]'), text(' '), raw('<multi>a</multi>')]);
	});
```

Fichier de tests complet du sérialiseur (Task 1 comprise) :

`prive/javascript/tiptap_spip/tests/spip/serialize.test.js` :

````js
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
});

describe('imbrication des marks', () => {
	const S = { type: 'strike' };
	const canonical = (source) => serialize(parse(source), { conservative: false });

	it('une mark qui continue reste ouverte, la mark intérieure s\'imbrique', () => {
		expect(serializeInline([text('a ', [I]), text('b', [B, I]), text(' c', [I])])).toBe('{a <strong>b</strong> c}');
		expect(serializeInline([text('a ', [S]), text('b', [B, S]), text(' c', [S])])).toBe('<del>a {{b}} c</del>');
	});

	it('la mark qui s\'étend le plus loin s\'ouvre en premier', () => {
		expect(serializeInline([text('a', [B, S]), text('b', [B])])).toBe('{{<del>a</del>b}}');
		expect(serializeInline([text('a', [B, S]), text('b', [S])])).toBe('<del>{{a}}b</del>');
	});

	it('la source garde sa structure après réécriture', () => {
		expect(canonical('{a {{b}} c}')).toBe('{a <strong>b</strong> c}');
		expect(canonical('{{a {b} c}}')).toBe('{{a <i>b</i> c}}');
		expect(canonical('<del>a {{b}} c</del>')).toBe('<del>a {{b}} c</del>');
		expect(canonical('{{a <del>b</del> c}}')).toBe('{{a <del>b</del> c}}');
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
````

Run : `npx vitest run tests/spip` → FAIL, `Failed to load url ../../src/spip/links.js`.

- [ ] **Step 2 : regex, liens, modèles**

Ajouter à la fin de `prive/javascript/tiptap_spip/src/spip/regex.js` (liste obtenue par `array_keys($GLOBALS['codes_langues'])` après `include_spip('inc/lang_liste')`, 197 codes, tous reconnus par `traduire_nom_langue()`) :

```js
// ecrire/inc/lang_liste.php — clés de $GLOBALS['codes_langues'] : les codes que traduire_nom_langue()
// reconnaît, donc ceux qu'un {xx} de lien transforme en hreflang (sinon c'est un italique)
export const LANGUES = new Set(`
aa ab af am an ar as ast ay az ba be ber_tam ber_tam_tfng bg bh bi bm bn bo br bs ca co cpf
cpf_dom cpf_hat cs cy da de dz el en en_hx en_sm eo es es_co es_mx_pop et eu fa ff fi fj fo fon
fr fr_fem fr_sc fr_lpc fr_lsf fr_spl fr_tu fy ga gd gl gn grc gu ha hac hbo haz he hi hr hu hy
ia id ie ik is it it_fem iu ja jv ka kk kl km kn ko kok ks ku ky la lb ln lo lt lu lv man mfv mg
mi mk ml mn mo mos mr ms mt my na nap ne nqo nl no nb nn oc oc_lnc oc_ni oc_ni_la oc_ni_mis
oc_prv oc_gsc oc_lms oc_auv oc_va om or pa pbb pl prs ps pt pt_br qu rm rn ro roa ru rw sa sc
scn sd sg sh sh_latn sh_cyrl si sk sl sm sn so sq sr src sro ss st su sv sw ta te tg th ti tk tl
tn to tr ts tt tw ty ug uk ur uz vi vo wa wo xh yi yo za zh zh_tw zu
`.trim().split(/\s+/));

// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_ATTRIBUTS : texte|bulle{lang} d'un lien
export const RE_ATTRIBUTS_LIEN = /^((?:[^[]*?(?:\[[^\]]*\])?)*?)([|]([^<>]*?))?([{]([a-z_]*)[}])?$/;

// ecrire/src/Texte/Collecteur/Modeles.php — même regex que RE_MODELE, ancrée sur un raccourci entier
export const RE_MODELE_SEUL = /^<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>$/i;
```

`prive/javascript/tiptap_spip/src/spip/links.js` :

```js
import { LANGUES, RE_ATTRIBUTS_LIEN } from './regex.js';

/**
 * Partie « texte » d'un raccourci de lien [texte|bulle{lang}->cible], découpée comme
 * traiter_raccourci_lien_atts() (plugins-dist/textwheel/inc/lien.php) :
 * - {xx} final : langue si xx est un code connu, sinon reste dans la bulle (ou le texte) ;
 * - {} final : langue de l'objet, qui dépend du contexte : non représentable (null).
 * Le texte n'est pas rogné : SPIP le rogne au rendu, la source garde ses espaces.
 *
 * @param {string} part
 * @returns {{ text: string, bulle: string|null, hreflang: string|null } | null}
 */
export function parseLinkAtts(part) {
	const whole = { text: part, bulle: null, hreflang: null };
	if (!/[|{]/.test(part)) return whole;
	const m = part.match(RE_ATTRIBUTS_LIEN);
	if (!m) return whole;
	const [, text, pipe, bulle, brace, lang] = m;
	if (brace !== undefined) {
		if (lang === '') return null;
		if (!LANGUES.has(lang)) {
			return pipe !== undefined ? { text, bulle: bulle + brace, hreflang: null } : whole;
		}
	}
	return { text, bulle: pipe !== undefined ? bulle : null, hreflang: brace !== undefined ? lang : null };
}

/** Attributs écrits après le texte d'un lien : |bulle{lang} */
export const linkAtts = ({ bulle, hreflang }) => (bulle != null ? `|${bulle}` : '') + (hreflang ? `{${hreflang}}` : '');

/** Fin d'un raccourci de lien : |bulle{lang}->cible] (->> : nouvelle fenêtre) */
export const linkEnd = (attrs) => `${linkAtts(attrs)}->${attrs.newWindow ? '>' : ''}${attrs.href}]`;
```

`prive/javascript/tiptap_spip/src/spip/models.js` :

```js
import { RE_MODELE_SEUL } from './regex.js';

/**
 * Raccourci de modèle → attribut `model` (spec 03 §4) : nom, id, paramètres ordonnés, source.
 * Les paramètres sont coupés sur chaque | comme inclure_modele() (ecrire/public/assembler.php),
 * même à l'intérieur d'une balise.
 *
 * @param {string} source
 * @returns {{ name: string, id: string, params: { key: string|null, value: string }[], source: string } | null}
 *          null si ce n'est pas un modèle (ni id ni paramètres : c'est une balise HTML)
 */
export function parseModel(source) {
	const m = source.match(RE_MODELE_SEUL);
	if (!m || (!m[2] && !m[3])) return null;
	const params = (m[3] ?? '').split('|').slice(1).map((piece) => {
		const kv = piece.match(/^([\w-]+)=([\s\S]*)$/);
		return kv ? { key: kv[1], value: kv[2] } : { key: null, value: piece };
	});
	return { name: m[1], id: m[2], params, source };
}

const sameShape = (a, b) => a && b && a.name === b.name && a.id === b.id && JSON.stringify(a.params) === JSON.stringify(b.params);

/** Source d'origine si le modèle n'a pas changé, sinon forme normalisée <nomID|p|cle=valeur>. */
export function serializeModel(model) {
	if (typeof model.source === 'string' && sameShape(parseModel(model.source), model)) return model.source;
	const params = model.params.map(({ key, value }) => `|${key === null ? value : `${key}=${value}`}`).join('');
	return `<${model.name}${model.id ?? ''}${params}>`;
}
```

- [ ] **Step 3 : protect, inline, blocks, json, serialize**

`prive/javascript/tiptap_spip/src/spip/protect.js` :

````js
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

	// 4. raccourcis : modèles, liens et ancres analysés (inline.js), les autres conservés tels quels
	scan(RE_MODELE, (m, start, end) => {
		// condition du core : un id ou des paramètres, sinon c'est une balise HTML
		if (m[2] || m[3]) add(start, end, 'model', { source: m[0] });
	});
	scan(RE_NOTE, (m, start, end) => add(start, end, 'note', {}));
	// texte et cible relus dans la source : le texte masqué a remplacé les modèles par FILL
	scan(RE_LIEN, (m, start, end) => add(start, end, 'link', {
		part: source.slice(start + 1, start + 1 + m[1].length),
		newWindow: m[3] === '>',
		href: source.slice(end - 1 - m[4].length, end - 1),
	}));
	scan(RE_ANCRE, (m, start, end) => add(start, end, 'anchor', { name: source.slice(end - 3 - m[1].length, end - 3) }));
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
````

`prive/javascript/tiptap_spip/src/spip/inline.js` :

```js
import { mergeText, node, raw, sortMarks, text } from './json.js';
import { parseLinkAtts } from './links.js';
import { parseModel } from './models.js';
import { protect } from './protect.js';

/** Balises HTML sans attribut équivalentes à une mark (même rendu que le raccourci SPIP). */
const MARK_TAGS = { strong: 'bold', i: 'italic', del: 'strike', sup: 'superscript', sub: 'subscript' };
const ENTITIES = { lt: '<', gt: '>', amp: '&', '#91': '[', '#63': '?' };
/** Dans le texte d'un lien, | et ] s'écrivent en entités (le collecteur de liens passe avant les échappements). */
const LINK_ENTITIES = { ...ENTITIES, '#124': '|', '#93': ']' };
const entityRegex = (entities) => new RegExp(`^&(${Object.keys(entities).join('|')});`);
const RE_ENTITY = entityRegex(ENTITIES);
const RE_LINK_ENTITY = entityRegex(LINK_ENTITIES);

/**
 * Analyse le contenu inline d'un bloc.
 *
 * @param {string} source  texte source du contenu
 * @param {string} masked  même texte masqué (cf. protect.js)
 * @param {import('./protect.js').Region[]} regions  régions, positions relatives à source
 * @param {{ lineStart?: boolean, link?: boolean }} options  lineStart : le contenu commence en début
 *        de ligne (paragraphe), donc les marqueurs de début de ligne (`- `, `_ `) s'appliquent ;
 *        link : texte d'un lien (entités &#124; et &#93; décodées)
 * @returns {object[]} nœuds inline JSON
 */
export function parseInline(source, masked, regions, { lineStart = false, link = false } = {}) {
	return buildNodes(tokenize(source, masked, regions, lineStart, link));
}

/** Région d'un raccourci de lien → jeton : lien (contenu analysé), lien sans texte, ou brut. */
function linkToken(region, src) {
	const atts = parseLinkAtts(region.data.part);
	if (!atts) return { t: 'raw', v: src };
	const attrs = { href: region.data.href, bulle: atts.bulle, hreflang: atts.hreflang, newWindow: region.data.newWindow };
	if (atts.text.trim() === '') return { t: 'node', node: node('spipLinkAuto', attrs) };
	const { masked, regions } = protect(atts.text);
	return { t: 'link', mark: { type: 'spipLink', attrs }, children: parseInline(atts.text, masked, regions, { link: true }) };
}

function tokenize(source, masked, regions, lineStart, link) {
	const reEntity = link ? RE_LINK_ENTITY : RE_ENTITY;
	const entities = link ? LINK_ENTITIES : ENTITIES;
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
			} else if (region.kind === 'link') {
				push(linkToken(region, src));
			} else if (region.kind === 'anchor') {
				push({ t: 'node', node: node('spipAnchor', { name: region.data.name }) });
			} else if (region.kind === 'model' && parseModel(src)) {
				push({ t: 'node', node: node('spipModel', { model: parseModel(src) }) });
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
		} else if (c === '&' && (m = rest.match(reEntity))) {
			buf += entities[m[1]];
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
			case 'node':
				nodes.push(withMarks(tk.node));
				break;
			case 'link':
				for (const child of tk.children) {
					nodes.push({ ...child, marks: sortMarks([...marks, tk.mark, ...(child.marks ?? [])]) });
				}
				break;
		}
	}
	return mergeText(nodes);
}
```

`prive/javascript/tiptap_spip/src/spip/blocks.js` :

```js
import { parseInline } from './inline.js';
import { node, text } from './json.js';
import { parseModel } from './models.js';
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
	if (r.kind === 'model' && parseModel(src)) return [node('spipModelBlock', { model: parseModel(src) })];
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

`prive/javascript/tiptap_spip/src/spip/json.js` :

```js
/**
 * Construction et comparaison des nœuds JSON (format editor.getJSON() de Tiptap).
 */

/** Ordre canonique des marks, de la plus externe à la plus interne. */
export const MARK_ORDER = ['spipLink', 'bold', 'italic', 'strike', 'superscript', 'subscript', 'code'];

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

`prive/javascript/tiptap_spip/src/spip/serialize.js` :

````js
import { canon, MARK_ORDER, sameMark } from './json.js';
import { linkEnd } from './links.js';
import { serializeModel } from './models.js';
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

/**
 * Séparateur avant le bloc i. L'éditeur recopie les attributs techniques quand il coupe un bloc
 * ou colle une copie : un spipSep n'est donc repris que s'il reste valide à cette place, c'est-à-
 * dire vide en tête de document, contenant une ligne vide ailleurs.
 */
function separator(i, spipSep) {
	if (i === 0) return '';
	return typeof spipSep === 'string' && /\n[ \t\r]*\n/.test(spipSep) ? spipSep : '\n\n';
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
		case 'spipModelBlock':
			return serializeModel(a.model);
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

/** Délimiteurs d'une mark ; un lien dépend de ses attributs. */
const delimiters = (mark) => (mark.type === 'spipLink' ? ['[', linkEnd(mark.attrs)] : OPEN[mark.type]);
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
	const marksOf = (n) => (n.marks ?? []).filter((m) => m.type !== 'code');
	// longueur de la suite de nœuds portant la mark à partir du nœud i
	const runLength = (i, mark) => {
		let j = i;
		while (j < nodes.length && marksOf(nodes[j]).some((m) => sameMark(m, mark))) j++;
		return j - i;
	};
	nodes.forEach((n, i) => {
		const marks = marksOf(n);
		// les marks déjà ouvertes qui continuent restent ouvertes (du bas de la pile vers le haut)
		let k = 0;
		while (k < stack.length && marks.some((m) => sameMark(m, stack[k].mark))) k++;
		closeTo(k);
		// les autres s'ouvrent de la plus longue à la plus courte : la plus longue est extérieure
		const toOpen = marks
			.filter((m) => !stack.some((s) => sameMark(s.mark, m)))
			.map((m) => ({ m, run: runLength(i, m) }))
			.sort((a, b) => b.run - a.run || MARK_ORDER.indexOf(a.m.type) - MARK_ORDER.indexOf(b.m.type));
		for (const { m } of toOpen) {
			const useHtml = HTML[m.type] && (html || stack.some((s) => delimiters(s.mark)[0].startsWith('{')));
			const [open, close] = useHtml ? HTML[m.type] : delimiters(m);
			out += open;
			stack.push({ mark: m, close });
			atLineStart = false;
		}
		const inLink = stack.some((s) => s.mark.type === 'spipLink');
		if (n.type === 'text') {
			const code = n.marks?.find((m) => m.type === 'code');
			out += code ? serializeCode(n.text) : escapeText(n.text, atLineStart, { link: inLink });
			atLineStart = false;
		} else if (n.type === 'hardBreak') {
			const autobr = n.attrs?.syntax === 'autobr';
			out += autobr ? '\n' : '\n_ ';
			atLineStart = autobr;
		} else if (n.type === 'spipRawInline') {
			out += n.attrs.source;
			atLineStart = false;
		} else if (n.type === 'spipLinkAuto') {
			out += `[${linkEnd(n.attrs)}`;
			atLineStart = false;
		} else if (n.type === 'spipAnchor') {
			out += `[#${n.attrs.name}<-]`;
			atLineStart = false;
		} else if (n.type === 'spipModel') {
			out += serializeModel(n.attrs.model);
			atLineStart = false;
		} else {
			throw new Error(`serialize: type inline inconnu « ${n.type} »`);
		}
	});
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

/**
 * Échappe dans du texte ce que SPIP interpréterait comme un raccourci.
 * Dans le texte d'un lien, le collecteur de liens passe avant les échappements : [ ] | et ->
 * s'écrivent en entités.
 */
export function escapeText(value, atLineStart, { link = false } = {}) {
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
	if (link) {
		s = s.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/\|/g, '&#124;').replace(/->/g, '-&gt;');
	}
	if (atLineStart) s = s.replace(/^([-|]|_(?= |_))/, '\\$1');
	return s;
}
````

- [ ] **Step 4 : vérifier**

Run : `npx vitest run tests/spip` → PASS.

- [ ] **Step 5 : corpus et équivalence**

Depuis `tests/corpus/` :

```bash
printf '%s' $'Voir [l\'article->art12], [la rubrique|Bulle d\'aide->rub3] et [le site{en}->https://www.spip.net].\n\nLien en {{gras}} : [voir {{la}} doc->art1], {{gras [autour->art2] du lien}}, [{{tout en gras}}->art3].\n\nSans texte : [->art12], [|avec une bulle->rub3], [->>https://example.org].\n\nCaractères : [a&#124;b&#93;c-&gt;d->art1], [a{zz}->art1], [texte|bulle{zz}->art1], [un \\{échappé\\}->art1].\n\nAncres [#haut<-] et [bas<-], lien [vers le haut->#haut], [->art1#section].\n\nNon représentable : [a{}->art1].\n' > liens.spip
printf '%s' $'<doc12|center>\n\nUn texte avec <img3|left> au milieu et <doc4 | right /> ici.\n\n<emb5|largeur=300|legende=Une <i>légende</i>>\n\n[<img3|left>->art12]\n\n{{Gras <doc6>}} et <span>pas un modèle</span>.\n\n-* <doc7|left> dans une liste\n\n|<doc8>|cellule|\n' > modeles.spip
```

Run : `SPIP_ROOT=/src/spip/v4.4.21 npm run equivalence` → `22/23 fichiers équivalents, 1 écart(s) accepté(s)` ; avec le corpus de démo (51 liens, 44 modèles) : `47/48`, l'écart déjà accepté. La forme canonique réécrit bien (`[bas<-]` → `[#bas<-]`, `[a{zz}->art1]` reste lien + italique).

Les tests de l'éditeur (`tests/editor/roundtrip.test.js`) échouent tant que le schéma ne connaît pas les nouveaux nœuds (Task 3) : c'est attendu.

- [ ] **Step 6 : commit**

```bash
git add prive/javascript/tiptap_spip/src/spip prive/javascript/tiptap_spip/tests/spip tests/corpus/liens.spip tests/corpus/modeles.spip
git commit -m "feat(spip): liens, liens sans texte, ancres et modèles"
```

---

### Task 3 : Schéma de l'éditeur et affichage compact

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/editor/extensions.js`, `css/tiptap_spip.css`
- Test: `prive/javascript/tiptap_spip/tests/editor/roundtrip.test.js`
- Regenerate: `prive/javascript/tiptap_spip.js`, `.min.js`

**Interfaces:**
- Consumes : JSON de la Task 2.
- Produces : mark `spipLink` (`inclusive: false`, rendue `<a class="tts-link" data-tts-href>` sans `href`, pour qu'un clic ne navigue pas) ; nœuds atomes `spipLinkAuto` (`<a data-tts-auto>`, priorité de lecture 60 : sinon la règle de la mark le capte au collage), `spipAnchor`, `spipModel`, `spipModelBlock` (attribut `model` transporté en JSON dans `data-tts-model`).

Pas d'`@tiptap/extension-link` : sa validation d'URL refuse les cibles SPIP (`art12`).

- [ ] **Step 1 : tests qui échouent**

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
import { canon, parse, serialize } from '../../src/spip/index.js';

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

describe('liens, ancres et modèles dans l\'éditeur', () => {
	const source = 'Voir [la {{doc}}|bulle{en}->>art12], [->rub3] et [#ici<-] avec <img3|left>.\n\n<doc12|center>';

	it('le HTML de l\'éditeur se relit à l\'identique (copier-coller interne)', () => {
		const ed = mount(source);
		const json = ed.getJSON();
		ed.commands.setContent(ed.getHTML());
		expect(canon(ed.getJSON())).toBe(canon(json));
	});

	it('changer la cible d\'un lien ne réécrit que son paragraphe', () => {
		const ed = mount(`${source}\n\n\nFin  intacte.`);
		ed.chain().setTextSelection(6).extendMarkRange('spipLink').updateAttributes('spipLink', { href: 'art13' }).run();
		expect(serialize(ed.getJSON())).toBe('Voir [la {{doc}}|bulle{en}->>art13], [->rub3] et [#ici<-] avec <img3|left>.\n\n<doc12|center>\n\n\nFin  intacte.');
	});
});
```

Run : `npx vitest run tests/editor/roundtrip.test.js` → FAIL (`base.spip`, `modele-formulaire.spip`, `reserves.spip`, `liens.spip`, `modeles.spip` : nœuds inconnus du schéma).

- [ ] **Step 2 : implémenter**

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
		SpipLinkAuto,
		SpipAnchor,
		SpipModel,
		SpipModelBlock,
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
	];
}
````

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
```

- [ ] **Step 3 : vérifier**

Run : `npm test` → PASS, 243 tests ; `TTS_CORPUS=<corpus de démo> npx vitest run tests/editor/roundtrip.test.js` → PASS. Le test « copier-coller interne » a détecté pendant la préparation un lien sans texte relu comme texte marqué : c'est la raison de la priorité 60.

- [ ] **Step 4 : bundle et commit**

Run : `npm run build` (≈ 872 ko, 418 ko minifié).

```bash
git add prive/javascript/tiptap_spip/src/editor/extensions.js prive/javascript/tiptap_spip/tests/editor/roundtrip.test.js css/tiptap_spip.css prive/javascript/tiptap_spip.js prive/javascript/tiptap_spip.min.js
git commit -m "feat(editor): liens, ancres et modèles dans le schéma, affichage compact"
```

---

### Task 4 : Bout en bout et specs

**Files:**
- Modify: `prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` (corpus testé : + `liens.spip`, `modeles.spip`)
- Modify: `docs/specs/03-schema-json.md`, `04-parseur-serialiseur.md`, `05-extensions-spip.md`, `09-lots-roadmap.md`

- [ ] **Step 1 : bout en bout**

Dans `prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` : `for (const fichier of ['base.spip', 'melanges.spip', 'blancs.spip', 'liens.spip', 'modeles.spip'])`.

Site jetable neuf relié au dépôt, serveur sur un port libre (cf. plan L0, Task 7), puis :
Run : `TTS_SITE=… TTS_URL=http://127.0.0.1:18931 npm run e2e` → `7 passed`.

- [ ] **Step 2 : specs**

- 03 §3 : `spipLink` est une mark propre (pas `@tiptap/extension-link`, dont la validation refuse `art12`), `inclusive: false`, en tête de l'ordre des marks ; `spipAnchor` n'a que `name` (`[ancre<-]` s'écrit `[#ancre<-]`, même rendu) ; les quatre nœuds sont affichés en compact jusqu'au lot L2.3.
- 04 : nouvelle section « Imbrication des marks » (algorithme de la Task 1, égalité → ordre canonique, lien à l'extérieur) ; règles d'échappement du texte de lien (`&#124;`, `&#93;`, `&#91;`, `-&gt;`, `\{` fonctionne) ; `{}` → brut ; code de langue inconnu → italique ou bulle, comme le core.
- 05 §3 et §4 : modèles et liens reconnus dans le cœur (L2.1), prévisualisation, titres, popover et insertion aux lots L2.2 / L2.3 ; autolien non activé.
- 09 : le lot L2 est découpé en L2.1 (fait), L2.2, L2.3 ; L2.1 a corrigé l'imbrication des marks du lot L1.

- [ ] **Step 3 : commit**

```bash
git add prive/javascript/tiptap_spip/tests/e2e/article.e2e.js docs/specs
git commit -m "test(e2e), docs: liens et modèles de bout en bout, specs du lot L2.1"
```
