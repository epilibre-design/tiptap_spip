# 09 — Lots et feuille de route

## 1. Lots

| Lot | Contenu | Livrable vérifiable |
|-----|---------|---------------------|
| **L0 — Socle** | Paquet SPIP, bundle esbuild, chargement SPIP 4/5, `TextareaBridge`, schéma Tiptap 3 (extensions déclarées une à une), Vitest/PHPUnit/Playwright en place | Un textarea d'article est remplacé par Tiptap, texte simple aller-retour |
| **L1 — Cœur SPIP** | `src/spip/` : protections, blocs, inline (gras, italique, intertitres, titres `<h3>`–`<h6>`, alignements `<div>`, listes, `_ `, `----`, quote, backticks, code, cadre, html, tableaux), échappements, nœuds bruts, sérialisation conservatrice ; liens, notes, modèles, glossaire, abréviations, ancres, multi et idiomes y sont reconnus mais conservés en `spipRawInline` jusqu'aux lots L2–L4 | Invariants 1, 2, 4 verts sur le corpus ; harnais d'équivalence de rendu opérationnel |
| **L2 — Liens et modèles** | découpé en trois plans : **L2.1** (fait) liens, liens sans texte, ancres et modèles dans le cœur et le schéma, affichage compact, imbrication des marks corrigée ; **L2.2** (fait) formulaire CVT `tiptap_spip` (services serveur `previsu_modele`, `titre_lien`, `rechercher` ; `glossaire` au lot L3) et client `cvt.js` ; **L2.3** (fait) interface : prévisualisation des modèles (porté depuis markdown_editor), titres des liens sans texte, popover de lien avec recherche d'objets, insertion de modèles | Insertion/édition de liens et modèles de bout en bout |
| **L2b — Hôtes** (fait) | lancement générique et cycle de vie, adaptateurs (Crayons, `data-tts-*`, `tiptap_spip_contextes`, sans objet), formulaire de services à la demande, styles par hôte | Tests « Hôtes » de la spec 08 |
| **L3 — Notes et glossaire** (fait) | découpé en deux plans : **L3.1** (fait) notes (contenu analysé et restitué à l'identique), glossaire et abréviations dans le cœur et le schéma, appels numérotés, ordre réel du core (`pre_liens`, liens, notes, wheel) ; **L3.2** (fait) opération `glossaire` du formulaire CVT, popover de note avec sous-éditeur, panneau des notes, popovers glossaire et abréviation, popovers imbriqués, commandes, raccourcis et règles de saisie, validation des saisies par relecture | Critère d'acceptation 4 |
| **L4 — Multilinguisme** (fait) | découpé en deux plans : **L4.1** (fait) multi en ligne (atome) et en bloc, idiomes, dans le cœur et le schéma, affichage, oracle dans chaque langue ; **L4.2** (fait) interface : langue affichée, popover de multi en ligne, insertion, langues d'un multi bloc, traductions et popover des idiomes | Édition d'un texte multilingue sans perte |
| **L5 — Interface** | découpé en trois plans : **L5.1** (fait) barres `edition`/`forum`/`minimale` déclarées (`barres.json`, pipeline `tiptap_spip_toolbars`), registre de composants, menus accessibles, commandes d'édition (alignement, poésie, tableaux, guillemets, casse), plein écran, mode mémorisé, raccourcis ; **L5.2** (fait) anomalies signalées, barre d'état (mots, anomalies), popover du nœud brut (source du segment relue), piège de focus, zone éditable et atomes nommés, audit axe ; **L5.3** (fait) page de configuration CFG (activation, champs équipés, mode, niveaux, glossaires ; modèles masqués reportés avec leur catalogue), contrôle i18n, popovers `div role="dialog"` (axe sans violation), critère 6 mesuré et tenu, e2e sous Chromium, Firefox et WebKit | Critères 6, 7, 8 |
| **L6 — Extensibilité** | (fait) API `registerExtension`, pipelines `tiptap_spip_extensions` et `tiptap_spip_i18n`, ré-export du core (`window.tiptapSpip`), harnais `allerRetour`, exemple de plugin tiers `exemples/tiptap_spip_faq` | Plugin d'exemple fonctionnel sans modifier le cœur |
| **Compatibilité SPIP 4.2 et 5** (fait) | sites jetables SPIP 4.2.16 et 5.0-dev, lancement commun SPIP 4/5 hors de `_inits/` (configuration et module par `header_prive`/`insert_head`, bundle par l'importmap en SPIP 5), glossaire par `pre_liens` en SPIP 5, chargement du noyau commun aux scripts de test, diff figé propre à une branche de SPIP | Critère 8 |
| **Catalogue des modèles** (fait) | Q3 tranchée : formulaires YAML du plugin Insérer modèles en modalbox (insertion, « Modifier » prérempli), saisie brute sinon, modèles masqués par sa configuration ; plein écran au-dessus du bandeau de l'espace privé | Insertion et modification d'un modèle par son formulaire |
| L7 — Ultérieur | glisser-déposer de documents (upload → `<docN>`), aperçu `<math>`, collaboration | — |

État de L0 : chargement SPIP 4 vérifié de bout en bout (site 4.4.21 jetable) ; chargement SPIP 5 repris de
markdown_editor, non vérifié faute de site SPIP 5 sur le poste (vérifié depuis, et refait : lot Compatibilité
SPIP 4.2 et 5). Mesure du critère 6 (spec 08) : 50 000
caractères, montage à froid 256 ms, à chaud 102 à 127 ms dans Chromium 149 ; optimisation à prévoir avant la
recette (L5).

L1 est le lot critique : rien d'autre ne vaut tant que l'aller-retour n'est pas fiable. Il est développé en
TDD avec le corpus.

## 2. Risques

| Risque | Mitigation |
|--------|------------|
| Divergences subtiles avec TextWheel (ordre des règles, cas limites) | Oracle `propre()` en CI, regex recopiées du core avec référence, corpus réel |
| Textes existants « sales » (accolades orphelines, HTML collé) | Nœuds bruts + sérialisation conservatrice : jamais de réécriture d'un bloc non touché |
| Site utilisant des raccourcis de plugins tiers | Hors configuration de référence : documenté ; désactiver l'éditeur sur ces champs ou fournir une extension |
| Doublon de code avec markdown_editor | Mutualisation (Q3) |
| Poids du bundle | Tiptap 3 modulaire, tree-shaking, pas de framework UI |
| Charge serveur (prévisualisations, titres de liens) | Cache JS, regroupement par lot, limites dans `verifier()` |

## 3. Questions ouvertes

| # | Question | Proposition |
|---|----------|-------------|
| Q1 | Nom et préfixe du plugin | `tiptap_spip`, nom « Éditeur visuel pour SPIP » |
| Q2 | Intertitres de niveau > 2 et alignements | **Tranché** : HTML simple (`<h3>`…`<h6>`, `<div class="text-…">`), pas de raccourcis de plugins tiers |
| Q3 | Mutualiser avec markdown_editor (modèles, multi, html, formulaire `inserer_modeles`, Toolbar) ? | **Tranché (2026-10-12)** pour le catalogue des modèles : plugin contrib Insérer modèles facultatif (`<utilise>`), sans copie ni paquet commun ; saisie brute sans lui ([05](05-extensions-spip.md) §3). Multi, html et Toolbar restent propres à tiptap_spip |
| Q4 | En mode source, réactiver le porte-plume sur le textarea ? | Oui si le plugin porte-plume est actif |
| Q5 | Autolien : sérialiser les URL tapées en `[->url]` ou les laisser en texte ? | Texte par défaut (SPIP fait l'autolien), lien explicite seulement si créé via le popover |
| Q6 | Champs autres que `texte` (`chapo`, `ps`, `descriptif`, champs extras) | Configurable, barre `minimale` par défaut |
| Q7 | Public (forums, formulaires d'édition publics, Crayons) en v1 ? | Oui : lot L2b ; forums avec barre `forum`, sans modèles ni prévisualisation serveur |
| Q8 | Noms des classes d'alignement | **Tranché** : `text-left` / `text-center` / `text-right` / `text-justify`, déjà définies par la dist et Bootstrap ; surchargeables par constante |
| Q9 | Crayons : le crayon d'un champ texte doit-il ouvrir l'éditeur par défaut, ou seulement sur option (comme `porte_plume_partout`) ? | **Tranché** : sur option (`tiptap_spip/crayons`, `non` par défaut), comme `tiptap_spip/public` pour le site public |
