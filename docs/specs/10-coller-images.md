# 10 — Coller une image

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
   le navigateur la fournit). La saisie reste libre pendant l'envoi.
3. L'image est envoyée au serveur, qui crée un **document SPIP** lié à l'objet édité.
4. Le marqueur est remplacé par le modèle `<docN>` (§4), affiché par la prévisualisation habituelle des modèles
   ([05](05-extensions-spip.md) §3). L'insertion est une étape d'historique : `Ctrl+Z` la retire (le document
   reste lié à l'objet, comme après un ajout par la boîte « Documents »).
5. En cas d'échec, le marqueur disparaît, rien n'est inséré, et la barre d'état
   ([06](06-interface.md) §5) affiche le message du serveur (type refusé, taille, droits, session expirée).

Plusieurs images collées d'un coup sont envoyées une par une, dans l'ordre, chacune avec son marqueur.

Le même comportement vaut en **mode source** : le marqueur est alors un texte provisoire dans le textarea
(`<!-- envoi… -->`, à la manière du `progressText` d'InlineAttachment), remplacé par `<docN>` ou retiré.

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
| `onFileReceived`, `onFileUploadResponse`, `onFileUploadError` | événements `tiptap-spip:image-recue`, `…:image-inseree`, `…:image-erreur` sur le textarea, pour les plugins tiers ([07](07-extensibilite.md)) |

## 3. Côté client

### Capture

Un module `src/editor/collerImage.js`, commun aux deux modes :

- **Éditeur visuel** : `handlePaste` d'une extension `spipPasteImage`, ajoutée seulement si le service
  d'envoi est disponible (§5).
- **Mode source** : écouteur `paste` sur le textarea.

Arbitrage avec le collage existant ([04](04-parseur-serialiseur.md) §6). Le presse-papiers contient souvent à
la fois un fichier et du texte : un tableau copié depuis un tableur arrive en HTML **et** en PNG, un
paragraphe copié depuis un traitement de texte aussi. Règle :

| Contenu du presse-papiers | Traitement |
|---------------------------|------------|
| Fichiers image seuls | envoi |
| Fichier image + `text/html` réduit à une seule `<img>` (copie d'image depuis un navigateur) | envoi du fichier ; le HTML est ignoré |
| Fichier image + autre `text/html` ou `text/plain` non vide | collage texte/HTML habituel ; le fichier est ignoré |
| Fichier non image, ou type hors liste blanche | collage habituel (rien n'est envoyé) ; message « type non accepté » |

Liste blanche par défaut : `image/png`, `image/jpeg`, `image/gif`, `image/webp`. Elle est envoyée au JS dans
la configuration (§6), recoupée par le serveur avec `spip_types_documents` (types `upload='oui'`).

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

Tant qu'un envoi est en cours, la soumission du formulaire d'édition est retenue (écouteur `submit`) avec le
message « Une image est en cours d'envoi » ; elle repart d'elle-même à la fin des envois, ou au clic sur
« Enregistrer sans attendre », qui abandonne les envois restants.

### Envoi

Par `src/services/cvt.js`, dans la file sérialisée du formulaire de services : nouvelle opération
`deposer_image` (§5), corps `FormData` du formulaire + `fichier` (le `File` renommé). `fetch` ne donnant pas
la progression d'un envoi, celle-ci passe par `XMLHttpRequest.upload.onprogress` pour cette seule opération ;
sans progression, le marqueur reste indéterminé.

## 4. Raccourci inséré

`<docN>`, sans alignement : c'est le raccourci que propose la boîte « Documents » de SPIP 4 et 5 pour une
image, et il s'affiche avec titre et légende si le rédacteur en ajoute ensuite. Le nœud inséré est un
`spipModel` ordinaire ([03](03-schema-json.md) §4) : il se modifie (`|left`, `|center`…) et se prévisualise
comme tout modèle. Pas de nouveau nœud, pas de nouvelle règle de parseur ni de sérialiseur.

Toujours `<docN>`, jamais `<imgN>`, et sans réglage (Q11, tranchée le 2026-10-14 ; cf. §8).

Position : à l'endroit du collage, en ligne. Le core rend `<docN>` seul sur sa ligne comme un bloc ; inséré
au milieu d'un paragraphe, il reste en ligne, comme si le rédacteur l'avait tapé.

## 5. Côté serveur : opération `deposer_image`

Nouvelle ligne du tableau des opérations ([02](02-architecture.md) §5) :

| Opération | Paramètres | Contrôles `verifier()` | Résultat |
|-----------|------------|------------------------|----------|
| `deposer_image` | `fichier` (dans `$_FILES`) | un seul fichier, envoi PHP sans erreur (`UPLOAD_ERR_OK`, `is_uploaded_file`) ; extension et type réel (`finfo`) dans la liste blanche et acceptés par `spip_types_documents` ; `autoriser('joindredocument', objet, id_objet_lien)` ; configuration `tiptap_spip/coller_images` active | `{id_document, raccourci}` (`raccourci` = `doc12`) |

- **Ajout** : `action_ajouter_documents_dist('new', [$fichier], $objet, $id_objet_lien, 'auto')` du plugin
  medias. Il refait les contrôles de taille et de dimensions du site (`_IMG_MAX_SIZE`, `_IMG_MAX_WIDTH`…) et
  renvoie un message d'erreur sous forme de chaîne, transmis tel quel dans `message_erreur`.
- **Objet nouveau** (`id_objet` = 0) : le document est lié à `-id_auteur`, comme le fait la boîte
  « Documents » ; `medias_post_insertion` le rattache à l'objet lors de sa création. `autoriser('joindredocument')`
  accepte cet id négatif quand il vaut l'auteur connecté.
- **Statut et `vu`** : rien de spécifique. Le document est lié comme par la boîte « Documents » ; à
  l'enregistrement du texte, SPIP marque `vu=oui` les documents cités.
- **Pas de medias** (plugin désactivé) ou objet hors de `documents_objets` : `charger()` annonce l'opération
  indisponible (§6), le JS n'ajoute pas la capture.
- **Forums** : jamais (barre `forum`, comme pour les modèles).
- **CVT et fichiers** : `_request()` ne lit pas `$_FILES` ; le fichier est lu directement, sous le nom de champ
  fixe `fichier`. À vérifier sur SPIP 4.2, 4.4 et 5 : le traitement AJAX d'un CVT (`var_ajax=form`) avec un
  corps `multipart/form-data` envoyé par `fetch`/XHR (le JS de SPIP passe, lui, par `jquery.form`).

## 6. Configuration

| Clé | Défaut | Effet |
|-----|--------|-------|
| `tiptap_spip/coller_images` | `oui` | active la capture du collage d'images |

Le JS reçoit, dans la configuration de l'instance (`data-tts-*` du conteneur `.tts-services` ou réponse de
`charger()`) : disponibilité de l'opération, liste blanche, taille maximale. Sans ces informations, pas de
capture : le collage se comporte comme aujourd'hui.

## 7. Tests

| Niveau | Cas |
|--------|-----|
| Vitest | arbitrage du presse-papiers (§3, chaque ligne du tableau) ; renommage d'un fichier sans nom ; refus avant envoi (type, taille) ; marqueur : position reportée quand on tape avant lui, repli quand on supprime autour, absent de `getJSON()` et du textarea ; remplacement par `<docN>` en une transaction annulable ; échec sans insertion |
| Vitest (CVT) | réponses enregistrées de `deposer_image` (succès, type refusé, taille, non autorisé, session expirée) lues par `cvt.js` |
| PHPUnit | `verifier()` : sans fichier, deux fichiers, extension/type réel discordants (PNG renommé `.php`), type absent de `spip_types_documents`, sans droit, objet nouveau d'un autre auteur |
| Playwright | sur `editer_article` existant : collage d'un PNG (`ClipboardEvent` avec `DataTransfer` contenant un `File`) → `<docN>` dans le textarea, document lié à l'article ; même chose sur un article **nouveau**, puis enregistrement : document rattaché à l'article créé ; mode source ; soumission pendant l'envoi retenue ; collage d'un tableau HTML + PNG → tableau collé, rien envoyé. Sous Chromium, Firefox et WebKit |

## 8. Hors périmètre et suites

- **Glisser-déposer** de fichiers : même chaîne (`handleDrop`, même opération), étendue à tous les types de
  documents → lot L7.2.
- Images référencées par URL dans un HTML collé (`<img src="https://…">`, `data:`) : non rapatriées ; le
  collage HTML les ignore comme aujourd'hui.
- Retouche (recadrage, redimensionnement) avant envoi.
- Suppression du document quand le rédacteur retire `<docN>` : non, comme dans SPIP (le document reste dans
  la boîte « Documents »).

Question tranchée, reprise dans [09](09-lots-roadmap.md) §3 :

| # | Question | Proposition |
|---|----------|-------------|
| Q11 | Raccourci inséré pour une image collée : `<docN>` ou `<imgN>` ? | **Tranché (2026-10-14)** : `<docN>`, cohérent avec la boîte « Documents » de SPIP 4/5 ; pas de réglage |
