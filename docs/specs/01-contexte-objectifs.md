# 01 — Contexte et objectifs

## 1. Besoin

Les rédacteurs SPIP éditent aujourd'hui leurs textes dans un `<textarea>` équipé du **porte-plume** :
ils voient et manipulent directement les raccourcis (`{{gras}}`, `[->art12]`, `[[note]]`, `<doc3|left>`…).
C'est puissant mais intimidant pour des rédacteurs occasionnels, et les erreurs de syntaxe
(accolade non fermée, crochet en trop) cassent le rendu.

On veut un éditeur **WYSIWYG** (ou au moins WYSIWYM) qui :

- affiche le texte mis en forme, avec les objets SPIP (notes, glossaire, modèles, liens internes)
  représentés de façon compréhensible et éditables via des interfaces dédiées ;
- **continue de stocker en base exactement la syntaxe SPIP** : aucun changement de format,
  compatibilité totale avec l'existant, les squelettes, `propre()`, TextWheel, les plugins ;
- permet à tout moment de basculer sur le code source brut.

## 2. Décisions de cadrage

| Sujet | Décision | Raison |
|-------|----------|--------|
| Syntaxe stockée | **Raccourcis SPIP natifs** (pas de Markdown) | Remplacer le porte-plume sur l'existant sans migration |
| Moteur | **Tiptap 3** (ProseMirror) | Version actuelle, API d'extension plus propre, StarterKit enrichi |
| Représentation intermédiaire | **JSON ProseMirror** (`editor.getJSON()`) | Format pivot natif de Tiptap, sérialisable, testable |
| Parseur / sérialiseur | **Dédié SPIP**, écrit en JS, sans markdown-it | La grammaire SPIP n'est pas du CommonMark (cf. [04](04-parseur-serialiseur.md)) |
| Rendu des modèles | **Côté serveur**, via un formulaire CVT (markdown_editor utilise une action) | Seul SPIP sait calculer un modèle |
| UI | **JS vanilla**, sans framework | Léger, cohérent avec l'espace privé et markdown_editor |
| Compatibilité SPIP | `[4.2.0;5.*]` | Identique à markdown_editor |

## 3. Périmètre

### Inclus (v1)

- Raccourcis de base : paragraphes, `_ ` (retour à la ligne forcé), `{{gras}}`, `{italique}`,
  `{{{intertitre}}}`, listes `-*` / `-#` (imbriquées), `----`, `<quote>`, `<poesie>`,
  `<code>`, `<cadre>`, `<html>`, tableaux `|…|` (en-tête, légende, fusions `<` et `^`),
  HTML inline usuel (`<sup>`, `<sub>`, `<del>`, `<small>`, `<sc>`…).
- Liens : `[texte->cible]`, `[texte|bulle{lang}->cible]`, `[->art12]` (titre automatique),
  ancres `[#ancre<-]`, liens vers objets (`art`, `rub`, `doc`, `br`, `aut`, `mot`, `site`, …).
- **Notes** : `[[texte]]`, `[[<nom>texte]]`, `[[<>texte]]`.
- **Glossaire** : `[?terme]`, `[?terme#glossaire]`, `[?terme|bulle]`, `[?terme{lang}]`.
- **Modèles** : `<nomN|param|clé=valeur>` génériques, avec prévisualisation serveur et formulaire
  d'édition piloté par YAML (reprise de `#FORMULAIRE_INSERER_MODELES`).
- Multilinguisme : `<multi>[fr]…[en]…</multi>` (inline et bloc), idiomes `<:module:cle:>`.
- Abréviations `[ABBR|explication]`.
- Code en backticks (SPIP 4+) : `` `code` `` et blocs ```` ```langage … ``` ````, utilisés par le porte-plume actuel.
- **Au-delà du core, en HTML uniquement** : intertitres de niveau 3 à 6 écrits `<h3>…</h3>` … `<h6>…</h6>`,
  alignements écrits `<div class="text-left|text-center|text-right|text-justify">…</div>`.
- **Référence fonctionnelle : le porte-plume par défaut** (`plugins-dist/porte_plume/barre_outils/edition.php`) —
  tout ce qu'il permet d'insérer doit être faisable dans l'éditeur (cf. [06](06-interface.md) §2).
- Bascule WYSIWYG ⇄ source, plein écran, synchronisation avec le textarea.
- Conservation des constructions **du core** mal formées ou non représentables (accolade orpheline, HTML
  inconnu…) dans des nœuds « bruts ».

### Configuration de référence

L'éditeur implémente la sémantique des raccourcis **du core SPIP** (TextWheel de la version installée), et
seulement elle. C'est sa configuration connue. Un texte est interprété comme le core l'interpréterait :
avec un plugin qui ajoute des raccourcis (typoenluminee, Couteau suisse…), ces raccourcis sont vus comme le
core les voit (du texte, ou d'autres raccourcis du core). Par exemple `{{{**Titre}}}` est un intertitre dont le
texte est « **Titre ». C'est le comportement attendu, pas une perte : l'éditeur ne prétend pas gérer une
configuration qu'il ne connaît pas. Un site qui dépend de tels raccourcis désactive l'éditeur sur les champs
concernés, ou fournit une extension ([07](07-extensibilite.md)).

### Exclus (v1)

- Remplacer TextWheel ou modifier le rendu public.
- Édition collaborative temps réel (Tiptap Collaboration / Yjs).
- Upload de documents par glisser-déposer (lot ultérieur, cf. [09](09-lots-roadmap.md)) ; le collage d'une ou
  plusieurs images est spécifié à part ([10](10-coller-images.md), lot L7.1).
- Syntaxes ajoutées par des plugins tiers (typoenluminee, Couteau suisse…) : hors de la configuration de
  référence (cf. ci-dessus). Ce qu'elles apportent (titres hiérarchisés, alignements) est couvert par du
  HTML simple.
- Champs en Markdown : ils restent gérés par markdown_editor (cf. §5).

## 4. Analyse du plugin markdown_editor (référence)

Copie locale : `/src/plugins/markdown_editor` (v1.0.1, Tiptap **2.27**, `tiptap-markdown` 0.8).

### Ce qu'il fait

- Remplace les textareas marqués `inserer_md_barre*` ou `data-md-editor-toolbar` par un wrapper
  (barre + éditeur + textarea masqué) — `src/main.js`.
- Sérialise en Markdown à chaque `onUpdate` dans le textarea ; ré-importe le textarea à chaque `input`.
- Nodes SPIP ajoutés à Tiptap :
  - **`SpipModel`** (`src/nodes/SpipModel.js`) — **confirmé : c'est bien l'extension de traitement
    des modèles.** Node inline atomique, attribut `spip_model = {full, name, id, raw_params, params}`.
    Reconnaissance par règles markdown-it (bloc et inline) avec la regex du core SPIP
    (`<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*>`), input rule et paste rule.
    NodeView qui POST le modèle à l'action `markdown_editor_compiler_modele` et affiche le HTML compilé
    (passé par `safehtml`), éléments interactifs neutralisés, bouton « Modifier » ouvrant
    `#FORMULAIRE_INSERER_MODELES` en modalbox. Commandes `insertSpipModel` / `updateSpipModel`.
  - `SpipHtml` (bloc `<html>…</html>` en texte brut), `SpipMultiInline`, `SpipMultiBlock`,
    `SpipLang` (`[fr]`), `SpipLink` (lien étendu, titre auto des liens vides via
    l'action `markdown_editor_analyser_lien`), `SpipTrailingNode`.
- Côté PHP : formulaire `inserer_modeles` refait avec Saisies (YAML dans `modeles/*.yaml`,
  ex. `modeles/media.yaml`), autorisation `markdowneditormodele_previsualiser`,
  barres d'outils déclarées par le pipeline `markdown_editor_toolbars`, config JS via
  `importmap` (SPIP 5) ou `header_prive` (SPIP 4).
- UI : barre d'outils déclarative (registre de composants `Toolbar.registerComponent`).

### Ce qu'il ne fait pas

- **Ni notes ni glossaire** : aucune extension, et en Markdown les `[[…]]` / `[?…]` passent
  comme du texte (voire sont mal interprétés comme liens).
- Pas d'extensibilité par sous-plugins (dernier point de sa todo).
- Rendu inline uniquement pour les modèles (un modèle seul sur sa ligne est enveloppé dans un `<p>`).
- Synchronisation brutale : `setContent` complet à chaque frappe dans le textarea (perte de
  l'historique d'annulation et de la sélection).
- Pas de tests JS ; l'aller-retour Markdown n'est pas vérifié.

### Ce dont on s'inspire

markdown_editor ne déclare pas de licence. tiptap_spip s'inspire de sa conception sans reprendre son code :
les deux comparaisons de code faites le 2026-10-15 (lignes et jetons, JS et PHP) n'ont relevé aucune copie.
Crédit et détail : `CREDITS.md`.

| Élément de markdown_editor | Dans tiptap_spip |
|----------------------------|------------------|
| Regex des modèles, attributs `spip_model`, `generateSpipModelAttributes` | Conception reprise ; regex prise au core (`Modeles.php`), attribut `model` réécrit (ordre et forme brute des paramètres) |
| NodeView de prévisualisation + `traitements_previsu` | Conception reprise ; `traitements_previsu()` vient du porte-plume, d'où markdown_editor tient aussi la sienne ; l'action `compiler_modele` est remplacée par le formulaire CVT |
| Formulaire `inserer_modeles` (Saisies + YAML) | Plugin Insérer modèles utilisé s'il est présent (question Q3) |
| Action `analyser_lien` + décorations titre auto | Idée reprise, servie par le formulaire CVT de l'éditeur (cf. [02](02-architecture.md) §5), code réécrit |
| `SpipMulti*`, `SpipLang`, `SpipHtml` | Idée des nœuds reprise ; structure, parse et sérialisation réécrits pour SPIP |
| Registre `Toolbar` et composants de boutons | Conception reprise (registre de composants), code réécrit pour Tiptap 3 |
| Câblage `importmap` / `header_prive`, `09_…_config.js.html` | Même mécanisme de SPIP (pipelines, configuration dans `spipConfig`), code réécrit |

Tout ce qui repose sur `tiptap-markdown` / markdown-it (règles `setup(markdownit)`, `storage.markdown`)
**n'est pas réutilisable** : remplacé par le parseur/sérialiseur SPIP ([04](04-parseur-serialiseur.md)).

## 5. Cohabitation

- **Porte-plume** : tiptap-spip prend la main sur les textareas que le porte-plume équiperait
  (classes `inserer_barre_edition`, `inserer_barre_forum`, `porte_plume_partout`), sauf désactivation
  par configuration. Le porte-plume reste disponible comme repli (mode source).
- **markdown_editor** : un même textarea n'est pris que par un seul éditeur. Si le champ est en
  Markdown (classe `inserer_md_barre*`, ou texte commençant par le marqueur du plugin markdown),
  tiptap-spip s'abstient. Les deux plugins doivent pouvoir partager le code commun (modèles, multi).
- **Formulaires publics** (forums) : barre réduite, sans modèles par défaut (autorisation).
- **Crayons** et tout autre hôte (CVT de plugins, réglages du site) : l'éditeur se lance sur n'importe quel
  textarea, comme le porte-plume ; le contexte des services serveur est résolu par des adaptateurs d'hôte
  ([02](02-architecture.md) §6). Dans le site public, l'éditeur hérite des styles du site (pas d'iframe).

## 6. Exigences non fonctionnelles

- **Zéro perte** : un texte ouvert puis enregistré sans modification doit être identique, caractère pour
  caractère, à `textarea.value` au chargement ; un texte modifié ne doit voir changer que les blocs touchés (cf. sérialisation conservatrice).
- **Équivalence de rendu** : `propre(source)` ≡ `propre(serialize(parse(source)))` sur tout le corpus.
- **Performance** : parse + rendu initial < 150 ms pour un texte de 50 000 caractères sur un poste
  moyen ; frappe sans latence perceptible (sérialisation différée/débouncée).
- **Sécurité** : tous les appels serveur passent par un **formulaire CVT** (signature des arguments et de la
  session par SPIP, autorisation dans `charger()`, cf. [02](02-architecture.md) §5) ; aucun HTML de
  prévisualisation inséré sans `safehtml` serveur ; pas d'`innerHTML` sur du contenu utilisateur côté JS
  sans passer par le schéma ProseMirror.
- **Accessibilité** : barre d'outils navigable au clavier (pattern ARIA *toolbar*), raccourcis clavier
  documentés, contrastes de l'espace privé.
- **Poids** : bundle minifié < 350 ko (gzip < 110 ko) hors prévisualisations.
