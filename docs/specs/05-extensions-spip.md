# 05 — Extensions SPIP

Chaque extension est une extension Tiptap 3 (`Node.create` / `Mark.create`) qui déclare en plus ses règles
SPIP (`spipTokenizer`, `parseSpip`, `renderSpip`, cf. [07](07-extensibilite.md)). Cette fiche décrit le
comportement attendu de chacune.

---

## 1. Notes — `spipNote`

### Syntaxe couverte

| Source | Sens |
|--------|------|
| `texte[[Contenu de la note.]]` | note numérotée automatiquement |
| `texte[[<A>Contenu]]` | note nommée « A » (appel `[A]`) |
| `texte[[<>Contenu]]` | note sans appel (le contenu apparaît en bas, sans renvoi) |
| `texte[[<i>italique</i> au début]]` | **pas** une note nommée : le core vérifie la balise fermante correspondante (`traiter_raccourci_notes`) ; le parseur applique la même règle |

### Dans l'éditeur

- Nœud **inline atomique** affiché comme un appel de note en exposant : `[1]`, `[A]`, ou une puce discrète
  pour `[[<>…]]`. La numérotation automatique est recalculée à chaque transaction (plugin ProseMirror
  à décorations, pas d'attribut stocké).
- Survol / focus : infobulle avec l'aperçu texte de la note.
- Clic, `Entrée` sur le nœud sélectionné ou bouton « Modifier » : **popover d'édition** contenant un
  **sous-éditeur Tiptap** (même schéma, sans les notes, barre réduite : gras, italique, lien, glossaire,
  modèle). Champ « Nom de la note » optionnel (vide = automatique, case « sans appel »).
- **Panneau des notes** (repliable, sous l'éditeur) : liste ordonnée de toutes les notes du texte, comme
  elles apparaîtront en bas d'article ; cliquer sur une note y place le curseur et ouvre son popover.
  Le panneau est une vue dérivée, pas une zone de saisie distincte.

### Commandes

`insertSpipNote({ name?, content? })` (ouvre le popover si `content` vide),
`updateSpipNote({ name?, content })`, `removeSpipNote()`.
Raccourci clavier : `Mod-Alt-N`. Input rule : taper `[[` ouvre une note vide.

### Sérialisation

`[[` + (`<nom>` si nommée, `<>` si sans appel) + contenu sérialisé + `]]`, sans espace avant
(SPIP fait `rtrim` avant l'appel). Les paragraphes du contenu sont séparés par une ligne vide à
l'intérieur des crochets, ce que SPIP accepte. Un `]]` littéral dans le contenu est échappé (`\]\]`).

---

## 2. Glossaire — `spipGlossary`

### Syntaxe couverte (`_RACCOURCI_GLOSSAIRE` / `_RACCOURCI_GLOSES`)

| Source | Sens |
|--------|------|
| `[?SPIP]` | terme « SPIP », glossaire par défaut (`$url_glossaire_externe`, Wikipédia) |
| `[?SPIP#wikipedia]` | glossaire nommé (`glossaire_wikipedia()`) |
| `[?SPIP#mots12]` | glossaire nommé avec numéro (`#mots` + `12`) |
| `[?SPIP\|Système de publication]` | bulle d'aide personnalisée |
| `[?SPIP{fr}]` | langue (hreflang) |

### Dans l'éditeur

- **Mark** sur le terme (le texte affiché *est* le terme), rendu souligné en pointillé avec icône discrète.
- Ajout : sélectionner un mot puis bouton « Glossaire » (`Mod-Alt-G`) ; input rule `[?terme]`.
- Popover : terme (le texte), choix du glossaire (liste issue de la config : défaut + fonctions
  `glossaire_*` disponibles), numéro, bulle, langue ; lien « Voir la définition » (URL calculée par
  l'opération `glossaire` du formulaire CVT de l'éditeur, ouverte dans un nouvel onglet).
- Contraintes du schéma : pas d'autre mark à l'intérieur, pas de `[ ] < >` dans le terme
  (le bouton est désactivé sinon).

### Sérialisation

`[?` + texte + (`#glossaire` + `numero`) + (`|bulle`) + (`{lang}`) + `]`.

---

## 3. Modèles — `spipModel` / `spipModelBlock`

Reprise de `SpipModel.js` de markdown_editor (cf. [01](01-contexte-objectifs.md) §4), portée en Tiptap 3,
avec les évolutions suivantes.

### Reconnaissance

- Regex du core (`Modeles.php`) : `<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*/?>`,
  avec la condition « id ou paramètres requis » (sinon c'est du HTML : `<span>` n'est pas un modèle).
- Seul dans son bloc → `spipModelBlock` (rendu bloc, déplaçable entre paragraphes) ; dans une phrase →
  `spipModel` inline. La conversion est automatique quand on déplace le nœud.
- Attribut `model` structuré (`name`, `id`, `params` ordonnés, `source`), cf. [03](03-schema-json.md) §4.

### Prévisualisation

- NodeView : opération `previsu_modele` du formulaire CVT de l'éditeur ([02](02-architecture.md) §5) ; le
  contexte de l'objet édité (`objet`, `id_objet`, `champ`) vient des arguments signés du formulaire, pour
  que les modèles dépendant de l'objet se calculent bien sans que le JS puisse le modifier.
- Cache JS par clé (source + contexte), invalidé quand l'attribut change ; requêtes regroupées au chargement
  (au plus N=4 en parallèle) pour les textes à nombreux documents.
- HTML inséré dans un conteneur `contenteditable=false`, éléments interactifs neutralisés
  (repris de markdown_editor), scripts jamais exécutés. Pendant le chargement : squelette avec le
  raccourci ; en erreur : chip `<doc12|center>` en code (comportement de repli).
- Option « affichage compact » (config / bouton) : chip avec icône du modèle (`icone_barre` du YAML)
  et raccourci, sans prévisualisation — utile en plein écran ou sur connexions lentes.

### Édition

- Si un YAML `modeles/<nom>.yaml` existe : bouton « Modifier » → `#FORMULAIRE_INSERER_MODELES` en
  modalbox, prérempli avec `id` et `params` ; au retour, `updateSpipModel`. **Résoudre la todo de
  markdown_editor « Plein écran + modèles »** : la modalbox doit s'ouvrir au-dessus de l'éditeur plein
  écran (z-index et piège de focus).
- Sans YAML : édition du raccourci brut dans un petit champ texte (validé par la regex).
- Insertion : bouton « Modèles » de la barre → liste des modèles disponibles par catégorie
  (`inserer_modeles_lister_formulaires_modeles`), puis formulaire. Raccourcis spécifiques
  « Image / Document » (`doc`, `img`, `emb`) avec sélecteur de document de l'objet.
- Input rule : taper un raccourci de modèle complet (`<doc12|left>`) le transforme en nœud.

### Sérialisation

`source` si `name`, `id`, `params` inchangés ; sinon `<` + name + id + (`|` + `key=value` ou `value`)… + `>`.

---

## 4. Liens — `spipLink`

- Extension de `@tiptap/extension-link` 3 avec attributs `href` (cible SPIP brute), `bulle`, `hreflang`,
  `newWindow`. `autolink` gardé (URL tapée → lien) mais sérialisé en `[->https://…]` seulement si
  l'utilisateur l'a validé ; sinon l'URL reste du texte (SPIP fait lui-même l'autolien au rendu).
- Cibles reconnues : `art12`, `article12`, `rub3`, `br5`, `doc7`, `aut2`, `mot4`, `site8`, `12` (article),
  types d'objets déclarés (`_RACCOURCI_URL`), `#ancre`, `art12#ancre`, URL absolues, `mailto:`.
- **Liens sans texte** `[->art12]` : nœud `spipLinkAuto` ([03](03-schema-json.md) §3), affiché avec le titre
  que SPIP calculera, obtenu par l'opération `titre_lien` du formulaire CVT (cibles regroupées par lot,
  cache JS) ; le titre n'est jamais écrit dans la source. Bouton « Figer le titre » : convertit en
  `[Titre->art12]`.
- Popover : champ cible avec **recherche d'objets SPIP** (titre → `art12`) via
  l'opération `rechercher`, bulle, langue, nouvelle fenêtre, « ouvrir », « retirer ».
- Ancres `[#ancre<-]` : nœud `spipAnchor` affiché comme un petit marqueur ; les liens `#ancre` proposent
  les ancres présentes dans le document.

## 5. Multilinguisme — `spipMultiInline`, `spipMultiBlock`, `spipLang*`, `spipIdiome`

- Repris de markdown_editor (`SpipMultiInline`, `SpipMultiBlock`, `SpipLang`), mais avec une structure
  explicite : un multi contient des **parties par langue** (`spipLangInline` / `spipLangBlock`, attribut
  `lang`) au lieu de marqueurs `[fr]` mêlés au texte. Une partie sans code de langue en tête est la
  partie par défaut (`lang: null`).
- Affichage : onglets de langue au-dessus du multi bloc ; pour l'inline, la langue active de l'interface
  est affichée et un sélecteur permet de basculer.
- Idiomes `<:module:cle:>` : nœud atomique affichant la traduction (récupérée en lot) avec le raccourci
  en infobulle ; édition du raccourci brut.

## 6. Blocs protégés — `codeBlock`, `spipCadre`, `spipHtml`, `spipMath`, `spipPoesie`

- Code : backticks (`` `x` `` → mark `code`, ```` ```php … ``` ```` → `codeBlock` avec `language`) et forme
  historique `<code>` (inline ou bloc), `<cadre>` : texte brut, aucun raccourci interprété, attributs de la
  balise conservés (`<code class="php">`). Les nouveaux codes sont écrits en backticks, comme le fait
  le porte-plume de SPIP 4.
- `<html>` : repris de `SpipHtml.js`, texte brut éditable avec coloration minimale ; jamais interprété
  dans l'éditeur.
- `<math>` : texte brut ; aperçu optionnel si le site fournit un rendu (hors v1).
- `<poesie>` : conteneur de paragraphes où chaque retour à la ligne est significatif (rendu `hardBreak`).

## 7. Divers

| Raccourci | Traitement |
|-----------|------------|
| `[ABBR\|explication{lang}]` | mark `spipAbbr`, popover d'édition |
| `-- ` (alinéa en début de ligne) | `hardBreak` + tiret cadratin, sérialisé `\n-- ` (attribut sur le hardBreak) |
| `- ` (puce isolée en début de ligne) | conservé en `spipRawInline` (usage rare, rendu SPIP spécifique) |
| `<intro>…</intro>` | `spipRaw` bloc conteneur affiché avec étiquette « Introduction » (v1 : brut) |
| `~` | espace insécable visible (caractère invisible affiché par décoration) |
| `<br>` HTML | `hardBreak` sérialisé `\n_ ` (normalisation dans les blocs modifiés uniquement) |
| HTML inline inconnu (`<span style>`) | `spipRawInline` |

---

## 8. Au-delà du core : HTML simple

Choix assumé : plutôt que d'introduire des raccourcis non standards (ceux de typoenluminee entrent en conflit
avec `[…]` et `|…|` du core), les fonctions absentes de SPIP sont écrites **en HTML lisible**, que SPIP
conserve tel quel et dont il traite quand même les raccourcis inline.

### Intertitres de niveau 3 à 6

```
{{{Partie}}}

<h3>Sous-partie avec {italique}</h3>
```

- Menu « Titre » de la barre : niveaux configurés (défaut 2 à 4). Raccourcis clavier `Mod-Alt-2` … `Mod-Alt-6`.
- Le parseur ne reconnaît que `<hN>` **sans attribut**, seul dans son bloc ; un `<h3 class="x">` reste
  un nœud brut (préservé, éditable en source).

### Alignements

```
<div class="text-center">

Texte centré, avec {{gras}} et [un lien->art3].

Second paragraphe centré.

</div>
```

- Bloc conteneur `spipAlign` (attribut `align`), appliqué à la sélection de blocs via un menu
  « Alignement » (gauche / centre / droite / justifié) ; « aucun » retire le conteneur. Alignement gauche utile
  surtout pour les langues RTL.
- Classes `text-left`, `text-center`, `text-right`, `text-justify` : **déjà présentes** dans `squelettes-dist/css/typo.css`
  (SPIP 4.4) et dans Bootstrap, donc rendues correctement par la plupart des squelettes sans CSS
  supplémentaire. Le plugin ne fournit une feuille de style publique de secours (`insert_head_css`,
  désactivable) que pour les squelettes qui ne les définissent pas ; l'éditeur applique les mêmes règles
  pour l'aperçu.
- Les noms restent surchargeables par constante (`_TIPTAP_SPIP_CLASSES_ALIGN`) pour un squelette qui
  utiliserait d'autres conventions (ex. `text-start` / `text-end` de Bootstrap 5) ; le parseur reconnaît
  alors les classes configurées.
- Les lignes vides après `<div …>` et avant `</div>` sont obligatoires : sans elles SPIP ne crée pas les
  paragraphes à l'intérieur. Le parseur accepte les deux formes ; le sérialiseur écrit toujours la forme
  avec lignes vides.
- Tout autre `<div>` (autres classes, `style`, `id`) reste un nœud brut.

