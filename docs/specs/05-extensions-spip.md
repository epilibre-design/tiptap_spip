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
  - Un multi ne rend qu'une langue : comme SPIP, seules comptent les notes de sa partie affichée (langue affichée, §5). Celles d'un multi en ligne sont numérotées dans son affichage.
  - Le panneau des notes suit la langue affichée ; un clic sur une note d'un multi en ligne ouvre le popover du multi.
- Survol / focus : infobulle avec l'aperçu texte de la note.
- Clic, `Entrée` sur le nœud sélectionné ou bouton « Modifier » : **popover d'édition** contenant un
  **sous-éditeur Tiptap** (même schéma, sans les notes, sans barre d'outils : une zone de texte, avec
  Appliquer, Supprimer la note et Annuler). Champ « Nom de la note » optionnel (vide = automatique, case « sans appel »).
- **Panneau des notes** (repliable, sous l'éditeur) : liste ordonnée de toutes les notes du texte, comme
  elles apparaîtront en bas d'article ; cliquer sur une note y place le curseur et ouvre son popover.
  Le panneau est une vue dérivée, pas une zone de saisie distincte.

### Commandes

`insertSpipNote({ name?, content? })` (ouvre le popover si `content` vide),
`updateSpipNote({ name?, content })`, `removeSpipNote()`.
Raccourci clavier : `Mod-Alt-N`. Input rule : taper `[[` ouvre une note vide.

### Sérialisation

`[[` + (`<nom>` si nommée, `<>` si sans appel) + contenu sérialisé + `]]`. Le contenu est un
sous-document avec sa carte de segments : non modifié, il est restitué à l'identique. Les paragraphes
du contenu sont séparés par une ligne vide à l'intérieur des crochets, ce que SPIP accepte. Un `]`
final ou suivi d'un autre `]` s'écrit `&#93;` : `\]` ne suffit pas, le core cherchant le premier `]]`
avant de traiter les échappements (`[[a\]]]` est la note `a\` suivie de `]`).

Lot L3.2 : popover ouvert par le bouton « Note », `Mod-Alt-N`, la frappe de `[[`, un clic ou `Entrée`
sur un appel, ou le panneau des notes ; le bouton « Note » sur un appel sélectionné tient lieu de
bouton « Modifier ». Comme le bouton Note du porte-plume, un texte sélectionné dans un même bloc
devient le texte de la nouvelle note, qui le remplace ; une autre sélection est gardée, la note est
insérée après. Le sous-éditeur a le schéma de l'éditeur sans notes, avec les seuls blocs permis dans
une note (`noteExtensions()`) ; il n'a pas de barre d'outils, le lien (`Ctrl+K`) et les modèles déjà
présents s'y modifient en popovers enfants. Une note ouverte puis appliquée sans que son texte change
garde son contenu d'origine (identité) ; une note vide est refusée, comme une note qui ne se relirait
pas à l'identique (nom `a>b`, nom `i` devant un texte contenant `</i>` brut…). La note est suivie
pendant que le popover est ouvert : supprimée entre-temps, rien n'est modifié.

Reconnaissance (lot L3.1) : le nom se cherche dans le texte que voit le core, où liens, modèles et
glossaire sont déjà traités (`[[<doc1>]]` est une note automatique contenant un modèle). Gardées
brutes : note dont le contenu a d'autres blocs que paragraphes, listes et modèles seuls ; note dont le
nom n'est pas fait de lettres, chiffres, `_`, `-` alors que le texte contient `</nom>` (le core place
le nom tel quel dans une regex).

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

Lot L3.1 : un terme devient une mark si le raccourci se réécrit à l'identique depuis ses attributs et
que le terme s'écrit tel quel ; sinon il reste brut (`[? SPIP]`, `[??SPIP]`, `[?SPIP|b#mots]`,
`[?S{P}]`, même rendu). Pas de glossaire ni d'abréviation dans le texte d'un lien (brut). Une mark
saisie qui ne se relirait pas à l'identique (terme avec accolades, bulle avec `]`…) est abandonnée à
la sérialisation, le texte restant ; l'interface (L3.2) empêche ces saisies.

Lot L3.2 : popover du bouton « Glossaire » ou de `Mod-Alt-G` : curseur ou sélection dans un terme →
modification du terme entier ou retrait ; texte d'un même paragraphe sélectionné → nouveau terme ;
curseur seul → champ « Terme » et insertion. Le bouton est désactivé sur une sélection qui contient
`[ ] < >` ; `Mod-Alt-G` ouvre le popover, qui refuse alors la saisie. Toute saisie est validée par relecture
(`src/spip/valider.js`). Avec les services : glossaires nommés du site proposés (`datalist`) et
« Voir la définition ». La frappe de `[?terme…]` pose le terme si le raccourci se réécrit à
l'identique (sinon le texte reste, comme le parseur le garde brut).

---

## 3. Modèles — `spipModel` / `spipModelBlock`

Conception inspirée de `SpipModel.js` de markdown_editor (cf. [01](01-contexte-objectifs.md) §4), réécrite pour Tiptap 3,
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
- Cache JS par source du raccourci (`ModelPreviews`, `src/services/cache.js`), un échec n'étant pas gardé ;
  le contexte est celui, fixe, du formulaire de services. Les appels passent par la file des services, qui
  les sérialise (lot L2.2) : pas de limite de parallélisme propre.
- HTML inséré dans un conteneur `contenteditable=false` et rendu inerte côté navigateur, en plus du
  `safehtml()` du serveur (`src/ui/sanitize.js`) : ni script, ni gestionnaire `on*`, ni URL `javascript:`,
  éléments interactifs hors du clavier et désactivés, iframes en bac à sable. Pendant le chargement et en
  cas d'erreur ou de rendu vide : le raccourci en code (comportement de repli). Sans services : affichage
  compact, sans NodeView.
- Option « affichage compact » (config / bouton) : chip avec icône du modèle (`icone_barre` du YAML)
  et raccourci, sans prévisualisation — utile en plein écran ou sur connexions lentes.

### Édition

- Si un YAML `modeles/<nom>.yaml` existe : bouton « Modifier » → `#FORMULAIRE_INSERER_MODELES` en
  modalbox, prérempli avec `id` et `params` ; au retour, `updateSpipModel`. **Résoudre la todo de
  markdown_editor « Plein écran + modèles »** : la modalbox doit s'ouvrir au-dessus de l'éditeur plein
  écran (z-index et piège de focus).
- Sans YAML : édition du raccourci brut dans un petit champ texte, validé par le parseur (`parseModel`) —
  **réalisé au lot L2.3** : bouton « Modifier » du NodeView et bouton « Modèle » de la barre ; insertion en
  bloc (`spipModelBlock`) dans un paragraphe vide, en ligne sinon. YAML (`#FORMULAIRE_INSERER_MODELES`,
  question Q3), sélecteur de documents et règle de saisie : lots suivants.
- Insertion : bouton « Modèles » de la barre → liste des modèles disponibles par catégorie
  (`inserer_modeles_lister_formulaires_modeles`), puis formulaire. Raccourcis spécifiques
  « Image / Document » (`doc`, `img`, `emb`) avec sélecteur de document de l'objet.
- **Catalogue, réalisé (Q3 tranchée : plugin Insérer modèles facultatif, `<utilise>`) :**
  - **Contrat avec le plugin,** sans le modifier :
    - l'`input[name=url_inserer_modeles]` qu'il pose dans le formulaire d'un textarea (après le formulaire
      pour un crayon) donne l'URL de sa modalbox pour l'objet édité, si l'auteur a le droit d'insérer des
      modèles ;
    - après « Insérer », son formulaire rechargé dans la modalbox affiche le raccourci dans
      `#code_modele_modalbox` : l'éditeur le lit, le pose et ferme la modalbox ;
    - le plugin insère lui-même par le porte-plume dans la zone markItUp qui a le focus :
      `$.markItUp.focused` est remis à `null` à l'ouverture, pour qu'aucune autre zone ne le reçoive ;
    - préremplissage par l'URL : `formulaire_modele` et un paramètre par champ.
  - **Catalogue** (`tiptap_spip_catalogue_modeles()`, config JS `modeles`) : nom du modèle → formulaire
    YAML (saisie `modele`), champ de l'identifiant (`id_modele`), autres champs, valeurs seules
    d'`align`, `variante` et `classe` (`|left`), cases à cocher (`masquer=legende,titre`). Modèles ignorés
    exclus ; `null` sans le plugin.
  - **Barre :** avec catalogue, « Modèle » est un menu : « Catalogue des modèles… » ou « Saisir le
    raccourci… ». `Mod-Alt-M` ouvre la saisie brute. Sans catalogue (pas de plugin, pas de droit, aucun
    modèle proposé, SPIP 5), c'est le bouton de la saisie brute.
  - **« Modifier » :** il ouvre le formulaire prérempli si le modèle est au catalogue et que le formulaire
    peut réécrire chacun de ses paramètres ; sinon la saisie brute, pour ne jamais perdre un paramètre.
    Le formulaire perdrait un paramètre sans champ, ou une valeur vide ou `0` (identifiant compris) :
    le `traiter()` du plugin écarte les valeurs fausses en PHP.
  - **Limites :**
    - le formulaire réécrit le raccourci dans son ordre (identifiant, `variante`, `classe`, `align`, puis
      les champs) ;
    - un modèle dans une note s'édite en brut ;
    - le plugin ne déclare pas SPIP 5.
- Input rule : taper un raccourci de modèle complet (`<doc12|left>`) le transforme en nœud.

### Sérialisation

`source` si `name`, `id`, `params` inchangés ; sinon `<` + name + id + (`|` + `key=value` ou `value`)… + `>`.

---

## 4. Liens — `spipLink`

- Mark propre (pas `@tiptap/extension-link`, dont la validation d'URL refuse les cibles SPIP) avec
  attributs `href` (cible SPIP brute), `bulle`, `hreflang`, `newWindow`. Pas d'autolien : une URL tapée reste
  du texte (SPIP fait lui-même l'autolien au rendu) ; un lien se crée par le popover (L2.3).
- Lot L2.1 : liens, liens sans texte, ancres et modèles sont reconnus, sérialisés et affichés en compact ;
  titres, recherche, popover et prévisualisation viennent des services (L2.2) et de l'interface (L2.3).
- Lot L2.3 : titres des liens sans texte demandés par lots de 50 (`LinkTitles`) ; popover (`Ctrl+K`,
  bouton « Lien ») : sélection vide → lien sans texte, texte sélectionné → nouveau lien, curseur dans un
  lien → modification du lien entier ; recherche à partir de 2 caractères (250 ms), sauf pour une cible
  déjà au format `art12`, une URL ou `#ancre` ; « Ouvrir » utilise l'URL résolue par `titre_lien`.
  Proposition des ancres du document : lots suivants. Lot L3.2 : une cible ou une bulle qui couperait
  le raccourci (`a]b`, bulle avec `->`) est refusée (relecture, `src/spip/valider.js`).
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

- Inspiré de markdown_editor (`SpipMultiInline`, `SpipMultiBlock`, `SpipLang`), réécrit avec une structure
  explicite : un multi contient des **parties par langue** (`spipLangInline` / `spipLangBlock`, attribut
  `lang`) au lieu de marqueurs `[fr]` mêlés au texte. Une partie sans code de langue en tête est la
  partie par défaut (`lang: null`).
- Affichage : onglets de langue au-dessus du multi bloc ; pour l'inline, la langue active de l'interface
  est affichée et un sélecteur permet de basculer.
- Idiomes `<:module:cle:>` : nœud atomique affichant la traduction (récupérée en lot) avec le raccourci
  en infobulle ; édition du raccourci brut.

Lot L4.1 (vérifié avec l'oracle, rendu dans chaque langue) :
- **Ordre de traitement :** `<multi>` et idiomes sont traités dans `typo()`, après tous les autres raccourcis. Liens, notes, gras… d'une partie sont rendus normalement, et les marqueurs `[xx]` se cherchent dans le texte où ces raccourcis sont déjà remplacés.
- **Découpage des parties** (`Multis::extraire_trads()`) : une première partie sans marqueur n'existe que si elle n'est pas vide ; casse du code gardée (`[FR]` rend `lang='FR'`).
- **Marqueur dans le texte d'une partie :** `\[en]` ne protège pas un marqueur (le `\` reste dans la partie précédente), d'où l'écriture `&#91;en]`. Ce `\` final d'une partie ne se rend pas pareil selon la langue (retiré quand SPIP retombe sur une autre langue) : gardé en fragment brut dans un multi en ligne, multi bloc gardé brut.
- **Marqueur caché dans un raccourci traité avant** (note, texte d'un lien, code) : le core coupe le multi dans une note, pas dans du code ; découpage incertain, multi gardé brut.
- **Partie sans langue :** elle ne s'écrit qu'en tête ; une partie sans langue placée ailleurs y est déplacée. Une partie sans langue faite de blancs dans un multi bloc : gardé brut (elle compte quand aucune langue ne convient).
- **Langue en double :** SPIP garde la dernière partie, l'affichage aussi.
- **Multi en ligne :** atome affiché dans la langue de l'interface (`<html lang>`, code exact puis langue de base, sinon la première partie), les autres parties en infobulle, la langue en badge.
- **Multi bloc :** parties empilées, chacune avec sa langue en badge, éditables directement.
- **Gardés bruts :**
  - un multi dans le texte d'un lien ;
  - un multi qui contient une ligne vide sans être seul dans son segment ;
  - un multi bloc dont une partie n'est pas faite que de paragraphes.
- **Idiomes :** affichés par leur raccourci (traduction : L4.2).
- **Choix d'affichage :** toutes les parties d'un multi bloc restent visibles. Le sélecteur de la langue affichée, qui remplace les onglets, est prévu au lot L4.2.

Lot L4.2 :
- **Langue affichée :** un sélecteur de la barre, présent quand le texte a des multis, liste les langues du texte. Un multi en ligne montre sa partie dans cette langue ; dans un multi bloc, les autres parties sont estompées. Il remplace les onglets.
- **Bouton « Multilingue »**, selon la sélection :
  - multi en ligne sélectionné, ou clic, ou `Entrée` : popover avec une ligne par partie (code de langue, sous-éditeur d'un paragraphe sans multi, retirer) et « Ajouter une langue » ;
  - curseur dans un multi bloc : popover des langues de ses parties (code, retirer, ajouter) ;
  - paragraphe vide : nouveau multi bloc dans la langue affichée, inséré à « Appliquer » (annuler laisse le paragraphe) ;
  - sinon : nouveau multi en ligne, dont la première partie est le texte sélectionné.
- **Validation :** codes de la regex du core, une seule partie sans langue, multi relu à l'identique (`multiSeRelit`). Une partie ouverte et non modifiée garde son contenu d'origine. « Supprimer le multi » garde le texte de la langue affichée. Lien et glossaire d'une partie s'ouvrent en popovers enfants.
- **Idiomes :** traduction calculée par SPIP (opération `idiomes`, par lots, cache) affichée à la place du raccourci, qui passe en infobulle. Clic ou `Entrée` : popover du raccourci brut, validé par le parseur, et suppression.

## 6. Blocs protégés — `codeBlock`, `spipCadre`, `spipHtml`, `spipMath`, `spipPoesie`

- Code : backticks (`` `x` `` → mark `code`, ```` ```php … ``` ```` → `codeBlock` avec `language`) et forme
  historique `<code>` (inline ou bloc), `<cadre>` : texte brut, aucun raccourci interprété, attributs de la
  balise conservés (`<code class="php">`). Les nouveaux codes sont écrits en backticks, comme le fait
  le porte-plume de SPIP 4.
- `<html>` : inspiré de `SpipHtml.js`, texte brut éditable avec coloration minimale ; jamais interprété
  dans l'éditeur.
- `<math>` : texte brut ; aperçu optionnel si le site fournit un rendu (hors v1).
- `<poesie>` : conteneur de paragraphes où chaque retour à la ligne est significatif (rendu `hardBreak`).

## 7. Divers

| Raccourci | Traitement |
|-----------|------------|
| `[ABBR\|explication{lang}]` | mark `spipAbbr` (L3.1 ; mêmes règles que le glossaire : texte écrit tel quel, sinon brut), popover (L3.2) : bouton « Abréviation », mêmes règles de sélection que le glossaire, explication obligatoire |
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
  Lot L5.1 : la commande `setAlignement` agit sur tous les blocs de premier niveau touchés par la sélection,
  alignés ou non. Les alignements existants sont dépliés, puis l'ensemble est entouré d'un seul conteneur ;
  « aucun » les déplie tous. Un seul bloc aligné change d'alignement sur place.
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

