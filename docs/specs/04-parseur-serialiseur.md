# 04 — Parseur et sérialiseur SPIP

## 1. Pourquoi pas markdown-it

markdown_editor passe par `tiptap-markdown` : markdown-it découpe le texte en tokens, rendus en HTML, que
Tiptap re-parse avec `parseHTML`. Pour SPIP cette chaîne ne convient pas :

- la grammaire SPIP n'est pas CommonMark : `{…}` italique, `-*` listes, `|…|` tableaux, `_ ` sauts de ligne,
  un simple retour à la ligne n'est pas significatif, `[…]` sert à cinq raccourcis différents ;
- passer par le HTML perd l'information de forme (paramètres de modèles, nom de note, cible brute `art12`) ;
- TextWheel applique des règles **ordonnées par priorité** sur la chaîne entière ; il faut reproduire cet
  ordre pour obtenir le même découpage.

On écrit donc un parseur dédié **chaîne → JSON** et un sérialiseur **JSON → chaîne**, sans DOM,
dans `src/spip/` (cf. [02](02-architecture.md) §3). Les regex sont recopiées du core SPIP 4.4
dans `src/spip/regex.js` (source unique, avec référence au fichier PHP d'origine) :

| Constante JS | Origine PHP |
|--------------|-------------|
| `RE_MODELE` | `ecrire/src/Texte/Collecteur/Modeles.php` |
| `RE_LIEN` | `ecrire/src/Texte/Collecteur/Liens.php` (`_RACCOURCI_LIEN`) |
| `RE_LIEN_ATTRIBUTS` | `textwheel/inc/lien.php` (`_RACCOURCI_ATTRIBUTS`) |
| `RE_NOTE` | `textwheel/inc/notes.php` (`_NOTES_RACCOURCI`) |
| `RE_GLOSSAIRE`, `RE_GLOSES` | `textwheel/inc/lien.php` |
| `RE_ANCRE` | `textwheel/inc/lien.php` (`_RACCOURCI_ANCRE`) |
| `RE_MULTI`, `RE_MULTI_LANG` | `ecrire/src/Texte/Collecteur/Multis.php` |
| `RE_IDIOME` | `ecrire/src/Texte/Collecteur/Idiomes.php` |
| `RE_PROTEGE_BLOCS` | `ecrire/inc/texte_mini.php` (`_PROTEGE_BLOCS`) |
| `RE_BACKTICKS_*` | `textwheel/wheels/spip/backticks.json` / `backticks.php` |
| `RE_ABBR`, listes, tableaux, intertitres | `textwheel/wheels/spip/*.json` (le format YAML des wheels est obsolète) |

## 2. Parseur : étapes

Le parseur suit l'ordre de TextWheel. Chaque étape est une **règle enregistrée** dans un registre
(`src/spip/registry.js`) avec une priorité, ce qui permet aux extensions tierces d'en insérer
([07](07-extensibilite.md)).

1. **Normalisation** : `\r\n?` → `\n` ; lignes ne contenant que des blancs → vides. Ces normalisations ne
   servent qu'à l'analyse : la carte de segments (§4) garde la source exacte.
2. **Protection** (priorité la plus basse) — remplacer par des jetons opaques `\u0001N\u0001` :
   - wheel backticks, **avant tout** (`pre_echappe_html_propre`), sur tout le texte, y compris dans `<code>`
     ou `<html>` : d'abord les échappements `\\` et `` \` ``, puis ```` ``` ```` (bloc, 1re ligne = langage
     éventuel), ``` `` ``` puis `` ` `` (inline). Dans du code en backticks, SPIP **perd** `\\` et `` \` `` ;
     dans `<code>`, `<cadre>`, `<html>`, il les décode en `\` et `` ` `` ;
   - blocs `<html>`, `<code>`, `<cadre>`/`<frame>`, `<math>`, `<script>`/`<style>` (`RE_PROTEGE_BLOCS`) ;
   - échappements `\{ \} \_ \- \[ \] \| \< \> \* \# \+ \~` ;
   - modèles (`RE_MODELE`, avec la condition du core : il faut un id **ou** des paramètres commençant
     par `|`, sinon c'est une balise HTML) ;
   - `<multi>…</multi>`, idiomes `<:…:>`.
3. **Découpage en blocs** sur les lignes vides, en reconnaissant :
   - tableau : suite de lignes commençant et finissant par `|` ;
   - liste : lignes commençant par `-*`/`-#` (profondeur = nombre de caractères, type = `*` ou `#`) ;
   - `----` / `____` → `horizontalRule` ;
   - `{{{…}}}` occupant tout le bloc → `heading` niveau 2 ; `<h3>…</h3>` à `<h6>…</h6>` seuls dans le bloc →
     `heading` 3 à 6 (contenu parsé en inline) ;
   - `<div class="text-…">` … `</div>` (classes configurées, aucun autre attribut) → `spipAlign`, contenu parsé
     récursivement ; tout autre `<div>` → `spipRaw` ;
   - `<quote>`, `<poesie>` (blocs conteneurs, parsés récursivement) ;
   - bloc ne contenant qu'un jeton de modèle → `spipModelBlock` ;
   - bloc ne contenant qu'un jeton `<multi>` dont les parties contiennent des lignes vides → `spipMultiBlock`
     (parties faites de paragraphes seulement, sinon brut ; lot L4.1) ;
   - sinon `paragraph`.
4. **Inline** dans chaque bloc textuel, dans l'ordre de `propre()` (vérifié avec l'oracle, lot L3.1) :
   modèles → glossaire `[?…]` et ancres `[#x<-]` (pipeline `pre_liens`) → liens `[…->…]` (texte parsé
   récursivement, attributs via `RE_LIEN_ATTRIBUTS`) → notes `[[…]]` (`traiter_raccourcis`, avant la
   wheel ; contenu parsé récursivement) → abréviations `[A|b]` → `{{…}}` / `{…}` (appariement par pile,
   cf. §3) → HTML inline connu → `_ ` (hardBreak), `-- ` (alinéa), `- ` (puce isolée) → texte.
   Conséquences : `[[note->art1]]` est un lien entre crochets ; les échappements `\x` (wheel) passent
   après glossaire, ancres et notes, que `\[` ne protège donc pas (`x\[[n]]` est une note, le `\`
   reste un fragment brut) ; ils protègent un lien et une abréviation.
   Un simple `\n` dans un paragraphe ou un élément de liste est **significatif** : SPIP 3+ le rend
   `<br class='autobr' />` (`_AUTOBR`, `textwheel/wheels/spip/spip-paragrapher.php`). Il devient un
   `hardBreak {syntax: 'autobr'}` ; `\n_ ` devient un `hardBreak {syntax: 'manual'}` (`<br class='manualbr' />`).
   Entités : `&lt;`, `&gt;`, `&amp;`, `&#91;`, `&#63;` deviennent leur caractère ; les autres restent des
   nœuds bruts (une entité n'est pas du texte).
5. **Restauration** des jetons protégés en nœuds (`codeBlock`, `spipModel`, `spipMultiInline`…) ou en
   texte littéral (échappements).
6. **Repli** : toute construction non reconnue ou mal formée (accolade orpheline, `[` non fermé
   ressemblant à un raccourci, balise HTML inconnue) devient `spipRawInline` / `spipRaw` avec sa source.

### Appariement des accolades

SPIP remplace `{{`/`}}` puis `{`/`}` **sans vérifier l'appariement** (règles `type: str`). Le parseur
utilise une pile : une paire bien formée produit `bold`/`italic` ; une accolade orpheline produit un
`spipRawInline` contenant `{` ou `}`, pour qu'elle soit restituée et que son effet au rendu (balise
`<i>` non fermée) reste identique — et l'interface la signale comme anomalie (cf. [06](06-interface.md)).

### Tableaux

- 1re ligne de la forme `||légende|résumé||` → attributs `caption`/`summary` de `table`. Comme textwheel
  (`traiter_tableau()`), la légende se cherche sur la ligne privée de son `|` final puis de tous les `|` de
  fin : `||x|` est une légende, `||||` une ligne de cellules vides, et un résumé peut contenir des `|`
  (`||l|r|s||` → résumé `r|s`).
- Lot L5.1 : une cellule ne contient qu'un paragraphe et les en-têtes n'existent qu'en première ligne, toute
  la ligne. L'éditeur maintient ces deux règles après une fusion, un ajout de ligne ou de colonne, un
  collage (plugin `spipTableaux`, `src/editor/edition.js`) : textes réunis séparés par une espace, types de
  cellule corrigés.
- 1re ligne de données dont **toutes** les cellules sont en `{{…}}` → ligne de `tableHeader`
  (le gras est retiré du contenu : il est implicite).
- `|<|` : la cellule fusionne avec sa voisine de gauche (→ `colspan` +1 de la voisine).
  `|^|` : fusion avec la cellule du dessus (→ `rowspan` +1).

## 3. Sérialiseur : règles

Chaque type de nœud/mark déclare sa sérialisation (`renderSpip`, cf. [07](07-extensibilite.md)).
Règles générales :

| Élément | Sortie |
|---------|--------|
| Séparation des blocs | une ligne vide (`\n\n`) |
| `hardBreak` | `syntax: 'autobr'` → `\n` ; `'manual'` ou absent (saut créé dans l'éditeur) → `\n_ ` |
| `heading` | niveau 2 → `{{{…}}}` ; niveaux 3–6 → `<h3>…</h3>` … `<h6>…</h6>` |
| `spipAlign` | `<div class="text-center">` + ligne vide + blocs + ligne vide + `</div>` (les lignes vides permettent à SPIP de paragrapher le contenu) |
| Listes | `-*`/`-#` répétés selon la profondeur, une ligne par item, pas de ligne vide entre items |
| `bold` / `italic` | `{{…}}` / `{…}` ; bold+italic → `{{{…}}}` **interdit** (confusion avec intertitre) : émettre `{{ {…} }}` |
| `code` | `` `…` `` (comme le porte-plume ; ``` `` ``` si le code contient un backtick) ; `<code>…</code>` si le code a des blancs aux bords, contient `\\`, `` \` `` ou finit par `\` (non représentable entre backticks) |
| `codeBlock` | ```` ```langage\n…``` ```` (délimiteur allongé si le code contient ```` ``` ````) ; `openTag` présent (`<code class="…">` d'origine) ou code non représentable entre backticks → `<code…>\n…\n</code>` ; `<code>` et ```` ``` ```` ont le même rendu, la forme n'est donc pas mémorisée |
| `spipLink` | `[texte\|bulle{lang}->cible]` ; `newWindow` → `->>` ; texte échappé comme ci-dessous |
| `spipLinkAuto` | `[->cible]`, `[\|bulle{lang}->cible]` |
| `spipNote` | `[[<nom>contenu]]` ; contenu restitué à l'identique s'il n'est pas modifié (carte de segments du sous-document, `spipLead`/`spipTrail` sur le nœud) ; l'espace qui précède reste tel qu'il est dans le texte (SPIP le supprime au rendu) |
| `spipGlossary` | `[?terme#glossaireN\|bulle{lang}]` |
| `spipModel`, `spipModelBlock` | `source` si nom, id et paramètres inchangés, sinon `<nameid\|p1\|k=v>` reconstruit |
| `spipAnchor` | `[#nom<-]` |
| `spipRaw*` | `source` tel quel |

### Échappements

Le sérialiseur échappe dans le **texte** ce qui serait interprété comme raccourci :

- `{`, `}`, `~`, `` ` ``, `\` → `\{`, `\}`, `\~`, `` \` ``, `\\` ; l'espace insécable U+00A0 → `~` ;
- `<` suivi d'une lettre, `/`, `!` ou `:` (balise, modèle, `<multi>`, idiome) → `&lt;` : un `\<` ne protège
  **pas** une balise, SPIP la restitue telle quelle ;
- `&` suivi d'une entité (`&eacute;`) → `&amp;` ;
- `[?` → `[&#63;`, `[[` → `[&#91;` : notes et glossaire sont traités **avant** les échappements `\[`, qui ne les
  protègent pas. `[&#63;` plutôt que `&#91;?` évite l'espace insécable que la typographie française ajoute
  avant `?` ;
- `[` suivi de `#`, en fin de texte, ou d'une séquence contenant `<-` avant le `]` → `&#91;` (`\[` ne protège pas une ancre, traitée dans `pre_liens`) ; `[` suivi d'une séquence contenant `->` ou `|` → `\[` (protège un lien et une abréviation, comme dans SPIP) ; un `[` final → `\[`, ou `&#91;` devant une note ou un fragment brut (`\[[[n]]` serait une note de texte `[n`). **Décision (lot L3.1)** : `\[` remplace `&#91;` dans ces cas, ce qui change la forme canonique des lots précédents ; c'est l'échappement adapté aux liens et abréviations dans l'ordre de traitement vérifié avec SPIP. L'identité caractère pour caractère d'un texte non modifié reste la règle ; la forme canonique d'un texte réécrit peut évoluer. Tests de régression : `tests/spip/serialize.test.js` (`escapeText`), `tests/spip/notes.test.js` ;
- en début de ligne : `-`, `|`, `_` suivi d'un espace ou d'un `_` → `\-`, `\|`, `\_` ;
- dans le **texte d'un lien**, le collecteur de liens passe avant les échappements (`\|` n'y protège rien) :
  `[` → `&#91;`, `]` → `&#93;`, `|` → `&#124;`, `->` → `-&gt;` ; `\{` y fonctionne. Le parseur décode
  `&#124;` et `&#93;` dans le texte d'un lien seulement.

### Texte d'un lien

Découpé comme `traiter_raccourci_lien_atts()` (`plugins-dist/textwheel/inc/lien.php`) : `texte|bulle{lang}`.
`{xx}` final n'est une langue que si `xx` est un code de `$GLOBALS['codes_langues']` (liste recopiée dans
`regex.js`) ; sinon il reste dans la bulle, ou dans le texte (où il devient un italique). `{}` (langue de
l'objet, qui dépend du contexte) n'est pas représentable : le lien reste brut. Le texte est analysé
récursivement (marks, modèles) et reçoit la mark `spipLink`.

### Imbrication des marks

Les marks d'un nœud n'indiquent pas leur imbrication dans la source. Le sérialiseur garde ouvertes les marks
qui continuent, puis ouvre les autres de la plus étendue (nombre de nœuds suivants qui la portent) à la
moins étendue : `{a {{b}} c}` reste `{a <strong>b</strong> c}`, `[voir {{la}} doc->x]` reste un seul lien.
À étendue égale, l'ordre canonique départage (`spipLink`, `bold`, `italic`, `strike`, `superscript`,
`subscript`, `code`) : `{{[a->b]}}` est réécrit `[{{a}}->b]` (rendu `<a><strong>` au lieu de
`<strong><a>`, même affichage) ; seul un bloc modifié est concerné.

On n'échappe **que si nécessaire** (minimiser le bruit dans la source). Ces règles sont vérifiées contre
`propre()` (texte saisi dans l'éditeur → rendu littéral).

### Ambiguïtés de collage

Certaines juxtapositions produiraient un autre raccourci : `{{gras}}{italique}` → `{{gras}}{italique}` est
correct, mais `{italique}}` suivi de texte, ou un italique en fin d'intertitre (`{{{Titre {x}}}}`), peuvent
se mal découper. Le sérialiseur dispose d'une table de **séparateurs de sécurité** (espace ou espace
insécable) insérés uniquement quand un test de re-parse détecte une ambiguïté.

## 4. Sérialisation conservatrice

Objectif : ouvrir puis enregistrer un texte non modifié produit **exactement** la source d'origine,
et une modification locale ne réécrit que le bloc concerné (diffs de révisions SPIP lisibles).

**Source de référence** : `textarea.value` au montage de l'éditeur (le navigateur y présente toujours des
fins de ligne `\n` ; la conversion en `\r\n` à la soumission est faite par le navigateur, à l'identique
avec ou sans éditeur, et sort du périmètre).

### Carte de segments

Le parseur découpe la source en segments **contigus couvrant chaque caractère** :

```
source = lead + Σ ( sep_i + bloc_i ) + trail
```

| Segment | Stockage |
|---------|----------|
| `lead` (lignes vides/blancs avant le 1er bloc) | attribut `spipLead` du nœud `doc` |
| `sep_i` (séparateur exact avant le bloc *i* : `\n\n`, `\n\n\n`, espaces…) | attribut `spipSep` du bloc |
| `bloc_i` (source exacte du segment) | attributs du **premier** bloc JSON issu du segment : `spipSrc`, `spipGroup` (nombre de blocs JSON issus du segment : `{{{T}}}\ntexte` en donne deux, comme le rendu SPIP) et `spipHash` (forme canonique exacte de ces blocs — comparaison de chaînes, pas de hachage, donc aucune collision possible) |
| `trail` (blancs après le dernier bloc) | attribut `spipTrail` du nœud `doc` |

Le nœud `doc` est étendu (extension `Document`) pour porter ces attributs. Pour le **document vide** (`''`
ou blancs seuls) : aucun bloc source, ProseMirror crée un paragraphe vide ; un `doc` réduit à un paragraphe
vide sans `spipSrc` se sérialise en `lead + trail`, donc la source d'origine.

### Algorithme

1. `lead` en tête.
2. Pour chaque bloc portant `spipGroup = k` : si la forme canonique des *k* blocs courants est égale à
   `spipHash`, on émet `séparateur + spipSrc` et on saute les *k* blocs. Sinon, chaque bloc est sérialisé
   normalement, précédé de son séparateur. Le séparateur est le `spipSep` du bloc s'il est valide à sa
   place (vide pour le premier bloc, contenant une ligne vide ailleurs), sinon `\n\n` (rien pour le
   premier bloc).
3. `trail` en fin.
4. Un document entièrement intact redonne donc la source exacte, sans chemin rapide séparé. La forme
   canonique ignore les attributs techniques et les attributs nuls (Tiptap ajoute les valeurs par défaut
   nulles dans `getJSON()`) ; les empreintes sont recalculées sur le JSON passé par le schéma de l'éditeur
   (`toEditorJSON`, attributs par défaut compris) avant `setContent`.
5. `spipSrc`/`spipHash`/`spipSep`/`spipGroup` ne sont pas rendus en HTML, donc perdus au copier-coller ;
   mais ProseMirror les **recopie** quand il coupe un bloc en son milieu (`keepOnSplit: false` n'agit que sur
   une coupure en fin de bloc) ou le déplace. Le sérialiseur n'en reprend donc que ce qui reste valide :
   `spipSrc` si la forme canonique correspond, `spipSep` s'il est valide à sa place. Sans cette règle, le
   second morceau d'un paragraphe coupé hériterait d'un séparateur vide et se recollerait au premier.

Corollaire : les normalisations (espaces en fin de ligne, forme des modèles, forme du code)
ne s'appliquent qu'aux blocs effectivement édités.

**Test** : pour toute source du corpus, la concaténation des segments est égale à la source (vérifié avant
même la sérialisation), y compris sources vides, blancs seuls, lignes vides initiales/finales multiples.

## 5. Invariants (testés, cf. [08](08-tests-recette.md))

1. **Identité** : `serialize(parse(s)) === s` pour tout `s` non modifié (via §4).
2. **Idempotence canonique** : sans la conservation (§4 désactivée), `serialize(parse(serialize(parse(s))))
   === serialize(parse(s))`.
3. **Équivalence de rendu** : `propre(s) ≡ propre(serializeCanonique(parse(s)))` (HTML normalisé).
4. **Totalité** : `parse` ne lève jamais d'exception ; au pire il produit des nœuds bruts.
5. **Sûreté du schéma** : tout JSON valide pour le schéma est sérialisable, et son re-parse redonne le même JSON.

**Limite assumée (décision utilisateur, 2026-10-12)** : les fins de ligne `\r` seules (Mac OS 9) ne sont pas
gérées. SPIP les traite comme des sauts de ligne ; le parseur ne découpe que sur `\n` (`\r\n` compris). Un
segment qui contient un `\r` non suivi de `\n` reste un bloc brut : restitué tel quel, modifiable seulement en
mode source. À reprendre dans les notes de version.

**Limite (lot corpus et propriétés)** : une note automatique dont le texte commence par un idiome
(`<:cle:>`, traité après les notes) ou par une mark écrite en balise HTML (`<sup>`, `<sub>`, `<del>`) quand la
même balise revient plus loin sur la ligne se lit nommée (`[[<sup>1</sup> voir <sup>2</sup>]]` est la note
`sup` pour `traiter_raccourci_notes()`). Aucune écriture ne garde à la fois la note automatique et ce début :
le sérialiseur écrit le premier `<` en `&lt;`, qui s'affiche.

**Limite (lot corpus et propriétés)** : la balise fermante d'un bloc verbatim (`</cadre>` dans un cadre,
`</html>`, `</math>`, `</code>` dans un `<code>`) n'a pas d'échappement : SPIP y afficherait une entité telle
quelle. Un tel contenu ferme le bloc plus tôt à la relecture. Un bloc de code qui s'écrit entre backticks
n'est pas concerné. Un bloc de code qui ne s'écrit pas entre backticks (`\\`, `` \` ``, `\` final, saut de
ligne en tête, `` ` `` final) passe par `<code>` et perd sa langue, que seuls les backticks portent (```` ```php ````).

## 6. Copier-coller

| Source | Traitement |
|--------|------------|
| Interne (éditeur → éditeur) | HTML ProseMirror avec `data-spip-*` : fidélité totale |
| Texte brut contenant des raccourcis SPIP | Option « coller comme SPIP » (défaut : actif si le texte contient des raccourcis reconnus) → `parse` du fragment |
| HTML externe (Word, LibreOffice, web) | `parseHTML` des extensions, nettoyé par le schéma ; les styles non représentables sont perdus (comportement normal d'un WYSIWYG) |
| Copie vers l'extérieur | `text/plain` = SPIP sérialisé du fragment ; `text/html` = HTML de l'éditeur |
