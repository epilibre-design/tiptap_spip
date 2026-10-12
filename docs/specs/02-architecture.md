# 02 — Architecture

## 1. Vue d'ensemble

```
            ┌───────────────────────────── navigateur ─────────────────────────────┐
            │                                                                       │
 textarea ──┼─► SpipParser ──► JSON ProseMirror ──► Editor Tiptap 3 ──► vue WYSIWYG │
 (source    │       ▲                                   │                           │
  SPIP)  ◄──┼── SpipSerializer ◄── JSON ◄───────────────┘ (onUpdate, débouncé)       │
            │                                                                       │
            │  NodeViews modèles / glossaire / liens ──fetch──┐                     │
            └─────────────────────────────────────────────────┼─────────────────────┘
                                                              ▼
                       formulaire CVT tiptap_spip (signé, autorisé) :
                       previsu_modele, titre_lien, glossaire, rechercher
                       formulaire CVT inserer_modeles (modalbox)
```

Le **textarea reste la source de vérité** pour la soumission du formulaire : l'éditeur ne fait
qu'en produire le contenu. Le JSON n'est jamais stocké ; c'est le format pivot en mémoire et dans
les tests.

## 2. Le plugin SPIP

- Préfixe proposé : `tiptap_spip` (cf. Q1 dans [09](09-lots-roadmap.md)).
- `compatibilite="[4.2.0;5.*]"`.
- Nécessite : `saisies`, `yaml`, `verifier` (formulaire des modèles). Utilise : `porte_plume`
  (repli), `markdown_editor` (détection pour s'abstenir).

```
tiptap_spip/
├── paquet.xml
├── tiptap_spip_pipelines.php        # header_prive, importmap, toolbars, autoriser, formulaire_fond
├── tiptap_spip_fonctions.php        # traitements_previsu (repris de markdown_editor)
├── tiptap_spip_options.php          # constantes surchargeables
├── formulaires/
│   ├── tiptap_spip.html / .php      # services serveur de l'éditeur (CVT, cf. §5)
│   ├── configurer_tiptap_spip.html
│   └── inserer_modeles.*            # si non mutualisé avec markdown_editor
├── inclure/tiptap_spip_services.html  # rend #FORMULAIRE_TIPTAP_SPIP, concaténé après le formulaire d'édition
├── tiptap_spip_services.html        # même formulaire, chargé à la demande par les hôtes hors editer_* (§6)
├── modeles/*.yaml                   # descriptions de formulaires de modèles (doc, img, emb…)
├── prive/
│   ├── javascript/
│   │   ├── tiptap_spip_config.js.html            # configuration JS, calculée à chaque page
│   │   ├── tiptap_spip.js / tiptap_spip.min.js   # bundle généré
│   │   └── tiptap_spip/                          # sources npm (cf. §3)
│   ├── squelettes/contenu/configurer_tiptap_spip.html
│   └── style_prive_plugin_tiptap_spip.css.html
├── css/tiptap_spip_contenu.css      # rendu du contenu dans l'éditeur (proche du public)
├── lang/
└── tests/                           # PHPUnit (cf. 08)
```

### Pipelines et points d'entrée

| Pipeline / mécanisme | Rôle |
|----------------------|------|
| `header_prive` / `insert_head` | Charger la config, les feuilles de style et le module de lancement (SPIP 4 et 5) |
| `importmap` (SPIP 5) | Déclarer le bundle (`tiptap_spip.js`), importé par le module de lancement et par les plugins tiers |
| `tiptap_spip_toolbars` (nouveau) | Déclarer/modifier les barres d'outils (`edition`, `forum`, …) : `flux['data']`, barres de `src/ui/barres.json` (lot L5.1, [06](06-interface.md) §2) |
| `tiptap_spip_contextes` (nouveau) | Déclarer le contexte (objet, id, champ) des CVT de plugins qui embarquent l'éditeur (§6) |
| `tiptap_spip_extensions` (nouveau) | Déclarer des extensions JS tierces à charger (cf. [07](07-extensibilite.md)) : `nom => ['src', 'dependances']` |
| `tiptap_spip_i18n` (nouveau) | Ajouter des chaînes de langue aux libellés de l'interface (cf. [07](07-extensibilite.md)) |
| `autoriser` | `tiptapspipmodele_previsualiser`, `tiptapspip_utiliser` |
| `porte_plume_barre_pre_charger` / config | Désactiver le porte-plume sur les champs pris en charge |

Lancement (vérifié sur SPIP 4.2, 4.4 et 5.0-dev, cf. [08](08-tests-recette.md) critère 8) :
- Un même chemin pour SPIP 4 et 5 : `tiptap_spip_head()` insère les feuilles de style et un module qui
  pose la configuration, importe les extensions tierces puis lance `tiptap_spip_init()`, relancé à chaque
  `onAjaxLoad`.
- SPIP 5 : le module importe le bundle et `onAjaxLoad` par l'importmap (`'tiptap_spip.js'`,
  `'ajaxCallback.js'`) : un plugin tiers qui importe `tiptap_spip.js` partage alors le même module, donc
  le même registre d'extensions. La configuration est posée dans le module, car le module
  d'initialisation de SPIP remplace `window.spipConfig` avant lui.
- Pas de script dans `prive/javascript/_inits/` : SPIP 5 les concatène en un fichier statique, gardé
  tant que le cache de `_init.js` dure (100 h) et que l'invalidation n'atteint pas. La configuration
  du plugin n'y était pas reprise (`prive` y valait même `false`, SPIP 5 passant un booléen), et le
  bundle y était chargé sur toutes les pages publiques (chemin `prive` du plugin).

### Configuration (CFG)

- Activer pour : espace privé / public ; par type d'objet et par champ (`texte`, `chapo`, `ps`,
  `descriptif`…).
- Mode par défaut à l'ouverture : WYSIWYG ou source.
- Niveaux d'intertitres disponibles et convention de sérialisation (cf. [03](03-schema-json.md) §3).
- Modèles masqués dans l'interface (repris de `inserer_modeles/ignorer_modeles`).
- Glossaires proposés (`wikipedia` par défaut + glossaires déclarés `glossaire_XXX`).

Réalisation (lot L5.3) :
- **Page :** `configurer_tiptap_spip`, entrée du menu Configuration. Le formulaire CVT
  `formulaires/configurer_tiptap_spip.{html,php}` n'utilise pas Saisies et écrit la méta `tiptap_spip`.
  `tiptap_spip_config()` (`inc/tiptap_spip_config.php`) la relit en remplaçant chaque valeur absente ou
  invalide par son défaut. L'autorisation `configurer` est vérifiée par le core.
- **Activation :**
  - site public et crayons : `non` par défaut, indépendants. Le bundle est chargé dans le site public dès
    que l'un des deux est actif ; le lancement JS n'y équipe les formulaires qu'avec l'option publique
    (`public` de la config JS), et les crayons qu'avec la leur ;
  - pas de réglage propre à l'espace privé, car décocher tous les champs d'un objet y désactive l'éditeur.
- **Champs candidats :** champs éditables des objets éditables dont le traitement passe par `propre()`. Par
  exemple `texte`, `chapo`, `ps` et `descriptif` d'un article, ou `bio` d'un auteur ; jamais `titre` ni
  `nom_site`, qui passent par `typo()`.
  - Tous sont équipés tant qu'aucun choix n'a été fait pour l'objet.
  - Un formulaire d'objet reçoit un formulaire de services par champ équipé, et `data-tts-champs` sur son
    `<form>` : le lancement JS n'équipe que ces champs.
  - Pour un crayon, `spipConfig.tiptap_spip.champs` (objet → champs) fait le même tri.
  - Un formulaire `editer_*` d'un objet non éditable n'est pas pris en charge.
- **Mode et niveaux :** mode à l'ouverture (`visual` par défaut) ; niveaux d'intertitres parmi 2 à 6, au
  moins un, `[2, 3, 4]` par défaut. Le menu Titre prend ceux de la configuration quand sa barre n'en
  indique pas.
- **Glossaires :** glossaires nommés proposés dans le popover du glossaire, tous par défaut. L'opération
  `glossaire` accepte toujours tous les glossaires du site, car un raccourci existant reste valide.
- **Modèles masqués :** reportés avec le catalogue des modèles (`inserer_modeles`, Q3). L'interface n'en
  liste encore aucun, donc rien à masquer.

## 3. Le code JavaScript

Sources dans `prive/javascript/tiptap_spip/` (package npm privé), bundle construit avec **esbuild**
(`npm run build`) en `prive/javascript/tiptap_spip.js` et `.min.js`, versionnés comme ceux de
markdown_editor pour que le plugin s'installe sans build. esbuild remplace bun (absent des postes de
développement) et produit le même module ESM.

Licence : GPL-3.0-or-later (fichier `LICENSE`), imposée par le code repris de textwheel, du porte-plume et
de markdown_editor. Les paquets embarqués dans le bundle (MIT : Tiptap, ProseMirror ; Apache-2.0 : Remix
Icon) n'ont pas de commentaire de licence : le build écrit leurs licences dans
`prive/javascript/tiptap_spip.LICENSES.txt`, d'après la liste des paquets embarqués (metafile d'esbuild), et
le bundle commence par une bannière qui y renvoie.

```
src/
├── main.js                     # tiptap_spip_init(racine) : découverte des textareas, montage ;
│                               # config lue dans window.spipConfig.tiptap_spip (SPIP 4 et 5)
├── editor/
│   ├── createEditor.js         # assemble extensions + options, refuse un contenu invalide
│   ├── content.js              # toEditorJSON : parse, contrôle par le schéma, empreintes recalculées
│   ├── TextareaBridge.js       # synchronisation textarea ⇄ éditeur (cf. §4)
│   └── extensions.js           # schéma : extensions cœur déclarées une à une
├── spip/                       # *** cœur indépendant de Tiptap et du DOM ***
│   ├── parser/                 # SPIP → JSON (cf. 04)
│   │   ├── protect.js          # échappements et blocs protégés
│   │   ├── blocks.js           # découpage en blocs
│   │   ├── inline.js           # raccourcis inline
│   │   └── rules/              # une règle par raccourci, enregistrables
│   ├── serializer/             # JSON → SPIP (cf. 04)
│   ├── regex.js                # regex alignées sur le core SPIP (source unique)
│   └── registry.js             # registre des règles (cœur + extensions tierces)
├── nodes/                      # Node.create(...) : SpipNote, SpipModel, SpipRaw, SpipCadre…
├── marks/                      # Mark.create(...) : SpipLink, SpipGlossary, SpipAbbr…
├── nodeviews/                  # rendus riches (modèle compilé, note, multi)
├── ui/                         # Toolbar, boutons, popovers, panneau des notes
├── hosts/                      # adaptateurs d'hôte : editer_* (formulaire_fond), Crayons, data-tts-*, sans objet
├── services/cvt.js             # appels AJAX au formulaire CVT de services, lecture des réponses
└── i18n.js                     # chaînes fournies par SPIP via la config
```

Règle d'architecture : **`src/spip/` ne dépend ni de Tiptap ni du DOM**. Il transforme une chaîne en
JSON et inversement. Il est donc testable en Node pur (Vitest) et réutilisable côté serveur si besoin
(ex. script de vérification de corpus).

### Dépendances Tiptap 3

- `@tiptap/core`, `@tiptap/pm`, et les extensions **déclarées une à une** (`document`, `paragraph`, `text`,
  `heading`, `bold`, `italic`, `strike`, `code`, `code-block`, `blockquote`, `list`, `horizontal-rule`,
  `hard-break`), pas de `@tiptap/starter-kit` : les marks doivent être déclarées dans l'ordre canonique du
  parseur (cf. [03](03-schema-json.md) §2),
- `@tiptap/extension-table`, `@tiptap/extension-subscript`, `@tiptap/extension-superscript`,
- `@tiptap/extensions` (`Dropcursor`, `Gapcursor`, `UndoRedo` ; `Placeholder`, `CharacterCount` au lot L5 ;
  **pas** de `TrailingNode`, qui ajoute un paragraphe vide en fin de document et modifie donc la source),
- `@tiptap/extension-bubble-menu` (barre contextuelle sur sélection, optionnelle).
- **Pas** de `@tiptap/markdown`, **pas** de `@tiptap/extension-typography` (la typographie française est
  faite par SPIP au rendu ; la faire dans l'éditeur modifierait la source).

Versions épinglées exactement dans `package.json`, lockfile versionné.

## 4. Synchronisation textarea ⇄ éditeur (`TextareaBridge`)

| Événement | Action |
|-----------|--------|
| Montage | `createEditor()` avec `toEditorJSON(textarea.value)` : le JSON du parseur passe par le schéma (`nodeFromJSON` puis `check()`, exception si invalide : l'éditeur n'est alors pas monté et le textarea reste en saisie directe), puis les empreintes `spipHash` sont recalculées sur la forme que `getJSON()` renverra (attributs par défaut compris) |
| `editor.on('update')` | Sérialisation **débouncée** (150 ms) → `textarea.value`, écrite seulement si elle diffère ; flush immédiat sur `submit`, `blur` de l'éditeur, bascule de mode, `beforeunload` |
| Saisie dans le textarea (mode source) | Pas de re-parse pendant la saisie ; au retour en visuel, rechargement **une seule fois** s'il y a eu saisie (`setContent` sans émettre de mise à jour, donc sans réécrire le textarea). Si la source n'est pas représentable, on reste en mode source |
| Garde anti-boucle | Les événements `input` émis par l'éditeur lui-même ne marquent pas la source comme modifiée |
| Événements | Le textarea reçoit des événements `input`/`change` synthétiques pour que les scripts SPIP (alerte de modification non enregistrée, compteurs) restent informés |

Différence voulue avec markdown_editor : pas de `setContent` à chaque frappe dans le textarea, ce qui
préserve l'historique d'annulation et la position du curseur côté WYSIWYG.

## 5. Côté serveur : un formulaire CVT

Plutôt que des actions `URL_ACTION_AUTEUR` dont chacune réimplémente ses contrôles (cas de markdown_editor,
qui passe en plus tout `$_POST` comme contexte de modèle), tous les services serveur de l'éditeur passent
par **un formulaire CVT** `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}`. Le framework CVT apporte
la sécurité sans code spécifique :

- **arguments de la balise signés** : `objet`, `id_objet`, `champ` sont encodés par le serveur au calcul
  (`formulaire_action_args`, vérifiés par `decoder_contexte_ajax`) : le JS ne peut pas les falsifier pour
  viser un autre objet ;
- **POST lié à la session** : `formulaire_action_sign` est vérifié contre la session de l'auteur
  (`ecrire/public/aiguiller.php`) : protection CSRF incluse ;
- **autorisation dans `charger()`** : retourne `false` si
  `!autoriser('modifier', $objet, $id_objet)` (ou `autoriser('creer', $objet)` pour un objet nouveau), ce
  qui rend le formulaire absent pour qui n'a pas le droit ; `verifier()` refait le même test, car il est
  exécuté avant `charger()` au POST.

### Intégration

- **Hors du formulaire d'édition** : le champ édité est déjà dans un `<form>` et HTML interdit les formulaires
  imbriqués (le navigateur supprimerait le `<form>` intérieur). Le pipeline `formulaire_fond` reçoit le rendu
  complet du formulaire d'édition (`editer_article`, `editer_rubrique`, …, et formulaires publics configurés),
  `<form>…</form>` compris : le formulaire de services est **concaténé à la fin** de `$flux['data']`, donc
  après la balise `</form>` du formulaire d'édition, dans un conteneur masqué
  `<div class="tts-services" data-tts-instance="<instance>" data-tts-objet="<objet>" data-tts-id="<id_objet>" data-tts-champ="<champ>">`.
  Il est rendu par
  `recuperer_fond('inclure/tiptap_spip_services', [objet, id_objet, champ])`, squelette qui contient
  `#FORMULAIRE_TIPTAP_SPIP{#ENV{objet}, #ENV{id_objet}, #ENV{champ}}`.
- **Un formulaire de services par champ équipé** : le pipeline rend une instance par champ configuré pour
  l'objet (`texte`, `chapo`…), chacune avec son `champ` **signé**. `champ` n'est donc jamais une entrée du
  POST : le contexte de prévisualisation reste composé uniquement d'arguments signés. Le surcoût (quelques
  champs cachés par champ équipé) est négligeable.
- **Lien explicite par identifiant d'instance.** Objet, id et champ ne suffisent pas : une page peut contenir
  deux formulaires d'édition du même objet, et le conteneur `.tts-services` est un frère qui suit le `</form>`,
  pas un descendant. À chaque rendu, le pipeline `formulaire_fond` :
  1. génère un identifiant d'instance aléatoire (`tts-` + 12 caractères hexadécimaux issus de
     `random_bytes`) ; le formulaire d'édition étant dynamique (CVT, jamais mis en cache), il change à
     chaque calcul ;
  2. l'ajoute en attribut `data-tts-instance` sur la balise `<form` du formulaire d'édition (premier `<form\b`
     de `$flux['data']`, le squelette d'édition n'en contenant qu'un) ;
  3. le reporte sur chaque conteneur `.tts-services` concaténé après le `</form>`.
- Repérage côté JS, à chaque montage :
  `textarea.form.dataset.ttsInstance` → `.tts-services[data-tts-instance="…"][data-tts-champ="<name du textarea>"]`.
  Pas d'attribut d'instance sur le formulaire, ou aucun conteneur correspondant ⇒ mode dégradé sans services.
- Formulaire et conteneurs étant produits par le même rendu, ils sont recalculés ensemble (rechargement
  AJAX du formulaire d'édition, nouvel objet après création) et l'identifiant reste cohérent ; l'éditeur
  refait l'association à chaque `onAjaxLoad`.
- Pas de formulaire rendu (pas d'autorisation, ou contexte non configuré) ⇒ l'éditeur fonctionne sans
  services serveur : modèles en affichage compact, liens vides sans titre résolu, pas de recherche d'objets.
- Hors des formulaires `editer_*`, le formulaire de services est obtenu par un adaptateur d'hôte (§6).

### Opérations

Champ `operation` + paramètres, validés dans `verifier()` (liste blanche, tailles maximales) ;
`traiter()` renvoie le résultat dans `message_ok`, sous forme de JSON (cf. « Format de réponse »).

| Opération | Paramètres | Contrôles `verifier()` | Résultat |
|-----------|------------|------------------------|----------|
| `previsu_modele` | `modele` | exactement **un** raccourci de modèle (regex du core, ancrée), ≤ 2 000 caractères, modèle existant : déclaré par un objet (`modeles` de `lister_tables_objets_sql()`, cas de `doc`, `img`, `emb`, résolus par `styliser_modele()` sans squelette `modeles/doc.html`) ou trouvé par `trouve_modele()` ; nom non exclu par la config (lot L5) | HTML via les traitements du champ (`tiptap_spip_traitements_previsu`, repris de `traitements_previsu`) puis `safehtml` ; contexte limité à `objet`, `id_objet`, `id_<objet>` signés (jamais `$_POST`) |
| `titre_lien` | `cibles` (liste JSON) | 1 à 50 cibles, ≤ 500 caractères chacune | `[{cible, titre, url, objet, id}]` ; pour un objet SPIP (`typer_raccourci`), titre et URL seulement si `autoriser('voir', objet, id)` ; URL explicite : titre et URL de `calculer_url()` ; `#ancre` : rien |
| `glossaire` | `raccourci` (`[?terme#glossaireN\|bulle{lang}]`), facultatif | un seul raccourci de glossaire (`_RACCOURCI_GLOSSAIRE` ancrée), ≤ 500 caractères, glossaire connu (par défaut, ou `glossaire_<nom>()` existante) ; sans raccourci : la liste seule (`url` nulle) | `{url, glossaires}` : URL de la définition rendue par `traiter_raccourci_glossaire()` (SPIP 4) ou par le pipeline `pre_liens` (SPIP 5, écouteur du glossaire de TextWheel) dans la langue de l'objet édité (sinon celle du site), le glossaire par défaut en dépendant (`@lang@.wikipedia.org`) ; `glossaires` : noms des fonctions `glossaire_<nom>()` définies, hors `glossaire_std` (aucun appel réseau sortant) — **lot L3.2** |
| `rechercher` | `q`, `objets` (liste JSON) | `q` de 2 à 100 caractères, objets parmi `article, rubrique, breve, document, auteur, mot, site` | `[{objet, id, titre, raccourci}]` (`raccourci` = `article12`), filtré par `autoriser('voir')` **avant** de retenir les résultats (des objets invisibles en tête ne masquent pas les suivants), hors poubelle, 20 résultats max, les plus récemment modifiés d'abord (`maj`) tous types confondus : une suite par type, lue par pages de 50, fusionnée par `maj` |
| `idiomes` | `cles` (liste JSON de `module:cle` ou `cle`) | 1 à 50 clés, ≤ 100 caractères, forme de la regex de `Idiomes::collecter()` | `[{cle, texte}]` : traduction par `inc_traduire` dans la langue de l'objet édité (sinon celle du site), sans balises ; `texte` nul pour une chaîne absente (SPIP laisse alors le raccourci) — **lot L4.2** |

Réalisé au lot L2.2 (`formulaires/tiptap_spip.php`, `src/services/cvt.js`). Constats sur SPIP 4.4 :

- pour un formulaire d'objet (`editer_article`…), `formulaire_fond` reçoit `args = ['type' => …, 'id' => …]`
  et non les arguments de la balise ; un nouvel objet a l'id 0 ;
- champs équipés par défaut : `texte` (`tiptap_spip_champs()`), le seul que le lancement JS équipe dans
  `editer_article` ;
- SPIP enveloppe chaque erreur de `verifier()` dans `<span role='alert'>` : `cvt.js` n'en garde que le texte ;
- arguments signés ou signature de session falsifiés : SPIP ne traite pas le formulaire et renvoie la page
  complète ; session absente : script de redirection vers la connexion. Dans les deux cas, pas
  d'`ajax-form-is-ok` : `cvt.js` passe en mode dégradé et ne rappelle plus le service.

### Format de réponse

Une soumission AJAX d'un CVT ne renvoie pas du JSON : `traiter_formulaires_dynamiques()`
(`ecrire/public/aiguiller.php`) renvoie `<br class='bugajaxie ajax-form-is-ok' style='display:none;'>`
suivi du **HTML du formulaire recalculé**. Le contrat est donc :

- **Requête** : `POST` sur l'`action` du formulaire, corps = `new FormData(form)` (tous les champs cachés
  produits par `#ACTION_FORMULAIRE` : `formulaire_action`, `formulaire_action_args`,
  `formulaire_action_sign`…) + `var_ajax=form` + `operation` et ses paramètres.
- **Squelette** `formulaires/tiptap_spip.html` : en plus du `<form>` (sans champ visible), il expose le résultat
  et les erreurs dans deux blocs dédiés :
  ```html
  [<script type="application/json" class="tts-resultat">(#ENV*{message_ok})</script>]
  [<script type="application/json" class="tts-erreurs">(#ENV*{erreurs}|tiptap_spip_json)</script>]
  ```
  `traiter()` et le filtre `tiptap_spip_json` encodent avec
  `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT` : aucun `<` ne peut apparaître dans le bloc,
  donc ni `</script>` (le HTML d'une prévisualisation de modèle est transporté échappé), ni prise pour
  `interdire_scripts`.
- **Lecture côté JS** (`src/services/cvt.js`) :
  1. réponse sans `.ajax-form-is-ok` ou sans `<form>` ⇒ service indisponible (session expirée, droit retiré,
     ou `noajax`) : l'éditeur passe en mode dégradé, sans erreur bloquante ;
  2. `DOMParser` sur la réponse, lecture de `script.tts-erreurs` (erreurs de `verifier()`, par paramètre et
     `message_erreur`) puis de `script.tts-resultat`, `JSON.parse` du `textContent` ;
  3. remplacement du formulaire masqué par celui de la réponse, pour repartir des champs cachés à jour.
- Les appels sont **sérialisés** (une file par formulaire) ; les demandes de titres de liens et de
  prévisualisations sont regroupées par lot dans une seule opération.

Le contexte public (forums, formulaires d'édition publics, Crayons) suit la même règle : le formulaire n'est
rendu que là où `charger()` l'autorise ; les forums n'ont pas de service `previsu_modele` (barre `forum` sans
modèles).

Les prévisualisations de modèles sont **mises en cache côté JS** (clé = raccourci complet + champ + objet)
pour éviter de recompiler à chaque re-rendu de NodeView.

## 6. Hôtes de l'éditeur

L'éditeur n'est pas lié à un endroit : comme le porte-plume, il s'accroche à **n'importe quel textarea**, dans
l'espace privé comme dans le site public. On distingue trois couches :

| Couche | Dépend de l'hôte ? | Contenu |
|--------|--------------------|---------|
| Cœur (`src/spip/`, extensions, `TextareaBridge`) | non | ne connaît que le textarea |
| Hôte | oui | où et quand monter l'éditeur, quelle barre, quels styles |
| Contexte serveur | oui | objet, id, champ pour les services (§5) |

### Lancement générique

- Textareas équipés : ceux du porte-plume (classes `inserer_barre_edition`, `inserer_barre_forum`, et
  `porte_plume_partout` si la configuration l'active ; champ `.formulaire_spip textarea[name=texte]`, que le
  porte-plume équipe par son option `inserer_auto_name_texte`, cas de `editer_article` dont le textarea n'a
  pas de classe) ou attribut `data-tts-toolbar="<barre>"` ; jamais un textarea déjà pris par markdown_editor
  (classes `inserer_md_barre*`, `data-md-editor-toolbar`). Un marqueur `data-tts-mounted` (`oui` ou
  `erreur`) rend le montage idempotent.
- Le porte-plume est écarté du textarea : classes `no_barre no_previsualisation` posées avant son lancement
  (il démarre sur `window.load`, après le module de l'éditeur), `markItUpRemove()` s'il est déjà monté.
- Plusieurs éditeurs par page, indépendants (chacun son instance, son pont textarea, ses services).
- Relance à chaque `onAjaxLoad` : couvre les rechargements AJAX de SPIP **et Crayons**, qui appelle
  `jQuery.spip.triggerAjaxLoad()` à l'ouverture d'un crayon (`crayons/js/crayons.js`). La racine rechargée
  arrive dans `this` (pas en argument), parfois sous forme d'objet jQuery :
  `onAjaxLoad(function () { tiptap_spip_init(this); })`.
- Cycle de vie : sérialisation forcée sur l'événement `submit` du formulaire hôte (Crayons déclenche bien un
  `submit`) ; quand le textarea quitte le DOM (crayon fermé, bloc AJAX rechargé), l'éditeur est détruit
  (`editor.destroy()`, observateurs retirés) pour ne pas fuir de mémoire.

### Résolution du contexte serveur (adaptateurs)

| Hôte | Contexte (objet, id, champ) | Formulaire de services |
|------|-----------------------------|------------------------|
| Formulaires d'édition `editer_*` (CVT) | arguments du formulaire d'édition | inséré par `formulaire_fond` après le `</form>`, relié par identifiant d'instance (§5) |
| Autres CVT déclarés | pipeline `tiptap_spip_contextes` : nom du formulaire → fonction qui renvoie objet, id, champ à partir des arguments du CVT | idem, inséré par `formulaire_fond` |
| Crayons | classes du crayon (`crayon <objet>-<champ>-<id>`), lues par l'adaptateur JS Crayons | **à la demande** (ci-dessous) |
| Textarea quelconque | attributs `data-tts-objet`, `data-tts-id-objet`, `data-tts-champ` posés par le squelette | à la demande |
| Sans contexte (réglages, `descriptif_site`…) | aucun | à la demande, en mode sans objet |

**Formulaire de services à la demande** : l'éditeur charge en AJAX un squelette
`tiptap_spip_services.html` (`spip.php?page=tiptap_spip_services&objet=…&id_objet=…&champ=…`, `#CACHE{0}`)
qui ne contient que `#FORMULAIRE_TIPTAP_SPIP{#ENV{objet}, #ENV{id_objet}, #ENV{champ}}`, puis l'insère dans
un conteneur masqué ajouté à la fin de `<body>`, donc hors de tout formulaire. La sécurité reste celle du
CVT (§5) :

- le formulaire inclut `inc/autoriser`, que le site public ne charge pas d'office (sans cela, la page de
  services répond 503) ;
- le contexte vient de la requête, mais `charger()` le vérifie avant de rendre quoi que ce soit :
  `autoriser('modifier', objet, id_objet)`, et `champ` doit être un champ texte de la table de l'objet ; sinon
  `false`, donc aucun formulaire ;
- une fois rendu, le contexte est **signé** dans les arguments du formulaire et lié à la session : les
  opérations ne peuvent pas viser un autre objet ;
- en mode **sans objet**, `charger()` exige `autoriser('previsualiser', 'tiptapspipmodele')` (repris de
  markdown_editor : accès à l'espace privé, ou administrateur non restreint dans le public). Les modèles sont
  alors calculés sans contexte d'objet ; `titre_lien` et `rechercher` gardent leur filtrage par
  `autoriser('voir')`.

L'éditeur garde la référence du formulaire chargé : pas de recherche dans le DOM, donc pas d'ambiguïté
entre instances.

### Barre d'outils par hôte

La barre vient de la classe ou de `data-tts-toolbar` ; à défaut, l'adaptateur choisit : `edition` pour les
champs `texte` et `chapo`, `minimale` pour les autres champs, `forum` pour les formulaires de forum.

### Styles

Tiptap n'utilise pas d'iframe : la zone d'édition fait partie du DOM de la page.

- **Dans le site public** (Crayons, CVT publics) : l'éditeur hérite directement des CSS et du JS du site,
  sans extraction ni réinjection. Seule la feuille de l'interface (`tts-*` : barre, popovers) est ajoutée.
- **Dans l'espace privé** : la feuille de contenu `css/tiptap_spip_contenu.css` (surchargeable par le
  squelette) approche le rendu public.
- Un hôte peut forcer l'une ou l'autre (`data-tts-styles="site|contenu"`).

### Réalisation (lot L2b)

- **Options** (`non` par défaut ; page de configuration au lot L5.3) : `tiptap_spip/public`
  charge l'éditeur dans le site public (pipeline `insert_head`) ; `tiptap_spip/crayons` équipe les crayons
  (`.formulaire_crayon textarea.crayon-active`) — Q9 tranchée : sur option. Avec l'option publique, le
  formulaire de forum d'un article (`textarea[name=texte]`) est équipé lui aussi.
- **Configuration JS** (`tiptap_spip_config.js.html`, sans cache, calculée avec `prive` dans son
  contexte pour ne pas partager le cache entre privé et public) : `prive`, `services` (URL de la page de
  services à la demande), et depuis le lot L5.3 `crayons`, `mode`, `niveaux`, `champs`
  (`tiptap_spip_config_js`).
- **Contextes déclarés** : `tiptap_spip_contextes` associe un nom de formulaire à une fonction
  `($args, $contexte) → ['objet', 'id_objet', 'champs']` (objet vide : sans objet ; `null` : rien) ;
  `formulaire_fond` pose `data-tts-toolbar="minimale"` sur leurs textareas (sauf barre déjà indiquée) et
  ajoute leurs services. Défaut fourni : `configurer_identite` → sans objet, `descriptif_site`.
- **Contexte côté JS** (`src/hosts/contexte.js`), quand aucun formulaire de services n'a été rendu après
  le formulaire hôte : `data-tts-objet` / `data-tts-id-objet` / `data-tts-champ`, sinon crayon (champ caché
  `name_<clé>` = `objet-champ-id`, textarea `content_<clé>_<champ>`), sinon sans objet (champ = `name`).
  Les services sont alors chargés à la demande (`src/hosts/aLaDemande.js`) et placés dans `#tts-services`
  à la fin de `<body>` ; prévisualisations et titres les attendent (`instance.servicesPrets`).
- **Cycle de vie** : `onAjaxLoad` peut passer un élément, un objet jQuery ou un tableau d'éléments
  (Crayons : `triggerAjaxLoad(tous.get())`) ; jquery.form (Crayons, CVT en AJAX) envoie sur un
  `.trigger("submit")` jQuery que l'écouteur natif ne voit pas : le pont sérialise sur `form-pre-serialize`.
  Un crayon enregistré ou annulé quitte le DOM : son éditeur est détruit.
- **Styles** : classe `tts-styles-contenu` sur `.tts-editor` (privé par défaut, ou `data-tts-styles`) ;
  `css/tiptap_spip_contenu.css` est chargée partout mais ne s'applique qu'à cette classe.
