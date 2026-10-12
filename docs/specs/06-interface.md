# 06 — Interface

## 1. Structure

```
┌ div.tts-editor ─────────────────────────────────────────────────────────┐
│ ┌ div.tts-editor__menu (role=toolbar) ─────────────────────────────────┐ │
│ │ ↶ ↷ │ Titre▾ Liste▾ ❝ </> │ G I S ⁱ ₓ 🔗 │ [¹] [?] ⧉Modèle 🌐Multi │ ⇆ ⛶ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌ div.tts-editor__wysiwyg (Tiptap) ────────────────────────────────────┐ │
│ │  contenu mis en forme…                                              │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ▸ Notes (3)          ← panneau repliable                                 │
│ ┌ textarea (masqué en mode WYSIWYG, visible en mode source) ───────────┐ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ⚠ 1 anomalie de syntaxe          ← barre d'état (mots, anomalies)       │
└─────────────────────────────────────────────────────────────────────────┘
```

Le wrapper est construit autour du textarea existant (même méthode que markdown_editor) ; le textarea
garde son `name`, ses classes et sa place dans le formulaire.

## 2. Barre d'outils

Déclarative, décrite côté PHP par le pipeline `tiptap_spip_toolbars` et rendue par le registre de
composants repris de markdown_editor (`Toolbar.registerComponent`).

**Réalisation (lot L5.1)** :
- **Une seule déclaration**, `src/ui/barres.json`, importée par le bundle et lue par PHP
  (`tiptap_spip_barres()`), qui la passe au pipeline `tiptap_spip_toolbars` (`flux['data']`) puis à la
  configuration JS (`spipConfig.tiptap_spip.toolbars`). Le JS prend celle de la configuration, sinon celle du
  bundle.
- **Forme d'une barre :** liste de noms de composants (`'|'` : séparateur), ou d'objets
  `{ "composant": nom, …options }` (ex. `{ "composant": "titre", "niveaux": [2, 3] }`). Pas de libellé dans la
  déclaration : chaque composant prend les siens dans `labels.js`. Un nom inconnu est ignoré (avertissement en
  console).
- **Composant :** fabrique `(ctx, options) => { element, cible?, maj?(), source? }`, avec
  `ctx = { editor, ui, instance }`. `maj()` est appelée à chaque transaction et à chaque changement de mode.
  En mode source, seuls les composants `source: true` (Source, Plein écran) restent actifs.
- **Composants du cœur :**
  - `annuler`, `retablir` ;
  - `titre` : menu Paragraphe, Intertitre, Titre de niveau 3, 4…, selon l'option `niveaux` (par défaut 2 à 4) ;
  - `liste` : puces, numérotée, indenter, désindenter ;
  - `citation`, `poesie`, `cadre` (`codeBlock`, ```` ``` ```` comme le porte-plume) ;
  - `gras`, `italique`, `barre`, `exposant`, `indice`, `code` (mark, `` ` ``) ;
  - `lien`, `note`, `glossaire`, `abbr`, `modele`, `multi`, `langues` ;
  - `alignement` : gauche, centre, droite, justifié, sans ;
  - `tableau` : insérer (trois lignes de trois cellules, sans en-tête), ligne d'en-tête, lignes et colonnes
    avant ou après, suppression, fusion et scission de cellules, suppression du tableau ;
  - `guillemets` : doubles et simples selon la langue de l'objet, comme le porte-plume (fr eo cpf ar es :
    « » et “ ” ; bg de pl hr src : „ “ et ‚ ‘ ; autres : “ ” et ‘ ’), sans espace ajoutée (la typographie de
    SPIP pose l'espace insécable) ;
  - `caracteres` : À É È æ Æ œ Œ Ç, majuscules, minuscules ;
  - `source`, `pleinEcran`.
- **Icônes :** SVG de Remix Icon (Apache-2.0) extraits par `npm run icones` dans `src/ui/icones.js`. La police
  de markdown_editor n'a ni exposant, ni tableau, ni alignement, et son préfixe `sp-icone_` entrerait en
  conflit. Le libellé traduit est porté par `aria-label` et la bulle (avec le raccourci).
- La barre minimale du lot L2.3 (Lien, Modèle, Source) devient celle du tableau ci-dessous.
- La barre contextuelle (bubble menu) n'est pas livrée.

Barres fournies :

| Barre | Contenu |
|-------|---------|
| `edition` | tout le porte-plume par défaut (tableau ci-dessous) + annuler/rétablir, titres (niveaux configurés, 2 à 4 par défaut), alignement, exposant/indice, **glossaire**, **modèle**, multi, tableau (menu contextuel lignes/colonnes/fusions), bascule source, plein écran |
| `forum` | gras, italique, lien, citation, liste, code, source ; pas de modèles ni de notes par défaut |
| `minimale` | gras, italique, lien, source (pour `descriptif`, `ps`…) |

Correspondance avec la barre `edition` du porte-plume SPIP 4.4 (`porte_plume/barre_outils/edition.php`) :

| Bouton porte-plume | Insère | Équivalent tiptap-spip |
|--------------------|--------|------------------------|
| Intertitre (`header1`) | `{{{…}}}` | menu Titre, niveau 2 |
| Gras / italique | `{{…}}` / `{…}` (avec `espace_si_accolade`) | marks `bold` / `italic` |
| Barré | `<del>…</del>` | mark `strike` |
| Liste à puces / numérotée, indenter / désindenter | `-*` / `-#` | listes, `Tab` / `Shift-Tab` |
| Lien | `[…->…]` | popover lien |
| Note | `[[…]]` | note |
| Citation, poésie | `<quote>`, `<poesie>` | `blockquote`, `spipPoesie` |
| Guillemets (« », “ ”, „ “, ‚ ‘ …) selon la langue | caractères | menu Guillemets : entoure la sélection |
| Caractères spéciaux (À É È æ Æ œ Œ Ç), majuscules / minuscules | caractères | menu Caractères |
| Code, cadre | `` `…` ``, ```` ```…``` ```` | mark `code`, `codeBlock` |

`espace_si_accolade` (porte-plume) ajoute des espaces quand la sélection touche une accolade ; le sérialiseur
traite le même cas par ses séparateurs de sécurité ([04](04-parseur-serialiseur.md) §3).

Le choix de la barre suit `data-tts-toolbar="nom"`, sinon la classe du textarea (`inserer_barre_edition`,
`inserer_barre_forum`), sinon l'hôte ([02](02-architecture.md) §6 : `forum` dans un formulaire de forum,
`edition` pour `texte` et `chapo`, `minimale` pour les autres champs). Une barre inconnue donne `minimale`.

Barre contextuelle (bubble menu, optionnelle) sur sélection de texte : gras, italique, lien, note, glossaire.

## 3. Modes

- **WYSIWYG** (défaut configurable) et **Source** : bouton bascule ; en mode source, le textarea est affiché
  (avec le porte-plume si présent, cf. Q4) et l'éditeur masqué. La bascule fait un flush de sérialisation
  ou un re-parse ([02](02-architecture.md) §4). La position du curseur est conservée au mieux
  (correspondance bloc ↔ plage de source via `spipSrc`).
- **Plein écran** : les modalbox (modèles) et popovers s'affichent au-dessus. Lot L5.1 : par CSS
  (`.tts-editor--plein-ecran`, position fixe, `html.tts-plein-ecran` sans défilement), et non par l'API
  Fullscreen de markdown_editor : celle-ci n'affiche que l'élément en plein écran, une modalbox posée dans
  `body` serait cachée.
- Le mode choisi est mémorisé (préférence `localStorage` `tiptap_spip.mode`, lue et écrite sous try/catch,
  sinon option `spipConfig.tiptap_spip.mode`, sinon WYSIWYG). La préférence est celle du navigateur, pas de
  l'auteur.

## 4. Popovers et dialogues

| Objet | Interface |
|-------|-----------|
| Lien | popover : cible avec autocomplétion d'objets SPIP, bulle, langue, nouvelle fenêtre, ouvrir, retirer |
| Note | popover avec sous-éditeur, nom optionnel, « sans appel » |
| Glossaire | popover : glossaire, numéro, bulle, langue, voir la définition |
| Modèle | modalbox `#FORMULAIRE_INSERER_MODELES` (YAML) ou champ brut |
| Abréviation | popover : explication, langue |
| Nœud brut | popover : source éditable + validation par re-parse (« convertir » si devenu reconnaissable) |

Lot L5.2, nœud brut :
- **Ouverture :** clic ou `Entrée` sur un `spipRawInline` ou un `spipRaw`, ou bouton des anomalies de la barre
  d'état.
- **Contenu du popover :**
  - la source exacte du **segment** qui contient le nœud, c'est-à-dire la sérialisation conservatrice de son
    groupe de blocs (carte de segments). Comme pour la sérialisation conservatrice, le groupe ne vaut que si
    ses blocs sont restés ceux du segment (forme canonique égale à `spipHash`). Après une suppression ou une
    modification, `spipGroup` ne compte plus les bons blocs : le bloc est alors pris seul, sans jamais
    englober un bloc voisin ;
  - l'explication de l'anomalie s'il en est une.
- **« Appliquer »** (ou `Mod-Entrée`) relit la source (`parse`) et remplace le segment : un raccourci réparé
  devient éditable (« convertir »). Le séparateur qui précédait le segment est gardé. Une source qui ne peut
  pas se placer là est refusée, par exemple un tableau dans une note : le popover s'ouvre aussi depuis les
  sous-éditeurs (note, partie de multi).

Tous les popovers : fermeture par `Échap`, focus rendu à l'éditeur, validation par `Entrée`.

Lot L3.2 : un popover peut en ouvrir un autre (lien ou glossaire depuis le sous-éditeur d'une note) :
l'enfant s'ouvre sans fermer son parent, rend le focus au sous-éditeur, et se ferme avec lui. Le focus
est rendu tout de suite (`view.focus()`) : une touche pressée juste après agit dans l'éditeur. Les
popovers d'une instance se ferment à sa destruction. Piège de focus des popovers (§7) : lot L5.

## 5. Anomalies de syntaxe

Les nœuds `spipRaw*` issus d'un raccourci cassé (accolade orpheline, `[[` non fermé…) sont surlignés
(soulignement ondulé) et comptés dans la barre d'état. Un clic ouvre le popover du nœud brut avec
l'explication (« accolade fermante manquante : tout le texte qui suit sera en italique »).
Les nœuds bruts légitimes (HTML inconnu volontaire) ne sont pas signalés comme anomalies.

Lot L5.2 (`src/spip/anomalies.js`, `src/editor/anomalies.js`, `src/ui/StatusBar.js`). Le rendu de SPIP a été
vérifié avec l'oracle (SPIP 4.4) ; l'explication décrit ce qu'il fera de chaque cas.

| Source du nœud brut | Anomalie | Rendu SPIP |
|---------------------|----------|------------|
| `{`, `{{`, `<i>`, `<strong>`, `<del>`, `<sup>`, `<sub>`, `<code>` | `ouverture` | mise en forme jusqu'à la fin du paragraphe |
| `}`, `}}`, `</i>`…, `</quote>`… | `fermeture` | affiché tel quel, ou sans effet |
| `{{{` et plus | `intertitre` | la suite devient un intertitre |
| `<quote>` | `citation` | tout le texte qui suit passe en citation |
| `<multi>`, `<cadre>`, `<frame>`, `<poesie>`, `<poetry>`, `<html>`, `<math>` | `balise` | non traité |

- **Non signalés :** le HTML inconnu, les entités, `{}`, et les blocs gardés bruts par repli (tableau
  incohérent…). Ils restent éditables par le popover.
- **Signalement :**
  - soulignement ondulé (`.tts-anomalie`), explication en bulle ;
  - barre d'état sous le textarea : « N mots », et « N anomalies de syntaxe » (bouton : anomalie suivante
    après la sélection, popover ouvert ; région `aria-live`) ;
  - barre d'état masquée en mode source.
- `[[` ou `[x->` non fermés restent du texte (SPIP les affiche tels quels) : ce ne sont pas des nœuds bruts, ils
  ne sont pas signalés.

## 6. Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Gras / italique / barré | `Mod-B` / `Mod-I` / `Mod-Shift-S` |
| Lien | `Mod-K` |
| Note | `Mod-Alt-N` |
| Glossaire | `Mod-Alt-G` |
| Modèle | `Mod-Alt-M` |
| Intertitre niveau 2 à 6 / paragraphe | `Mod-Alt-2` … `Mod-Alt-6` / `Mod-Alt-0` |
| Bascule source | `Mod-Shift-E` |
| Plein écran | `F11` dans l'éditeur, `Échap` pour sortir |
| Annuler / rétablir | `Mod-Z` / `Mod-Shift-Z` |
| Exposant / indice / code | `Mod-.` / `Mod-,` / `Mod-E` |

Lot L2.3 : barre minimale (Lien, Modèle, Source ; Lien et Modèle désactivés en mode source) et `Mod-K`.
Lot L3.2 : boutons Note, Glossaire, Abréviation, désactivés en mode source comme Lien et Modèle ;
`Mod-Alt-N`, `Mod-Alt-G` ; règles de saisie `[[` et `[?x]` ; panneau des notes sous l'éditeur, masqué
sans note et en mode source. Lot L4.2 : bouton Multilingue et sélecteur de la langue affichée
(masqué sans multi), désactivés en mode source.
Lot L5.1 : barres déclarées (§2), `Mod-Alt-M`, `Mod-Shift-E` (depuis l'éditeur comme depuis le textarea),
`F11` et `Échap` (écoutés en capture sur `.tts-editor` : `Échap` ne quitte le plein écran que si aucun
popover ni menu de l'instance n'est ouvert, car ProseMirror empêche l'action par défaut de toute touche
`Échap`). Les intertitres `Mod-Alt-2` … `Mod-Alt-6` et `Mod-Alt-0` sont ceux de Tiptap.
Une commande lancée depuis la barre rend le focus à l'éditeur tout de suite (`view.focus()`, la commande
`focus` de Tiptap attend l'image suivante).
ProseMirror lit la sélection du navigateur sur `selectionchange`, asynchrone dans Chromium : une commande
clavier qui suit de près `Maj+flèches` verrait l'ancienne sélection. Le popover de lien force donc cette
lecture avant d'agir.

Input rules (frappe directe des raccourcis SPIP, pour les habitués) : `{{x}}`, `{x}`, `{{{` en début de
bloc, `-* ` / `-# ` en début de ligne, `----`, `[[`, `[?x]`, `<doc12>` etc.

## 7. Accessibilité

- Barre `role="toolbar"` avec navigation aux flèches (roving tabindex), `aria-pressed` sur les boutons
  bascules, `aria-label` traduits.
- Zone éditable avec `aria-label` = label du champ SPIP, `aria-multiline="true"`.
- Nœuds atomiques (notes, modèles) annoncés (`aria-label="Note 2 : …"`, `"Modèle doc 12"`).
- Popovers : `role="dialog"`, piège de focus, retour de focus.

Lot L5.1 :
- **Barre :** `role="toolbar"` et `aria-label`, roving tabindex (un seul élément tabulable ; `←` `→` `Début`
  `Fin` ; éléments désactivés ou masqués sautés), `aria-pressed` sur les bascules.
- **Menus** (pattern « menu button ») : bouton `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` ; liste
  `role="menu"`, éléments `menuitem`, `menuitemradio` (choix exclusifs : titre, alignement) ou
  `menuitemcheckbox` (types de liste), avec `aria-checked`. `↓` ou `Entrée` ouvre, `↑` `↓` `Début` `Fin`
  parcourent, `Échap` ferme et rend le focus au bouton, `Tab` ou un clic ailleurs ferme. Un choix coché
  reste atteignable même sans effet. Un seul menu ouvert à la fois.

Lot L5.2 :
- **Zone éditable :** `aria-label` = libellé du champ (son `<label>`, sinon son `aria-label` ou sa bulle, sinon
  « Texte ») et `aria-multiline="true"`.
- **Atomes :** modèles `role="group"`, `aria-label="Modèle doc 12"` ; appels de note `role="note"` avec leur
  `aria-label`.
- **Piège de focus :** `Tab` sur le dernier élément d'un popover revient au premier, `Maj+Tab` sur le premier va
  au dernier. Une tabulation déjà traitée (liste du sous-éditeur d'une note) n'est pas reprise.
- **Audit axe** (`@axe-core/playwright`, e2e) de l'éditeur, d'un menu ouvert et d'un popover ouvert : aucune
  violation critique ni sérieuse. Reste une violation mineure (`aria-allowed-role`) : le popover est un
  `<form role="dialog">`, et le rôle `dialog` n'est pas permis sur un `form`.

## 8. Internationalisation

Toutes les chaînes viennent des fichiers de langue SPIP (`lang/tiptap_spip_fr.php`…), injectées dans la
config JS (`spipConfig.tiptap_spip.i18n`). Aucune chaîne en dur dans le JS (à corriger par rapport à
markdown_editor : bouton « Modifier », « Liste »…).

## 9. Style

- CSS de l'interface préfixé `tts-`, variables CSS de l'espace privé SPIP 4/5 (thème clair/sombre).
- CSS du contenu (`css/tiptap_spip_contenu.css`) surchargeable par le squelette, pour approcher le
  rendu public dans l'espace privé ; dans le site public (Crayons, CVT publics), l'éditeur hérite des styles
  du site ([02](02-architecture.md) §6).
