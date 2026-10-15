# Glisser-déposer des documents (lot L7.2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** déposer un ou plusieurs fichiers de tout type accepté par SPIP dans l'éditeur (visuel ou source)
en fait des documents liés à l'objet et un `<docN>` par fichier, à l'endroit du dépôt. La coexistence avec le
dépôt expérimental de Crayons ne doit produire aucun double envoi (spec `docs/specs/10-coller-images.md` §8,
demande #4).

**Architecture :**
- **Serveur.** L'opération `deposer_image` (L7.1, non publiée) devient `deposer_document`, qui accepte tous les
  types que SPIP autorise en envoi.
  - Le type réel (`finfo`) n'est contrôlé que pour les images de la liste blanche. Pour les autres types, le
    contrôle d'extension reste celui de medias, comme dans la boîte « Documents » et Crayons.
  - L'annonce `data-tts-images` devient `data-tts-depot` :
    `{ images, extensions, taille_image, documents, documents_limite_image, taille_document }`.
    `documents_limite_image` liste les extensions déposables que medias borne par `_IMG_MAX_SIZE`. C'est une liste
    de limite de taille, pas de types d'images : on y trouve svg et swf, qui ne se collent pas.
- **Client.**
  - L'orchestrateur `CollerImages` devient `Envois` (`src/editor/envois.js`). Il sert au collage et au dépôt.
    Les événements deviennent `tiptap-spip:document-*`, les libellés parlent de « fichier ».
  - Un nouveau module `src/editor/deposer.js` porte :
    - `trierDepot` : fichiers acceptés ou refusés ;
    - `DepotFichiers` : écouteurs de glisser-déposer en capture sur la zone de l'éditeur, état de survol,
      position du dépôt, `preventDefault()` systématique ;
    - l'exception du mode source d'un crayon équipé par `crayons/upload`, limitée aux dépôts sur son textarea
      `.uploader`.
- **Réglage.** La case « Coller des images » commande aussi le dépôt : la clé `tiptap_spip/coller_images` reste,
  son libellé s'élargit.

**Tech Stack :** inchangée (Tiptap 3.31.4, Vitest 3 + jsdom, Playwright 1.61, PHPUnit).

## Global Constraints

- Commentaires et libellés en français, tabulations ; commits sans trailer ; branche `feat/deposer-documents`
  poussée sur origin, une seule demande de fusion vers main à la fin du plan (« Réf. #4 »).
- Raccourci inséré : `<docN>` pour tout document, sans alignement ; mode d'ajout `document`.
- Types acceptés au dépôt : ceux de `spip_types_documents` avec `upload='oui'`, après `corriger_extension()`.
  Au collage : les images de la liste blanche (`image/png`, `image/jpeg`, `image/gif`, `image/webp`).
- Taille maximale, avec la même répartition que medias (`verifier_taille_document_acceptable`) :
  - fichiers dont medias borne la taille par `_IMG_MAX_SIZE`, c'est-à-dire reconnus par `getimagesize()`
    (`decoder_type_image` : gif, jpg, png, psd, bmp, tif, webp, svg, et swf, dont `metadata/swf.php` passe par
    `metadata/image.php`) : minimum de `upload_max_filesize`, `post_max_size` et
    `_IMG_MAX_SIZE` (Ko) ;
  - autres documents : même calcul avec `_DOC_MAX_SIZE` (Ko).
- Le dépôt de fichiers appelle toujours `preventDefault()` sur `dragover` et `drop`, même refusé.
  - **Seule exception :** en mode source, un dépôt **sur** le textarea de classe `uploader` (Crayons). Là, aucun
    envoi, aucun `preventDefault()`, aucun arrêt de propagation. Un dépôt ailleurs dans la zone (barre
    d'outils, barre d'état) reste traité par Tiptap : Crayons ne l'écoute pas, et sans `preventDefault()` le
    navigateur ouvrirait le fichier.
- Réglage : `tiptap_spip/coller_images` (défaut `oui`) commande collage **et** dépôt.
- Règle i18n : chaque libellé JS est dans `labels.js`, `lang/tiptap_spip_fr.php` et
  `prive/javascript/tiptap_spip_config.js.html` (vérifié par `tests/ui/i18n.test.js`). Il n'y a pas de
  `lang/tiptap_spip_en.php`.
- Le bundle `prive/javascript/tiptap_spip.js` / `.min.js` est versionné : `npm run build` avant chaque commit qui
  touche `src/`.
- Sites jetables : ne jamais les réinitialiser ; pas de `git switch`, de fusion ni de commit d'un fichier servi
  pendant un e2e ; après un changement de branche, vider `tmp/cache/skel/*` et `tmp/cache/calcul/*` des trois
  sites.
- Commandes JS depuis `prive/javascript/tiptap_spip/`, commandes PHP depuis la racine du dépôt. Sites :
  - 4.4 : `TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931` ;
  - 4.2 : `TTS_SITE=/src/jetables/v4.2.16 TTS_URL=http://127.0.0.1:18932 TTS_PHP=php8.3` ;
  - 5 : `TTS_SITE=/src/jetables/v5.0-dev TTS_URL=http://127.0.0.1:18933 TTS_PHP=php8.4` (sans Crayons).

## Décisions (utilisateur, 2026-10-15)

1. Une seule opération, `deposer_document`, qui remplace `deposer_image` (rien n'est publié : CHANGELOG
   « Non publié »). Le collage reste limité aux images, côté client.
2. Type réel (`finfo`) contrôlé pour les images seulement. Pour les autres documents : extension de
   `spip_types_documents`, puis contrôles de medias.
3. Même case de configuration pour le collage et le dépôt (`coller_images`, libellé élargi).

## Décisions prises en écrivant ce plan (à reporter dans la spec 10, tâche 6)

4. **Position du dépôt.**
   - Éditeur visuel : point du dépôt, `view.posAtCoords`. Hors du contenu, ou sans position : après la sélection.
     Dans un bloc de code : après ce bloc.
   - Mode source : après la sélection du textarea. Un navigateur ne donne pas la position du caret sous la souris
     dans un textarea.
5. **Arbitrage du dépôt.** Tout fichier du dépôt est traité, même accompagné de HTML ou de texte (image glissée
   depuis une page web). Un dépôt sans fichier (texte glissé, déplacement interne) reste à ProseMirror et au
   navigateur.
6. **Nom des fichiers déposés.**
   - Une image de la liste blanche est renommée comme au collage (`nommer`, extension annoncée).
   - Un autre document garde son nom.
7. **Tailles** : la limite d'un fichier déposé suit la répartition de medias. Le serveur annonce
   `documents_limite_image`, les extensions déposables dont medias borne la taille par `_IMG_MAX_SIZE`. C'est une
   liste technique de limite de taille, distincte de `images` (types collables) :
   - un SVG y figure, sans être collable ;
   - un SWF aussi, parce que medias le décrit avec `metadata/image.php`. Ce n'est pas une image (Flash est
     abandonné), il n'est jamais collable, et il n'est déposable que si le site autorise son envoi.

   Exclure le SWF du dépôt serait une décision distincte, non prise ici.
8. **Exception Crayons** limitée à la cible : seul un dépôt sur le textarea `.uploader`, en mode source, est
   laissé à Crayons (relecture du plan).
9. **Renommages**, puisque rien n'est publié :
   - `data-tts-images` → `data-tts-depot` et `Services#images()` → `Services#depot()` ;
   - événements `tiptap-spip:image-*` → `tiptap-spip:document-*` ;
   - libellés `image_*` → libellés « fichier » ;
   - `CollerImages` → `Envois` ;
   - `inc/tiptap_spip_images.php` → `inc/tiptap_spip_depot.php` ;
   - `tests/unit/ImagesTest.php` → `tests/unit/DepotTest.php`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `inc/tiptap_spip_depot.php` (renommé depuis `inc/tiptap_spip_images.php`) | disponibilité et annonce, contrôle, ajout |
| `formulaires/tiptap_spip.{php,html}` | `_depot`, `deposer_document`, `data-tts-depot` |
| `lang/tiptap_spip_fr.php`, `src/ui/labels.js`, `prive/javascript/tiptap_spip_config.js.html` | messages et libellés |
| `tests/bootstrap.php`, `tests/unit/DepotTest.php` (renommé), `tests/unit/Config*.php` | PHPUnit |
| `src/services/cvt.js` | `depot()` |
| `src/editor/collerImage.js` | `nommer`, `trierPressePapiers` (collage) |
| `src/editor/envois.js` (nouveau, depuis `CollerImages`) | `Envois` : marqueurs, envois, insertion, événements |
| `src/editor/deposer.js` (nouveau) | `corrigerExtension`, `trierDepot`, `DepotFichiers` |
| `src/editor/marqueurEnvoi.js` | `ajouterMarqueurs(view, ids, pos?)` |
| `src/main.js` | câblage (`this.envois`, `this.depot`) |
| `css/tiptap_spip.css` | état de survol |
| `tests/e2e/site.php`, `tests/e2e/site.js` | inchangés (commandes `documents`, `config` déjà là) |
| `tests/e2e/images.e2e.js`, `tests/e2e/depot.e2e.js` (nouveau), `tests/e2e/fixtures-cvt.e2e.js`, `tests/fixtures/cvt/*` | Playwright, fixtures |
| `tests/services/cvt.test.js`, `tests/editor/collerImage.test.js`, `tests/editor/envois.test.js` (nouveau, déplacé depuis collerImage.test.js), `tests/editor/deposer.test.js` (nouveau), `tests/editor/marqueurEnvoi.test.js`, `tests/editor/soumission.test.js` | Vitest |
| `docs/specs/10-coller-images.md`, `02-architecture.md`, `07-extensibilite.md`, `09-lots-roadmap.md`, `CHANGELOG.md` | documentation |

---

### Task 0 : branche

- [ ] **Step 1**

```bash
cd /src/tiptap-spip && pgrep -fa "playwright test" ; git switch -c feat/deposer-documents main
for s in v4.2.16 v4.4.21 v5.0-dev; do rm -rf /src/jetables/$s/tmp/cache/skel/* /src/jetables/$s/tmp/cache/calcul/*; done
```

`pgrep` ne doit rien afficher.

---

### Task 1 : serveur — `deposer_document` et annonce `data-tts-depot`

**Files:**
- Rename: `inc/tiptap_spip_images.php` → `inc/tiptap_spip_depot.php`
- Rename: `tests/unit/ImagesTest.php` → `tests/unit/DepotTest.php`
- Modify: `formulaires/tiptap_spip.php`, `formulaires/tiptap_spip.html`, `lang/tiptap_spip_fr.php`, `tests/bootstrap.php`
- Modify: `prive/javascript/tiptap_spip/tests/e2e/images.e2e.js` (partie `serveur`)

**Interfaces:**
- Produces :
  - `tiptap_spip_taille_max(string $upload, string $post, ?int $max_ko): int`
  - `tiptap_spip_images_types(): array<string, string>` (extension → type MIME, liste blanche ; inchangée)
  - `tiptap_spip_documents_extensions(): string[]` (toutes les extensions `upload='oui'`, après correction)
  - `tiptap_spip_depot_id_lien(int $id_objet): int`
  - `tiptap_spip_depot(string $objet, int $id_objet): ?array{images: string[], extensions: array<string,string>, taille_image: int, documents: string[], documents_limite_image: string[], taille_document: int}`
  - constante `TIPTAP_SPIP_EXTENSIONS_LIMITE_IMAGE` (extensions bornées par `_IMG_MAX_SIZE` dans medias ; liste
    de limite de taille, pas de types d'images)
  - `tiptap_spip_controler_document(array $files, array $images, array $documents, ?callable $est_envoye = null): ?string`
  - `tiptap_spip_deposer_document(array $fichier, string $objet, int $id_objet): array{id_document: int, raccourci: string}|string`
  - attribut `data-tts-depot` sur le `<form>` de services ; opération `deposer_document`

- [ ] **Step 1 : renommer les fichiers**

```bash
git mv inc/tiptap_spip_images.php inc/tiptap_spip_depot.php
git mv tests/unit/ImagesTest.php tests/unit/DepotTest.php
```

- [ ] **Step 2 : tests PHPUnit qui échouent**

Dans `tests/unit/DepotTest.php` :
- classe `DepotTest` ;
- `require_once` de `inc/tiptap_spip_depot.php` ;
- fixture de `spip_types_documents` complétée : ajouter `['extension' => 'pdf', 'mime_type' => 'application/pdf']`
  (déjà là), `['extension' => 'odt', 'mime_type' => 'application/vnd.oasis.opendocument.text']` et
  `['extension' => 'jpeg', 'mime_type' => 'image/jpeg']` (ligne que medias ne reconnaît pas).

Puis remplacer les tests de disponibilité et de contrôle par :

```php
	public function testTailleMaxPlusPetiteLimiteNonNulle(): void {
		$this->assertSame(2 * 1024 ** 2, tiptap_spip_taille_max('2M', '8M', null));
		$this->assertSame(500 * 1024, tiptap_spip_taille_max('2M', '8M', 500));
		$this->assertSame(8 * 1024 ** 2, tiptap_spip_taille_max('0', '8M', null));
		$this->assertSame(0, tiptap_spip_taille_max('0', '0', null));
	}

	public function testDocumentsTousLesTypesEnvoyables(): void {
		// jpeg : corrigée en jpg par medias, elle ne compte pas
		$this->assertSame(['gif', 'jpg', 'png', 'webp', 'pdf', 'odt'], tiptap_spip_documents_extensions());
	}

	public function testAnnonceDuDepot(): void {
		$depot = tiptap_spip_depot('article', 12);
		$this->assertSame(['image/gif', 'image/jpeg', 'image/png', 'image/webp'], $depot['images']);
		$this->assertSame(['image/gif' => 'gif', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'], $depot['extensions']);
		$this->assertSame(['gif', 'jpg', 'png', 'webp', 'pdf', 'odt'], $depot['documents']);
		// bornées par _IMG_MAX_SIZE dans medias (getimagesize)
		$this->assertSame(['gif', 'jpg', 'png', 'webp'], $depot['documents_limite_image']);
		$this->assertIsInt($depot['taille_image']);
		$this->assertIsInt($depot['taille_document']);
	}

	public function testLimiteImagePourSvgEtSwfSansLesRendreCollables(): void {
		$GLOBALS['_test_sql']['spip_types_documents'][] = ['extension' => 'svg', 'mime_type' => 'image/svg+xml'];
		$GLOBALS['_test_sql']['spip_types_documents'][] = ['extension' => 'swf', 'mime_type' => 'application/x-shockwave-flash'];
		$depot = tiptap_spip_depot('article', 12);
		$this->assertNotContains('image/svg+xml', $depot['images'], 'un SVG ne se colle pas');
		$this->assertContains('svg', $depot['documents_limite_image'], 'mais medias borne sa taille par _IMG_MAX_SIZE');
		// metadata_swf passe par metadata_image : _IMG_MAX_SIZE, sans que le SWF soit une image ni collable
		$this->assertContains('swf', $depot['documents_limite_image']);
		$this->assertNotContains('application/x-shockwave-flash', $depot['images']);
		$this->assertNotContains('pdf', $depot['documents_limite_image']);
	}

	public function testDepotSansImageAccepteeMaisAvecDocuments(): void {
		$GLOBALS['_test_sql']['spip_types_documents'] = [['extension' => 'pdf', 'mime_type' => 'application/pdf']];
		$depot = tiptap_spip_depot('article', 12);
		$this->assertSame([], $depot['images']);
		$this->assertSame(['pdf'], $depot['documents']);
	}

	public function testDepotObjetNouveauLieAuRedacteur(): void {
		$GLOBALS['visiteur_session'] = ['id_auteur' => 7];
		$demandes = [];
		$GLOBALS['_test_autoriser'] = static function ($faire, $type, $id) use (&$demandes) {
			$demandes[] = [$faire, $type, $id];
			return true;
		};
		tiptap_spip_depot('article', 0);
		$this->assertSame([['joindredocument', 'article', -7]], $demandes);
	}

	public function testDepotIndisponible(): void {
		$this->assertNull(tiptap_spip_depot('', 0), 'sans objet');
		$GLOBALS['_test_autoriser'] = static fn () => false;
		$this->assertNull(tiptap_spip_depot('article', 12), 'sans droit');
		test_reset_globals();
		$GLOBALS['_test_plugins'] = [];
		$this->assertNull(tiptap_spip_depot('article', 12), 'sans medias');
		test_reset_globals();
		$GLOBALS['_test_config']['tiptap_spip'] = ['coller_images' => 'non'];
		$this->assertNull(tiptap_spip_depot('article', 12), 'désactivé');
		test_reset_globals();
		$this->assertNull(tiptap_spip_depot('article', 12), 'aucun type envoyable');
	}

	public function testControleImageAvecTypeReel(): void {
		$png = base64_decode(self::PNG);
		$type = _T('tiptap_spip:erreur_depot_type');
		$this->assertNull(tiptap_spip_controler_document(['fichier' => $this->fichier('a.png', $png)], self::TYPES, ['png', 'pdf'], self::envoye()));
		$this->assertSame($type, tiptap_spip_controler_document(['fichier' => $this->fichier('x.png', '<?php echo 1;')], self::TYPES, ['png', 'pdf'], self::envoye()), 'PHP renommé .png');
		$this->assertSame($type, tiptap_spip_controler_document(['fichier' => $this->fichier('x.php', $png)], self::TYPES, ['png', 'pdf'], self::envoye()), 'PNG renommé .php');
	}

	public function testControleDocumentParExtension(): void {
		$this->assertNull(tiptap_spip_controler_document(['fichier' => $this->fichier('notes.pdf', '%PDF-1.4')], self::TYPES, ['png', 'pdf'], self::envoye()));
		$this->assertNull(tiptap_spip_controler_document(['fichier' => $this->fichier('Notes.PDF', '%PDF-1.4')], self::TYPES, ['png', 'pdf'], self::envoye()), 'extension en majuscules');
		$this->assertSame(_T('tiptap_spip:erreur_depot_type'), tiptap_spip_controler_document(['fichier' => $this->fichier('a.exe', 'MZ')], self::TYPES, ['png', 'pdf'], self::envoye()));
	}

	public function testControleRefusCommuns(): void {
		$fichier = _T('tiptap_spip:erreur_depot_fichier');
		$png = base64_decode(self::PNG);
		$this->assertSame($fichier, tiptap_spip_controler_document([], self::TYPES, ['png'], self::envoye()), 'sans fichier');
		$deux = ['fichier' => $this->fichier('a.png', $png), 'autre' => $this->fichier('b.png', $png)];
		$this->assertSame($fichier, tiptap_spip_controler_document($deux, self::TYPES, ['png'], self::envoye()), 'deux fichiers');
		$this->assertSame(_T('tiptap_spip:erreur_depot_taille'), tiptap_spip_controler_document(['fichier' => $this->fichier('x.png', '', UPLOAD_ERR_INI_SIZE)], self::TYPES, ['png'], self::envoye()));
		$this->assertSame($fichier, tiptap_spip_controler_document(['fichier' => $this->fichier('x.png', $png)], self::TYPES, ['png'], static fn () => false), 'pas un envoi PHP');
	}
```

Dans `testDeposerEnModeDocument` et `testDeposerRendLeMessageDeMedias`, remplacer `tiptap_spip_deposer_image`
par `tiptap_spip_deposer_document` et `erreur_image_ajout` par `erreur_depot_ajout`. Supprimer les anciens
`testTailleMax…`, `testDisponible…`, `testObjetNouveau…`, `testIndisponible`, `testExtensionAnnonceeParType`,
`testControle…`, qui sont remplacés ci-dessus. Garder `testOctets` et `testTypesRecoupesAvecLaListeBlanche`.

`tests/bootstrap.php` : `corriger_extension` est déjà simulée. Rien à ajouter.

- [ ] **Step 3 : vérifier l'échec**

Run: `vendor/bin/phpunit --filter DepotTest`
Expected: FAIL (`tiptap_spip_depot` indéfinie).

- [ ] **Step 4 : implémentation de `inc/tiptap_spip_depot.php`**

En-tête du fichier :

```php
/**
 * Fichiers collés ou déposés dans l'éditeur (spec 10 §5, §8) : disponibilité de l'opération
 * deposer_document et annonce au JS, contrôle du fichier envoyé, ajout comme document SPIP lié à l'objet.
 */
```

Remplacer `tiptap_spip_images_taille_max` par :

```php
/**
 * Plus gros fichier accepté : la plus petite des limites définies (upload_max_filesize, post_max_size,
 * _IMG_MAX_SIZE ou _DOC_MAX_SIZE en Ko) ; 0 : sans limite connue.
 */
function tiptap_spip_taille_max(string $upload, string $post, ?int $max_ko): int {
	$limites = array_filter([tiptap_spip_octets($upload), tiptap_spip_octets($post), $max_ko ? $max_ko * 1024 : 0]);
	return $limites ? min($limites) : 0;
}
```

Après `tiptap_spip_images_types()`, ajouter :

```php
/**
 * Extensions dont medias borne la taille par _IMG_MAX_SIZE, et non par _DOC_MAX_SIZE
 * (inc/verifier_taille_document_acceptable.php) : celles que decoder_type_image() rend pour un fichier
 * reconnu par getimagesize() (metadata/image.php). Liste technique de limite de taille, pas de types
 * d'images : swf y figure parce que metadata/swf.php passe par metadata/image.php, mais un SWF n'est ni
 * une image ni collable (images de tiptap_spip_depot()). Il n'est déposable que si le site en autorise
 * l'envoi.
 */
const TIPTAP_SPIP_EXTENSIONS_LIMITE_IMAGE = ['gif', 'jpg', 'png', 'psd', 'bmp', 'tif', 'webp', 'svg', 'swf'];

/**
 * Extensions de tous les types que le site accepte en envoi (boîte « Documents »), dans l'ordre de
 * spip_types_documents ; seules celles que medias reconnaît après corriger_extension().
 *
 * @return string[]
 */
function tiptap_spip_documents_extensions(): array {
	include_spip('base/abstract_sql');
	include_spip('inc/documents');
	$extensions = [];
	foreach (sql_allfetsel('extension', 'spip_types_documents', "upload='oui'") as $ligne) {
		$extension = (string) $ligne['extension'];
		if (corriger_extension($extension) === $extension) {
			$extensions[] = $extension;
		}
	}
	return array_values(array_unique($extensions));
}
```

Attention : la simulation `sql_allfetsel` rend les lignes complètes, avec `mime_type`. Le code ne lit que
`extension`, cela suffit.

Renommer `tiptap_spip_images_id_lien` en `tiptap_spip_depot_id_lien` (même corps, mettre à jour son
commentaire).

Remplacer `tiptap_spip_images()` par :

```php
/**
 * Dépôt de fichiers pour l'éditeur d'un objet (spec 10 §5, §6, §8), ou null si deposer_document est
 * indisponible (sans objet, plugin medias inactif, réglage coller_images désactivé, pas le droit de
 * joindre un document, aucun type envoyable) :
 * - images : types collables (liste blanche acceptée par le site), extension de chacun (le JS renomme
 *   le fichier avec elle), taille maximale (_IMG_MAX_SIZE) ;
 * - documents : extensions déposables (tous les types envoyables) ; documents_limite_image : celles que medias
 *   borne par _IMG_MAX_SIZE (documents_limite_image : liste de limite de taille, pas de types d'images ;
 *   taille_image) ; taille maximale des autres (_DOC_MAX_SIZE).
 *
 * @return ?array{images: string[], extensions: array<string, string>, taille_image: int, documents: string[], documents_limite_image: string[], taille_document: int}
 */
function tiptap_spip_depot(string $objet, int $id_objet): ?array {
	if ($objet === '' || tiptap_spip_config()['coller_images'] !== 'oui' || !test_plugin_actif('medias')) {
		return null;
	}
	include_spip('inc/autoriser');
	if (!autoriser('joindredocument', $objet, tiptap_spip_depot_id_lien($id_objet))) {
		return null;
	}
	$documents = tiptap_spip_documents_extensions();
	if (!$documents) {
		return null;
	}
	// type MIME → première extension acceptée
	$extensions = [];
	foreach (tiptap_spip_images_types() as $extension => $type) {
		$extensions[$type] ??= $extension;
	}
	$upload = (string) ini_get('upload_max_filesize');
	$post = (string) ini_get('post_max_size');
	return [
		'images' => array_keys($extensions),
		'extensions' => $extensions,
		'taille_image' => tiptap_spip_taille_max($upload, $post, defined('_IMG_MAX_SIZE') ? (int) _IMG_MAX_SIZE : null),
		'documents' => $documents,
		'documents_limite_image' => array_values(array_intersect($documents, TIPTAP_SPIP_EXTENSIONS_LIMITE_IMAGE)),
		'taille_document' => tiptap_spip_taille_max($upload, $post, defined('_DOC_MAX_SIZE') ? (int) _DOC_MAX_SIZE : null),
	];
}
```

Remplacer `tiptap_spip_controler_image()` par :

```php
/**
 * Contrôle du fichier de deposer_document : un seul fichier, champ « fichier », envoi PHP complet ;
 * image de la liste blanche : extension et type réel (finfo) concordants ; autre document : extension
 * déposable (medias refait ses contrôles, comme pour la boîte « Documents »).
 *
 * @param array $files  $_FILES
 * @param array<string, string> $images  extension → type MIME des images (tiptap_spip_images_types)
 * @param string[] $documents  extensions déposables (tiptap_spip_documents_extensions)
 * @param ?callable(string): bool $est_envoye  is_uploaded_file par défaut, remplaçable dans les tests
 * @return ?string  message d'erreur, null si le fichier est accepté
 */
function tiptap_spip_controler_document(array $files, array $images, array $documents, ?callable $est_envoye = null): ?string {
	$est_envoye ??= 'is_uploaded_file';
	$fichier = $files['fichier'] ?? null;
	if (count($files) !== 1 || !is_array($fichier) || !is_string($fichier['tmp_name'] ?? null) || !is_string($fichier['name'] ?? null)) {
		return _T('tiptap_spip:erreur_depot_fichier');
	}
	$erreur = (int) ($fichier['error'] ?? UPLOAD_ERR_NO_FILE);
	if ($erreur === UPLOAD_ERR_INI_SIZE || $erreur === UPLOAD_ERR_FORM_SIZE) {
		return _T('tiptap_spip:erreur_depot_taille');
	}
	if ($erreur !== UPLOAD_ERR_OK || !$est_envoye($fichier['tmp_name'])) {
		return _T('tiptap_spip:erreur_depot_fichier');
	}
	include_spip('inc/documents');
	$extension = corriger_extension(strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION)));
	$reel = (new finfo(FILEINFO_MIME_TYPE))->file($fichier['tmp_name']);
	// une image de la liste blanche, ou un fichier qui en a le type réel : extension et type concordants
	if (isset($images[$extension]) || in_array($reel, $images, true)) {
		return ($images[$extension] ?? null) === $reel ? null : _T('tiptap_spip:erreur_depot_type');
	}
	return in_array($extension, $documents, true) ? null : _T('tiptap_spip:erreur_depot_type');
}
```

Le second test de la branche image (`in_array($reel, $images)`) refuse un PNG renommé `.pdf`. Le premier refuse
du PHP renommé `.png`.

Renommer `tiptap_spip_deposer_image` en `tiptap_spip_deposer_document`. Son commentaire parle maintenant d'un
« fichier ». Elle appelle `tiptap_spip_depot_id_lien`, et son message par défaut est
`_T('tiptap_spip:erreur_depot_ajout')`.

`lang/tiptap_spip_fr.php` :
- supprimer les cinq `erreur_image_*` ;
- ajouter les clés suivantes, dans l'ordre alphabétique :

```php
	'erreur_depot_ajout' => 'Le fichier n’a pas pu être ajouté aux documents.',
	'erreur_depot_fichier' => 'Aucun fichier reçu, ou envoi incomplet.',
	'erreur_depot_indisponible' => 'L’ajout de fichiers n’est pas disponible pour ce texte.',
	'erreur_depot_taille' => 'Fichier trop volumineux pour le serveur.',
	'erreur_depot_type' => 'Ce type de fichier n’est pas accepté.',
```

et élargir le libellé de la case :

```php
	'cfg_coller_images' => 'Coller des images et déposer des documents : chaque fichier est ajouté aux documents de l’objet et inséré en &lt;docN&gt;',
```

`formulaires/tiptap_spip.php` :
- `include_spip('inc/tiptap_spip_depot');` remplace `inc/tiptap_spip_images` ;
- dans `charger()` :

```php
		// collage et dépôt de fichiers (spec 10 §6) : configuration annoncée au JS, null si indisponible
		'_depot' => tiptap_spip_depot((string) $objet, intval($id_objet)),
```

- le cas `verifier()` :

```php
		case 'deposer_document':
			// messages dans message_erreur : sinon SPIP y met son message générique
			if (!tiptap_spip_depot((string) $objet, intval($id_objet))) {
				$erreurs['message_erreur'] = _T('tiptap_spip:erreur_depot_indisponible');
			} elseif ($erreur = tiptap_spip_controler_document($_FILES, tiptap_spip_images_types(), tiptap_spip_documents_extensions())) {
				$erreurs['message_erreur'] = $erreur;
			}
			break;
```

- dans `traiter()`, `deposer_image` devient `deposer_document` (la condition et la clé du `match`), et
  `tiptap_spip_deposer_image` devient `tiptap_spip_deposer_document`.

`formulaires/tiptap_spip.html` :

```html
	<form method="post" action="#ENV{action}"[ data-tts-depot="(#ENV{_depot}|tiptap_spip_json|attribut_html)"]><div>
```

- [ ] **Step 5 : vérifier PHPUnit**

Run: `vendor/bin/phpunit`
Expected: PASS. `ConfigTest` et `ConfigurerTest` ne changent pas : la clé `coller_images` reste.

- [ ] **Step 6 : e2e serveur**

Dans `prive/javascript/tiptap_spip/tests/e2e/images.e2e.js`, partie `serveur` :
- `annonce` lit `dataset.ttsDepot` ;
- `deposer()` poste `operation: 'deposer_document'` ;
- les attentes deviennent :

```js
	test('annonce : images collables, documents déposables, tailles ; rien si le réglage est désactivé', async ({ page }) => {
		await editer(page, 'Texte');
		const depot = await annonce(page);
		expect(depot.images).toEqual(expect.arrayContaining(['image/png', 'image/jpeg', 'image/gif']));
		expect(depot.extensions).toMatchObject({ 'image/png': 'png', 'image/jpeg': 'jpg' });
		expect(depot.documents).toEqual(expect.arrayContaining(['pdf', 'png', 'jpg', 'odt', 'svg']));
		expect(depot.documents_limite_image).toEqual(expect.arrayContaining(['png', 'jpg', 'svg']));
		expect(depot.documents_limite_image).not.toContain('pdf');
		expect(depot.taille_image).toBeGreaterThan(0);
		expect(depot.taille_document).toBeGreaterThan(0);
		configurer('tiptap_spip/coller_images', 'non');
		try {
			await page.reload();
			expect(await annonce(page)).toBeNull();
		} finally {
			configurer('tiptap_spip/coller_images', 'oui');
		}
	});
```

Le test `deposer_document : PNG renommé .php refusé` attend toujours un refus, désormais
`'Ce type de fichier n’est pas accepté.'`. Ajouter :

```js
	test('deposer_document : un PDF est lié à l\'article, en mode document', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const { ok, erreurs } = await deposer(page, { nom: 'notes.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64') });
		expect(erreurs).toBeNull();
		expect(ok.resultat.raccourci).toBe(`doc${ok.resultat.id_document}`);
		expect(documents('article', id)).toEqual([{ id_document: ok.resultat.id_document, mode: 'document', extension: 'pdf' }]);
	});
```

Renommer aussi les titres de tests qui citent `deposer_image`.

Run sur 4.4, 4.2 et 5 (caches vidés avant) :

```bash
cd prive/javascript/tiptap_spip
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images --project=chromium -g serveur
TTS_SITE=/src/jetables/v4.2.16 TTS_URL=http://127.0.0.1:18932 TTS_PHP=php8.3 npx playwright test images --project=chromium -g serveur
TTS_SITE=/src/jetables/v5.0-dev TTS_URL=http://127.0.0.1:18933 TTS_PHP=php8.4 npx playwright test images --project=chromium -g serveur
```

Expected: PASS. Le JS du collage lit encore `images()` : la partie `collage` échouera jusqu'à la Task 2. Ne
lancer ici que `-g serveur`.

- [ ] **Step 7 : commit**

```bash
git add -A inc formulaires lang tests/unit tests/bootstrap.php prive/javascript/tiptap_spip/tests/e2e/images.e2e.js
git commit -m "feat: opération deposer_document pour tout type de document"
```

---

### Task 2 : client — `depot()`, `Envois`, renommages (comportement du collage inchangé)

**Files:**
- Modify: `src/services/cvt.js`, `src/editor/collerImage.js`, `src/editor/marqueurEnvoi.js`, `src/editor/soumission.js`, `src/main.js`, `src/ui/labels.js`
- Create: `src/editor/envois.js` (classe `CollerImages` déplacée et renommée `Envois`)
- Modify: `lang/tiptap_spip_fr.php`, `prive/javascript/tiptap_spip_config.js.html`
- Modify: `tests/services/cvt.test.js`, `tests/editor/collerImage.test.js`, `tests/editor/marqueurEnvoi.test.js`, `tests/editor/soumission.test.js`, `tests/e2e/images.e2e.js`, `tests/e2e/fixtures-cvt.e2e.js`
- Create: `tests/editor/envois.test.js` (tests `CollerImages` déplacés)
- Re-record: `tests/fixtures/cvt/*` (`deposer_image*.html` → `deposer_document*.html`)

**Interfaces:**
- Consumes : annonce `data-tts-depot` et opération `deposer_document` (Task 1).
- Produces :
  - `Services#depot(): { images: string[], extensions: Record<string,string>, taille_image: number, documents: string[], documents_limite_image: string[], taille_document: number } | null`
  - `trierPressePapiers(donnees, { images, taille_image })` (même résultat qu'avant)
  - `class Envois` (`src/editor/envois.js`), même constructeur que `CollerImages`, avec en plus `lancer(fichiers: File[], mode: 'visual'|'source', pos?: number): void`
  - `ajouterMarqueurs(view, ids, pos = view.state.selection.to)`
  - événements `tiptap-spip:document-recu`, `tiptap-spip:document-insere`, `tiptap-spip:document-erreur`
  - `Instance#envois` (remplace `Instance#images`)

- [ ] **Step 1 : renommages mécaniques**

Table des renommages, à appliquer dans `src/`, `tests/` (Vitest et e2e) et
`prive/javascript/tiptap_spip_config.js.html`, `lang/tiptap_spip_fr.php` :

| Avant | Après |
|-------|-------|
| `images()` (méthode de `Services`) | `depot()` |
| `dataset.ttsImages` | `dataset.ttsDepot` |
| `'deposer_image'` | `'deposer_document'` |
| `tiptap-spip:${nom}` avec `image-recue` / `image-inseree` / `image-erreur` | `document-recu` / `document-insere` / `document-erreur` |
| `image_envoi` (libellé) | `envoi_fichier` |
| `image_echec` | `envoi_echec` |
| `image_type_refuse` | `fichier_type_refuse` |
| `image_trop_grosse` | `fichier_trop_gros` |
| `image_envoi_en_cours` | `envoi_en_cours` |
| `image_enregistrer_sans_attendre` | `enregistrer_sans_attendre` |
| `tts-img-` (ids d'envoi) | `tts-envoi-` |
| `this.images` (instance) | `this.envois` |

Textes des libellés (`labels.js` et `lang/tiptap_spip_fr.php`, mêmes chaînes) :

```js
	envoi_fichier: 'Envoi du fichier…',
	envoi_echec: 'Le fichier n’a pas pu être envoyé (session expirée ou connexion perdue).',
	fichier_type_refuse: 'Type de fichier non accepté : @nom@.',
	fichier_trop_gros: 'Fichier trop volumineux : @nom@.',
	envoi_en_cours: 'Un fichier est en cours d’envoi.',
	enregistrer_sans_attendre: 'Enregistrer sans attendre',
```

Dans `tiptap_spip_config.js.html`, chaque clé apparaît sous la forme `cle: "<:tiptap_spip:cle|texte_script:>",`.
Les textes attendus des tests suivent ces nouvelles chaînes : par exemple
`'Une image est en cours d’envoi.'` devient `'Un fichier est en cours d’envoi.'`.

- [ ] **Step 2 : `Services#depot()` (`src/services/cvt.js`)**

```js
	/**
	 * Collage et dépôt de fichiers (spec 10 §6) : configuration annoncée par charger() sur le formulaire
	 * courant, null si deposer_document est indisponible.
	 * @returns {{ images: string[], extensions: Record<string, string>, taille_image: number,
	 *             documents: string[], documents_limite_image: string[], taille_document: number } | null}
	 */
	depot() {
		const brut = this.container.querySelector('form')?.dataset.ttsDepot;
		if (!brut) return null;
		try {
			return JSON.parse(brut);
		} catch {
			return null;
		}
	}
```

(remplace `images()`).

- [ ] **Step 3 : `trierPressePapiers` (`src/editor/collerImage.js`)**

Signature et corps adaptés à l'annonce :

```js
 * @param {{ images: string[], taille_image: number }} config  taille_image 0 : sans limite
 …
export function trierPressePapiers(donnees, { images, taille_image: taille }) {
	…
		if (!images.includes(fichier.type)) refuses.push({ fichier, raison: 'type' });
```

`collerImage.js` ne garde que `nommer`, `imageSeule` et `trierPressePapiers`. Son commentaire d'en-tête devient
« arbitrage du presse-papiers et nom des captures ; les envois sont dans envois.js ».

- [ ] **Step 4 : `Envois` (`src/editor/envois.js`)**

Déplacer dans `src/editor/envois.js` le code de `CollerImages` et les définitions qui l'accompagnent :
`compteur`, `nouvelId`, `marqueurSource`, et les imports de `ServiceUnavailable`, `label` et des fonctions de
marqueurs. Puis :

```js
import { ServiceUnavailable } from '../services/cvt.js';
import { label } from '../ui/labels.js';
import { nommer, trierPressePapiers } from './collerImage.js';
import { ajouterMarqueurs, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from './marqueurEnvoi.js';

/**
 * Envois de fichiers collés ou déposés dans une instance (spec 10 §1, §3, §8) : un marqueur par
 * fichier, un appel deposer_document par fichier dans la file des services, puis <docN> à la place du
 * marqueur. Un envoi appartient au mode où le fichier a été collé ou déposé : la bascule de mode est
 * refusée tant qu'il en reste (main.js).
 */
export class Envois {
```

La méthode `coller(donnees, mode)` lit `services.depot()` au lieu de `services.images()`. Elle renomme avec
`config.extensions` comme avant, et délègue la suite à `lancer` :

```js
	coller(donnees, mode) {
		const services = this.services();
		const config = services?.available ? services.depot() : null;
		const tri = config && trierPressePapiers(donnees, config);
		if (!tri) return false;
		this.signalerRefus(tri.refuses);
		if (!tri.envoyer.length) return false;
		this.lancer(tri.envoyer.map((fichier) => nommer(fichier, new Date(), config.extensions)), mode);
		return true;
	}

	/** Refus avant envoi dans la barre d'état ; aucun refus : message effacé. */
	signalerRefus(refuses) {
		if (!refuses.length) {
			this.effacer();
			return;
		}
		this.signaler(refuses.map(({ fichier, raison }) => label(raison === 'type' ? 'fichier_type_refuse' : 'fichier_trop_gros').replace('@nom@', fichier.name || 'image')).join(' '));
	}

	/**
	 * Envoie des fichiers déjà nommés, dans l'ordre, chacun avec son marqueur.
	 * @param {File[]} fichiers
	 * @param {'visual'|'source'} mode
	 * @param {number} [pos]  visuel : position des marqueurs (après la sélection par défaut) ;
	 *        source : position dans le textarea (après la sélection par défaut)
	 */
	lancer(fichiers, mode, pos) {
		const services = this.services();
		const envois = fichiers.map((fichier) => ({ id: nouvelId(), fichier, mode, controleur: new AbortController() }));
		if (mode === 'visual') {
			ajouterMarqueurs(this.editor.view, envois.map((e) => e.id), pos);
		} else {
			// texte sélectionné conservé, comme avec Crayons : marqueurs après lui, sélection inchangée
			const fin = pos ?? this.textarea.selectionEnd;
			this.textarea.setRangeText(envois.map((e) => marqueurSource(e.id)).join(''), fin, fin, 'preserve');
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
		}
		for (const envoi of envois) {
			this.envois.set(envoi.id, envoi);
			this.emettre('document-recu', { fichier: envoi.fichier });
			this.envoyer(services, envoi);
		}
		this.surChangement();
	}
```

Dans `envoyer`, les noms deviennent `'deposer_document'`, `'document-insere'`, `'document-erreur'`,
`label('envoi_echec')`. Le reste de la classe est inchangé.

`src/editor/marqueurEnvoi.js` :

```js
/**
 * Marqueurs à `pos`, dans l'ordre des ids ; par défaut après la sélection : le texte sélectionné est
 * conservé, comme avec Crayons (son envoi ne touche pas au texte).
 */
export function ajouterMarqueurs(view, ids, pos = view.state.selection.to) {
	view.dispatch(view.state.tr.setMeta(cleMarqueurs, { ajouter: ids.map((id) => ({ id, pos })) }).setMeta('addToHistory', false));
}
```

et le widget affiche `label('envoi_fichier')`.

`src/main.js` :
- `import { Envois } from './editor/envois.js';` remplace l'import de `CollerImages` ;
- `this.images = new CollerImages(` devient `this.envois = new Envois(`, et toutes les autres mentions de
  `this.images` deviennent `this.envois` ;
- les libellés `image_*` deviennent leurs nouveaux noms.

`src/editor/soumission.js` : `label('envoi_en_cours')` et `label('enregistrer_sans_attendre')`.

- [ ] **Step 5 : tests**

- Déplacer de `tests/editor/collerImage.test.js` vers `tests/editor/envois.test.js` le bloc
  `describe('CollerImages …')` et ses aides : `services`, `monterInstance`, `coller`, `tick`, `afterEach`,
  `CONFIG`, `fichier`, `presse`. Les dupliquer si les deux fichiers en ont besoin. Le bloc devient
  `describe('Envois (spec 10 §1, §3)')`.
- Les services simulés exposent désormais :

```js
const CONFIG = { images: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], extensions: {}, taille_image: 1000, documents: ['png', 'jpg', 'gif', 'webp', 'pdf'], documents_limite_image: ['png', 'jpg', 'gif', 'webp'], taille_document: 5000 };
…
	depot: () => CONFIG,
```

  et `instance.images` devient `instance.envois`.
- Dans `collerImage.test.js`, les appels `trierPressePapiers(…, CONFIG)` restent avec ce même `CONFIG`. Le cas
  « taille 0 = sans limite » devient `{ ...CONFIG, taille_image: 0 }`.
- Le test « extension annoncée » de `envois.test.js` construit `depot: () => ({ ...CONFIG, extensions: { 'image/jpeg': 'jpeg' } })`.
- `tests/services/cvt.test.js` :
  - `Services.depot` remplace `Services.images` ;
  - l'attente devient `{ images: expect.arrayContaining(['image/png']), extensions: expect.objectContaining({ 'image/png': 'png' }), taille_image: expect.any(Number), documents: expect.arrayContaining(['pdf']), documents_limite_image: expect.arrayContaining(['png']), taille_document: expect.any(Number) }` ;
  - les fixtures `deposer_image` / `deposer_image_type` deviennent `deposer_document` / `deposer_document_type` ;
  - le message attendu devient `'Ce type de fichier n’est pas accepté.'`.
- `tests/e2e/fixtures-cvt.e2e.js` : les fixtures enregistrées s'appellent `deposer_document` et
  `deposer_document_type`, et postent `operation: 'deposer_document'`. Supprimer les anciennes
  `tests/fixtures/cvt/deposer_image*.html`, puis réenregistrer :

```bash
git rm -q tests/fixtures/cvt/deposer_image.html tests/fixtures/cvt/deposer_image_type.html
TTS_FIXTURES=1 TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test fixtures-cvt --project=chromium
grep -c 'data-tts-depot' tests/fixtures/cvt/formulaire.html
```

Expected : `1`.

- `tests/e2e/images.e2e.js` (partie collage) : textes des messages (« Un fichier est en cours d’envoi »).

- [ ] **Step 6 : vérifier**

```bash
npx vitest run
grep -rn "deposer_image\|ttsImages\|image-recue\|image-inseree\|image-erreur\|image_envoi\|image_echec\|image_type_refuse\|image_trop_grosse\|CollerImages\|tts-img-\|erreur_image_\|tiptap_spip_images(\b" src tests ../tiptap_spip_config.js.html ../../../lang ../../../inc ../../../formulaires
```

Expected :
- Vitest : PASS, y compris `tests/ui/i18n.test.js` ;
- `grep` : aucune ligne. Exception tolérée : `ui.collerImages`, le nom du rappel de collage, qui ne change pas.

Puis e2e du collage sur 4.4 (Chromium) :

```bash
npm run build
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images --project=chromium
```

Expected : PASS (tous les tests du collage, serveur compris).

- [ ] **Step 7 : commit**

```bash
git add -A src tests ../tiptap_spip.js ../tiptap_spip.min.js ../tiptap_spip_config.js.html ../../../lang
git commit -m "refactor: envois de fichiers génériques (deposer_document, événements document-*)"
```

---

### Task 3 : arbitrage du dépôt (`trierDepot`)

**Files:**
- Create: `prive/javascript/tiptap_spip/src/editor/deposer.js` (première partie)
- Test: `prive/javascript/tiptap_spip/tests/editor/deposer.test.js`

**Interfaces:**
- Consumes: `nommer` (`collerImage.js`), annonce `depot()` (Task 2).
- Produces:
  - `corrigerExtension(extension: string): string` (même table que `corriger_extension` de SPIP)
  - `trierDepot(donnees: DataTransfer|null, config): { envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null`
    (`null` : pas de fichier ; `envoyer` contient les fichiers déjà nommés)

- [ ] **Step 1 : tests qui échouent**

```js
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { corrigerExtension, trierDepot } from '../../src/editor/deposer.js';

const CONFIG = { images: ['image/png', 'image/jpeg'], extensions: { 'image/jpeg': 'jpg', 'image/png': 'png' }, taille_image: 1000, documents: ['png', 'jpg', 'pdf', 'odt', 'svg'], documents_limite_image: ['png', 'jpg', 'svg'], taille_document: 5000 };
const fichier = (nom, type, taille = 10) => new File([new Uint8Array(taille)], nom, { type });
const depot = (files, { html = '', texte = '' } = {}) => ({ files, getData: (t) => ({ 'text/html': html, 'text/plain': texte })[t] ?? '' });

describe('corrigerExtension (corriger_extension de SPIP)', () => {
	it('jpeg → jpg, htm → html, tiff → tif, aif → aiff, mpeg → mpg ; autres inchangées', () => {
		expect(['jpeg', 'htm', 'tiff', 'aif', 'mpeg', 'pdf'].map(corrigerExtension)).toEqual(['jpg', 'html', 'tif', 'aiff', 'mpg', 'pdf']);
	});
});

describe('trierDepot (spec 10 §8)', () => {
	it('sans fichier : null (texte glissé, déplacement interne)', () => {
		expect(trierDepot(depot([], { texte: 'x' }), CONFIG)).toBeNull();
		expect(trierDepot(null, CONFIG)).toBeNull();
	});

	it('images et documents dans l\'ordre ; image renommée, document gardant son nom', () => {
		const tri = trierDepot(depot([fichier('', 'image/png'), fichier('Rapport final.PDF', 'application/pdf'), fichier('photo.jpeg', 'image/jpeg')]), CONFIG);
		expect(tri.refuses).toEqual([]);
		expect(tri.envoyer.map((f) => f.name.replace(/\d{8}-\d{6}/, 'D'))).toEqual(['capture-D.png', 'Rapport final.PDF', 'photo.jpg']);
	});

	it('fichiers et HTML (image glissée depuis une page) : les fichiers sont traités', () => {
		expect(trierDepot(depot([fichier('a.png', 'image/png')], { html: '<p>du texte</p>' }), CONFIG).envoyer).toHaveLength(1);
	});

	it('extension non déposable : refusée (type), sans bloquer les autres', () => {
		const exe = fichier('setup.exe', 'application/x-msdownload');
		const tri = trierDepot(depot([exe, fichier('a.pdf', 'application/pdf')]), CONFIG);
		expect(tri.refuses).toEqual([{ fichier: exe, raison: 'type' }]);
		expect(tri.envoyer.map((f) => f.name)).toEqual(['a.pdf']);
	});

	it('image hors liste blanche mais extension déposable (svg) : document, nom gardé', () => {
		expect(trierDepot(depot([fichier('logo.svg', 'image/svg+xml')]), CONFIG).envoyer.map((f) => f.name)).toEqual(['logo.svg']);
	});

	it('extension jpeg d\'un document : corrigée comme par medias', () => {
		const config = { ...CONFIG, images: [] };
		expect(trierDepot(depot([fichier('a.JPEG', 'image/jpeg')]), config).envoyer).toHaveLength(1);
	});

	it('taille d\'un SVG : taille_image, la limite que medias lui applique (getimagesize le reconnaît)', () => {
		const svg = fichier('logo.svg', 'image/svg+xml', 1001);
		expect(trierDepot(depot([svg]), CONFIG).refuses).toEqual([{ fichier: svg, raison: 'taille' }]);
		expect(trierDepot(depot([fichier('logo.svg', 'image/svg+xml', 999)]), CONFIG).envoyer).toHaveLength(1);
	});

	it('tailles : image (taille_image) et document (taille_document) ; 0 = sans limite', () => {
		const image = fichier('a.png', 'image/png', 1001);
		const pdf = fichier('a.pdf', 'application/pdf', 5001);
		expect(trierDepot(depot([image, pdf]), CONFIG).refuses).toEqual([{ fichier: image, raison: 'taille' }, { fichier: pdf, raison: 'taille' }]);
		expect(trierDepot(depot([image, pdf]), { ...CONFIG, taille_image: 0, taille_document: 0 }).envoyer).toHaveLength(2);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/deposer.test.js`
Expected: FAIL (module absent).

- [ ] **Step 3 : implémentation**

`src/editor/deposer.js` :

```js
import { nommer } from './collerImage.js';

/**
 * Glisser-déposer de fichiers (spec 10 §8) : arbitrage du dépôt, état de survol de la zone d'édition,
 * position du dépôt, et partage avec le dépôt expérimental de Crayons.
 */

/** Extension telle que medias la cherche (corriger_extension de ecrire/inc/documents.php). */
const CORRECTIONS = { htm: 'html', jpeg: 'jpg', tiff: 'tif', aif: 'aiff', mpeg: 'mpg' };
export const corrigerExtension = (extension) => {
	const e = extension.replace(/[^a-z0-9]/gi, '');
	return CORRECTIONS[e] ?? e;
};

const extensionDe = (nom) => corrigerExtension((nom.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase());

/**
 * Arbitrage d'un dépôt : chaque fichier est traité, dans l'ordre, même accompagné de HTML ou de texte.
 * Une image de la liste blanche est renommée comme au collage ; un autre fichier est accepté si son
 * extension est déposable, et garde son nom.
 *
 * @param {DataTransfer|null} donnees
 * @param {{ images: string[], extensions: Record<string, string>, taille_image: number,
 *           documents: string[], documents_limite_image: string[], taille_document: number }} config
 *        tailles 0 : sans limite ; documents_limite_image : extensions que medias borne par
 *        _IMG_MAX_SIZE (liste de limite de taille, pas de types d'images)
 * @returns {{ envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null}
 *          null : pas de fichier (le dépôt n'est pas pour l'éditeur)
 */
export function trierDepot(donnees, config) {
	const fichiers = [...(donnees?.files ?? [])];
	if (!fichiers.length) return null;
	const envoyer = [];
	const refuses = [];
	for (const fichier of fichiers) {
		const image = config.images.includes(fichier.type);
		const extension = image ? config.extensions[fichier.type] : extensionDe(fichier.name);
		// limite de medias : _IMG_MAX_SIZE pour les extensions qu'il borne ainsi (svg, swf…), _DOC_MAX_SIZE sinon
		const taille = image || config.documents_limite_image.includes(extension) ? config.taille_image : config.taille_document;
		if (!image && !config.documents.includes(extension)) refuses.push({ fichier, raison: 'type' });
		else if (taille && fichier.size > taille) refuses.push({ fichier, raison: 'taille' });
		else envoyer.push(image ? nommer(fichier, new Date(), config.extensions) : fichier);
	}
	return { envoyer, refuses };
}
```

Le test « photo.jpeg » attend `photo.jpg` : `nommer` utilise l'extension annoncée pour `image/jpeg`.

- [ ] **Step 4 : vérifier**

Run: `npx vitest run tests/editor/deposer.test.js`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add src/editor/deposer.js tests/editor/deposer.test.js
git commit -m "feat: arbitrage des fichiers déposés dans l'éditeur"
```

---

### Task 4 : glisser-déposer dans l'instance (`DepotFichiers`)

**Files:**
- Modify: `src/editor/deposer.js` (classe `DepotFichiers`)
- Modify: `src/main.js`, `src/ui/labels.js`, `lang/tiptap_spip_fr.php`, `prive/javascript/tiptap_spip_config.js.html`, `css/tiptap_spip.css`
- Test: `tests/editor/deposer.test.js` (suite)

**Interfaces:**
- Consumes: `Envois#lancer`, `Envois#signalerRefus` (Task 2) ; `trierDepot` (Task 3).
- Produces:
  - `new DepotFichiers({ wrapper, textarea, editor, envois, services: () => ?Services, mode: () => 'visual'|'source', signaler: (texte) => void })`
  - `DepotFichiers#destroy()`
  - classe `tts-editor--depot` et attribut `data-tts-depot` (indication) sur le wrapper pendant le survol
  - `Instance#depot`

- [ ] **Step 1 : tests qui échouent**

Ajouter à `tests/editor/deposer.test.js` (imports : `afterEach`, `vi` ; `instances`, `tiptap_spip_init` de
`../../src/main.js`) :

```js
const tick = () => new Promise((r) => setTimeout(r, 0));

const services = (...reponses) => ({
	container: document.createElement('div'),
	available: true,
	depot: () => CONFIG,
	call: vi.fn(async () => {
		const r = reponses.shift();
		await tick();
		if (r instanceof Error) throw r;
		return r;
	}),
});

const monterInstance = (source, s, { mode = 'visual', classe = '' } = {}) => {
	document.body.innerHTML = `<form><textarea class="inserer_barre_edition ${classe}" name="texte">${source}</textarea></form>`;
	tiptap_spip_init();
	const instance = [...instances][0];
	instance.services = s;
	if (mode === 'source') instance.toggleMode({ focus: false });
	return instance;
};

/** Événement de glisser-déposer avec des fichiers (types : ['Files']). */
const glisser = (cible, type, files = [], { x = 0, y = 0 } = {}) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { clientX: x, clientY: y });
	Object.defineProperty(event, 'dataTransfer', { value: { types: files.length || type !== 'drop' ? ['Files'] : [], files, dropEffect: 'none', getData: () => '' } });
	cible.dispatchEvent(event);
	return event;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	localStorage.clear();
});

describe('DepotFichiers (spec 10 §8)', () => {
	it('survol avec des fichiers : état visible, retiré à la sortie et après le dépôt', () => {
		const instance = monterInstance('Texte', services({ id_document: 9, raccourci: 'doc9' }));
		const { wrapper } = instance;
		const surface = instance.editor.view.dom;
		expect(glisser(surface, 'dragenter').defaultPrevented).toBe(true);
		expect(glisser(surface, 'dragover').defaultPrevented).toBe(true);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(true);
		expect(wrapper.dataset.ttsDepot).toBe('Déposer les fichiers');
		const sortie = new Event('dragleave', { bubbles: true });
		Object.defineProperty(sortie, 'relatedTarget', { value: document.body });
		surface.dispatchEvent(sortie);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
		glisser(surface, 'dragover');
		glisser(surface, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
	});

	it('glisser du texte (sans fichier) : rien n\'est intercepté', () => {
		const instance = monterInstance('Texte', services());
		const event = new Event('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: { types: ['text/plain'], files: [] } });
		instance.editor.view.dom.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(instance.wrapper.classList.contains('tts-editor--depot')).toBe(false);
	});

	it('visuel : deux fichiers à la position du dépôt, dans l\'ordre, un appel chacun', async () => {
		const s = services({ id_document: 1, raccourci: 'doc1' }, { id_document: 2, raccourci: 'doc2' });
		const instance = monterInstance('Avant après', s);
		// jsdom n'a pas de géométrie : posAtCoords simulée au point du dépôt
		instance.editor.view.posAtCoords = () => ({ pos: 6, inside: -1 });
		const event = glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf'), fichier('', 'image/png')]);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(s.call.mock.calls.map(([op, , { fichier: f }]) => [op, f.name.replace(/\d{8}-\d{6}/, 'D')])).toEqual([['deposer_document', 'a.pdf'], ['deposer_document', 'capture-D.png']]);
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Avant<doc1><doc2> après');
	});

	it('visuel : dépôt dans un bloc de code : après le bloc', async () => {
		const instance = monterInstance('<code class="php">\n$a;\n</code>', services({ id_document: 3, raccourci: 'doc3' }));
		instance.editor.view.posAtCoords = () => ({ pos: 3, inside: 0 });
		glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toMatch(/<\/code>\n\n<doc3>$/);
	});

	it('source : fichiers après la sélection du textarea', async () => {
		const instance = monterInstance('Texte', services({ id_document: 4, raccourci: 'doc4' }), { mode: 'source' });
		instance.textarea.setSelectionRange(0, 3);
		const event = glisser(instance.textarea, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Tex<doc4>te');
	});

	it('refus (type, services absents ou indisponibles) : preventDefault quand même, message, rien envoyé', () => {
		const s = services();
		const instance = monterInstance('Texte', s);
		const exe = glisser(instance.editor.view.dom, 'drop', [fichier('setup.exe', 'application/x-msdownload')]);
		expect(exe.defaultPrevented).toBe(true);
		expect(instance.etat.message.textContent).toBe('Type de fichier non accepté : setup.exe.');
		instance.services = null;
		expect(glisser(instance.editor.view.dom, 'dragover').defaultPrevented).toBe(true);
		expect(glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		expect(instance.etat.message.textContent).toBe('L’ajout de fichiers n’est pas disponible ici.');
		instance.services = { ...services(), depot: () => null };
		glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(instance.etat.message.textContent).toBe('L’ajout de fichiers n’est pas disponible ici.');
		expect(s.call).not.toHaveBeenCalled();
	});

	it('mode source d\'un textarea .uploader (Crayons) : rien n\'est fait, l\'événement continue', () => {
		const instance = monterInstance('Texte', services(), { mode: 'source', classe: 'uploader' });
		const vus = [];
		instance.textarea.addEventListener('drop', (e) => vus.push(e.defaultPrevented));
		const survol = glisser(instance.textarea, 'dragover');
		const depot = glisser(instance.textarea, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect([survol.defaultPrevented, depot.defaultPrevented]).toEqual([false, false]);
		expect(vus).toEqual([false]);
		expect(instance.wrapper.classList.contains('tts-editor--depot')).toBe(false);
		expect(instance.envois.enCours()).toBe(0);
	});

	it('mode source d\'un textarea .uploader, dépôt ailleurs dans la zone : traité par l\'éditeur', async () => {
		const instance = monterInstance('Texte', services({ id_document: 6, raccourci: 'doc6' }), { mode: 'source', classe: 'uploader' });
		instance.textarea.setSelectionRange(5, 5);
		const barre = instance.wrapper.querySelector('.tts-toolbar');
		expect(glisser(barre, 'dragover').defaultPrevented).toBe(true);
		expect(glisser(barre, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Texte<doc6>');
	});

	it('visuel d\'un textarea .uploader : Tiptap traite le dépôt', async () => {
		const instance = monterInstance('Texte', services({ id_document: 5, raccourci: 'doc5' }), { classe: 'uploader' });
		instance.editor.commands.setTextSelection(6);
		expect(glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte<doc5>');
	});
});
```

Le test « visuel : position du dépôt » simule `posAtCoords`. Dans le test « source », `glisser` vise le
textarea. Le test « .uploader » écoute sur le textarea, comme Crayons (cQuery y lie ses gestionnaires) :
l'écouteur doit recevoir un événement non annulé.

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/deposer.test.js`
Expected: FAIL (`DepotFichiers` absent, `instance.depot` indéfini).

- [ ] **Step 3 : implémentation**

À la suite de `src/editor/deposer.js` (imports en tête : `import { label } from '../ui/labels.js';`) :

```js
const porteFichiers = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');

/**
 * Glisser-déposer de fichiers sur la zone d'une instance (spec 10 §8). Écouteurs en capture sur le
 * wrapper : ils passent avant ProseMirror, qui ne voit pas un dépôt de fichiers. Tout survol ou dépôt
 * de fichiers est annulé (preventDefault), même refusé : sinon le navigateur ouvrirait le fichier à la
 * place de la page. Seule exception : le mode source d'un textarea .uploader, dont Crayons
 * (crayons/upload) gère le dépôt : rien n'est fait, l'événement lui parvient intact.
 */
export class DepotFichiers {
	/**
	 * @param {{ wrapper: HTMLElement, textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor,
	 *           envois: import('./envois.js').Envois, services: () => ?import('../services/cvt.js').Services,
	 *           mode: () => 'visual'|'source', signaler: (texte: string) => void }} options
	 */
	constructor({ wrapper, textarea, editor, envois, services, mode, signaler }) {
		Object.assign(this, { wrapper, textarea, editor, envois, services, mode, signaler });
		this.onSurvol = (event) => {
			if (!this.concerne(event)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
			this.survol(true);
		};
		this.onSortie = (event) => {
			// sortie de la zone : pas vers un de ses descendants
			if (!this.wrapper.contains(event.relatedTarget)) this.survol(false);
		};
		this.onDepot = (event) => {
			if (!this.concerne(event)) return;
			event.preventDefault();
			event.stopPropagation();
			this.survol(false);
			this.deposer(event);
		};
		wrapper.addEventListener('dragenter', this.onSurvol, true);
		wrapper.addEventListener('dragover', this.onSurvol, true);
		wrapper.addEventListener('dragleave', this.onSortie, true);
		wrapper.addEventListener('drop', this.onDepot, true);
	}

	/**
	 * Glisser de fichiers, sauf sur le textarea géré par Crayons en mode source (crayons/upload y a lié
	 * ses gestionnaires). Ailleurs dans la zone (barre d'outils, barre d'état), Crayons n'écoute pas :
	 * le dépôt reste à l'éditeur, qui l'annule au moins.
	 */
	concerne(event) {
		if (!porteFichiers(event)) return false;
		return !(this.mode() === 'source' && event.target === this.textarea && this.textarea.classList.contains('uploader'));
	}

	survol(actif) {
		this.wrapper.classList.toggle('tts-editor--depot', actif);
		if (actif) this.wrapper.dataset.ttsDepot = label('depot_indication');
		else delete this.wrapper.dataset.ttsDepot;
	}

	deposer(event) {
		const services = this.services();
		const config = services?.available ? services.depot() : null;
		if (!config) {
			this.signaler(label('depot_indisponible'));
			return;
		}
		const tri = trierDepot(event.dataTransfer, config);
		if (!tri) return;
		this.envois.signalerRefus(tri.refuses);
		if (!tri.envoyer.length) return;
		const mode = this.mode();
		this.envois.lancer(tri.envoyer, mode, mode === 'visual' ? this.position(event) : undefined);
	}

	/**
	 * Visuel : point du dépôt dans le contenu ; dans un bloc de code, après ce bloc ; hors du contenu ou
	 * sans position, après la sélection.
	 */
	position(event) {
		const { view } = this.editor;
		const trouve = view.dom.contains(event.target) ? view.posAtCoords({ left: event.clientX, top: event.clientY }) : null;
		if (!trouve) return view.state.selection.to;
		const $pos = view.state.doc.resolve(trouve.pos);
		for (let d = $pos.depth; d > 0; d--) {
			if ($pos.node(d).type.spec.code) return $pos.after(d);
		}
		return trouve.pos;
	}

	destroy() {
		this.survol(false);
		this.wrapper.removeEventListener('dragenter', this.onSurvol, true);
		this.wrapper.removeEventListener('dragover', this.onSurvol, true);
		this.wrapper.removeEventListener('dragleave', this.onSortie, true);
		this.wrapper.removeEventListener('drop', this.onDepot, true);
	}
}
```

Après un bloc de code, la position est entre deux blocs. `remplacerMarqueur` (`insertContentAt`) y enveloppe le
`spipModel` dans un paragraphe : le test attend `</code>\n\n<doc3>`. Si Tiptap l'insère autrement, ajuster
l'attente du test au résultat de `insertContentAt`, en gardant l'image **après** le bloc.

`src/main.js`, après la création de `this.envois` et de `this.ui.collerImages` :

```js
		// glisser-déposer de fichiers (spec 10 §8)
		this.depot = new DepotFichiers({
			wrapper: this.wrapper,
			textarea,
			editor: this.editor,
			envois: this.envois,
			services: () => this.services,
			mode: () => this.bridge.mode,
			signaler: (texte) => this.etat.signaler(texte),
		});
```

avec `import { DepotFichiers } from './editor/deposer.js';`. Dans `destroy()`, ajouter `this.depot.destroy();`
avant `this.soumission?.destroy();`.

Libellés (`labels.js`, `lang/tiptap_spip_fr.php`, `tiptap_spip_config.js.html`) :

```js
	depot_indication: 'Déposer les fichiers',
	depot_indisponible: 'L’ajout de fichiers n’est pas disponible ici.',
```

`css/tiptap_spip.css` :

```css
/* Survol de la zone d'édition avec des fichiers (spec 10 §8) */
.tts-editor--depot {
	position: relative;
	outline: 2px dashed #3584e4;
	outline-offset: -2px;
}

.tts-editor--depot::after {
	content: attr(data-tts-depot);
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgb(53 132 228 / 12%);
	color: #1c71d8;
	font-weight: bold;
	pointer-events: none;
}
```

`pointer-events: none` : le calque ne capte pas le dépôt, qui atteint le contenu (position).

- [ ] **Step 4 : vérifier**

Run: `npx vitest run`
Expected: PASS (suite complète, i18n compris).

- [ ] **Step 5 : commit**

```bash
npm run build
git add src/editor/deposer.js src/main.js src/ui/labels.js tests/editor/deposer.test.js ../tiptap_spip_config.js.html ../tiptap_spip.js ../tiptap_spip.min.js ../../../lang/tiptap_spip_fr.php ../../../css/tiptap_spip.css
git commit -m "feat: glisser-déposer des fichiers dans l'éditeur"
```

---

### Task 5 : e2e du dépôt (`depot.e2e.js`)

**Files:**
- Create: `prive/javascript/tiptap_spip/tests/e2e/depot.e2e.js`

**Interfaces:**
- Consumes : tout ce qui précède ; `documents()`, `configurer()`, `lireConfig()`, `activer()`, `publier()`,
  `module()`, `enregistrer()`, `texte()` de `site.js`.

- [ ] **Step 1 : tests**

```js
// Glisser-déposer des documents (spec 10 §8) sur un site SPIP JETABLE : dépôt dans l'éditeur visuel et en
// mode source, état de survol, refus sans perte de la page, coexistence avec crayons/upload.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { activer, configure, configurer, documents, editer, enregistrer, lireConfig, module, publier, texte } from './site.js';

configure(test);

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

test.beforeAll(() => configurer('tiptap_spip/coller_images', 'oui'));

/**
 * Glisse puis dépose des fichiers sur l'élément, au centre de sa première ligne : dragenter, dragover,
 * drop, avec un vrai DataTransfer (dataTransfer posé par defineProperty, que DragEvent n'accepte pas
 * partout). Rend l'état d'annulation de chaque événement.
 */
const deposer = (page, selecteur, fichiers) => page.evaluate(([selecteur, fichiers, PNG]) => {
	const cible = document.querySelector(selecteur);
	const rect = cible.getBoundingClientRect();
	const dt = new DataTransfer();
	for (const { nom = 'image.png', type = 'image/png', base64 = PNG } of fichiers) {
		dt.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	}
	const etats = {};
	for (const type of ['dragenter', 'dragover', 'drop']) {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.assign(event, { clientX: rect.right - 2, clientY: rect.top + 8 });
		Object.defineProperty(event, 'dataTransfer', { value: dt });
		cible.dispatchEvent(event);
		etats[type] = event.defaultPrevented;
	}
	return etats;
}, [selecteur, fichiers, PNG]);

const envoisTermines = (page) => expect(page.locator('.tts-envoi')).toHaveCount(0, { timeout: 10_000 });

test.describe('dépôt', () => {
	test('visuel : un PDF et un PNG → deux documents liés, deux <docN> dans l\'ordre', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }, {}]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(2, { timeout: 10_000 });
		await envoisTermines(page);
		const docs = documents('article', id);
		expect(docs.map((d) => [d.extension, d.mode])).toEqual([['pdf', 'document'], ['png', 'document']]);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${docs[0].id_document}><doc${docs[1].id_document}>`);
	});

	test('mode source : <docN> après la sélection', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await module(page);
		await page.evaluate(() => [...window.__tts.instances][0].toggleMode());
		const textarea = page.locator('.tts-editor textarea');
		await textarea.evaluate((t) => t.setSelectionRange(5, 5));
		await deposer(page, '.tts-editor textarea', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(textarea).toHaveValue(/^Texte<doc\d+>$/, { timeout: 10_000 });
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('survol : état visible, retiré à la sortie de la zone', async ({ page }) => {
		await editer(page, 'Texte');
		const zone = page.locator('.tts-editor');
		await page.evaluate(() => {
			const dt = new DataTransfer();
			dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
			const ev = (type, cible, relatedTarget = null) => {
				const e = new Event(type, { bubbles: true, cancelable: true });
				Object.defineProperty(e, 'dataTransfer', { value: dt });
				Object.defineProperty(e, 'relatedTarget', { value: relatedTarget });
				cible.dispatchEvent(e);
			};
			window.__glisser = ev;
			ev('dragenter', document.querySelector('.tts-editor .ProseMirror'));
		});
		await expect(zone).toHaveClass(/tts-editor--depot/);
		await page.evaluate(() => window.__glisser('dragleave', document.querySelector('.tts-editor .ProseMirror'), document.body));
		await expect(zone).not.toHaveClass(/tts-editor--depot/);
	});

	test('refus (type non accepté) : page conservée, texte intact, message', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'setup.exe', type: 'application/x-msdownload', base64: 'TVo=' }]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		await expect(page.locator('.tts-etat__message')).toHaveText('Type de fichier non accepté : setup.exe.');
		await expect(page).toHaveURL(/exec=article_edit/);
		expect(documents('article', id)).toEqual([]);
		await expect(page.locator('.tts-editor .ProseMirror')).toHaveText('Texte');
	});

	test('services absents : dépôt annulé quand même, page et texte intacts, message', async ({ page }) => {
		// formulaire de services retiré de la page avant le montage de l'éditeur : mode dégradé
		await page.addInitScript(() => {
			new MutationObserver(() => document.querySelectorAll('.tts-services').forEach((c) => c.remove()))
				.observe(document, { childList: true, subtree: true });
		});
		const id = await editer(page, 'Texte');
		await module(page);
		expect(await page.evaluate(() => [...window.__tts.instances][0].services)).toBeNull();
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		await expect(page.locator('.tts-etat__message')).toHaveText('L’ajout de fichiers n’est pas disponible ici.');
		await expect(page).toHaveURL(/exec=article_edit/);
		await expect(page.locator('.tts-editor .ProseMirror')).toHaveText('Texte');
		expect(documents('article', id)).toEqual([]);
	});

	test('réglage désactivé : dépôt annulé quand même, message, rien envoyé', async ({ page }) => {
		configurer('tiptap_spip/coller_images', 'non');
		try {
			const id = await editer(page, 'Texte');
			const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
			expect(etats.drop).toBe(true);
			await expect(page.locator('.tts-etat__message')).toHaveText('L’ajout de fichiers n’est pas disponible ici.');
			expect(documents('article', id)).toEqual([]);
		} finally {
			configurer('tiptap_spip/coller_images', 'oui');
		}
	});
});

const crayons = existsSync(`${process.env.TTS_SITE}/plugins/crayons`);

test.describe('coexistence avec crayons/upload', () => {
	test.skip(!crayons, 'plugin crayons absent du site');
	let upload;
	test.beforeAll(() => {
		if (!crayons) return;
		activer('crayons');
		configurer('tiptap_spip/crayons', 'oui');
		upload = lireConfig('crayons/upload');
		configurer('crayons/upload', 'on');
	});
	test.afterAll(() => {
		if (crayons) configurer('crayons/upload', upload);
	});

	/** Article public, crayon de son texte ouvert, services à la demande arrivés ; requêtes deposer_document comptées. */
	const ouvrirCrayon = async (page) => {
		const id = await editer(page, 'Texte du crayon.');
		publier(id);
		const requetes = { tiptap: 0, crayons: 0 };
		page.on('request', (r) => {
			if (r.method() !== 'POST') return;
			if (r.postDataBuffer()?.includes('deposer_document')) requetes.tiptap++;
			if (/crayons_upload/.test(r.url())) requetes.crayons++;
		});
		await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
		await module(page);
		await page.locator(`.crayon.article-texte-${id}`).dblclick();
		await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		return { id, requetes };
	};

	test('mode visuel : Tiptap seul envoie, un document lié à l\'article, un <docN>', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		await deposer(page, '.crayon-html .tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(page.locator('.crayon-html .tts-editor .tts-model')).toHaveCount(1, { timeout: 10_000 });
		await envoisTermines(page);
		expect(requetes).toEqual({ tiptap: 1, crayons: 0 });
		expect(documents('article', id)).toHaveLength(1);
		await page.locator('.crayon-html .crayon-submit').click();
		await expect(page.locator('.crayon-html')).toHaveCount(0, { timeout: 10_000 });
		expect(texte(id)).toMatch(/^Texte du crayon\.<doc\d+>$/);
	});

	test('mode source : Crayons seul envoie, rien n\'est inséré dans le texte', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		await page.evaluate(() => [...window.__tts.instances].find((i) => i.textarea.closest('.crayon-html')).toggleMode());
		const textarea = page.locator('.crayon-html .tts-editor textarea');
		await expect(textarea).toHaveClass(/uploader/);
		await deposer(page, '.crayon-html .tts-editor textarea', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		// le raccourci s'affiche dans le panneau de Crayons
		await expect(page.locator('[id^=uploader_liste] li.ok, #uploader_liste li.ok')).toHaveCount(1, { timeout: 10_000 });
		expect(requetes).toEqual({ tiptap: 0, crayons: 1 });
		await expect(textarea).toHaveValue('Texte du crayon.');
		expect(documents('article', id)).toHaveLength(1);
	});

	test('panneau de Crayons : sa propre zone de dépôt, inchangée', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		// panneau latéral de crayons/upload (uploader.js.html : #uploader<id_article>)
		await deposer(page, `#uploader${id}`, [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(page.locator('#uploader_liste li.ok')).toHaveCount(1, { timeout: 10_000 });
		expect(requetes).toEqual({ tiptap: 0, crayons: 1 });
		await expect(page.locator('.crayon-html .tts-editor .tts-model')).toHaveCount(0);
		expect(documents('article', id)).toHaveLength(1);
	});

	test('Tiptap désactivé dans les crayons : comportement de Crayons conservé', async ({ page }) => {
		configurer('tiptap_spip/crayons', 'non');
		try {
			const id = await editer(page, 'Texte du crayon.');
			publier(id);
			await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
			await page.locator(`.crayon.article-texte-${id}`).dblclick();
			const textarea = page.locator('.crayon-html textarea.crayon-active');
			await expect(textarea).toHaveClass(/uploader/);
			await expect(page.locator('.crayon-html .tts-editor')).toHaveCount(0);
			await deposer(page, '.crayon-html textarea.crayon-active', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
			await expect(page.locator('#uploader_liste li.ok')).toHaveCount(1, { timeout: 10_000 });
			expect(documents('article', id)).toHaveLength(1);
		} finally {
			configurer('tiptap_spip/crayons', 'oui');
		}
	});
});
```

Points à vérifier au premier passage, en lisant `crayons/js/uploader.js.html` et `crayons/modeles/uploader_liste.html` sur le site :
- l'identifiant de la liste du panneau (`#uploader_liste` dans `uploader.js.html`) et la classe `ok` posée à
  la fin de l'envoi (`onServerLoad`) ;
- l'URL de l'action (`crayons_upload` dans `generer_url_action`). Si le motif de `requetes.crayons` ne trouve
  rien, l'adapter à l'URL observée ;
- `deposer()` lance `dragenter` et `dragover`, puis `drop`. Le gestionnaire `html5Uploader` de Crayons lit
  `e.originalEvent.dataTransfer.files` : la propriété posée par `defineProperty` sur l'événement natif lui
  parvient.

- [ ] **Step 2 : lancer sur 4.4 (Chromium), corriger, puis 3 navigateurs × 3 sites**

```bash
cd prive/javascript/tiptap_spip
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test depot --project=chromium
```

Puis en arrière-plan, sur les trois sites et sous les trois navigateurs : `depot` et `images` (le collage ne doit
pas avoir régressé).

Expected :
- 4.4 et 4.2 : tout passe ;
- 5 : coexistence sautée (pas de Crayons) ;
- puis suite e2e complète en Chromium sur 4.4, sans régression.

- [ ] **Step 3 : commit**

```bash
git add tests/e2e/depot.e2e.js
git commit -m "test: e2e du glisser-déposer (visuel, source, refus, crayons/upload)"
```

---

### Task 6 : documentation, demande de fusion

**Files:**
- Modify: `docs/specs/10-coller-images.md`, `docs/specs/02-architecture.md`, `docs/specs/07-extensibilite.md`, `docs/specs/09-lots-roadmap.md`, `CHANGELOG.md`

- [ ] **Step 1 : spec 10**
  - **§2 et §3 :** `deposer_image` devient `deposer_document`, l'annonce `data-tts-depot`, les événements
    `tiptap-spip:document-*`.
  - **§5 :** la ligne du tableau passe à `deposer_document`, avec ses contrôles. Le type réel n'est vérifié que pour
    les images de la liste blanche ; pour les autres documents, ce sont l'extension et les contrôles de medias.
    Indiquer aussi `_DOC_MAX_SIZE`.
  - **§6 :** la case « Coller des images et déposer des documents » ; l'annonce
    `{images, extensions, taille_image, documents, documents_limite_image, taille_document}` (tailles réparties comme dans medias).
  - **§8 :** le glisser-déposer passe de « Hors périmètre » à une section « Glisser-déposer (lot L7.2) »
    (décisions 4 à 8 de ce plan, état de survol, exception limitée au textarea `.uploader`).
  - **§7 :** la ligne Playwright (L7.2) est marquée réalisée.
  - **§9 « Réalisation » :** ajouter un paragraphe L7.2 (fichiers, écarts, résultats e2e).
- [ ] **Step 2 : spec 02** : la ligne `deposer_image` du tableau des opérations devient `deposer_document`, et
  `data-tts-images` devient `data-tts-depot`.
- [ ] **Step 3 : spec 07** : le tableau des événements devient `tiptap-spip:document-recu`, `document-insere` et
  `document-erreur` (même `detail`), avec la mention « collés ou déposés ».
- [ ] **Step 4 : spec 09** : L7.2, glisser-déposer marqué fait ; l'aperçu `<math>` et la collaboration restent en
  « L7 — Ultérieur ».
- [ ] **Step 5 : CHANGELOG**, dans « Non publié / Ajouté », compléter l'entrée du collage :

```markdown
- Coller une ou plusieurs images (capture d'écran, image copiée), ou glisser-déposer des fichiers de tout
  type accepté par SPIP, dans l'éditeur, visuel ou source : chaque fichier devient un document de l'objet,
  inséré en `<docN>` à l'endroit du collage ou du dépôt. Réglage « Coller des images et déposer des
  documents » dans la configuration de l'éditeur (actif par défaut).
```

- [ ] **Step 6 : vérifier, committer, pousser, demande de fusion**

```bash
cd /src/tiptap-spip && vendor/bin/phpunit && (cd prive/javascript/tiptap_spip && npx vitest run)
git add docs CHANGELOG.md
git commit -m "docs: glisser-déposer réalisé (spec 10, 02, 07, 09)"
git push -u origin feat/deposer-documents
glab mr create --source-branch feat/deposer-documents --target-branch main --title "Glisser-déposer des documents dans l'éditeur (L7.2)" --description "Réf. #4
…"
```

La description résume l'opération `deposer_document`, l'arbitrage, la position, l'état de survol, l'exception
Crayons et les résultats des tests. Sans mention « Generated with Claude Code ».

---

## Couverture de la spec (auto-revue)

| Spec 10 §8 / §7 (L7.2) | Tâche |
|------------------------|-------|
| même chaîne d'envoi que le collage, étendue à tous les types, opération adaptée | 1, 2 |
| plusieurs fichiers envoyés un par un dans l'ordre, chacun avec son marqueur | 2 (`lancer`), 4, 5 |
| état visible pendant le survol, retiré à la sortie et après le dépôt | 4, 5 |
| `preventDefault()` sur `dragover` et `drop` même refusé ; refus dans la barre d'état | 4, 5 |
| exception : mode source d'un crayon avec `crayons/upload` (textarea `.uploader`) | 4, 5 |
| visuel dans un crayon : document lié à l'article, un `<docN>`, pas de double envoi | 5 |
| mode source d'un crayon : dépôt sur le textarea laissé à Crayons ; ailleurs dans la zone, traité par l'éditeur | 4 (Vitest), 5 (e2e, textarea) |
| panneau de Crayons : comportement de Crayons | 5 (dépôt sur `#uploader<id>`) |
| Tiptap désactivé : comportement de Crayons | 5 |
| dépôt refusé (type non accepté, services absents) : page affichée, texte intact | 4 (Vitest), 5 (e2e : type, services absents, réglage désactivé) |
| tailles alignées sur medias (`_IMG_MAX_SIZE` pour les extensions qu'il borne ainsi, SVG et SWF compris, sans les rendre collables) | 1, 3 |
| réglage | 1 (même case, libellé élargi) |
