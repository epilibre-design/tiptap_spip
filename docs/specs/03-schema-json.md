# 03 — Schéma et représentation JSON

## 1. Principe directeur

> **Le schéma ProseMirror n'autorise que ce que la syntaxe SPIP sait exprimer.**

Tout document valide pour le schéma doit être sérialisable en SPIP sans perte ni ambiguïté.
On restreint donc les contenus (`content`, `marks`) au lieu de corriger après coup.
Exemples : un élément de liste ne contient qu'un paragraphe (SPIP coupe les listes sur une ligne vide),
une cellule de tableau ne contient que de l'inline, un intertitre n'accepte pas le gras.

Une construction **du core** qui ne rentre pas dans le schéma (mal formée, ou HTML non représentable) n'est
**jamais perdue** : elle est conservée dans un nœud brut (`spipRaw` / `spipRawInline`), affichée comme du code
et restituée telle quelle. Les raccourcis de plugins tiers sont hors configuration de référence
([01](01-contexte-objectifs.md) §3).

Le format JSON est le format standard de Tiptap (`editor.getJSON()`) :
`{ type, attrs?, content?, marks?, text? }`.

Pas de StarterKit : les extensions sont déclarées une à une, les marks dans l'ordre canonique du parseur
(`bold`, `italic`, `strike`, `superscript`, `subscript`, `code`). Le schéma range les marks d'un texte dans
l'ordre de déclaration ; un autre ordre ferait diverger `getJSON()` de l'empreinte d'un bloc intact.

## 2. Extensions standard retenues (déclarées une à une)

| Extension | Statut | Raccourci SPIP |
|-----------|--------|----------------|
| `document`, `text` | gardé | — |
| `paragraph` | gardé | bloc séparé par ligne vide |
| `hardBreak` | gardé, attr `syntax` (`autobr` \| `manual`) | retour à la ligne simple (`autobr`, rendu `<br class='autobr' />` par SPIP 3+) ou `\n_ ` (`manual`, valeur des sauts saisis dans l'éditeur) |
| `heading` | gardé, niveaux 2 à 6 | `{{{…}}}` (niveau 2), `<h3>`…`<h6>` (cf. §3) |
| `bold` | gardé | `{{…}}` |
| `italic` | gardé | `{…}` |
| `strike` | gardé | `<del>…</del>` |
| `code` | gardé, sans attribut, **combinable avec les autres marks** (configurer `excludes: ''`, Tiptap l'exclut par défaut) | `` `…` `` ou `<code>…</code>` inline (même rendu) |
| `codeBlock` | gardé, attrs `language`, `openTag` (seulement pour un `<code …>` avec attributs) | ```` ```langage … ``` ```` ou `<code>` multiligne (même rendu) ; `<cadre>` → `spipCadre` |
| `blockquote` | gardé | `<quote>…</quote>` |
| `bulletList`, `orderedList`, `listItem` | gardés, contenu restreint ; `orderedList` sans attributs `start`/`type` ni règle de saisie (SPIP ne les connaît pas) | `-*`, `-#` |
| `horizontalRule` | gardé | `----` |
| `link` | **remplacé** par `spipLink` | `[…->…]` |
| `underline` | **désactivé** | pas de raccourci SPIP (`<u>` déconseillé) |
| `listKeymap`, `dropcursor`, `gapcursor`, `undoRedo` | gardés | — |
| `trailingNode` | **retiré** : il ajoute un paragraphe vide en fin de document, donc modifie la source d'un texte intact ; `gapcursor` permet d'écrire après un tableau ou un bloc de code final | — |
| `subscript`, `superscript` | ajoutés | `<sub>`, `<sup>` |
| `table`, `tableRow`, `tableHeader`, `tableCell` (`TableKit`) | ajoutés, contenu restreint | `|…|` |

## 3. Nœuds et marques SPIP

### Blocs

| Type | Attributs | Contenu | Source SPIP |
|------|-----------|---------|-------------|
| `heading` | `level` (2–6) | `inline*`, marks sauf `bold` | `{{{Titre}}}` (2), `<h3>Titre</h3>` … `<h6>` |
| `spipAlign` | `align` : `left` \| `center` \| `right` \| `justify` | `block+` (sans `spipAlign` imbriqué) | `<div class="text-center">…</div>` |
| `bulletList` / `orderedList` | — | `listItem+` | `-* a` / `-# a` |
| `listItem` | — | `paragraph (bulletList \| orderedList)?` | profondeur = nb de `*`/`#` |
| `table` | `caption`, `summary` | `tableRow+` | `\|\|légende\|résumé\|\|` en 1re ligne |
| `tableHeader` / `tableCell` | `colspan`, `rowspan`, `colwidth` (ignoré) | `paragraph` unique, inline seulement | `\|{{titre}}\|` / `\|<\|` / `\|^\|` |
| `spipPoesie` | — | `paragraph+` (sauts de ligne significatifs) | `<poesie>…</poesie>` |
| `spipCadre` | `kind` (`cadre`\|`frame`), `attrs` (chaîne) | `text*`, pas de marks, `code: true` | `<cadre>…</cadre>` |
| `codeBlock` | `language`, `openTag` | `text*` | ```` ```php ```` ou `<code class="php">\n…\n</code>` sur bloc |
| `spipHtml` | — | `text*`, `code: true` | `<html>…</html>` en bloc |
| `spipMath` | — | `text*`, `code: true` | `<math>…</math>` |
| `spipMultiBlock` | — | `spipLangBlock+` | `<multi>` entourant des blocs |
| `spipLangBlock` | `lang` | `block+` | `[fr]` en tête de bloc dans un multi |
| `spipModelBlock` | `model` (cf. §4) | atome | modèle seul sur son paragraphe |
| `spipRaw` | `source` | atome | tout bloc non reconnu |

**Intertitres** : SPIP natif ne connaît que `{{{…}}}` (→ `h2`). Les niveaux 3 à 6 sont écrits **en HTML**
(`<h3>…</h3>` à `<h6>…</h6>`), que SPIP laisse passer tel quel et dont le contenu reçoit quand même les
raccourcis inline. Le niveau 1 n'est pas proposé (réservé au titre de la page). Les niveaux disponibles
sont configurables (défaut : 2 à 4).

**Alignements** : pas de raccourci SPIP ; on écrit un `<div>` avec une classe dédiée (cf.
[05](05-extensions-spip.md) §8). On reprend les classes déjà définies par la dist (`squelettes-dist/css/typo.css`) et par
Bootstrap : `text-left`, `text-center`, `text-right`, `text-justify`.

### Inline

| Type | Nature | Attributs | Source SPIP |
|------|--------|-----------|-------------|
| `spipLink` | mark | `href` (cible brute : `art12`, `https://…`, `#ancre`, `mailto:`), `bulle`, `hreflang`, `newWindow` (`->>`) | `[texte\|bulle{fr}->art12]` (texte non vide) |
| `spipLinkAuto` | nœud inline atome | mêmes attributs que `spipLink` | `[->art12]`, `[\|bulle->art12]` : lien sans texte, titre calculé par SPIP |
| `spipGlossary` | mark | `glossaire` (null = défaut), `numero`, `bulle`, `hreflang` | `[?terme#glossaireN\|bulle{lang}]` |
| `spipAbbr` | mark | `title`, `lang` | `[ABBR\|explication{fr}]` |
| `spipInlineHtml` | mark | `tag` (`small`, `sc`, `span`, `ins`, `q`…), `attrs` (chaîne brute) | `<small>…</small>` et HTML inline toléré |
| `spipNote` | nœud inline atome | `name` (null = auto, `""` = sans appel), `content` (JSON, cf. §5) | `[[…]]`, `[[<nom>…]]`, `[[<>…]]` |
| `spipModel` | nœud inline atome | `model` (cf. §4) | `<doc12\|left>` dans une phrase |
| `spipAnchor` | nœud inline atome | `name` | `[#ancre<-]` |
| `spipMultiInline` | nœud inline | — | contenu `spipLangInline+` → `<multi>[fr]a[en]b</multi>` |
| `spipLangInline` | nœud inline | `lang` | `inline*` |
| `spipIdiome` | nœud inline atome | `module`, `cle` | `<:module:cle:>` |
| `spipNbsp` | (texte) | — | `~` restitué comme U+00A0 dans le texte, re-sérialisé en `~` |
| `spipRawInline` | nœud inline atome | `source` | fragment inline non reconnu (HTML exotique, raccourci cassé) |

Remarques :

- `spipLink` est **exclusif** avec lui-même et avec `spipGlossary` (pas de lien dans un lien).
- Un lien sans texte n'a rien à porter une mark : c'est un **nœud** `spipLinkAuto`, affiché avec le titre
  résolu par le serveur (décoration, jamais stocké). Saisir un texte dans le popover le convertit en texte
  marqué `spipLink` ; vider le texte d'un lien le reconvertit en `spipLinkAuto`.
- `spipGlossary` ne s'applique qu'à du texte sans autre mark (la regex SPIP interdit `[]<>` dans le terme).
- Un `spipModel` peut porter la mark `spipLink` (cas `[<img3>->art12]`).
- Le texte des nœuds `code: true` n'est pas interprété : aucune règle inline n'y est appliquée.

## 4. Attribut `model` (modèles)

Repris de l'attribut `spip_model` de markdown_editor, en ajoutant l'ordre et la forme brute des paramètres
pour une restitution fidèle :

```json
{
  "name": "doc",
  "id": "12",
  "params": [
    { "key": null,    "value": "center" },
    { "key": "largeur", "value": "300" }
  ],
  "source": "<doc12|center|largeur=300>"
}
```

- `params` : liste **ordonnée** ; `key: null` pour un paramètre positionnel (`|center`).
- `source` : raccourci d'origine. Si `name/id/params` n'ont pas changé, on ressort `source` à l'identique
  (espaces, `/>`, casse conservés).
- Les valeurs peuvent contenir des balises (`|legende=<i>x</i>`), comme le permet la regex du core.

## 5. Attribut `content` des notes

Le texte d'une note peut contenir des raccourcis (gras, liens, modèles, glossaire…). On le stocke sous
forme de **fragment JSON** (contenu d'un mini-document), édité dans un sous-éditeur :

```json
{
  "type": "spipNote",
  "attrs": {
    "name": null,
    "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "Voir " },
        { "type": "text", "text": "la doc", "marks": [{ "type": "spipLink", "attrs": { "href": "https://www.spip.net" } }] },
        { "type": "text", "text": "." }
      ]}
    ]
  }
}
```

Contenu autorisé dans une note : `paragraph+` (les paragraphes deviennent des lignes vides dans `[[…]]`),
listes, marks inline ; **pas de note dans une note**.

La **numérotation** n'est pas stockée : elle est recalculée à l'affichage (notes auto numérotées dans
l'ordre du document, notes nommées affichant leur nom, `[[<>…]]` sans appel visible).

## 6. Exemple complet

Source SPIP :

```
{{{Présentation}}}

SPIP est un {{système de publication}}[[Voir [la doc->https://www.spip.net].]] pour [?Internet].

<doc12|center>

-* Premier point
-** Sous-point vers [un article->art42]
```

JSON :

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Présentation" }] },
    { "type": "paragraph", "content": [
      { "type": "text", "text": "SPIP est un " },
      { "type": "text", "text": "système de publication", "marks": [{ "type": "bold" }] },
      { "type": "spipNote", "attrs": { "name": null, "content": [
        { "type": "paragraph", "content": [
          { "type": "text", "text": "Voir " },
          { "type": "text", "text": "la doc", "marks": [{ "type": "spipLink", "attrs": { "href": "https://www.spip.net", "bulle": null, "hreflang": null, "newWindow": false } }] },
          { "type": "text", "text": "." }
        ]}
      ]}},
      { "type": "text", "text": " pour " },
      { "type": "text", "text": "Internet", "marks": [{ "type": "spipGlossary", "attrs": { "glossaire": null, "numero": null, "bulle": null, "hreflang": null } }] },
      { "type": "text", "text": "." }
    ]},
    { "type": "spipModelBlock", "attrs": { "model": {
      "name": "doc", "id": "12", "params": [{ "key": null, "value": "center" }], "source": "<doc12|center>" } } },
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Premier point" }] },
        { "type": "bulletList", "content": [
          { "type": "listItem", "content": [
            { "type": "paragraph", "content": [
              { "type": "text", "text": "Sous-point vers " },
              { "type": "text", "text": "un article", "marks": [{ "type": "spipLink", "attrs": { "href": "art42", "bulle": null, "hreflang": null, "newWindow": false } }] }
            ]}
          ]}
        ]}
      ]}
    ]}
  ]
}
```

## 7. Rendu HTML dans l'éditeur

Le `renderHTML` de chaque nœud produit un HTML proche du rendu public (`class="spip"`, `h2.spip`,
`ul.spip`, `table.spip`…) pour que la feuille `css/tiptap_spip_contenu.css` — surchargeable par le
squelette via `find_in_path` — donne un aperçu fidèle dans l'espace privé ; dans le site public, ce sont
les styles du site qui s'appliquent ([02](02-architecture.md) §6). Les éléments propres à l'édition portent des
classes préfixées `tts-` (`tts-note`, `tts-model`, `tts-raw`…) et des attributs `data-spip-*` qui
permettent le copier-coller interne (cf. [04](04-parseur-serialiseur.md) §6).
