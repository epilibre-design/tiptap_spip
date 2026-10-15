# 10 — Coller des images, déposer des documents

Demande : [#4](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/work_items/4), « Ajouter
l'insertion d'une image par paste du clipboard », sur le modèle d'InlineAttachment
([Rovak/InlineAttachment](https://github.com/Rovak/InlineAttachment)).

Aujourd'hui, coller une capture d'écran dans l'éditeur ne produit rien : le presse-papiers ne contient qu'un
fichier, que ni le collage HTML ni le collage texte ([04](04-parseur-serialiseur.md) §6) ne savent lire. Le
rédacteur doit enregistrer l'image, l'ajouter dans la boîte « Documents » de l'objet, puis insérer son
raccourci. Ce lot réduit ce parcours à un `Ctrl+V`.

## 1. Comportement attendu

1. Le rédacteur colle une image (capture d'écran, image copiée depuis un navigateur ou un logiciel de dessin).
2. Un **marqueur d'envoi** apparaît à la position du curseur (« Envoi de l'image… », avec une progression si
   le navigateur la fournit). La saisie reste libre pendant l'envoi. Si du texte est sélectionné, il est
   **conservé**, comme avec l'envoi de Crayons, qui ne touche pas au texte : le marqueur se place après la
   sélection, qui reste en place. La règle est la même dans les deux modes.
3. L'image est envoyée au serveur, qui crée un **document SPIP** lié à l'objet édité.
4. Le marqueur est remplacé par le modèle `<docN>` (§4), affiché par la prévisualisation habituelle des modèles
   ([05](05-extensions-spip.md) §3). L'insertion est une étape d'historique : `Ctrl+Z` la retire (le document
   reste lié à l'objet, comme après un ajout par la boîte « Documents »).
5. En cas d'échec pour une image, son marqueur disparaît, rien n'est inséré à sa place, et la barre d'état
   ([06](06-interface.md) §5) affiche le message du serveur (type refusé, taille, droits, session expirée).

Un collage peut contenir **plusieurs images** (fichiers copiés depuis l'explorateur, selon le navigateur et le
système). Toutes les images acceptées sont insérées dans l'ordre du presse-papiers, chacune avec son marqueur
et son `<docN>`. Une capture d'écran ou « Copier l'image » ne fournit généralement qu'une image. Plusieurs
collages successifs ajoutent leurs envois à la même file sérialisée (§3) ; les marqueurs restent visibles
pendant l'attente et le transfert.

Le même comportement vaut en **mode source** : chaque marqueur est alors un texte provisoire distinct dans le
textarea (`<!-- envoi… -->` avec un identifiant temporaire unique, à la manière du `progressText`
d'InlineAttachment), remplacé par son `<docN>` ou retiré sans toucher aux autres marqueurs.

## 2. Ce qu'on reprend d'InlineAttachment

InlineAttachment (MIT) fait exactement ce parcours pour un textarea ou CodeMirror : lecture des fichiers du
presse-papiers, envoi XHR, texte provisoire, remplacement par un gabarit (`![file]({filename})`).

**On ne l'embarque pas**, pour quatre raisons :

- il n'est plus maintenu (dernière version 2.0.3, 2016) et vise textarea, CodeMirror et jQuery, pas
  ProseMirror ;
- son texte provisoire vit dans le contenu : dans l'éditeur visuel, il serait synchronisé vers le textarea
  (`TextareaBridge`) et pourrait être enregistré si le formulaire part pendant l'envoi ;
- il poste vers une URL fixe avec des paramètres figés (`extraParams`) : or chaque appel aux services doit
  partir des champs cachés **à jour** du formulaire CVT, qui est remplacé après chaque réponse
  ([02](02-architecture.md) §5, « Format de réponse ») ;
- Tiptap 3 couvre déjà la capture du collage (`editorProps.handlePaste`, ou l'extension
  `@tiptap/extension-file-handler`, MIT).

**On reprend son contrat**, éprouvé :

| InlineAttachment | tiptap_spip |
|------------------|-------------|
| `allowedTypes` (`image/png`, `image/jpeg`, `image/gif`) | liste blanche §3, recoupée côté serveur |
| `defaultExtension` + nom horodaté pour un fichier sans nom (`image-<timestamp>.png`) | même règle : une capture arrive nommée `image.png` ou sans nom ; elle est renommée `capture-AAAAMMJJ-HHMMSS.<ext>` (extension tirée du type MIME) |
| `progressText` puis remplacement par `urlText` | marqueur d'envoi puis `<docN>` (§1, §4) |
| `errorText` | message d'erreur dans la barre d'état, pas de texte laissé dans le contenu |
| `onFileReceived`, `onFileUploadResponse`, `onFileUploadError` | événements `tiptap-spip:document-recu`, `…:document-insere`, `…:document-erreur` sur le textarea, pour les plugins tiers ([07](07-extensibilite.md)) |

## 3. Côté client

### Capture

Un module `src/editor/collerImage.js`, commun aux deux modes :

- **Éditeur visuel** : `handlePaste` d'une extension `spipPasteImage`.
- **Mode source** : écouteur `paste` sur le textarea.

L'extension et l'écouteur sont **toujours installés** ; la disponibilité se décide à chaque collage. Quand le
formulaire de services est chargé à la demande ([02](02-architecture.md) §6), l'éditeur est créé avant
qu'il arrive (`servicesPrets` dans `src/main.js`) : une extension ajoutée seulement si le service est déjà
là resterait absente. Au collage, le module lit les services de l'instance (`this.services`, renseigné à la
résolution de `servicesPrets`) et la configuration de l'opération qu'ils portent (§6) :

- services présents et `deposer_document` disponible : envoi ;
- services encore en chargement, absents (mode dégradé) ou opération indisponible : `handlePaste` rend
  `false` et le collage habituel s'applique, sans attendre ni message. Le collage suivant refait le test.

Arbitrage avec le collage existant ([04](04-parseur-serialiseur.md) §6). Le presse-papiers contient souvent à
la fois un fichier et du texte : un tableau copié depuis un tableur arrive en HTML **et** en PNG, un
paragraphe copié depuis un traitement de texte aussi. Règle :

| Contenu du presse-papiers | Traitement |
|---------------------------|------------|
| Un ou plusieurs fichiers image, sans texte ni HTML | envoi de toutes les images acceptées, dans l'ordre (§1) ; les types refusés sont signalés |
| Fichier(s) image + `text/html` réduit à une seule `<img>` (copie d'image depuis un navigateur), avec éventuellement `text/plain` | envoi de toutes les images acceptées ; le HTML et le texte sont ignorés |
| Fichier(s) image + autre `text/html` ou `text/plain` non vide | collage texte/HTML habituel ; les fichiers sont ignorés |
| Fichiers image et non image, sans texte ni HTML | envoi des images acceptées dans l'ordre ; fichiers non image ignorés avec message « type non accepté » |
| Fichier(s) non image ou image(s) de type hors liste blanche, sans image acceptée | collage habituel (rien n'est envoyé) ; message « type non accepté » |

Collage dans un bloc de code (éditeur visuel) : collage habituel, rien n'est envoyé.

La priorité est donnée au texte ou au HTML ordinaire, puis aux images acceptées. Un fichier refusé ne bloque
pas les autres images du même collage. Chaque image part dans un appel `deposer_document` distinct : le formulaire
CVT est renouvelé entre deux appels (§5).

Liste blanche par défaut : `image/png`, `image/jpeg`, `image/gif`, `image/webp`. Elle est envoyée au JS dans
la configuration (§6), recoupée par le serveur avec `spip_types_documents` (types `upload='oui'`). Le serveur
annonce aussi l'extension de chaque type, et le JS renomme le fichier avec elle. Seules comptent les
extensions que medias reconnaît : il corrige l'extension envoyée (`corriger_extension`, `.jpeg` → `.jpg`)
avant de la chercher.

Taille : le JS refuse avant envoi un fichier plus gros que la limite annoncée par le serveur (minimum de
`upload_max_filesize`, `post_max_size` et `_IMG_MAX_SIZE` si défini), pour ne pas faire attendre un envoi
voué à l'échec. Le serveur reste juge (§5).

### Marqueur d'envoi

Dans l'éditeur visuel, le marqueur n'est **pas** un nœud : c'est une décoration (widget) d'un plugin
ProseMirror `spipUploadPlaceholder`, dont la position est reportée à chaque transaction (`mapping`), sur le
modèle de l'exemple « upload » de ProseMirror. Conséquences :

- le document ne contient jamais le marqueur : la sérialisation, le textarea et l'historique restent propres ;
- si le texte autour est supprimé, la position se replie sur le point le plus proche ; si l'éditeur est
  détruit (fermeture d'un crayon, rechargement AJAX), l'envoi en cours est abandonné (`AbortController`).

Tant qu'un envoi est en cours, la bascule visuel ⇄ source est refusée, avec le message « Une image est en
cours d'envoi » : un marqueur appartient au mode où l'image a été collée, et ni la décoration du visuel ni
le texte provisoire de la source ne survivraient à la bascule. En mode source, un marqueur supprimé à la
main avant la fin de son envoi n'est pas remplacé : rien n'est inséré, le document reste lié (comme après
un ajout par la boîte « Documents »).

Tant qu'un envoi est en cours, la soumission du formulaire d'édition est retenue, avec le message « Une
image est en cours d'envoi ». En mode source, c'est indispensable : sinon `<!-- envoi… -->` serait
enregistré ; dans l'éditeur visuel, l'image manquerait au texte enregistré. Deux voies de soumission sont
couvertes, comme pour la synchronisation du textarea (`TextareaBridge`) :

- **soumission native** : écouteur `submit` (phase de capture), `preventDefault()` ;
- **soumission AJAX** (CVT en `ajax`, Crayons) : `ajaxSubmit()` de `jquery.form.js` ne déclenche pas
  l'écouteur natif, mais annonce la sérialisation par l'événement jQuery `form-pre-serialize`
  (`prive/javascript/jquery.form.js`), déclenché par `trigger('form-pre-serialize', [form, options, veto])`.
  L'écouteur jQuery reçoit donc l'événement **puis** ces trois valeurs : `(event, $form, options, veto)`.
  Il pose `veto.veto = true` (sur le quatrième paramètre, pas sur `options`) et `ajaxSubmit()` s'arrête
  avant de lire les champs.
  **Crayons a sa propre copie de jQuery** : `crayons.js.html` charge `jquery.js` et `jquery.form.js` renommés
  en `cQuery` (`pack_cQuery`, puis `cQuery.noConflict()`), et le formulaire du crayon passe par
  `cQuery(…).ajaxForm()`. Un `trigger` de `cQuery` n'atteint que les écouteurs posés par `cQuery` : l'écouteur
  `form-pre-serialize` est donc posé avec `globalThis.jQuery` **et**, s'il existe, avec `globalThis.cQuery`.

Dans les deux cas, le bouton de soumission utilisé est mémorisé. À la fin des envois, la soumission
repart d'elle-même par `form.requestSubmit(bouton)`, qui reprend la voie d'origine (le `submit` du
formulaire relance `ajaxSubmit()` pour un formulaire AJAX). « Enregistrer sans attendre » abandonne les envois
restants, retire les marqueurs du mode source, puis relance la soumission de la même façon.

### Envoi

Par `src/services/cvt.js`, dans la file sérialisée du formulaire de services : chaque image appelle la
nouvelle opération `deposer_document` (§5), avec un corps `FormData` du formulaire et `fichier` (le `File`
renommé). `fetch` ne donnant pas la progression d'un envoi, celle-ci passe par
`XMLHttpRequest.upload.onprogress` pour cette seule opération ;
sans progression, le marqueur reste indéterminé.

## 4. Raccourci inséré

`<docN>`, sans alignement : c'est le raccourci que propose la boîte « Documents » de SPIP 4 et 5 pour une
image, et il s'affiche avec titre et légende si le rédacteur en ajoute ensuite. Le nœud inséré est un
`spipModel` ordinaire ([03](03-schema-json.md) §4) : il se modifie (`|left`, `|center`…) et se prévisualise
comme tout modèle. Pas de nouveau nœud, pas de nouvelle règle de parseur ni de sérialiseur.

Toujours `<docN>`, jamais `<imgN>`, et sans réglage (Q11, tranchée le 2026-10-14 ; cf. §8).

Position : à l'endroit du collage, après le texte sélectionné s'il y en a un (§1), en ligne. Le core rend `<docN>` seul sur sa ligne comme un bloc ; inséré
au milieu d'un paragraphe, il reste en ligne, comme si le rédacteur l'avait tapé.

## 5. Côté serveur : opération `deposer_document`

Nouvelle ligne du tableau des opérations ([02](02-architecture.md) §5) :

| Opération | Paramètres | Contrôles `verifier()` | Résultat |
|-----------|------------|------------------------|----------|
| `deposer_document` | `fichier` (dans `$_FILES`) | un seul fichier, envoi PHP sans erreur (`UPLOAD_ERR_OK`, `is_uploaded_file`) ; image de la liste blanche (par son extension ou son type réel) : extension et type réel (`finfo`) concordants ; autre document : extension acceptée par `spip_types_documents` (`upload='oui'`, après `corriger_extension`), medias refaisant ses contrôles comme pour la boîte « Documents » ; `autoriser('joindredocument', objet, id_objet_lien)` ; configuration `tiptap_spip/coller_images` active | `{id_document, raccourci}` (`raccourci` = `doc12`) |

- **Ajout** : `action_ajouter_documents_dist('new', [$fichier], $objet, $id_objet_lien, 'document')` du plugin
  medias. Il refait les contrôles de taille et de dimensions du site (`_IMG_MAX_SIZE`, `_IMG_MAX_WIDTH`…) et
  renvoie un message d'erreur sous forme de chaîne, transmis tel quel dans `message_erreur`. Mode
  `document`, et non `auto` (qui rangerait l'image en mode `image`) : le raccourci inséré est `<docN>`, pas
  `<imgN>` (§4), et c'est le mode que force l'envoi de Crayons (`action_crayons_upload`). Une image ajoutée
  par l'un ou l'autre outil a ainsi le même mode.
- **Objet nouveau** (`id_objet` = 0) : le document est lié à `-id_auteur`, comme le fait la boîte
  « Documents » ; `medias_post_insertion` le rattache à l'objet lors de sa création. `autoriser('joindredocument')`
  accepte cet id négatif quand il vaut l'auteur connecté.
- **Statut et `vu`** : rien de spécifique. Le document est lié comme par la boîte « Documents » ; à
  l'enregistrement du texte, SPIP marque `vu=oui` les documents cités.
- **Disponibilité** : `charger()` annonce l'opération disponible (§6) si et seulement si le plugin medias est
  actif, la configuration le permet et `autoriser('joindredocument', objet, id_objet_lien)` est vrai. Pas de
  critère propre sur `documents_objets` : l'autorisation de medias le contient déjà, et accepte les
  **articles** même s'ils n'y figurent pas (`medias_autoriser.php`). Sans objet (réglage comme
  `descriptif_site`) : indisponible. Opération indisponible : le collage habituel s'applique (§3).
- **Forums** : jamais (barre `forum`, comme pour les modèles).
- **CVT et fichiers** : `_request()` ne lit pas `$_FILES` ; le fichier est lu directement, sous le nom de champ
  fixe `fichier`. Vérifié sur SPIP 4.2, 4.4 et 5 : le traitement AJAX d'un CVT (`var_ajax=form`) accepte un
  corps `multipart/form-data` envoyé par `fetch` ou XHR.
- **Messages d'erreur** : `verifier()` et `traiter()` rendent leur message dans `message_erreur`. Une erreur
  rangée sous une autre clé ferait afficher par SPIP son message générique (« Votre saisie contient des
  erreurs »). SPIP entoure ce message d'un `<span role='alert'>`, que `cvt.js` retire.

## 6. Configuration

| Clé | Défaut | Effet |
|-----|--------|-------|
| `tiptap_spip/coller_images` | `oui` | active la capture du collage d'images |

Le JS reçoit de `charger()`, dans l'attribut `data-tts-depot` du `<form>` de services (JSON, absent si
l'opération est indisponible) :

- `images`, `extensions`, `taille_image` : types collables (liste blanche acceptée par le site), extension
  de chacun, taille maximale (`_IMG_MAX_SIZE`) ;
- `documents` : extensions déposables (tous les types envoyables) ;
- `documents_limite_image` : celles dont medias borne la taille par `_IMG_MAX_SIZE`. C'est une liste de
  limite de taille, pas de types d'images : svg et swf y figurent sans être collables ;
- `taille_document` : taille maximale des autres (`_DOC_MAX_SIZE`).

La case de configuration « Coller des images et déposer des documents » (clé `coller_images`) commande le
collage et le dépôt. Le formulaire est remplacé après chaque réponse : l'annonce reste à jour. Ces informations arrivent avec le
formulaire de services, éventuellement après la création de l'éditeur (§3). Sans elles, pas de capture :
le collage se comporte comme aujourd'hui.

## 7. Tests

| Niveau | Cas |
|--------|-----|
| Vitest | arbitrage du presse-papiers (§3, chaque ligne du tableau), notamment deux images en un collage et fichiers mêlés (PDF puis PNG) ; ordre des images et un appel CVT par fichier ; renommage d'un fichier sans nom ; refus avant envoi (type, taille) sans bloquer les autres images ; collage avant l'arrivée des services → collage habituel, collage suivant envoyé une fois les services là ; marqueur : position reportée quand on tape avant lui, repli quand on supprime autour, absent de `getJSON()` et du textarea ; remplacement par `<docN>` en une transaction annulable ; échec sans insertion |
| Vitest (CVT) | réponses enregistrées de `deposer_document` (succès, type refusé, taille, non autorisé, session expirée) lues par `cvt.js` |
| PHPUnit | `verifier()` : sans fichier, deux fichiers, extension/type réel discordants (PNG renommé `.php`), type absent de `spip_types_documents`, sans droit, objet nouveau d'un autre auteur ; disponibilité dans `charger()` : article avec `documents_objets` vide → disponible, objet absent de `documents_objets` → indisponible, sans objet → indisponible |
| Playwright | sur `editer_article` existant : collage d'un PNG (`ClipboardEvent` avec `DataTransfer` contenant un `File`) → `<docN>` dans le textarea, document lié à l'article ; collage de deux PNG en un geste → deux `<docN>` dans l'ordre, deux documents liés ; même chose sur un article **nouveau**, puis enregistrement : documents rattachés à l'article créé ; mode source ; soumission pendant les envois retenue, par le bouton (soumission native) et par `ajaxSubmit()` (formulaire CVT en AJAX ; crayon, dont `ajaxForm` passe par `cQuery`), puis relancée après le dernier envoi, sans marqueur dans le texte enregistré ; éditeur chargé à la demande (services arrivés après l'éditeur) : collage envoyé ; collage d'un tableau HTML + PNG → tableau collé, rien envoyé. Sous Chromium, Firefox et WebKit |

Réalisé (L7.1) : les cas PHPUnit qui dépendent du vrai SPIP (autorisation de medias, `documents_objets`,
objet nouveau d'un autre auteur) sont vérifiés en e2e, par la page de services à la demande et par des
appels réels. PHPUnit, où les fonctions du core sont simulées, couvre les fonctions de
`inc/tiptap_spip_images.php`. Réponses enregistrées pour `cvt.js` : succès et type refusé. Les refus de
taille et d'autorisation ne se provoquent pas depuis un formulaire signé : ils sont couverts par PHPUnit
et par l'e2e.

| Niveau | Cas |
|--------|-----|
| Playwright (L7.2) | avec `crayons/upload` activé : dépôt en mode visuel → un seul document par fichier, lié à l'article édité (`spip_documents_liens`), et un seul `<docN>` dans le texte ; dépôt sur le textarea en mode source → un seul envoi, par l'éditeur (`<docN>` inséré, document lié, aucun envoi par Crayons, ni classe `hover` ni panneau ouvert) ; dépôt sur le panneau de Crayons → comportement Crayons ; Tiptap désactivé → comportement Crayons conservé ; état de survol retiré à la sortie de la zone et après dépôt ; dépôt refusé (type non accepté, services absents) → la page reste affichée, le texte édité est intact |

## 8. Hors périmètre et suites

- Images référencées par URL dans un HTML collé (`<img src="https://…">`, `data:`) : non rapatriées ; le
  collage HTML les ignore comme aujourd'hui.
- Retouche (recadrage, redimensionnement) avant envoi.
- Suppression du document quand le rédacteur retire `<docN>` : non, comme dans SPIP (le document reste dans
  la boîte « Documents »).

### Glisser-déposer (lot L7.2, réalisé)

Même chaîne d'envoi que le collage, étendue à tous les types de documents par l'opération `deposer_document`.

- **Fichiers traités** : chaque fichier du dépôt, dans l'ordre, chacun avec son marqueur, même accompagné de
  HTML ou de texte (image glissée depuis une page web). Un glisser sans fichier (texte, déplacement interne)
  reste à ProseMirror et au navigateur.
- **Nom** : une image de la liste blanche est renommée comme au collage (extension annoncée) ; un autre
  document garde son nom.
- **Types et tailles** :
  - une image de la liste blanche, ou un fichier dont l'extension est déposable (après `corriger_extension`) ;
  - limite `taille_image` pour les extensions de `documents_limite_image`, `taille_document` sinon, comme
    medias.
- **Position** :
  - éditeur visuel : point du dépôt (`posAtCoords`), après le bloc s'il tombe dans un bloc de code, après la
    sélection sinon ;
  - mode source : après la sélection du textarea (un navigateur ne donne pas la position sous la souris dans un
    textarea).
- **État de survol** : classe `tts-editor--depot` et indication « Déposer les fichiers » sur la zone de
  l'éditeur, retirées quand la souris en sort et après le dépôt.
- **Refus** : un dépôt de fichiers que l'éditeur ne traite pas (type refusé, services absents ou encore en
  chargement, opération indisponible) appelle quand même `preventDefault()` sur `dragover` et `drop`. Sinon le
  navigateur ouvrirait le fichier à la place de la page, et l'édition en cours serait perdue. Le refus est
  signalé dans la barre d'état.
- **Interception** : écouteurs en capture sur la zone de l'éditeur, avant ProseMirror et avant les
  écouteurs posés sur ses éléments, dont le textarea d'un crayon équipé par `crayons/upload` (ci-dessous).

### Coexistence avec le dépôt expérimental de Crayons (lot L7.2)

Quand `crayons/upload` est activé, le contrôleur `article.texte` de Crayons ajoute un panneau latéral et lie
`dragenter`, `dragover`, `dragleave` et `drop` au textarea et à ce panneau (`crayons/controleurs/article_texte.html`,
`crayons/js/uploader.js.html`). Sa bibliothèque parcourt `dataTransfer.files`, envoie chaque fichier par XHR à
`action_crayons_upload`, puis affiche `<docN>` dans le panneau (`crayons/modeles/uploader_item.html`) ; elle
n'insère pas ce raccourci dans le texte. L'action transmet `article` et son `id_article` à
`action_ajouter_documents_dist()` : le document est lié à l'article.

Une image collée ou déposée dans le crayon `article.texte` équipé par Tiptap doit être liée au **même article**
(`spip_documents_liens` avec `objet = article` et `id_objet = id_article`), comme avec Crayons. La présence de
`<docN>` dans le texte ne remplace pas cette liaison (§5).

Partage des dépôts, pour qu'un fichier ne soit envoyé qu'**une fois** :

- **mode visuel** : Tiptap masque le textarea, déposer sur sa zone visible ne déclenche pas le gestionnaire de
  Crayons. Tiptap traite le dépôt : un document lié à l'article et un `<docN>` inséré dans le texte par fichier ;
- **mode source** : le textarea est visible et Crayons y a branché ses gestionnaires (par `cQuery`, avant le
  montage de l'éditeur). Tiptap **traite aussi ce dépôt** : ses écouteurs en capture sur la zone de l'éditeur
  arrêtent `dragenter`, `dragover` et `drop` avant le textarea, et les gestionnaires de Crayons ne les voient
  pas. Le textarea ne prend pas la classe `hover` et le panneau reste fermé ; un `dragleave`, qui n'est pas
  arrêté, ne fait que les remettre dans cet état. Un document lié à l'article et un `<docN>` inséré après la
  sélection, comme en mode visuel. Choix fait après L7.2 (2026-10-15) : laisser ce dépôt à Crayons faisait
  coexister deux mécanismes dans la même zone, et le raccourci de Crayons s'affichait dans son panneau sans
  être inséré dans le texte ;
- **panneau latéral** de Crayons : hors de la zone de l'éditeur, sa propre zone de dépôt, inchangée. C'est
  une cible explicite de Crayons ; il liste aussi les derniers documents de l'article ;
- **Tiptap désactivé** : Crayons garde son comportement.

Vérifier ces cas avec `crayons/upload` activé (§7).

Question tranchée, reprise dans [09](09-lots-roadmap.md) §3 :

| # | Question | Proposition |
|---|----------|-------------|
| Q11 | Raccourci inséré pour une image collée : `<docN>` ou `<imgN>` ? | **Tranché (2026-10-14)** : `<docN>`, cohérent avec la boîte « Documents » de SPIP 4/5 ; pas de réglage |

## 9. Réalisation (lot L7.1)

Plan : `docs/superpowers/plans/2026-10-15-coller-images-l7-1.md`.

- **Serveur** : `inc/tiptap_spip_images.php` (disponibilité, taille maximale, contrôle du fichier, ajout par
  `action_ajouter_documents_dist(…, 'document')`) ; opération `deposer_image` et annonce `data-tts-images`
  dans `formulaires/tiptap_spip.{php,html}` ; réglage `coller_images` dans la page de configuration.
- **Client** :
  - `src/services/cvt.js` : `images()`, envoi d'un fichier par XHR (progression, abandon), dans la file
    sérialisée ;
  - `src/editor/collerImage.js` : arbitrage du presse-papiers (`trierPressePapiers`), renommage
    (`nommer`), envois et insertions (`CollerImages`) ;
  - `src/editor/marqueurEnvoi.js` : extension `spipPasteImage`, plugin `spipUploadPlaceholder`. Le plugin
    suit lui-même la position de chaque marqueur : une décoration de ProseMirror disparaîtrait avec le
    texte supprimé autour d'elle, au lieu de se replier ;
  - `src/editor/soumission.js` : soumission retenue. La relance est unique : « Enregistrer sans attendre »
    et la fin des envois ne soumettent pas deux fois. Sans bouton mémorisé, elle passe par `requestSubmit()`
    sans argument (`requestSubmit(null)` lève une exception). Elle rétablit `form.clk` le temps de la
    relance : jquery.form ne sérialise que ce bouton, et le remet à `null` 100 ms après le clic. La
    destruction de l'éditeur (crayon fermé) annule la soumission retenue ;
  - barre d'état : zone de message, seule affichée en mode source.
- **Écarts** : bascule de mode refusée pendant un envoi, collage habituel dans un bloc de code, marqueur
  source supprimé à la main → rien inséré (§3) ; tests PHP dépendant du vrai SPIP passés en e2e (§7).
- **Tests** :
  - PHPUnit : 64 tests ;
  - Vitest : suite verte, hors un échec qui existe déjà sur main (`tests/spip/invariants.test.js`, « texte
    de 200 Ko », dans le parseur) ;
  - e2e `images.e2e.js` (15 tests), sous Chromium, Firefox et WebKit : 45 réussis sur SPIP 4.4 et 4.2 ;
    39 réussis et 6 sautés (pas de Crayons) sur SPIP 5. Le test du formulaire AJAX à deux boutons échoue
    (`Bouton : aucun`) sans la restauration de `form.clk`.
  - suite e2e complète sous Chromium, sur SPIP 4.4 : 68 réussis, 1 sauté, 4 échecs dans `menus.e2e.js`. Ces
    échecs ne viennent pas de ce lot : le test ouvre chaque `.tts-menu > button`, y compris le menu de la
    langue affichée, masqué sans multi depuis `32247a8`.

## 10. Réalisation (lot L7.2)

Plan : `docs/superpowers/plans/2026-10-15-deposer-documents-l7-2.md`.

- **Serveur** : `inc/tiptap_spip_depot.php` (remplace `inc/tiptap_spip_images.php`) : extensions déposables,
  limites `taille_image` et `taille_document` selon `documents_limite_image`, `finfo` pour les images
  seulement ; opération `deposer_document` (remplace `deposer_image`) et annonce `data-tts-depot`. Le
  réglage `coller_images` couvre le collage et le dépôt (libellé élargi).
- **Client** :
  - `src/services/cvt.js` : `depot()` ;
  - `src/editor/envois.js` : classe `Envois`, commune au collage et au dépôt (envoi, insertion, refus) ;
    événements `tiptap-spip:document-recu`, `document-insere` et `document-erreur` ([07](07-extensibilite.md)) ;
  - `src/editor/deposer.js` : arbitrage du dépôt (`trierDepot`), extension corrigée comme medias
    (`corrigerExtension`), extension `DepotFichiers` (écouteurs en capture, état de survol, position).
- **Écarts** :
  - Bigup étend la zone de dépôt de la boîte « Documents » à `#contenu`. Sans `stopPropagation()` sur les
    `dragenter` et `dragover` pris par l'éditeur, son calque restait affiché après un dépôt sur SPIP 4.2 et
    bloquait « Enregistrer » ;
  - Crayons 3.5.1 : `action_crayons_upload` répond 500 (`distant_table()` appelée avant
    `include_spip('inc/crayons')`). Ce bug n'est pas le nôtre : les tests du panneau et de Tiptap désactivé
    vérifient que le fichier part bien vers Crayons (ligne ajoutée au panneau, requête `crayons_upload`,
    texte intact), pas le document créé ;
  - un crayon modifié sans que l'éditeur ait perdu le focus n'enregistrait pas le texte : Crayons soumet par
    `cQuery`, dont `form-pre-serialize` n'atteint pas un écouteur posé avec `jQuery`. Corrigé dans
    `TextareaBridge` (MR !28, fusionnée avant ce lot).
- **Tests** :
  - PHPUnit : 68 tests ;
  - Vitest : 1439 tests ;
  - e2e `depot.e2e.js` (10 tests) et `images.e2e.js` (17 tests), sous Chromium, Firefox et WebKit : 81
    réussis sur SPIP 4.4 et 4.2 ; 63 réussis et 18 sautés (pas de Crayons) sur SPIP 5.
