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
composants repris de markdown_editor (`Toolbar.registerComponent`). Barres fournies :

| Barre | Contenu |
|-------|---------|
| `edition` | tout le porte-plume par défaut (tableau ci-dessous) + annuler/rétablir, titres 3–6, alignement, exposant/indice, **glossaire**, **modèle**, multi, tableau (menu contextuel lignes/colonnes/fusions), bascule source, plein écran |
| `forum` | gras, italique, lien, citation, liste, code ; pas de modèles ni de notes par défaut |
| `minimale` | gras, italique, lien (pour `descriptif`, `chapo`…) |

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

Le choix de la barre suit la classe du textarea (`inserer_barre_edition`, `inserer_barre_forum`) ou
`data-tts-toolbar="nom"`.

Barre contextuelle (bubble menu, optionnelle) sur sélection de texte : gras, italique, lien, note, glossaire.

## 3. Modes

- **WYSIWYG** (défaut configurable) et **Source** : bouton bascule ; en mode source, le textarea est affiché
  (avec le porte-plume si présent, cf. Q4) et l'éditeur masqué. La bascule fait un flush de sérialisation
  ou un re-parse ([02](02-architecture.md) §4). La position du curseur est conservée au mieux
  (correspondance bloc ↔ plage de source via `spipSrc`).
- **Plein écran** : repris de markdown_editor ; les modalbox (modèles) et popovers s'affichent au-dessus.
- Le mode choisi est mémorisé par auteur (préférence `localStorage` + option de config par défaut).

## 4. Popovers et dialogues

| Objet | Interface |
|-------|-----------|
| Lien | popover : cible avec autocomplétion d'objets SPIP, bulle, langue, nouvelle fenêtre, ouvrir, retirer |
| Note | popover avec sous-éditeur, nom optionnel, « sans appel » |
| Glossaire | popover : glossaire, numéro, bulle, langue, voir la définition |
| Modèle | modalbox `#FORMULAIRE_INSERER_MODELES` (YAML) ou champ brut |
| Abréviation | popover : explication, langue |
| Nœud brut | popover : source éditable + validation par re-parse (« convertir » si devenu reconnaissable) |

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

Lot L2.3 : barre minimale (Lien, Modèle, Source ; Lien et Modèle désactivés en mode source) et `Mod-K`.
Lot L3.2 : boutons Note, Glossaire, Abréviation, désactivés en mode source comme Lien et Modèle ;
`Mod-Alt-N`, `Mod-Alt-G` ; règles de saisie `[[` et `[?x]` ; panneau des notes sous l'éditeur, masqué
sans note et en mode source. Lot L4.2 : bouton Multilingue et sélecteur de la langue affichée
(masqué sans multi), désactivés en mode source.
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

## 8. Internationalisation

Toutes les chaînes viennent des fichiers de langue SPIP (`lang/tiptap_spip_fr.php`…), injectées dans la
config JS (`spipConfig.tiptap_spip.i18n`). Aucune chaîne en dur dans le JS (à corriger par rapport à
markdown_editor : bouton « Modifier », « Liste »…).

## 9. Style

- CSS de l'interface préfixé `tts-`, variables CSS de l'espace privé SPIP 4/5 (thème clair/sombre).
- CSS du contenu (`css/tiptap_spip_contenu.css`) surchargeable par le squelette, pour approcher le
  rendu public dans l'espace privé ; dans le site public (Crayons, CVT publics), l'éditeur hérite des styles
  du site ([02](02-architecture.md) §6).
