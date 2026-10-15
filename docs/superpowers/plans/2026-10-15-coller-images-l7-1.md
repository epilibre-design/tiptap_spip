# Coller des images (lot L7.1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** coller une ou plusieurs images dans l'éditeur (visuel ou source) crée autant de documents SPIP
liés à l'objet édité et insère un `<docN>` par image, dans l'ordre (spec `docs/specs/10-coller-images.md`,
demande #4).

**Architecture :**
- **Serveur** : nouvelle opération `deposer_image` du CVT de services (`formulaires/tiptap_spip.php`). Sa
  logique est dans `inc/tiptap_spip_images.php` : disponibilité, contrôle du fichier et ajout par
  `action_ajouter_documents_dist(…, 'document')`. `charger()` annonce la disponibilité, la liste blanche et la taille
  maximale dans `data-tts-images` sur le `<form>` de services. Le formulaire étant remplacé après chaque
  réponse, cette annonce reste à jour.
- **Client** :
  - `src/services/cvt.js` lit cette annonce (`images()`). Il envoie un fichier par `XMLHttpRequest`, pour la
    progression et l'abandon, dans la même file sérialisée que les autres appels.
  - `src/editor/collerImage.js` arbitre le presse-papiers, renomme les captures et orchestre les envois
    (`CollerImages`), dans les deux modes.
  - `src/editor/marqueurEnvoi.js` : extension `spipPasteImage`. Son plugin ProseMirror `spipUploadPlaceholder`
    porte le `handlePaste` et les marqueurs (décorations dont la position est suivie à chaque transaction).
  - `src/editor/soumission.js` retient la soumission du formulaire d'édition tant qu'un envoi est en cours.
  - La barre d'état gagne une zone de message, visible aussi en mode source.

**Tech Stack :** inchangée (Tiptap 3.31.4, `@tiptap/pm`, Vitest 3 + jsdom, Playwright 1.61, PHPUnit). Aucune
dépendance ajoutée : InlineAttachment n'est pas embarqué (spec 10 §2).

## Global Constraints

- Commentaires et libellés en français, tabulations ; commits sans trailer ; une branche
  `feat/coller-images` poussée sur origin et une demande de fusion vers main (« Réf. #4 », le ticket reste
  ouvert jusqu'à la fusion).
- Raccourci inséré : toujours `<docN>`, jamais `<imgN>`, sans réglage (Q11).
- Mode d'ajout du document : `document` (comme `action_crayons_upload`), jamais `auto`.
- Liste blanche par défaut : `image/png`, `image/jpeg`, `image/gif`, `image/webp`, recoupée avec
  `spip_types_documents` (`upload='oui'`).
- Taille maximale : minimum de `upload_max_filesize`, `post_max_size` et `_IMG_MAX_SIZE` (Ko) s'il est
  défini.
- Configuration `tiptap_spip/coller_images`, défaut `oui`.
- Événements sur le textarea : `tiptap-spip:image-recue`, `tiptap-spip:image-inseree`,
  `tiptap-spip:image-erreur`.
- Règle i18n du projet : chaque libellé JS est dans `labels.js` (DEFAUTS), dans `lang/tiptap_spip_fr.php` (et
  `_en`) et dans `prive/javascript/tiptap_spip_config.js.html` (vérifié par `tests/ui/i18n.test.js`).
- Le bundle `prive/javascript/tiptap_spip.js` / `.min.js` est versionné : `npm run build` avant chaque
  commit qui touche `src/`.
- Sites jetables : ne jamais les réinitialiser. Pas de `git switch`, de fusion ni de commit d'un fichier
  servi pendant un e2e. Après un changement de branche, vider `tmp/cache/skel/*` et `tmp/cache/calcul/*`
  des trois sites.
- Commandes JS depuis `prive/javascript/tiptap_spip/`, commandes PHP depuis la racine du dépôt.

## Décisions prises en écrivant ce plan (à reporter dans la spec 10, tâche 11)

1. **Tests PHP** :
   - les cas de spec 10 §7 qui dépendent du vrai SPIP (autorisation de medias, `documents_objets`, objet
     nouveau d'un autre auteur) sont vérifiés en e2e, par la page de services à la demande et par des
     appels réels ;
   - PHPUnit (sans SPIP, fonctions du core simulées) couvre les fonctions pures et le câblage.
2. **Bascule de mode pendant un envoi** : refusée, avec le message « Une image est en cours d'envoi ». Un
   marqueur appartient au mode où il a été posé. Ni la décoration du visuel ni le texte provisoire de la
   source ne survivraient à la bascule.
3. **Marqueur supprimé à la main en mode source** : l'image n'est pas insérée. Le document reste lié, comme
   après un ajout par la boîte « Documents ».
4. **Collage dans un bloc de code** (visuel) : collage habituel, aucun envoi.
5. **Erreurs du serveur** : `verifier()` et `traiter()` rendent leur message dans `message_erreur`. Sinon SPIP
   le remplace par son message générique « Votre saisie contient des erreurs ».
6. **Fixtures CVT enregistrées** : succès et type refusé. Les refus de taille et d'autorisation ne se
   provoquent pas depuis un formulaire signé ; ils sont couverts par PHPUnit et par l'e2e.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `inc/tiptap_spip_config.php` | clé `coller_images` |
| `formulaires/configurer_tiptap_spip.{php,html}` | case « Coller des images » |
| `inc/tiptap_spip_images.php` (nouveau) | disponibilité, taille max, contrôle, ajout |
| `formulaires/tiptap_spip.{php,html}` | `_images` dans `charger()`, opération `deposer_image`, `data-tts-images` |
| `lang/tiptap_spip_{fr,en}.php` | messages serveur et libellés JS |
| `tests/bootstrap.php`, `tests/unit/ImagesTest.php` (nouveau), `tests/unit/ConfigTest.php` | PHPUnit |
| `tests/e2e/site.php` | commande `documents <objet> <id>` |
| `src/services/cvt.js` | `images()`, envoi d'un fichier par XHR, abandon |
| `src/editor/collerImage.js` (nouveau) | `nommer`, `trierPressePapiers`, `CollerImages` |
| `src/editor/marqueurEnvoi.js` (nouveau) | extension `spipPasteImage`, plugin `spipUploadPlaceholder` |
| `src/editor/soumission.js` (nouveau) | `SoumissionRetenue` |
| `src/editor/extensions.js` | ajoute `SpipPasteImage.configure({ ui })` |
| `src/ui/StatusBar.js`, `css/tiptap_spip.css` | zone de message ; style du marqueur |
| `src/ui/labels.js`, `prive/javascript/tiptap_spip_config.js.html` | libellés |
| `src/main.js` | câblage dans `Instance` |
| `tests/services/cvt.test.js`, `tests/fixtures/cvt/deposer_image*.html`, `tests/e2e/fixtures-cvt.e2e.js` | client CVT |
| `tests/editor/collerImage.test.js`, `tests/editor/marqueurEnvoi.test.js`, `tests/editor/soumission.test.js`, `tests/ui/etat.test.js` (nouveaux) | Vitest |
| `tests/e2e/images.e2e.js` (nouveau) | Playwright |
| `docs/specs/10-coller-images.md`, `docs/specs/02-architecture.md`, `docs/specs/07-extensibilite.md`, `CHANGELOG.md` | documentation |

---

### Task 0 : branche

- [ ] **Step 1 : créer la branche**

```bash
cd /src/tiptap-spip && git switch -c feat/coller-images main
```

Vérifier qu'aucun e2e ne tourne (`pgrep -fa playwright` vide), puis vider les caches des sites :

```bash
for s in v4.2.16 v4.4.21 v5.0-dev; do rm -rf /src/jetables/$s/tmp/cache/skel/* /src/jetables/$s/tmp/cache/calcul/*; done
```

---

### Task 1 : configuration `coller_images`

**Files:**
- Modify: `inc/tiptap_spip_config.php` (`tiptap_spip_config()`)
- Modify: `formulaires/configurer_tiptap_spip.php`, `formulaires/configurer_tiptap_spip.html`
- Modify: `lang/tiptap_spip_fr.php`, `lang/tiptap_spip_en.php`
- Test: `tests/unit/ConfigTest.php`, `tests/unit/ConfigurerTest.php`

**Interfaces:**
- Produces: `tiptap_spip_config()['coller_images']` : `'oui'|'non'`, `'oui'` par défaut.

- [ ] **Step 1 : tests qui échouent**

Dans `tests/unit/ConfigTest.php`, `testDefautsSansConfiguration` attend désormais la clé :

```php
	public function testDefautsSansConfiguration(): void {
		$this->assertSame(
			['public' => 'non', 'crayons' => 'non', 'coller_images' => 'oui', 'mode' => 'visual', 'niveaux' => [2, 3, 4], 'champs' => null, 'glossaires' => null],
			tiptap_spip_config()
		);
	}

	public function testCollerImagesDesactivableSeulementParNon(): void {
		$GLOBALS['_test_config']['tiptap_spip'] = ['coller_images' => 'non'];
		$this->assertSame('non', tiptap_spip_config()['coller_images']);
		$GLOBALS['_test_config']['tiptap_spip'] = ['coller_images' => 'autre'];
		$this->assertSame('oui', tiptap_spip_config()['coller_images']);
	}
```

Lire `tests/unit/ConfigurerTest.php` et ajouter, sur le modèle des tests de `crayons`, un test qui poste
`coller_images` absent (case décochée) et vérifie `'coller_images' => 'non'` dans la méta écrite, puis
`'oui'` quand la case est cochée.

- [ ] **Step 2 : vérifier l'échec**

Run: `vendor/bin/phpunit --filter 'ConfigTest|ConfigurerTest'`
Expected: FAIL (clé `coller_images` absente).

- [ ] **Step 3 : implémentation**

`inc/tiptap_spip_config.php`, dans le tableau rendu par `tiptap_spip_config()` (et son `@return`) :

```php
		'crayons' => ($meta['crayons'] ?? '') === 'oui' ? 'oui' : 'non',
		// collage d'images (spec 10 §6) : actif sauf s'il a été décoché
		'coller_images' => ($meta['coller_images'] ?? '') === 'non' ? 'non' : 'oui',
```

`formulaires/configurer_tiptap_spip.php` : `charger()` ajoute `'coller_images' => $config['coller_images'],` ;
`traiter()` écrit `'coller_images' => _request('coller_images') === 'oui' ? 'oui' : 'non',`.

`formulaires/configurer_tiptap_spip.html` : nouveau fieldset après « Activation » :

```html
		<fieldset>
			<legend><:tiptap_spip:cfg_documents:></legend>
			<div class="editer-groupe">
				<div class="editer editer_coller_images">
					<div class="choix">
						<input type="checkbox" class="checkbox" name="coller_images" id="tts_cfg_coller_images" value="oui"[ (#ENV{coller_images}|=={oui}|oui)checked="checked"] />
						<label for="tts_cfg_coller_images"><:tiptap_spip:cfg_coller_images:></label>
					</div>
				</div>
			</div>
		</fieldset>
```

`lang/tiptap_spip_fr.php` (ordre alphabétique des clés) :

```php
	'cfg_coller_images' => 'Coller des images : chaque image collée est ajoutée aux documents de l’objet et insérée en &lt;docN&gt;',
	'cfg_documents' => 'Documents',
```

`lang/tiptap_spip_en.php` :

```php
	'cfg_coller_images' => 'Paste images: each pasted image is added to the object’s documents and inserted as &lt;docN&gt;',
	'cfg_documents' => 'Documents',
```

- [ ] **Step 4 : vérifier**

Run: `vendor/bin/phpunit`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add inc/tiptap_spip_config.php formulaires/configurer_tiptap_spip.* lang/tiptap_spip_*.php tests/unit/Config*.php
git commit -m "feat: réglage du collage d'images (tiptap_spip/coller_images)"
```

---

### Task 2 : logique serveur des images (`inc/tiptap_spip_images.php`)

**Files:**
- Create: `inc/tiptap_spip_images.php`
- Modify: `tests/bootstrap.php` (simulations `autoriser`, `sql_allfetsel`, `test_plugin_actif`, `charger_fonction`)
- Modify: `lang/tiptap_spip_fr.php`, `lang/tiptap_spip_en.php`
- Test: `tests/unit/ImagesTest.php`

**Interfaces:**
- Produces:
  - `tiptap_spip_octets(string $valeur): int`
  - `tiptap_spip_images_taille_max(string $upload, string $post, ?int $img_max_ko): int` (0 : sans limite)
  - `tiptap_spip_images_types(): array<string, string>` (extension → type MIME)
  - `tiptap_spip_images_id_lien(int $id_objet): int`
  - `tiptap_spip_images(string $objet, int $id_objet): ?array{types: string[], taille: int}`
  - `tiptap_spip_controler_image(array $files, array $types, callable $est_envoye = 'is_uploaded_file'): ?string`
  - `tiptap_spip_deposer_image(array $fichier, string $objet, int $id_objet): array{id_document: int, raccourci: string}|string`

- [ ] **Step 1 : simulations du core dans `tests/bootstrap.php`**

Lire d'abord `tests/bootstrap.php` en entier. Dans `test_reset_globals()`, ajouter :

```php
	$GLOBALS['_test_autoriser'] = static fn () => true;
	$GLOBALS['_test_sql'] = [];
	$GLOBALS['_test_plugins'] = ['medias'];
	$GLOBALS['_test_fonctions'] = [];
	$GLOBALS['visiteur_session'] = ['id_auteur' => 1];
```

À la suite des autres simulations :

```php
if (!function_exists('autoriser')) {
	/** Simulation : décision de $GLOBALS['_test_autoriser'], qui reçoit les arguments. */
	function autoriser(string $faire, $type = '', $id = null, $qui = null, $opt = null): bool {
		return (bool) ($GLOBALS['_test_autoriser'])($faire, $type, $id);
	}
}

if (!function_exists('sql_allfetsel')) {
	/** Simulation : lignes de $GLOBALS['_test_sql'][table], sans interpréter la requête. */
	function sql_allfetsel($select = [], $from = [], $where = [], $groupby = [], $orderby = [], $limit = ''): array {
		return $GLOBALS['_test_sql'][$from] ?? [];
	}
}

if (!function_exists('test_plugin_actif')) {
	function test_plugin_actif(string $plugin): bool {
		return in_array($plugin, $GLOBALS['_test_plugins'], true);
	}
}

if (!function_exists('charger_fonction')) {
	/** Simulation : fonction de $GLOBALS['_test_fonctions']["dossier/nom"]. */
	function charger_fonction(string $nom, string $dossier = 'exec', bool $continue = false) {
		return $GLOBALS['_test_fonctions']["$dossier/$nom"] ?? ($continue ? false : throw new RuntimeException("$dossier/$nom non simulée"));
	}
}
```

Vérifier avant d'ajouter : si `include_spip()` simulé ne charge pas les fichiers `inc/…` du plugin, faire un
`require_once` de `inc/tiptap_spip_images.php` en tête de `ImagesTest.php`. Les autres tests procèdent ainsi
avec `tiptap_spip_pipelines.php`.

- [ ] **Step 2 : tests qui échouent**

Créer `tests/unit/ImagesTest.php` :

```php
<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/inc/tiptap_spip_images.php';

final class ImagesTest extends TestCase
{
	/** PNG 1×1 (le même que tests/e2e/site.php). */
	private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

	private const TYPES = ['gif' => 'image/gif', 'jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];

	private array $temporaires = [];

	protected function setUp(): void {
		test_reset_globals();
		$GLOBALS['_test_sql']['spip_types_documents'] = [
			['extension' => 'gif', 'mime_type' => 'image/gif'],
			['extension' => 'jpg', 'mime_type' => 'image/jpeg'],
			['extension' => 'png', 'mime_type' => 'image/png'],
			['extension' => 'webp', 'mime_type' => 'image/webp'],
			['extension' => 'pdf', 'mime_type' => 'application/pdf'],
		];
	}

	protected function tearDown(): void {
		array_map('unlink', $this->temporaires);
	}

	/** Entrée $_FILES d'un fichier temporaire au contenu donné. */
	private function fichier(string $nom, string $contenu, int $erreur = UPLOAD_ERR_OK): array {
		$tmp = tempnam(sys_get_temp_dir(), 'tts');
		file_put_contents($tmp, $contenu);
		$this->temporaires[] = $tmp;
		return ['name' => $nom, 'type' => 'image/png', 'tmp_name' => $tmp, 'error' => $erreur, 'size' => strlen($contenu)];
	}

	private static function envoye(): callable {
		return static fn () => true;
	}

	public function testOctets(): void {
		$this->assertSame(2 * 1024 ** 2, tiptap_spip_octets('2M'));
		$this->assertSame(512 * 1024, tiptap_spip_octets('512k'));
		$this->assertSame(1024 ** 3, tiptap_spip_octets(' 1G '));
		$this->assertSame(1000, tiptap_spip_octets('1000'));
		$this->assertSame(0, tiptap_spip_octets(''));
	}

	public function testTailleMaxPlusPetiteLimiteNonNulle(): void {
		$this->assertSame(2 * 1024 ** 2, tiptap_spip_images_taille_max('2M', '8M', null));
		$this->assertSame(500 * 1024, tiptap_spip_images_taille_max('2M', '8M', 500));
		$this->assertSame(8 * 1024 ** 2, tiptap_spip_images_taille_max('0', '8M', null));
		$this->assertSame(0, tiptap_spip_images_taille_max('0', '0', null));
	}

	public function testTypesRecoupesAvecLaListeBlanche(): void {
		$this->assertSame(self::TYPES, tiptap_spip_images_types());
		$GLOBALS['_test_sql']['spip_types_documents'] = [['extension' => 'png', 'mime_type' => 'image/png']];
		$this->assertSame(['png' => 'image/png'], tiptap_spip_images_types());
	}

	public function testDisponibleAvecMediasConfigurationEtDroit(): void {
		$demandes = [];
		$GLOBALS['_test_autoriser'] = static function ($faire, $type, $id) use (&$demandes) {
			$demandes[] = [$faire, $type, $id];
			return true;
		};
		$images = tiptap_spip_images('article', 12);
		$this->assertSame(['image/gif', 'image/jpeg', 'image/png', 'image/webp'], $images['types']);
		$this->assertIsInt($images['taille']);
		$this->assertSame([['joindredocument', 'article', 12]], $demandes);
	}

	public function testObjetNouveauLieAuRedacteur(): void {
		$GLOBALS['visiteur_session'] = ['id_auteur' => 7];
		$demandes = [];
		$GLOBALS['_test_autoriser'] = static function ($faire, $type, $id) use (&$demandes) {
			$demandes[] = $id;
			return true;
		};
		tiptap_spip_images('article', 0);
		$this->assertSame([-7], $demandes);
	}

	public function testIndisponible(): void {
		$this->assertNull(tiptap_spip_images('', 0), 'sans objet');
		$GLOBALS['_test_autoriser'] = static fn () => false;
		$this->assertNull(tiptap_spip_images('article', 12), 'sans droit');
		test_reset_globals();
		$GLOBALS['_test_plugins'] = [];
		$this->assertNull(tiptap_spip_images('article', 12), 'sans medias');
		test_reset_globals();
		$GLOBALS['_test_config']['tiptap_spip'] = ['coller_images' => 'non'];
		$this->assertNull(tiptap_spip_images('article', 12), 'désactivé');
		test_reset_globals();
		$this->assertNull(tiptap_spip_images('article', 12), 'aucun type d\'image accepté par le site');
	}

	public function testControleAccepteUnPng(): void {
		$files = ['fichier' => $this->fichier('capture-20261015-101500.png', base64_decode(self::PNG))];
		$this->assertNull(tiptap_spip_controler_image($files, self::TYPES, self::envoye()));
	}

	public function testControleRefus(): void {
		$png = base64_decode(self::PNG);
		$type = _T('tiptap_spip:erreur_image_type');
		$fichier = _T('tiptap_spip:erreur_image_fichier');
		$this->assertSame($fichier, tiptap_spip_controler_image([], self::TYPES, self::envoye()), 'sans fichier');
		$deux = ['fichier' => $this->fichier('a.png', $png), 'autre' => $this->fichier('b.png', $png)];
		$this->assertSame($fichier, tiptap_spip_controler_image($deux, self::TYPES, self::envoye()), 'deux fichiers');
		$tableau = ['fichier' => ['name' => ['a.png'], 'tmp_name' => ['/tmp/x'], 'error' => [0]]];
		$this->assertSame($fichier, tiptap_spip_controler_image($tableau, self::TYPES, self::envoye()), 'fichier[]');
		$this->assertSame($type, tiptap_spip_controler_image(['fichier' => $this->fichier('x.php', $png)], self::TYPES, self::envoye()), 'PNG renommé .php');
		$this->assertSame($type, tiptap_spip_controler_image(['fichier' => $this->fichier('x.png', '<?php echo 1;')], self::TYPES, self::envoye()), 'PHP renommé .png');
		$this->assertSame($type, tiptap_spip_controler_image(['fichier' => $this->fichier('x.png', $png)], ['jpg' => 'image/jpeg'], self::envoye()), 'type absent de spip_types_documents');
		$this->assertSame(_T('tiptap_spip:erreur_image_taille'), tiptap_spip_controler_image(['fichier' => $this->fichier('x.png', '', UPLOAD_ERR_INI_SIZE)], self::TYPES, self::envoye()));
		$this->assertSame($fichier, tiptap_spip_controler_image(['fichier' => $this->fichier('x.png', $png, UPLOAD_ERR_PARTIAL)], self::TYPES, self::envoye()));
		$this->assertSame($fichier, tiptap_spip_controler_image(['fichier' => $this->fichier('x.png', $png)], self::TYPES, static fn () => false), 'pas un envoi PHP');
	}

	public function testDeposerEnModeDocument(): void {
		$appels = [];
		$GLOBALS['visiteur_session'] = ['id_auteur' => 3];
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static function (...$args) use (&$appels) {
			$appels[] = $args;
			return [42];
		};
		$fichier = $this->fichier('capture.png', base64_decode(self::PNG));
		$this->assertSame(['id_document' => 42, 'raccourci' => 'doc42'], tiptap_spip_deposer_image($fichier, 'article', 0));
		$this->assertSame(['new', [['tmp_name' => $fichier['tmp_name'], 'name' => 'capture.png']], 'article', -3, 'document'], $appels[0]);
	}

	public function testDeposerRendLeMessageDeMedias(): void {
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static fn () => ['Image trop grande (5000 px)'];
		$this->assertSame('Image trop grande (5000 px)', tiptap_spip_deposer_image($this->fichier('a.png', 'x'), 'article', 12));
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static fn () => [false];
		$this->assertSame(_T('tiptap_spip:erreur_image_ajout'), tiptap_spip_deposer_image($this->fichier('a.png', 'x'), 'article', 12));
	}
}
```

- [ ] **Step 3 : vérifier l'échec**

Run: `vendor/bin/phpunit --filter ImagesTest`
Expected: FAIL (fichier `inc/tiptap_spip_images.php` absent).

- [ ] **Step 4 : implémentation**

Créer `inc/tiptap_spip_images.php` :

```php
<?php

/**
 * Images collées dans l'éditeur (spec 10 §5) : disponibilité de l'opération deposer_image, contrôle du
 * fichier envoyé et ajout comme document SPIP lié à l'objet édité.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('inc/tiptap_spip_config');

/** Types d'images acceptés par défaut (spec 10 §3), recoupés avec spip_types_documents. */
const TIPTAP_SPIP_IMAGES_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Taille d'une directive de php.ini (« 8M », « 512K », « 1G ») en octets ; 0 : sans limite. */
function tiptap_spip_octets(string $valeur): int {
	if (!preg_match('/^\s*(\d+)\s*([kmg]?)/i', $valeur, $m)) {
		return 0;
	}
	$n = (int) $m[1];
	return match (strtolower($m[2])) {
		'g' => $n * 1024 ** 3,
		'm' => $n * 1024 ** 2,
		'k' => $n * 1024,
		default => $n,
	};
}

/**
 * Plus grande image acceptée : la plus petite des limites définies (upload_max_filesize,
 * post_max_size, _IMG_MAX_SIZE en Ko) ; 0 : sans limite connue.
 */
function tiptap_spip_images_taille_max(string $upload, string $post, ?int $img_max_ko): int {
	$limites = array_filter([tiptap_spip_octets($upload), tiptap_spip_octets($post), $img_max_ko ? $img_max_ko * 1024 : 0]);
	return $limites ? min($limites) : 0;
}

/**
 * Types d'images que le site accepte en envoi : extension → type MIME, parmi la liste blanche.
 *
 * @return array<string, string>
 */
function tiptap_spip_images_types(): array {
	include_spip('base/abstract_sql');
	$types = [];
	foreach (sql_allfetsel('extension, mime_type', 'spip_types_documents', "upload='oui'") as $ligne) {
		if (in_array($ligne['mime_type'], TIPTAP_SPIP_IMAGES_TYPES, true)) {
			$types[(string) $ligne['extension']] = (string) $ligne['mime_type'];
		}
	}
	return $types;
}

/**
 * Identifiant auquel lier le document : celui de l'objet, ou -id_auteur pour un objet nouveau, comme
 * la boîte « Documents » (medias_post_insertion le rattache à la création de l'objet).
 */
function tiptap_spip_images_id_lien(int $id_objet): int {
	return $id_objet > 0 ? $id_objet : -intval($GLOBALS['visiteur_session']['id_auteur'] ?? 0);
}

/**
 * Collage d'images pour l'éditeur d'un objet (spec 10 §5, « Disponibilité ») : types acceptés et
 * taille maximale, ou null si l'opération deposer_image est indisponible (sans objet, plugin medias
 * inactif, réglage désactivé, pas le droit de joindre un document, aucun type d'image accepté).
 *
 * @return ?array{types: string[], taille: int}
 */
function tiptap_spip_images(string $objet, int $id_objet): ?array {
	if ($objet === '' || tiptap_spip_config()['coller_images'] !== 'oui' || !test_plugin_actif('medias')) {
		return null;
	}
	include_spip('inc/autoriser');
	if (!autoriser('joindredocument', $objet, tiptap_spip_images_id_lien($id_objet))) {
		return null;
	}
	$types = array_values(array_unique(tiptap_spip_images_types()));
	if (!$types) {
		return null;
	}
	return [
		'types' => $types,
		'taille' => tiptap_spip_images_taille_max(
			(string) ini_get('upload_max_filesize'),
			(string) ini_get('post_max_size'),
			defined('_IMG_MAX_SIZE') ? (int) _IMG_MAX_SIZE : null
		),
	];
}

/**
 * Contrôle du fichier de deposer_image : un seul fichier, champ « fichier », envoi PHP complet,
 * extension et type réel (finfo) concordants et acceptés par le site.
 *
 * @param array $files  $_FILES
 * @param array<string, string> $types  extension → type MIME acceptés (tiptap_spip_images_types)
 * @param callable(string): bool $est_envoye  is_uploaded_file, remplaçable dans les tests
 * @return ?string  message d'erreur, null si le fichier est accepté
 */
function tiptap_spip_controler_image(array $files, array $types, callable $est_envoye = 'is_uploaded_file'): ?string {
	$fichier = $files['fichier'] ?? null;
	if (count($files) !== 1 || !is_array($fichier) || !is_string($fichier['tmp_name'] ?? null) || !is_string($fichier['name'] ?? null)) {
		return _T('tiptap_spip:erreur_image_fichier');
	}
	$erreur = (int) ($fichier['error'] ?? UPLOAD_ERR_NO_FILE);
	if ($erreur === UPLOAD_ERR_INI_SIZE || $erreur === UPLOAD_ERR_FORM_SIZE) {
		return _T('tiptap_spip:erreur_image_taille');
	}
	if ($erreur !== UPLOAD_ERR_OK || !$est_envoye($fichier['tmp_name'])) {
		return _T('tiptap_spip:erreur_image_fichier');
	}
	$extension = strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION));
	$reel = (new finfo(FILEINFO_MIME_TYPE))->file($fichier['tmp_name']);
	if (!isset($types[$extension]) || $types[$extension] !== $reel) {
		return _T('tiptap_spip:erreur_image_type');
	}
	return null;
}

/**
 * Ajoute l'image aux documents de l'objet, en mode document comme Crayons (action_crayons_upload) : le
 * raccourci inséré est <docN> (spec 10 §4). medias refait ses contrôles de taille et de dimensions.
 *
 * @param array $fichier  $_FILES['fichier'], contrôlé par tiptap_spip_controler_image()
 * @return array{id_document: int, raccourci: string}|string  message d'erreur de medias
 */
function tiptap_spip_deposer_image(array $fichier, string $objet, int $id_objet) {
	$ajouter = charger_fonction('ajouter_documents', 'action');
	$ajoutes = $ajouter('new', [['tmp_name' => $fichier['tmp_name'], 'name' => $fichier['name']]], $objet, tiptap_spip_images_id_lien($id_objet), 'document');
	$id = reset($ajoutes);
	if (is_numeric($id) && intval($id) > 0) {
		return ['id_document' => intval($id), 'raccourci' => 'doc' . intval($id)];
	}
	return is_string($id) && $id !== '' ? $id : _T('tiptap_spip:erreur_image_ajout');
}
```

Chaînes de langue (`fr`, ordre alphabétique) :

```php
	'erreur_image_ajout' => 'L’image n’a pas pu être ajoutée aux documents.',
	'erreur_image_fichier' => 'Aucune image reçue, ou envoi incomplet.',
	'erreur_image_indisponible' => 'Le collage d’images n’est pas disponible pour ce texte.',
	'erreur_image_taille' => 'Image trop volumineuse pour le serveur.',
	'erreur_image_type' => 'Ce type d’image n’est pas accepté.',
```

(`en` : `The image could not be added to the documents.`, `No image received, or incomplete upload.`,
`Pasting images is not available for this text.`, `Image too large for the server.`,
`This image type is not accepted.`)

- [ ] **Step 5 : vérifier**

Run: `vendor/bin/phpunit`
Expected: PASS (tous les tests, anciens compris : les nouvelles simulations n'en changent aucun).

- [ ] **Step 6 : commit**

```bash
git add inc/tiptap_spip_images.php tests/bootstrap.php tests/unit/ImagesTest.php lang/tiptap_spip_*.php
git commit -m "feat: contrôle et ajout des images collées côté serveur"
```

---

### Task 3 : opération `deposer_image` du CVT de services (+ e2e serveur)

**Files:**
- Modify: `formulaires/tiptap_spip.php`, `formulaires/tiptap_spip.html`
- Modify: `tests/e2e/site.php` (commande `documents`)
- Create: `prive/javascript/tiptap_spip/tests/e2e/images.e2e.js` (première partie : serveur)

**Interfaces:**
- Consumes : `tiptap_spip_images()`, `tiptap_spip_images_types()`, `tiptap_spip_controler_image()`,
  `tiptap_spip_deposer_image()` (Task 2).
- Produces :
  - attribut `data-tts-images='{"types":[…],"taille":N}'` sur le `<form>` de services, absent si
    l'opération est indisponible ;
  - opération `deposer_image`, dont le résultat est `{ id_document: number, raccourci: "docN" }` ;
  - erreurs dans `erreurs.message_erreur` ;
  - pilote `php tests/e2e/site.php documents <objet> <id>`, qui renvoie
    `[{"id_document":…,"mode":"document","extension":"png"}]`.

- [ ] **Step 1 : pilote `documents`**

`tests/e2e/site.php` : ajouter `'documents'` à la liste des commandes, à l'usage (en-tête et message
d'erreur), puis :

```php
if ($commande === 'documents') {
	// documents liés à un objet, dans l'ordre de création
	$lignes = sql_allfetsel(
		'd.id_document, d.mode, d.extension',
		'spip_documents AS d JOIN spip_documents_liens AS l ON l.id_document = d.id_document',
		['l.objet = ' . sql_quote((string) ($argv[2] ?? '')), 'l.id_objet = ' . (int) ($argv[3] ?? 0)],
		'',
		'd.id_document'
	);
	echo json_encode(array_map(static fn ($l) => ['id_document' => (int) $l['id_document'], 'mode' => $l['mode'], 'extension' => $l['extension']], $lignes));
	exit(0);
}
```

et dans `tests/e2e/site.js` :

```js
export const documents = (objet, id) => JSON.parse(php(['documents', objet, String(id)]));
```

- [ ] **Step 2 : e2e serveur qui échouent**

Créer `prive/javascript/tiptap_spip/tests/e2e/images.e2e.js` :

```js
// Coller des images (spec 10) sur un site SPIP JETABLE : opération deposer_image du formulaire de
// services, collage dans l'éditeur visuel et en mode source, soumission retenue pendant les envois,
// crayons. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { activer, configure, configurer, creerAuteur, documents, editer, module, php } from './site.js';

configure(test);

/** PNG 1×1 (le même que tests/e2e/site.php). */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.beforeAll(() => configurer('tiptap_spip/coller_images', 'oui'));

/** Configuration du collage annoncée par le formulaire de services du champ texte. */
const annonce = (page) => page.evaluate(() => {
	const brut = document.querySelector('.tts-services[data-tts-champ=texte] form')?.dataset.ttsImages;
	return brut ? JSON.parse(brut) : null;
});

/**
 * Poste deposer_image avec un fichier, comme cvt.js, et lit la réponse : résultat ou erreurs.
 * Le formulaire de services est remplacé par celui de la réponse.
 */
const deposer = (page, { nom = 'capture.png', base64 = PNG, type = 'image/png' } = {}) => page.evaluate(async ([nom, base64, type]) => {
	const form = document.querySelector('.tts-services[data-tts-champ=texte] form');
	const data = new FormData(form);
	data.set('var_ajax', 'form');
	data.set('operation', 'deposer_image');
	data.set('fichier', new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	const html = await (await fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin' })).text();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const nouveau = doc.querySelector('form');
	if (nouveau) form.replaceWith(document.importNode(nouveau, true));
	const lire = (sel) => (doc.querySelector(sel) ? JSON.parse(doc.querySelector(sel).textContent) : null);
	return { ok: lire('script.tts-resultat'), erreurs: lire('script.tts-erreurs') };
}, [nom, base64, type]);

test.describe('serveur', () => {
	test('annonce : types acceptés et taille maximale ; rien si le réglage est désactivé', async ({ page }) => {
		await editer(page, 'Texte');
		const images = await annonce(page);
		expect(images.types).toEqual(expect.arrayContaining(['image/png', 'image/jpeg', 'image/gif']));
		expect(images.taille).toBeGreaterThan(0);
		configurer('tiptap_spip/coller_images', 'non');
		try {
			await page.reload();
			expect(await annonce(page)).toBeNull();
		} finally {
			configurer('tiptap_spip/coller_images', 'oui');
		}
	});

	test('deposer_image : document lié à l\'article, en mode document, raccourci docN', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const { ok, erreurs } = await deposer(page);
		expect(erreurs).toBeNull();
		expect(ok.operation).toBe('deposer_image');
		expect(ok.resultat.raccourci).toBe(`doc${ok.resultat.id_document}`);
		expect(documents('article', id)).toEqual([{ id_document: ok.resultat.id_document, mode: 'document', extension: 'png' }]);
		// le formulaire renouvelé accepte un second dépôt
		const second = await deposer(page);
		expect(second.ok.resultat.id_document).toBeGreaterThan(ok.resultat.id_document);
	});

	test('deposer_image : PNG renommé .php refusé, rien n\'est lié', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const { ok, erreurs } = await deposer(page, { nom: 'x.php' });
		expect(ok).toBeNull();
		expect(erreurs.message_erreur).toBe('Ce type d’image n’est pas accepté.');
		expect(documents('article', id)).toEqual([]);
	});

	test('disponibilité : article même sans documents_objets, rubrique non, sans objet non', async ({ page, request }) => {
		await editer(page, 'Texte');
		const avant = php(['lire_config', 'documents_objets']).trim();
		configurer('documents_objets', '');
		try {
			await page.reload();
			expect(await annonce(page)).not.toBeNull();
			// page de services à la demande : même charger(), contexte passé dans l'URL
			const services = async (query) => {
				const html = await (await page.request.get(`/spip.php?page=tiptap_spip_services&${query}`)).text();
				return /data-tts-images=/.test(html);
			};
			expect(await services('objet=rubrique&id_objet=1&champ=texte')).toBe(false);
			expect(await services('objet=&id_objet=0&champ=descriptif_site')).toBe(false);
		} finally {
			configurer('documents_objets', avant);
		}
	});

	test('rédacteur sans droit sur l\'article : pas de services, donc pas de dépôt', async ({ page }) => {
		const redacteur = creerAuteur('1comite');
		// article de l'administrateur publié : un rédacteur ne peut pas le modifier
		const id = await editer(page, 'Texte');
		php(['publier', String(id)]);
		await editer(page, 'Autre', { auteur: redacteur });
		await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
		expect(await page.locator('.tts-services[data-tts-champ=texte]').count()).toBe(0);
	});
});
```

Le test « disponibilité » lit la configuration `documents_objets` pour la restaurer. Le pilote n'a pas de
commande pour lire une configuration : ajouter `lire_config <clé>` à `tests/e2e/site.php` (sur le modèle
de `config`, en faisant `echo (string) lire_config(…)`), avec son usage. La session de `page.request` est
celle de la page : les cookies du contexte sont partagés.

- [ ] **Step 3 : vérifier l'échec**

```bash
cd prive/javascript/tiptap_spip
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images --project=chromium -g serveur
```

Expected: FAIL (`annonce` nulle, opération inconnue).

- [ ] **Step 4 : implémentation**

`formulaires/tiptap_spip.php` :

```php
include_spip('tiptap_spip_fonctions');
include_spip('inc/tiptap_spip_images');
```

`charger()` : ajouter au tableau rendu

```php
		// collage d'images (spec 10 §6) : configuration annoncée au JS, null si indisponible
		'_images' => tiptap_spip_images((string) $objet, intval($id_objet)),
```

`verifier()`, nouveau cas du `switch` (les messages vont dans `message_erreur` : sinon SPIP y met son
message générique) :

```php
		case 'deposer_image':
			if (!tiptap_spip_images((string) $objet, intval($id_objet))) {
				$erreurs['message_erreur'] = _T('tiptap_spip:erreur_image_indisponible');
			} elseif ($erreur = tiptap_spip_controler_image($_FILES, tiptap_spip_images_types())) {
				$erreurs['message_erreur'] = $erreur;
			}
			break;
```

`traiter()` : avant le `match`,

```php
	$operation = _request('operation');
	if ($operation === 'deposer_image') {
		// _request() ne lit pas $_FILES : le fichier, contrôlé par verifier(), est lu directement
		$depot = tiptap_spip_deposer_image($_FILES['fichier'], (string) $objet, intval($id_objet));
		if (is_string($depot)) {
			return ['message_erreur' => $depot, 'editable' => true];
		}
	}
```

et dans le `match`, `'deposer_image' => $depot,`.

`formulaires/tiptap_spip.html`, balise `<form>` :

```html
	<form method="post" action="#ENV{action}"[ data-tts-images="(#ENV{_images}|tiptap_spip_json|attribut_html)"]><div>
```

(`tiptap_spip_json` rend une chaîne vide pour `null` : l'attribut est alors absent.)

- [ ] **Step 5 : vérifier sur les trois sites**

Vider les caches de squelettes des trois sites, puis lancer :

```bash
cd prive/javascript/tiptap_spip
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images --project=chromium -g serveur
TTS_SITE=/src/jetables/v4.2.16 TTS_URL=http://127.0.0.1:18932 TTS_PHP=php8.3 npx playwright test images --project=chromium -g serveur
TTS_SITE=/src/jetables/v5.0-dev TTS_URL=http://127.0.0.1:18933 TTS_PHP=php8.4 npx playwright test images --project=chromium -g serveur
cd /src/tiptap-spip && vendor/bin/phpunit
```

Expected: PASS partout. Ce passage répond aussi au point « à vérifier » de spec 10 §5 : un CVT en AJAX reçoit
bien un corps `multipart/form-data` sur 4.2, 4.4 et 5. Si un site échoue sur ce point, s'arrêter et
remonter l'écart avant d'aller plus loin.

- [ ] **Step 6 : commit**

```bash
git add formulaires/tiptap_spip.* tests/e2e/site.php prive/javascript/tiptap_spip/tests/e2e/site.js prive/javascript/tiptap_spip/tests/e2e/images.e2e.js
git commit -m "feat: opération deposer_image du formulaire de services"
```

---

### Task 4 : client CVT — annonce et envoi d'un fichier

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/services/cvt.js`
- Modify: `prive/javascript/tiptap_spip/tests/e2e/fixtures-cvt.e2e.js`
- Create: `prive/javascript/tiptap_spip/tests/fixtures/cvt/deposer_image.html`, `deposer_image_type.html` (enregistrées)
- Test: `prive/javascript/tiptap_spip/tests/services/cvt.test.js`

**Interfaces:**
- Produces:
  - `Services#images(): { types: string[], taille: number } | null`
  - `Services#call(operation, params = {}, { fichier?: File, progression?: (ratio: number|null) => void, signal?: AbortSignal } = {})`
  - constructeur : option `xhr = () => new XMLHttpRequest()`
  - un appel abandonné rejette une `DOMException` de nom `AbortError`, et le service reste disponible.

- [ ] **Step 1 : enregistrer les fixtures**

Dans `fixtures-cvt.e2e.js`, `poster()` accepte un fichier :

```js
const poster = (page, params, { sansSession = false, fichier = null } = {}) => page.evaluate(async ([params, sansSession, fichier]) => {
	const form = document.querySelector('.tts-services[data-tts-champ=texte] form');
	const data = new FormData(form);
	data.set('var_ajax', 'form');
	for (const [k, v] of Object.entries(params)) data.set(k, v);
	if (fichier) data.set('fichier', new File([Uint8Array.from(atob(fichier.base64), (c) => c.charCodeAt(0))], fichier.nom, { type: 'image/png' }));
	// … suite inchangée
}, [params, sansSession, fichier]);
```

et le test enregistre deux réponses de plus :

```js
	const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
	ecrire('deposer_image', await poster(page, { operation: 'deposer_image' }, { fichier: { nom: 'capture.png', base64: png } }));
	ecrire('deposer_image_type', await poster(page, { operation: 'deposer_image' }, { fichier: { nom: 'x.php', base64: png } }));
```

Puis lancer l'enregistrement sur le site 4.4 :

```bash
cd prive/javascript/tiptap_spip
TTS_FIXTURES=1 TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test fixtures-cvt --project=chromium
git diff --stat tests/fixtures/cvt
```

Expected : les deux nouveaux fichiers. `formulaire.html` porte désormais `data-tts-images` sur le `<form>`.
Les autres fixtures sont réécrites (signatures nouvelles), ce qui est attendu.

- [ ] **Step 2 : tests qui échouent**

Ajouter à `tests/services/cvt.test.js` :

```js
/** XMLHttpRequest simulé : répond `reponse` (ou échoue) à send(), progression 50 % puis 100 %. */
const fakeXHR = (reponse) => {
	const envois = [];
	const fabrique = () => {
		const xhr = {
			upload: {},
			open: vi.fn((methode, url) => { xhr.url = url; }),
			send: vi.fn((body) => {
				envois.push({ url: xhr.url, body, xhr });
				queueMicrotask(() => {
					if (xhr.aborted) return;
					xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
					xhr.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 2 });
					if (reponse instanceof Error) xhr.onerror?.();
					else { xhr.responseText = reponse; xhr.onload?.(); }
				});
			}),
			abort: vi.fn(() => { xhr.aborted = true; xhr.onabort?.(); }),
		};
		return xhr;
	};
	fabrique.envois = envois;
	return fabrique;
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'capture.png', { type: 'image/png' });

describe('Services.images', () => {
	it('lit l\'annonce du formulaire courant', () => {
		const services = Services.forTextarea(page());
		expect(services.images()).toEqual({ types: expect.arrayContaining(['image/png']), taille: expect.any(Number) });
	});

	it('null sans annonce (opération indisponible)', () => {
		const services = Services.forTextarea(page());
		delete services.container.querySelector('form').dataset.ttsImages;
		expect(services.images()).toBeNull();
	});
});

describe('Services.call avec un fichier', () => {
	it('envoi par XHR avec le fichier, progression, résultat', async () => {
		const xhr = fakeXHR(fixture('deposer_image'));
		const services = Services.forTextarea(page(), { fetch: fakeFetch(), xhr });
		const action = services.container.querySelector('form').getAttribute('action');
		const progression = vi.fn();
		const resultat = await services.call('deposer_image', {}, { fichier: png(), progression });
		expect(resultat.raccourci).toBe(`doc${resultat.id_document}`);
		const { body, url } = xhr.envois[0];
		expect(url).toBe(action);
		expect(body.get('operation')).toBe('deposer_image');
		expect(body.get('fichier').name).toBe('capture.png');
		expect(progression.mock.calls).toEqual([[0.5], [1]]);
	});

	it('type refusé : ServiceError avec le message du serveur', async () => {
		const services = Services.forTextarea(page(), { xhr: fakeXHR(fixture('deposer_image_type')) });
		const erreur = await services.call('deposer_image', {}, { fichier: png() }).catch((e) => e);
		expect(erreur).toBeInstanceOf(ServiceError);
		expect(erreur.message).toBe('Ce type d’image n’est pas accepté.');
		expect(services.available).toBe(true);
	});

	it('session expirée ou réseau coupé : indisponible', async () => {
		for (const reponse of [fixture('sans_session'), new TypeError('réseau')]) {
			const services = Services.forTextarea(page(), { xhr: fakeXHR(reponse) });
			await expect(services.call('deposer_image', {}, { fichier: png() })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(services.available).toBe(false);
		}
	});

	it('abandon : AbortError, le service reste disponible, l\'appel suivant part', async () => {
		const xhr = fakeXHR(fixture('deposer_image'));
		const services = Services.forTextarea(page(), { xhr });
		const controleur = new AbortController();
		const promesse = services.call('deposer_image', {}, { fichier: png(), signal: controleur.signal });
		controleur.abort();
		const erreur = await promesse.catch((e) => e);
		expect(erreur.name).toBe('AbortError');
		expect(services.available).toBe(true);
		await expect(services.call('deposer_image', {}, { fichier: png() })).resolves.toMatchObject({ raccourci: expect.stringMatching(/^doc\d+$/) });
	});

	it('abandon avant son tour dans la file : rien n\'est envoyé', async () => {
		const xhr = fakeXHR(fixture('deposer_image'));
		const services = Services.forTextarea(page(), { xhr });
		const premier = services.call('deposer_image', {}, { fichier: png() });
		const controleur = new AbortController();
		const second = services.call('deposer_image', {}, { fichier: png(), signal: controleur.signal });
		controleur.abort();
		await premier;
		expect((await second.catch((e) => e)).name).toBe('AbortError');
		expect(xhr.envois).toHaveLength(1);
	});
});
```

- [ ] **Step 3 : vérifier l'échec**

Run: `npx vitest run tests/services/cvt.test.js`
Expected: FAIL (`images` n'est pas une fonction ; fichier non envoyé).

- [ ] **Step 4 : implémentation**

`src/services/cvt.js` :

```js
/** Appel abandonné (éditeur détruit, « Enregistrer sans attendre ») : pas une panne du service. */
const abandon = () => new DOMException('envoi abandonné', 'AbortError');
```

Constructeur :

```js
	/** @param {HTMLElement} container  élément .tts-services */
	constructor(container, { fetch = globalThis.fetch?.bind(globalThis), xhr = () => new XMLHttpRequest() } = {}) {
		this.container = container;
		this.fetch = fetch;
		this.xhr = xhr;
		this.available = true;
		this.queue = Promise.resolve();
	}

	/**
	 * Collage d'images (spec 10 §6) : configuration annoncée par charger() sur le formulaire courant,
	 * null si deposer_image est indisponible.
	 * @returns {{ types: string[], taille: number } | null}
	 */
	images() {
		const brut = this.container.querySelector('form')?.dataset.ttsImages;
		if (!brut) return null;
		try {
			return JSON.parse(brut);
		} catch {
			return null;
		}
	}
```

`call` et `send` :

```js
	/**
	 * Appelle une opération ; les appels sont sérialisés (chacun repart du formulaire renouvelé
	 * par la réponse précédente).
	 * @param {string} operation  previsu_modele, titre_lien, rechercher, deposer_image…
	 * @param {object} params  valeurs non chaînes envoyées en JSON
	 * @param {{ fichier?: File, progression?: (ratio: number|null) => void, signal?: AbortSignal }} [options]
	 *        fichier : envoyé dans le champ « fichier », par XMLHttpRequest (progression) ;
	 *        signal : abandon de l'appel, en attente ou en cours (AbortError)
	 * @returns {Promise<any>} résultat de l'opération
	 */
	call(operation, params = {}, options = {}) {
		const run = () => this.send(operation, params, options);
		const promise = this.queue.then(run, run);
		this.queue = promise.catch(() => {});
		return promise;
	}

	async send(operation, params, { fichier = null, progression = null, signal = null } = {}) {
		if (signal?.aborted) throw abandon();
		if (!this.available) throw new ServiceUnavailable();
		const form = this.container.querySelector('form');
		const body = new FormData(form);
		body.set('var_ajax', 'form');
		body.set('operation', operation);
		for (const [key, value] of Object.entries(params)) {
			body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		if (fichier) body.set('fichier', fichier, fichier.name);
		const url = form.getAttribute('action');
		let reponse;
		try {
			const html = fichier
				? await this.envoyer(url, body, { progression, signal })
				: await (await this.fetch(url, { method: 'POST', body, credentials: 'same-origin' })).text();
			reponse = parseResponse(html);
		} catch (erreur) {
			if (erreur?.name === 'AbortError') throw erreur;
			reponse = null;
		}
		if (!reponse) {
			this.available = false;
			throw new ServiceUnavailable();
		}
		form.replaceWith(document.importNode(reponse.form, true));
		if (reponse.erreurs) throw new ServiceError(reponse.erreurs);
		return reponse.resultat;
	}

	/**
	 * POST par XMLHttpRequest, seule voie qui donne la progression d'un envoi (fetch ne la donne pas).
	 * @returns {Promise<string>} réponse ; rejet TypeError (réseau) ou AbortError
	 */
	envoyer(url, body, { progression, signal }) {
		return new Promise((resolve, reject) => {
			const xhr = this.xhr();
			const abandonner = () => xhr.abort();
			const fin = (suite) => {
				signal?.removeEventListener('abort', abandonner);
				suite();
			};
			xhr.open('POST', url);
			xhr.withCredentials = true;
			if (progression) xhr.upload.onprogress = (e) => progression(e.lengthComputable ? e.loaded / e.total : null);
			xhr.onload = () => fin(() => resolve(xhr.responseText));
			xhr.onerror = () => fin(() => reject(new TypeError('échec de l\'envoi')));
			xhr.onabort = () => fin(() => reject(abandon()));
			signal?.addEventListener('abort', abandonner, { once: true });
			xhr.send(body);
		});
	}
```

Mettre à jour le commentaire d'en-tête du fichier : les envois de fichiers passent par XHR.

- [ ] **Step 5 : vérifier**

Run: `npx vitest run tests/services`
Expected: PASS (tests existants compris).

- [ ] **Step 6 : commit**

```bash
npm run build
git add src/services/cvt.js tests/services/cvt.test.js tests/fixtures/cvt tests/e2e/fixtures-cvt.e2e.js ../tiptap_spip.js ../tiptap_spip.min.js ../tiptap_spip.LICENSES.txt
git commit -m "feat: envoi d'un fichier aux services de l'éditeur, avec progression et abandon"
```

---

### Task 5 : arbitrage du presse-papiers et nom des captures

**Files:**
- Create: `prive/javascript/tiptap_spip/src/editor/collerImage.js` (première partie)
- Test: `prive/javascript/tiptap_spip/tests/editor/collerImage.test.js`

**Interfaces:**
- Produces:
  - `nommer(fichier: File, date?: Date): File`
  - `trierPressePapiers(donnees: DataTransfer|null, config: { types: string[], taille: number }): { envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null`
    (`null` : collage habituel sans message ; `envoyer` vide : collage habituel, refus à signaler)

- [ ] **Step 1 : tests qui échouent**

```js
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { nommer, trierPressePapiers } from '../../src/editor/collerImage.js';

const CONFIG = { types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], taille: 1000 };
const fichier = (nom, type, taille = 10) => new File([new Uint8Array(taille)], nom, { type });

/** DataTransfer minimal (jsdom n'en a pas) : files et getData. */
const presse = ({ files = [], html = '', texte = '' } = {}) => ({
	files,
	getData: (type) => ({ 'text/html': html, 'text/plain': texte })[type] ?? '',
});

describe('nommer', () => {
	const date = new Date(2026, 9, 15, 9, 5, 3);

	it('capture sans nom ou nommée image.png : capture-AAAAMMJJ-HHMMSS.<ext>', () => {
		expect(nommer(fichier('', 'image/png'), date).name).toBe('capture-20261015-090503.png');
		expect(nommer(fichier('image.png', 'image/png'), date).name).toBe('capture-20261015-090503.png');
		expect(nommer(fichier('image.jpeg', 'image/jpeg'), date).name).toBe('capture-20261015-090503.jpg');
	});

	it('fichier nommé : son nom, avec l\'extension de son type', () => {
		expect(nommer(fichier('Photo vacances.JPEG', 'image/jpeg'), date).name).toBe('Photo vacances.jpg');
		expect(nommer(fichier('schema.webp', 'image/webp'), date).name).toBe('schema.webp');
	});

	it('garde le contenu et le type', () => {
		const f = nommer(fichier('', 'image/gif', 7), date);
		expect(f.type).toBe('image/gif');
		expect(f.size).toBe(7);
	});
});

describe('trierPressePapiers (spec 10 §3)', () => {
	const png = fichier('a.png', 'image/png');
	const jpg = fichier('b.jpg', 'image/jpeg');
	const pdf = fichier('c.pdf', 'application/pdf');

	it('sans fichier : collage habituel', () => {
		expect(trierPressePapiers(presse({ html: '<p>x</p>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(null, CONFIG)).toBeNull();
	});

	it('images seules : toutes envoyées dans l\'ordre', () => {
		expect(trierPressePapiers(presse({ files: [png, jpg] }), CONFIG)).toEqual({ envoyer: [png, jpg], refuses: [] });
	});

	it('images + HTML réduit à une <img> (+ texte) : envoyées, HTML et texte ignorés', () => {
		const html = '<meta charset="utf-8"><img src="https://exemple.test/a.png" alt="">';
		expect(trierPressePapiers(presse({ files: [png], html, texte: 'https://exemple.test/a.png' }), CONFIG).envoyer).toEqual([png]);
		const windows = '<html><body><!--StartFragment--><a href="x"><img src="a.png"></a><!--EndFragment--></body></html>';
		expect(trierPressePapiers(presse({ files: [png], html: windows }), CONFIG).envoyer).toEqual([png]);
	});

	it('images + autre HTML ou texte : collage habituel, fichiers ignorés sans message', () => {
		expect(trierPressePapiers(presse({ files: [png], html: '<table><tr><td>1</td></tr></table>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], html: '<p>texte <img src="a.png"></p>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], texte: 'du texte' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], html: '<img src="a"><img src="b">' }), CONFIG)).toBeNull();
	});

	it('images et non-images : images envoyées, les autres refusées (type)', () => {
		expect(trierPressePapiers(presse({ files: [pdf, png] }), CONFIG)).toEqual({ envoyer: [png], refuses: [{ fichier: pdf, raison: 'type' }] });
	});

	it('rien d\'acceptable : envoyer vide, refus signalés', () => {
		const svg = fichier('d.svg', 'image/svg+xml');
		expect(trierPressePapiers(presse({ files: [pdf, svg] }), CONFIG)).toEqual({ envoyer: [], refuses: [{ fichier: pdf, raison: 'type' }, { fichier: svg, raison: 'type' }] });
	});

	it('trop grosse : refusée avant envoi sans bloquer les autres ; taille 0 = sans limite', () => {
		const gros = fichier('gros.png', 'image/png', 1001);
		expect(trierPressePapiers(presse({ files: [gros, jpg] }), CONFIG)).toEqual({ envoyer: [jpg], refuses: [{ fichier: gros, raison: 'taille' }] });
		expect(trierPressePapiers(presse({ files: [gros] }), { ...CONFIG, taille: 0 }).envoyer).toEqual([gros]);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/collerImage.test.js`
Expected: FAIL (module absent).

- [ ] **Step 3 : implémentation**

`src/editor/collerImage.js` :

```js
/**
 * Coller des images (spec 10) : arbitrage du presse-papiers, nom des captures, envois vers
 * l'opération deposer_image des services et insertion de <docN>, dans l'éditeur visuel comme en
 * mode source.
 */

/** Extension de chaque type d'image de la liste blanche. */
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

const deux = (n) => String(n).padStart(2, '0');

/**
 * Nom envoyé au serveur (spec 10 §2) : une capture arrive sans nom ou nommée image.png, elle devient
 * capture-AAAAMMJJ-HHMMSS.<ext> ; un fichier nommé garde son nom, avec l'extension de son type.
 * @param {File} fichier
 * @param {Date} [date]
 * @returns {File}
 */
export function nommer(fichier, date = new Date()) {
	const extension = EXTENSIONS[fichier.type] ?? fichier.name.split('.').pop();
	const capture = !fichier.name || /^image\.\w+$/i.test(fichier.name);
	const base = capture
		? `capture-${date.getFullYear()}${deux(date.getMonth() + 1)}${deux(date.getDate())}-${deux(date.getHours())}${deux(date.getMinutes())}${deux(date.getSeconds())}`
		: fichier.name.replace(/\.[^.]*$/, '');
	return new File([fichier], `${base}.${extension}`, { type: fichier.type, lastModified: fichier.lastModified });
}

/** HTML réduit à une seule image (copie d'une image depuis un navigateur), liens et commentaires compris. */
function imageSeule(html) {
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	const images = body.querySelectorAll('img');
	if (images.length !== 1 || body.textContent.trim() !== '') return false;
	return [...body.querySelectorAll('*')].every((el) => el === images[0] || el.contains(images[0]));
}

/**
 * Arbitrage du presse-papiers (spec 10 §3) : le texte ou le HTML ordinaire gardent la priorité ;
 * sinon chaque image acceptée est envoyée, dans l'ordre, et les autres fichiers sont refusés.
 *
 * @param {DataTransfer|null} donnees
 * @param {{ types: string[], taille: number }} config  taille 0 : sans limite
 * @returns {{ envoyer: File[], refuses: { fichier: File, raison: 'type'|'taille' }[] } | null}
 *          null : collage habituel sans message ; envoyer vide : collage habituel, refus à signaler
 */
export function trierPressePapiers(donnees, { types, taille }) {
	const fichiers = [...(donnees?.files ?? [])];
	if (!fichiers.length) return null;
	const html = donnees.getData('text/html');
	if (html ? !imageSeule(html) : donnees.getData('text/plain').trim() !== '') return null;
	const envoyer = [];
	const refuses = [];
	for (const fichier of fichiers) {
		if (!types.includes(fichier.type)) refuses.push({ fichier, raison: 'type' });
		else if (taille && fichier.size > taille) refuses.push({ fichier, raison: 'taille' });
		else envoyer.push(fichier);
	}
	return { envoyer, refuses };
}
```

- [ ] **Step 4 : vérifier**

Run: `npx vitest run tests/editor/collerImage.test.js`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add src/editor/collerImage.js tests/editor/collerImage.test.js
git commit -m "feat: arbitrage du presse-papiers pour le collage d'images"
```

---

### Task 6 : message dans la barre d'état, visible aussi en mode source

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/ui/StatusBar.js`
- Modify: `css/tiptap_spip.css`
- Test: `prive/javascript/tiptap_spip/tests/ui/etat.test.js` (nouveau)

**Interfaces:**
- Produces:
  - `StatusBar#signaler(texte: string, action?: { libelle: string, faire: () => void }): void`
  - `StatusBar#effacer(): void`
  - En mode source, la barre ne montre que le message : elle est masquée s'il n'y en a pas.

- [ ] **Step 1 : tests qui échouent**

```js
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from '../../src/ui/StatusBar.js';
import { editor, monter } from './outils.js';

let etat;
afterEach(() => {
	etat?.destroy();
	editor?.destroy();
});

describe('StatusBar : message', () => {
	it('affiche un message, annoncé, puis l\'efface', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		etat.signaler('Type de fichier non accepté : a.pdf.');
		const message = etat.element.querySelector('.tts-etat__message');
		expect(message.textContent).toBe('Type de fichier non accepté : a.pdf.');
		expect(message.getAttribute('role')).toBe('status');
		etat.effacer();
		expect(message.textContent).toBe('');
		expect(message.hidden).toBe(true);
	});

	it('action : bouton qui exécute et efface', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		const faire = vi.fn();
		etat.signaler('Une image est en cours d’envoi.', { libelle: 'Enregistrer sans attendre', faire });
		const bouton = etat.element.querySelector('.tts-etat__message button');
		expect(bouton.textContent).toBe('Enregistrer sans attendre');
		bouton.click();
		expect(faire).toHaveBeenCalledTimes(1);
	});

	it('mode source : barre masquée sauf s\'il y a un message, mots et anomalies masqués', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		etat.setMode(true);
		expect(etat.element.hidden).toBe(true);
		etat.signaler('Échec');
		expect(etat.element.hidden).toBe(false);
		expect(etat.mots.hidden).toBe(true);
		etat.effacer();
		expect(etat.element.hidden).toBe(true);
		etat.setMode(false);
		expect(etat.element.hidden).toBe(false);
		expect(etat.mots.hidden).toBe(false);
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/ui/etat.test.js`
Expected: FAIL (`signaler` absent).

- [ ] **Step 3 : implémentation**

`src/ui/StatusBar.js`, dans le constructeur, après la création de `annonce` (la garder dans
`this.annonce`) :

```js
		// message ponctuel (envoi d'image refusé, soumission retenue…), visible aussi en mode source
		this.message = document.createElement('span');
		this.message.className = 'tts-etat__message';
		this.message.setAttribute('role', 'status');
		this.message.hidden = true;
		this.element.append(this.mots, this.annonce, this.message);
```

(remplace `this.element.append(this.mots, annonce);`)

Méthodes :

```js
	/**
	 * Message dans la barre, avec éventuellement un bouton d'action ; remplace le précédent.
	 * @param {string} texte
	 * @param {{ libelle: string, faire: () => void }} [action]
	 */
	signaler(texte, action = null) {
		this.message.replaceChildren(texte);
		if (action) {
			const bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.textContent = action.libelle;
			bouton.addEventListener('click', () => action.faire());
			this.message.append(' ', bouton);
		}
		this.message.hidden = false;
		this.afficher();
	}

	effacer() {
		this.message.replaceChildren();
		this.message.hidden = true;
		this.afficher();
	}

	afficher() {
		// mode source : seul le message reste, la barre est masquée sans lui
		this.element.hidden = this.source && this.message.hidden;
		this.mots.hidden = this.source;
		this.annonce.hidden = this.source;
		if (this.source) return;
		// … suite inchangée (mots, anomalies)
	}
```

Mettre à jour le commentaire de classe (« masquée en mode source » → « en mode source, seul le message est
affiché »).

`css/tiptap_spip.css`, après `.tts-etat__anomalies` :

```css
.tts-etat__message {
	margin-inline-start: auto;
}

.tts-etat__message[hidden] {
	display: none;
}

.tts-etat__message button {
	font: inherit;
	text-decoration: underline;
	background: none;
	border: 0;
	padding: 0;
	color: inherit;
	cursor: pointer;
}
```

Lire d'abord le bloc `.tts-etat` existant : si c'est déjà un flex, `margin-inline-start: auto` pousse le
message à droite. Sinon, en faire un flex comme les autres barres du fichier.

- [ ] **Step 4 : vérifier**

Run: `npx vitest run tests/ui tests/editor`
Expected: PASS (les tests existants de la barre d'état restent verts).

- [ ] **Step 5 : commit**

```bash
git add src/ui/StatusBar.js tests/ui/etat.test.js ../../../css/tiptap_spip.css
git commit -m "feat: message de la barre d'état, visible aussi en mode source"
```

---

### Task 7 : marqueurs d'envoi dans l'éditeur visuel (`spipPasteImage`)

**Files:**
- Create: `prive/javascript/tiptap_spip/src/editor/marqueurEnvoi.js`
- Modify: `prive/javascript/tiptap_spip/src/editor/extensions.js` (`extensionsDuCoeur`)
- Modify: `css/tiptap_spip.css`
- Modify: `src/ui/labels.js`, `lang/tiptap_spip_{fr,en}.php`, `prive/javascript/tiptap_spip_config.js.html` (libellé `image_envoi`)
- Test: `prive/javascript/tiptap_spip/tests/editor/marqueurEnvoi.test.js`

**Interfaces:**
- Consumes: `ui.collerImages?: (view, event) => boolean`, posé par `main.js` (Task 8).
- Produces:
  - `cleMarqueurs: PluginKey`, plugin `spipUploadPlaceholder`
  - `ajouterMarqueurs(view, ids: string[]): void` (à la sélection)
  - `positionMarqueur(state, id): number | null`
  - `retirerMarqueurs(view, ids: string[]): void`
  - `remplacerMarqueur(editor, id, source: string): boolean` : insère le modèle à la place du marqueur, en une
    transaction annulable ; `false` si le marqueur n'existe plus
  - `progressionMarqueur(view, id, ratio: number|null): void`
  - extension `SpipPasteImage` (nom `spipPasteImage`, option `ui`)

- [ ] **Step 1 : tests qui échouent**

```js
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ajouterMarqueurs, positionMarqueur, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from '../../src/editor/marqueurEnvoi.js';
import { serialize } from '../../src/spip/index.js';
import { editor, monter } from '../ui/outils.js';

const source = () => serialize(editor.getJSON(), { regles: editor.tiptapSpip.regles });

describe('marqueurs d\'envoi (spec 10 §3)', () => {
	it('posé à la sélection, absent du document et de la sérialisation', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		expect(positionMarqueur(editor.state, 'a')).toBe(6);
		expect(editor.view.dom.querySelector('[data-tts-envoi="a"]').textContent).toContain('Envoi de l’image');
		expect(JSON.stringify(editor.getJSON())).not.toContain('envoi');
		expect(source()).toBe('Avant après');
	});

	it('position reportée quand on tape avant lui', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		editor.commands.insertContentAt(1, 'xyz');
		expect(positionMarqueur(editor.state, 'a')).toBe(9);
	});

	it('repli sur le point le plus proche quand le texte autour est supprimé', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		editor.commands.deleteRange({ from: 3, to: 9 });
		expect(positionMarqueur(editor.state, 'a')).toBe(3);
	});

	it('remplacement par <docN> en une transaction annulable', () => {
		monter('Avant après');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a']);
		expect(remplacerMarqueur(editor, 'a', '<doc12>')).toBe(true);
		expect(source()).toBe('Avant<doc12> après');
		expect(positionMarqueur(editor.state, 'a')).toBeNull();
		editor.commands.undo();
		expect(source()).toBe('Avant après');
	});

	it('plusieurs marqueurs au même endroit : insérés dans l\'ordre', () => {
		monter('Texte');
		editor.commands.setTextSelection(6);
		ajouterMarqueurs(editor.view, ['a', 'b']);
		remplacerMarqueur(editor, 'a', '<doc1>');
		remplacerMarqueur(editor, 'b', '<doc2>');
		expect(source()).toBe('Texte<doc1><doc2>');
	});

	it('retrait sans insertion ; marqueur inconnu : rien', () => {
		monter('Texte');
		ajouterMarqueurs(editor.view, ['a']);
		retirerMarqueurs(editor.view, ['a']);
		expect(positionMarqueur(editor.state, 'a')).toBeNull();
		expect(remplacerMarqueur(editor, 'a', '<doc1>')).toBe(false);
		expect(source()).toBe('Texte');
	});

	it('progression : barre déterminée, indéterminée sans ratio', () => {
		monter('Texte');
		ajouterMarqueurs(editor.view, ['a']);
		const barre = () => editor.view.dom.querySelector('[data-tts-envoi="a"] progress');
		expect(barre().hasAttribute('value')).toBe(false);
		progressionMarqueur(editor.view, 'a', 0.5);
		expect(barre().value).toBe(0.5);
	});

	it('handlePaste délègue à ui.collerImages', () => {
		const collerImages = vi.fn(() => true);
		monter('Texte', null, { ui: { collerImages } });
		const event = new Event('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'clipboardData', { value: { files: [], getData: () => '', types: [] } });
		editor.view.dom.dispatchEvent(event);
		expect(collerImages).toHaveBeenCalledWith(editor.view, event);
	});
});
```

`monter()` (`tests/ui/outils.js`) n'accepte pas d'option `ui`. L'ajouter : `{ tierces, catalogue, ui: extra = {} }`
et `Object.assign(ui, extra)` après `creerInterface`. Cela ne change rien aux appels existants.

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/marqueurEnvoi.test.js`
Expected: FAIL (module absent).

- [ ] **Step 3 : implémentation**

`src/editor/marqueurEnvoi.js` :

```js
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { parseModel } from '../spip/models.js';
import { label } from '../ui/labels.js';

/**
 * Marqueurs d'envoi des images collées (spec 10 §3) : décorations, jamais des nœuds. Le document,
 * sa sérialisation, le textarea et l'historique ne les contiennent pas. Le plugin suit lui-même la
 * position de chaque marqueur : reportée à chaque transaction, repliée sur le point le plus proche si
 * le texte autour est supprimé (une décoration de ProseMirror disparaîtrait avec lui).
 */
export const cleMarqueurs = new PluginKey('spipUploadPlaceholder');

function widget(id) {
	const element = document.createElement('span');
	element.className = 'tts-envoi';
	element.dataset.ttsEnvoi = id;
	element.contentEditable = 'false';
	const barre = document.createElement('progress');
	barre.max = 1;
	element.append(label('image_envoi'), ' ', barre);
	return element;
}

const plugin = (ui) => new Plugin({
	key: cleMarqueurs,
	state: {
		init: () => new Map(),
		apply(tr, marqueurs) {
			const meta = tr.getMeta(cleMarqueurs);
			if (!tr.docChanged && !meta) return marqueurs;
			const suite = new Map();
			for (const [id, pos] of marqueurs) suite.set(id, tr.mapping.map(pos));
			for (const { id, pos } of meta?.ajouter ?? []) suite.set(id, pos);
			for (const id of meta?.retirer ?? []) suite.delete(id);
			return suite;
		},
	},
	props: {
		decorations(state) {
			const marqueurs = cleMarqueurs.getState(state);
			if (!marqueurs.size) return null;
			// key : le même élément est gardé d'un rendu à l'autre (progression)
			return DecorationSet.create(state.doc, [...marqueurs].map(([id, pos]) => Decoration.widget(pos, () => widget(id), { key: id })));
		},
		// collage d'images (spec 10 §3) : décidé à chaque collage par l'instance (services, disponibilité)
		handlePaste: (view, event) => ui?.collerImages?.(view, event) ?? false,
	},
});

/** Marqueurs à la sélection, dans l'ordre des ids. */
export function ajouterMarqueurs(view, ids) {
	const pos = view.state.selection.from;
	view.dispatch(view.state.tr.setMeta(cleMarqueurs, { ajouter: ids.map((id) => ({ id, pos })) }).setMeta('addToHistory', false));
}

export const positionMarqueur = (state, id) => cleMarqueurs.getState(state)?.get(id) ?? null;

export function retirerMarqueurs(view, ids) {
	view.dispatch(view.state.tr.setMeta(cleMarqueurs, { retirer: ids }).setMeta('addToHistory', false));
}

/**
 * Remplace le marqueur par le modèle `source` (<docN>), en une transaction : une étape d'historique.
 * @returns {boolean} false si le marqueur n'existe plus
 */
export function remplacerMarqueur(editor, id, source) {
	const pos = positionMarqueur(editor.state, id);
	if (pos === null) return false;
	return editor.chain()
		.command(({ tr }) => {
			tr.setMeta(cleMarqueurs, { retirer: [id] });
			return true;
		})
		.insertContentAt(pos, { type: 'spipModel', attrs: { model: parseModel(source) } }, { updateSelection: false })
		.run();
}

/** Progression de l'envoi (0 à 1) ; null : indéterminée. */
export function progressionMarqueur(view, id, ratio) {
	const barre = view.dom.querySelector(`[data-tts-envoi="${id}"] progress`);
	if (barre && ratio !== null) barre.value = ratio;
}

/** Capture du collage d'images et marqueurs d'envoi (spec 10 §3). */
export const SpipPasteImage = Extension.create({
	name: 'spipPasteImage',
	addOptions: () => ({ ui: null }),
	addProseMirrorPlugins() {
		return [plugin(this.options.ui)];
	},
});
```

Point à vérifier au test « plusieurs marqueurs » : le second marqueur, à la même position que le premier,
doit passer **après** le modèle inséré. `tr.mapping.map(pos)` (assoc 1) le garantit. Si le test montre
l'inverse, utiliser `tr.mapping.map(pos, 1)` explicitement.

Pas de `CSS.escape` (absent de jsdom) : les ids viennent de `CollerImages` (`tts-img-…`, sans caractère
spécial).

`src/editor/extensions.js` : `import { SpipPasteImage } from './marqueurEnvoi.js';`, puis dans
`extensionsDuCoeur`, après `SpipUi.configure({ ui })` :

```js
		SpipPasteImage.configure({ ui }),
```

Libellé `image_envoi` : « Envoi de l’image… » (`en` : « Uploading image… »), ajouté à `DEFAUTS` de
`labels.js`, aux fichiers de langue et à `tiptap_spip_config.js.html` (bloc `i18n`, avant
`zone_texte`).

`css/tiptap_spip.css` :

```css
/* Marqueur d'envoi d'une image collée (spec 10 §3) */
.tts-envoi {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	padding: 0 0.3em;
	border: 1px dashed currentColor;
	border-radius: 3px;
	font-size: 0.85em;
	opacity: 0.75;
}

.tts-envoi progress {
	width: 4em;
}
```

- [ ] **Step 4 : vérifier**

Run: `npx vitest run`
Expected: PASS (suite complète : l'extension ajoutée ne change aucun aller-retour ; `tests/ui/i18n.test.js`
vérifie le libellé).

- [ ] **Step 5 : commit**

```bash
npm run build
git add src/editor/marqueurEnvoi.js src/editor/extensions.js src/ui/labels.js tests/editor/marqueurEnvoi.test.js tests/ui/outils.js ../tiptap_spip_config.js.html ../tiptap_spip.js ../tiptap_spip.min.js ../../../css/tiptap_spip.css ../../../lang/tiptap_spip_*.php
git commit -m "feat: marqueurs d'envoi des images collées dans l'éditeur visuel"
```

---

### Task 8 : orchestration des envois (`CollerImages`) et câblage dans l'instance

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/editor/collerImage.js` (classe `CollerImages`)
- Modify: `prive/javascript/tiptap_spip/src/main.js` (`Instance`)
- Modify: `src/ui/labels.js`, `lang/tiptap_spip_{fr,en}.php`, `prive/javascript/tiptap_spip_config.js.html`
- Test: `prive/javascript/tiptap_spip/tests/editor/collerImage.test.js` (suite)

**Interfaces:**
- Consumes: `Services#images()`, `Services#call(…, { fichier, progression, signal })` (Task 4) ;
  `trierPressePapiers`, `nommer` (Task 5) ; `StatusBar#signaler/effacer` (Task 6) ; marqueurs (Task 7).
- Produces:
  - `new CollerImages({ textarea, editor, services: () => ?Services, mode: () => 'visual'|'source', signaler: (texte) => void, effacer: () => void, surChangement?: () => void })`
  - `CollerImages#collerVisuel(view, event): boolean`
  - `CollerImages#enCours(): number`
  - `CollerImages#abandonner(): void`
  - `CollerImages#destroy(): void`
  - `Instance#images`
  - `ui.collerImages`
  - bascule de mode refusée pendant un envoi.

- [ ] **Step 1 : tests qui échouent**

Ajouter à `tests/editor/collerImage.test.js` (après les imports existants, ajouter `afterEach`, `vi`) :

```js
import { instances, tiptap_spip_init } from '../../src/main.js';
import { ServiceError, ServiceUnavailable } from '../../src/services/cvt.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Services simulés : annonce et réponses de deposer_image, dans l'ordre. */
const services = (...reponses) => ({
	available: true,
	images: () => CONFIG,
	call: vi.fn(async (operation, params, { fichier, signal, progression }) => {
		const r = reponses.shift();
		await tick();
		if (signal?.aborted) throw new DOMException('abandon', 'AbortError');
		progression?.(1);
		if (r instanceof Error) throw r;
		return r;
	}),
});

/** Éditeur monté par tiptap_spip_init, services remplacés par `s`. */
const monterInstance = (source, s, { mode = 'visual' } = {}) => {
	document.body.innerHTML = `<form><textarea class="inserer_barre_edition" name="texte">${source}</textarea><button type="submit">Enregistrer</button></form>`;
	tiptap_spip_init();
	const instance = [...instances][0];
	instance.services = s;
	if (mode === 'source') instance.toggleMode({ focus: false });
	return instance;
};

/** Événement paste avec un presse-papiers donné. */
const coller = (cible, donnees) => {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: donnees });
	cible.dispatchEvent(event);
	return event;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	localStorage.clear();
});

describe('CollerImages (spec 10 §1, §3)', () => {
	const png = () => fichier('', 'image/png');

	it('visuel : deux images → deux appels dans l\'ordre, deux <docN>, événements', async () => {
		const s = services({ id_document: 1, raccourci: 'doc1' }, { id_document: 2, raccourci: 'doc2' });
		const instance = monterInstance('Texte', s);
		instance.editor.commands.setTextSelection(6);
		const recues = [];
		const inserees = [];
		instance.textarea.addEventListener('tiptap-spip:image-recue', (e) => recues.push(e.detail.fichier.name));
		instance.textarea.addEventListener('tiptap-spip:image-inseree', (e) => inserees.push(e.detail.raccourci));
		const event = coller(instance.editor.view.dom, presse({ files: [png(), fichier('b.jpg', 'image/jpeg')] }));
		expect(event.defaultPrevented).toBe(true);
		expect(instance.images.enCours()).toBe(2);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(s.call.mock.calls.map(([op, , { fichier: f }]) => [op, f.name.replace(/\d{8}-\d{6}/, 'D')])).toEqual([['deposer_image', 'capture-D.png'], ['deposer_image', 'b.jpg']]);
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte<doc1><doc2>');
		expect(recues).toHaveLength(2);
		expect(inserees).toEqual(['doc1', 'doc2']);
	});

	it('services en chargement : collage habituel ; collage suivant envoyé une fois les services là', async () => {
		const instance = monterInstance('Texte', null);
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
		instance.services = services({ id_document: 3, raccourci: 'doc3' });
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toContain('<doc3>');
	});

	it('opération indisponible ou services hors service : collage habituel', () => {
		const instance = monterInstance('Texte', { ...services(), images: () => null });
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
		instance.services = { ...services(), available: false };
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
	});

	it('refus avant envoi : message, sans bloquer l\'autre image', async () => {
		const s = services({ id_document: 4, raccourci: 'doc4' });
		const instance = monterInstance('Texte', s);
		coller(instance.editor.view.dom, presse({ files: [fichier('c.pdf', 'application/pdf'), png()] }));
		expect(instance.etat.message.textContent).toBe('Type de fichier non accepté : c.pdf.');
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(s.call).toHaveBeenCalledTimes(1);
	});

	it('échec : marqueur retiré, rien inséré, message du serveur, événement image-erreur', async () => {
		const instance = monterInstance('Texte', services(new ServiceError({ message_erreur: 'Ce type d’image n’est pas accepté.' })));
		const erreurs = [];
		instance.textarea.addEventListener('tiptap-spip:image-erreur', (e) => erreurs.push(e.detail.message));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.editor.view.dom.querySelector('.tts-envoi')).toBeNull();
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte');
		expect(instance.etat.message.textContent).toBe('Ce type d’image n’est pas accepté.');
		expect(erreurs).toEqual(['Ce type d’image n’est pas accepté.']);
	});

	it('session expirée : message générique', async () => {
		const instance = monterInstance('Texte', services(new ServiceUnavailable()));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.etat.message.textContent).toBe('L’image n’a pas pu être envoyée (session expirée ou connexion perdue).');
	});

	it('mode source : marqueurs distincts dans le textarea, remplacés chacun par son <docN>', async () => {
		const instance = monterInstance('Texte', services({ id_document: 5, raccourci: 'doc5' }, new ServiceError({ message_erreur: 'Refus' })), { mode: 'source' });
		instance.textarea.setSelectionRange(5, 5);
		coller(instance.textarea, presse({ files: [png(), png()] }));
		expect(instance.textarea.value).toMatch(/^Texte<!-- envoi tts-img-[\w-]+ --><!-- envoi tts-img-[\w-]+ -->$/);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Texte<doc5>');
		// le retour en visuel relit la source
		instance.toggleMode({ focus: false });
		expect(instance.editor.view.dom.querySelector('.tts-model')).not.toBeNull();
	});

	it('bascule de mode refusée pendant un envoi', async () => {
		const instance = monterInstance('Texte', services({ id_document: 6, raccourci: 'doc6' }));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		instance.toggleMode({ focus: false });
		expect(instance.mode()).toBe('visual');
		expect(instance.etat.message.textContent).toBe('Une image est en cours d’envoi.');
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		instance.toggleMode({ focus: false });
		expect(instance.mode()).toBe('source');
	});

	it('destruction pendant un envoi : abandon, rien inséré', async () => {
		const s = services({ id_document: 7, raccourci: 'doc7' });
		const instance = monterInstance('Texte', s);
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		const { signal } = s.call.mock.calls[0][2];
		instance.destroy();
		expect(signal.aborted).toBe(true);
	});

	it('collage dans un bloc de code : collage habituel', () => {
		const instance = monterInstance('<code class="php">\n$a;\n</code>', services());
		instance.editor.commands.setTextSelection(3);
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
	});
});
```

Lire `tests/editor/main.test.js` pour l'accès aux internes (`instance.services`, `instance.etat`). Vérifier
aussi la source d'un bloc de code reconnue par le parseur, et l'adapter si besoin : le bloc de code doit être un
`codeBlock` dans l'éditeur.

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/collerImage.test.js`
Expected: FAIL (`instance.images` indéfini).

- [ ] **Step 3 : implémentation — `CollerImages`**

À la suite de `src/editor/collerImage.js` :

```js
import { ServiceUnavailable } from '../services/cvt.js';
import { label } from '../ui/labels.js';
import { ajouterMarqueurs, progressionMarqueur, remplacerMarqueur, retirerMarqueurs } from './marqueurEnvoi.js';
```

(imports en tête du fichier), puis :

```js
let compteur = 0;
const nouvelId = () => `tts-img-${Date.now().toString(36)}-${++compteur}`;

/** Texte provisoire d'un envoi en mode source (spec 10 §1), unique par envoi. */
const marqueurSource = (id) => `<!-- envoi ${id} -->`;

/**
 * Envois des images collées d'une instance (spec 10 §1, §3). Un envoi appartient au mode où il a été
 * collé : la bascule de mode est refusée tant qu'il en reste (main.js).
 */
export class CollerImages {
	/**
	 * @param {{ textarea: HTMLTextAreaElement, editor: import('@tiptap/core').Editor,
	 *           services: () => ?import('../services/cvt.js').Services, mode: () => 'visual'|'source',
	 *           signaler: (texte: string) => void, effacer: () => void, surChangement?: () => void }} options
	 *        services : lus à chaque collage (ils peuvent arriver après l'éditeur) ;
	 *        surChangement : appelé à chaque début et fin d'envoi
	 */
	constructor({ textarea, editor, services, mode, signaler, effacer, surChangement = () => {} }) {
		Object.assign(this, { textarea, editor, services, mode, signaler, effacer, surChangement });
		/** @type {Map<string, { id: string, fichier: File, mode: string, controleur: AbortController }>} */
		this.envois = new Map();
		this.onPaste = (event) => {
			if (this.mode() === 'source' && this.coller(event.clipboardData, 'source')) event.preventDefault();
		};
		textarea.addEventListener('paste', this.onPaste);
	}

	enCours() {
		return this.envois.size;
	}

	/** handlePaste de l'éditeur visuel (sous-éditeurs de note ou de multi : collage habituel). */
	collerVisuel(view, event) {
		if (view !== this.editor.view || view.state.selection.$from.parent.type.spec.code) return false;
		return this.coller(event.clipboardData, 'visual');
	}

	/**
	 * @returns {boolean} vrai si le collage est pris en charge (le collage habituel n'a pas lieu)
	 */
	coller(donnees, mode) {
		const services = this.services();
		const config = services?.available ? services.images() : null;
		const tri = config && trierPressePapiers(donnees, config);
		if (!tri) return false;
		if (tri.refuses.length) {
			this.signaler(tri.refuses.map(({ fichier, raison }) => label(raison === 'type' ? 'image_type_refuse' : 'image_trop_grosse').replace('@nom@', fichier.name || 'image')).join(' '));
		} else {
			this.effacer();
		}
		if (!tri.envoyer.length) return false;
		const envois = tri.envoyer.map((fichier) => ({ id: nouvelId(), fichier: nommer(fichier), mode, controleur: new AbortController() }));
		if (mode === 'visual') {
			ajouterMarqueurs(this.editor.view, envois.map((e) => e.id));
		} else {
			const { selectionStart, selectionEnd } = this.textarea;
			this.textarea.setRangeText(envois.map((e) => marqueurSource(e.id)).join(''), selectionStart, selectionEnd, 'end');
			this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
		}
		for (const envoi of envois) {
			this.envois.set(envoi.id, envoi);
			this.emettre('image-recue', { fichier: envoi.fichier });
			this.envoyer(services, envoi);
		}
		this.surChangement();
		return true;
	}

	async envoyer(services, envoi) {
		const { signal } = envoi.controleur;
		try {
			const resultat = await services.call('deposer_image', {}, {
				fichier: envoi.fichier,
				signal,
				progression: (ratio) => envoi.mode === 'visual' && progressionMarqueur(this.editor.view, envoi.id, ratio),
			});
			if (signal.aborted) return;
			this.inserer(envoi, `<${resultat.raccourci}>`);
			this.emettre('image-inseree', { fichier: envoi.fichier, id_document: resultat.id_document, raccourci: resultat.raccourci });
		} catch (erreur) {
			if (signal.aborted || erreur?.name === 'AbortError') return;
			this.retirer(envoi);
			const message = erreur instanceof ServiceUnavailable || !erreur?.message ? label('image_echec') : erreur.message;
			this.signaler(message);
			this.emettre('image-erreur', { fichier: envoi.fichier, message });
		} finally {
			if (this.envois.delete(envoi.id)) this.surChangement();
		}
	}

	/** Remplace le marqueur par le raccourci ; marqueur supprimé par le rédacteur : rien. */
	inserer(envoi, raccourci) {
		if (envoi.mode === 'visual') {
			remplacerMarqueur(this.editor, envoi.id, raccourci);
			return;
		}
		this.remplacerSource(envoi.id, raccourci);
	}

	retirer(envoi) {
		if (envoi.mode === 'visual') {
			if (!this.editor.isDestroyed) retirerMarqueurs(this.editor.view, [envoi.id]);
			return;
		}
		this.remplacerSource(envoi.id, '');
	}

	/** Remplace le texte provisoire d'un envoi, sans toucher à la sélection ni aux autres marqueurs. */
	remplacerSource(id, texte) {
		const marqueur = marqueurSource(id);
		const debut = this.textarea.value.indexOf(marqueur);
		if (debut < 0) return;
		this.textarea.setRangeText(texte, debut, debut + marqueur.length, 'preserve');
		this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}

	emettre(nom, detail) {
		this.textarea.dispatchEvent(new CustomEvent(`tiptap-spip:${nom}`, { bubbles: true, detail }));
	}

	/** Abandonne les envois en cours et retire leurs marqueurs (« Enregistrer sans attendre », destruction). */
	abandonner() {
		const envois = [...this.envois.values()];
		this.envois.clear();
		for (const envoi of envois) {
			envoi.controleur.abort();
			this.retirer(envoi);
		}
		if (envois.length) this.surChangement();
	}

	destroy() {
		this.abandonner();
		this.textarea.removeEventListener('paste', this.onPaste);
	}
}
```

Libellés (DEFAUTS, langues `fr`/`en`, configuration JS) :

| clé | fr | en |
|-----|----|----|
| `image_type_refuse` | `Type de fichier non accepté : @nom@.` | `File type not accepted: @nom@.` |
| `image_trop_grosse` | `Image trop volumineuse : @nom@.` | `Image too large: @nom@.` |
| `image_echec` | `L’image n’a pas pu être envoyée (session expirée ou connexion perdue).` | `The image could not be uploaded (session expired or connection lost).` |
| `image_envoi_en_cours` | `Une image est en cours d’envoi.` | `An image is being uploaded.` |

- [ ] **Step 4 : implémentation — câblage dans `Instance` (`src/main.js`)**

Import : `import { CollerImages } from './editor/collerImage.js';`

Dans le constructeur, après la création de `this.etat` (la barre d'état doit exister) :

```js
		// images collées (spec 10) : capture toujours installée, disponibilité décidée à chaque collage
		this.images = new CollerImages({
			textarea,
			editor: this.editor,
			services: () => this.services,
			mode: () => this.bridge.mode,
			signaler: (texte) => this.etat.signaler(texte),
			effacer: () => this.etat.effacer(),
		});
		this.ui.collerImages = (view, event) => this.images.collerVisuel(view, event);
```

`toggleMode`, en tête :

```js
		// un envoi appartient au mode où l'image a été collée (spec 10 §3)
		if (this.images.enCours()) {
			this.etat.signaler(label('image_envoi_en_cours'));
			return;
		}
```

`destroy`, avant `this.etat.destroy()` : `this.images.destroy();`

- [ ] **Step 5 : vérifier**

Run: `npx vitest run`
Expected: PASS (suite complète).

- [ ] **Step 6 : commit**

```bash
npm run build
git add src/editor/collerImage.js src/main.js src/ui/labels.js tests/editor/collerImage.test.js ../tiptap_spip_config.js.html ../tiptap_spip.js ../tiptap_spip.min.js ../../../lang/tiptap_spip_*.php
git commit -m "feat: coller des images dans l'éditeur visuel et en mode source"
```

---

### Task 9 : soumission retenue pendant les envois

**Files:**
- Create: `prive/javascript/tiptap_spip/src/editor/soumission.js`
- Modify: `prive/javascript/tiptap_spip/src/main.js`
- Modify: `src/ui/labels.js`, langues, configuration JS (`image_enregistrer_sans_attendre`)
- Test: `prive/javascript/tiptap_spip/tests/editor/soumission.test.js`

**Interfaces:**
- Consumes: `CollerImages#enCours/abandonner`, option `surChangement` (Task 8) ; `StatusBar#signaler/effacer`.
- Produces:
  - `new SoumissionRetenue({ form, enCours: () => boolean, signaler: (texte, action) => void, effacer: () => void, abandonner: () => void })`
  - `#verifier()` (à appeler à chaque fin d'envoi)
  - `#destroy()`

- [ ] **Step 1 : tests qui échouent**

```js
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoumissionRetenue } from '../../src/editor/soumission.js';

let soumission;
afterEach(() => {
	soumission?.destroy();
	delete globalThis.jQuery;
	delete globalThis.cQuery;
	document.body.innerHTML = '';
});

/** Formulaire, état d'envoi pilotable et soumissions réellement parties. */
const preparer = () => {
	document.body.innerHTML = '<form><button type="submit" name="enregistrer" value="1">OK</button><button type="submit" name="autre">Autre</button></form>';
	const form = document.querySelector('form');
	const parties = [];
	// dernier écouteur : enregistre la soumission et empêche la navigation (non implémentée par jsdom)
	form.addEventListener('submit', (e) => {
		if (!e.defaultPrevented) parties.push(e.submitter?.name ?? null);
		e.preventDefault();
	});
	const etat = { envois: 1, messages: [], abandons: 0 };
	soumission = new SoumissionRetenue({
		form,
		enCours: () => etat.envois > 0,
		signaler: (texte, action) => etat.messages.push({ texte, action }),
		effacer: () => etat.messages.push(null),
		abandonner: () => { etat.abandons++; etat.envois = 0; },
	});
	return { form, parties, etat };
};

describe('SoumissionRetenue (spec 10 §3)', () => {
	it('soumission native retenue, message, puis relancée avec le même bouton après le dernier envoi', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=autre]').click();
		expect(parties).toEqual([]);
		expect(etat.messages[0].texte).toBe('Une image est en cours d’envoi.');
		expect(etat.messages[0].action.libelle).toBe('Enregistrer sans attendre');
		soumission.verifier();
		expect(parties).toEqual([]);
		etat.envois = 0;
		soumission.verifier();
		expect(parties).toEqual(['autre']);
		expect(etat.messages.at(-1)).toBeNull();
	});

	it('sans envoi en cours : rien n\'est retenu', () => {
		const { form, parties, etat } = preparer();
		etat.envois = 0;
		form.querySelector('[name=enregistrer]').click();
		expect(parties).toEqual(['enregistrer']);
	});

	it('Enregistrer sans attendre : abandon puis soumission', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		etat.messages[0].action.faire();
		expect(etat.abandons).toBe(1);
		expect(parties).toEqual(['enregistrer']);
	});

	it('destruction pendant une soumission retenue : aucune relance ensuite', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		soumission.destroy();
		etat.envois = 0;
		soumission.verifier();
		soumission.relancer();
		expect(parties).toEqual([]);
	});

	it('relance unique : un verifier() pendant sansAttendre ne soumet pas deux fois', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		// comme CollerImages : abandonner() prévient l'instance, qui appelle verifier()
		soumission.abandonner = () => {
			etat.envois = 0;
			soumission.verifier();
		};
		etat.messages[0].action.faire();
		soumission.verifier();
		expect(parties).toEqual(['enregistrer']);
	});

	it('relance sans bouton mémorisé (ajaxSubmit sans clic, bouton retiré) : requestSubmit() sans argument', () => {
		const ecouteurs = [];
		globalThis.jQuery = () => ({ on: (evt, fn) => ecouteurs.push(fn), off: vi.fn() });
		const { form, parties, etat } = preparer();
		const veto = {};
		ecouteurs[0]({ type: 'form-pre-serialize' }, form, {}, veto);
		expect(veto.veto).toBe(true);
		etat.envois = 0;
		expect(() => soumission.verifier()).not.toThrow();
		expect(parties).toEqual([null]);

		// bouton mémorisé puis retiré du DOM
		etat.envois = 1;
		const autre = form.querySelector('[name=autre]');
		autre.click();
		autre.remove();
		etat.envois = 0;
		expect(() => soumission.verifier()).not.toThrow();
		expect(parties).toEqual([null, null]);
	});

	it('formulaire AJAX (jquery.form) : form.clk rétabli pendant la relance, puis remis à null', () => {
		const ecouteurs = [];
		globalThis.jQuery = () => ({ on: (evt, fn) => ecouteurs.push(fn), off: vi.fn() });
		const { form, etat } = preparer();
		// comme ajaxForm : le clic pose form.clk, effacé ensuite ; ajaxSubmit lit form.clk dans le submit
		const lus = [];
		form.addEventListener('submit', () => lus.push(form.clk?.name ?? null));
		const autre = form.querySelector('[name=autre]');
		form.clk = autre;
		ecouteurs[0]({ type: 'form-pre-serialize' }, form, {}, {});
		form.clk = null;
		etat.envois = 0;
		soumission.verifier();
		expect(lus).toEqual(['autre']);
		expect(form.clk).toBeNull();
	});

	it('form-pre-serialize (jquery.form) : veto sur le 4e paramètre, avec jQuery et cQuery', () => {
		const ecouteurs = { jQuery: [], cQuery: [] };
		const fauxQuery = (nom) => (el) => ({ on: (evt, fn) => ecouteurs[nom].push({ evt, fn, el }), off: vi.fn() });
		globalThis.jQuery = fauxQuery('jQuery');
		globalThis.cQuery = fauxQuery('cQuery');
		const { form } = preparer();
		for (const nom of ['jQuery', 'cQuery']) {
			expect(ecouteurs[nom]).toHaveLength(1);
			expect(ecouteurs[nom][0].evt).toBe('form-pre-serialize.ttsimages');
			const options = {};
			const veto = {};
			ecouteurs[nom][0].fn({ type: 'form-pre-serialize' }, form, options, veto);
			expect(veto.veto).toBe(true);
			expect(options.veto).toBeUndefined();
		}
	});
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run tests/editor/soumission.test.js`
Expected: FAIL (module absent).

- [ ] **Step 3 : implémentation**

`src/editor/soumission.js` :

```js
import { label } from '../ui/labels.js';

/**
 * Soumission du formulaire d'édition retenue tant qu'une image est en cours d'envoi (spec 10 §3) :
 * sinon le texte enregistré contiendrait <!-- envoi… --> (mode source) ou n'aurait pas l'image
 * (visuel). Deux voies, comme pour la synchronisation du textarea (TextareaBridge) :
 * - soumission native : écouteur submit en capture ;
 * - soumission AJAX (jquery.form) : événement jQuery form-pre-serialize, reçu avec
 *   (event, $form, options, veto) ; veto.veto arrête ajaxSubmit(). Crayons a sa propre copie de
 *   jQuery (cQuery) : l'écouteur est posé avec les deux.
 * La soumission repart d'elle-même après le dernier envoi, par le bouton utilisé.
 */
export class SoumissionRetenue {
	/**
	 * @param {{ form: HTMLFormElement, enCours: () => boolean,
	 *           signaler: (texte: string, action: { libelle: string, faire: () => void }) => void,
	 *           effacer: () => void, abandonner: () => void }} options
	 */
	constructor({ form, enCours, signaler, effacer, abandonner }) {
		Object.assign(this, { form, enCours, signaler, effacer, abandonner });
		this.attente = false;
		this.bouton = null;
		this.onSubmit = (event) => {
			if (!this.retenir(event.submitter)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		form.addEventListener('submit', this.onSubmit, true);
		// jquery.form garde le bouton cliqué dans form.clk
		this.onPreSerialize = (event, $form, options, veto) => {
			if (this.retenir(form.clk) && veto) veto.veto = true;
		};
		const bibliotheques = [...new Set([globalThis.jQuery, globalThis.cQuery].filter(Boolean))];
		this.$forms = bibliotheques.map(($) => $(form));
		for (const $form of this.$forms) $form.on('form-pre-serialize.ttsimages', this.onPreSerialize);
	}

	/** Vrai si la soumission est retenue (envois en cours) ; le bouton est gardé pour la relance. */
	retenir(bouton) {
		if (!this.enCours()) return false;
		this.attente = true;
		this.bouton = bouton ?? null;
		this.signaler(label('image_envoi_en_cours'), { libelle: label('image_enregistrer_sans_attendre'), faire: () => this.sansAttendre() });
		return true;
	}

	/** À chaque fin d'envoi : la soumission retenue repart après le dernier. */
	verifier() {
		if (this.attente && !this.enCours()) this.relancer();
	}

	/**
	 * « Enregistrer sans attendre » : abandonner() prévient l'instance (surChangement), dont le
	 * verifier() relance déjà la soumission ; le relancer() qui suit ne fait alors plus rien. Il ne sert
	 * que s'il n'y avait plus d'envoi à abandonner.
	 */
	sansAttendre() {
		this.abandonner();
		this.relancer();
	}

	/**
	 * Relance unique de la soumission retenue. requestSubmit reprend la voie d'origine : le submit relance
	 * ajaxSubmit() d'un formulaire AJAX. jquery.form ne sérialise le bouton que s'il est form.clk, que
	 * son écouteur de clic remet à null 100 ms après le clic : il est rétabli le temps de la relance
	 * (ajaxSubmit sérialise de façon synchrone, dans l'écouteur submit).
	 */
	relancer() {
		if (!this.attente || this.detruite) return;
		this.attente = false;
		this.effacer();
		const bouton = this.bouton?.isConnected && this.bouton.form === this.form ? this.bouton : null;
		this.bouton = null;
		if (!bouton) {
			// requestSubmit(null) lève une TypeError
			this.form.requestSubmit();
			return;
		}
		this.form.clk = bouton;
		try {
			this.form.requestSubmit(bouton);
		} finally {
			if (this.form.clk === bouton) this.form.clk = null;
		}
	}

	/**
	 * Éditeur détruit (crayon fermé, rechargement AJAX) : la soumission retenue est annulée, aucune
	 * relance ne part ensuite, même quand l'abandon des envois appelle encore verifier().
	 */
	destroy() {
		this.detruite = true;
		this.attente = false;
		this.bouton = null;
		this.form.removeEventListener('submit', this.onSubmit, true);
		for (const $form of this.$forms) $form.off('form-pre-serialize.ttsimages', this.onPreSerialize);
	}
}
```

Câblage dans `Instance` (`src/main.js`) :
- import de `SoumissionRetenue` ;
- avant la création de `this.images`, `let soumission = null;` ;
- dans les options de `CollerImages`, `surChangement: () => { this.toolbar.maj(); soumission?.verifier(); },` ;
- après :

```js
		// soumission retenue pendant les envois (spec 10 §3)
		soumission = textarea.form ? new SoumissionRetenue({
			form: textarea.form,
			enCours: () => this.images.enCours() > 0,
			signaler: (texte, action) => this.etat.signaler(texte, action),
			effacer: () => this.etat.effacer(),
			abandonner: () => this.images.abandonner(),
		}) : null;
		this.soumission = soumission;
```

- dans `destroy`, avant `this.images.destroy()` : `this.soumission?.destroy();`. Cet ordre ne suffit pas à
  lui seul : `images.destroy()` abandonne les envois et appelle encore `surChangement()`, donc `verifier()`.
  C'est `SoumissionRetenue#destroy()` qui annule l'attente et bloque toute relance (`detruite`).

Ordre à respecter à la fin d'un envoi :
1. `CollerImages.envoyer` insère le `<docN>` ;
2. son `finally` appelle `surChangement` ;
3. `verifier()` relance la soumission ;
4. le `submit` de la relance déclenche `TextareaBridge.flush()`, qui écrit le texte avec l'image.

Le test e2e de la Task 10 vérifie cet ordre.

Libellé `image_enregistrer_sans_attendre` : « Enregistrer sans attendre » (`en` : « Save without waiting »).

Ajouter à `tests/editor/collerImage.test.js` un test d'intégration :

```js
	it('soumission pendant l\'envoi : retenue, puis partie avec le <docN>', async () => {
		const instance = monterInstance('Texte', services({ id_document: 8, raccourci: 'doc8' }));
		const parties = [];
		instance.textarea.form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.editor.view.dom, presse({ files: [fichier('', 'image/png')] }));
		instance.textarea.form.querySelector('button').click();
		expect(parties).toEqual([]);
		await vi.waitFor(() => expect(parties).toEqual(['Texte<doc8>']));
	});

	it('soumission retenue puis fermeture du crayon (destroy sans restauration) : rien n\'est soumis', async () => {
		const s = services({ id_document: 10, raccourci: 'doc10' });
		const instance = monterInstance('Texte', s);
		const parties = [];
		const form = instance.textarea.form;
		form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.editor.view.dom, presse({ files: [fichier('', 'image/png')] }));
		form.querySelector('button').click();
		instance.destroy({ restore: false });
		await tick();
		await tick();
		expect(parties).toEqual([]);
		expect(s.call.mock.calls[0][2].signal.aborted).toBe(true);
	});

	it('Enregistrer sans attendre (vrai câblage) : une seule soumission, sans l\'image ni marqueur', async () => {
		const s = services({ id_document: 9, raccourci: 'doc9' });
		const instance = monterInstance('Texte', s, { mode: 'source' });
		instance.textarea.setSelectionRange(5, 5);
		const parties = [];
		instance.textarea.form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.textarea, presse({ files: [fichier('', 'image/png')] }));
		instance.textarea.form.querySelector('button').click();
		instance.etat.element.querySelector('.tts-etat__message button').click();
		expect(parties).toEqual(['Texte']);
		await tick();
		await tick();
		expect(parties).toEqual(['Texte']);
		expect(s.call.mock.calls[0][2].signal.aborted).toBe(true);
	});
```

- [ ] **Step 4 : vérifier**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
npm run build
git add src/editor/soumission.js src/main.js src/ui/labels.js tests/editor/soumission.test.js tests/editor/collerImage.test.js ../tiptap_spip_config.js.html ../tiptap_spip.js ../tiptap_spip.min.js ../../../lang/tiptap_spip_*.php
git commit -m "feat: soumission retenue pendant l'envoi d'images collées"
```

---

### Task 10 : e2e du collage (Playwright)

**Files:**
- Modify: `prive/javascript/tiptap_spip/tests/e2e/images.e2e.js` (suite)
- Create: `tests/e2e/plugin/tts_test/formulaires/tts_test_ajax.{html,php}`, `tests/e2e/plugin/tts_test/tts_test_ajax.html`
- Modify: `tests/e2e/plugin/tts_test/tts_test_pipelines.php`

**Interfaces:**
- Consumes : tout ce qui précède ; `documents()` (Task 3) ; `enregistrer`, `module`, `selectionStable`,
  `texte` de `site.js`.

- [ ] **Step 1 : écrire les tests**

Ajouter à `images.e2e.js` (et compléter les imports : `enregistrer`, `selectionStable`, `texte`,
`publier`) :

```js
/**
 * Colle des fichiers dans l'élément : événement paste synthétique avec un vrai DataTransfer
 * (Chromium, Firefox et WebKit le construisent ; clipboardData est posé par defineProperty, que
 * ClipboardEvent n'accepte pas partout).
 */
const coller = (page, selecteur, fichiers, { html = '', texte: plain = '' } = {}) => page.evaluate(([selecteur, fichiers, html, plain, PNG]) => {
	const dt = new DataTransfer();
	for (const { nom = 'image.png', type = 'image/png', base64 = PNG } of fichiers) {
		dt.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	}
	if (html) dt.setData('text/html', html);
	if (plain) dt.setData('text/plain', plain);
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: dt });
	document.querySelector(selecteur).dispatchEvent(event);
}, [selecteur, fichiers, html, plain, PNG]);

/** Curseur à la fin du premier paragraphe de l'éditeur. */
const finDuTexte = async (page) => {
	await page.locator('.tts-editor .ProseMirror p').first().click();
	await page.keyboard.press('End');
	await selectionStable(page);
};

const envoisTermines = (page) => expect(page.locator('.tts-envoi')).toHaveCount(0);

test.describe('collage', () => {
	test('un PNG : <docN> dans le texte enregistré, document lié', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}]);
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(1);
		await envoisTermines(page);
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
		expect(doc.mode).toBe('document');
	});

	test('deux PNG en un geste : deux <docN> dans l\'ordre, deux documents', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{ nom: 'premier.png' }, { nom: 'second.png' }]);
		await expect(page.locator('.tts-envoi')).toHaveCount(2);
		await envoisTermines(page);
		const docs = documents('article', id);
		expect(docs).toHaveLength(2);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${docs[0].id_document}><doc${docs[1].id_document}>`);
	});

	test('article nouveau : documents rattachés à l\'article créé', async ({ page }) => {
		await editer(page, 'x');
		await page.goto('/ecrire/?exec=article_edit&new=oui&id_rubrique=1');
		await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
		await page.locator('input[name=titre]').fill('Article nouveau avec images');
		await page.locator('.tts-editor .ProseMirror').click();
		await coller(page, '.tts-editor .ProseMirror', [{}, {}]);
		await envoisTermines(page);
		await Promise.all([
			page.waitForURL(/exec=article&id_article=\d+/),
			page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
		]);
		const id = Number(new URL(page.url()).searchParams.get('id_article'));
		const docs = documents('article', id);
		expect(docs).toHaveLength(2);
		expect(texte(id)).toBe(docs.map((d) => `<doc${d.id_document}>`).join(''));
	});

	test('mode source : <docN> à la place du marqueur', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await page.locator('.tts-editor').getByRole('button', { name: 'Source' }).click();
		const textarea = page.locator('.tts-editor textarea');
		await textarea.focus();
		await textarea.press('End');
		await coller(page, '.tts-editor textarea', [{}]);
		await expect(textarea).toHaveValue(/^Texte<doc\d+>$/);
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('soumission pendant l\'envoi : retenue, puis relancée, sans marqueur', async ({ page }) => {
		const id = await editer(page, 'Texte');
		// envoi ralenti : la soumission arrive pendant qu'il est en cours
		await page.route(/exec=article_edit/, async (route) => {
			if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('deposer_image')) {
				await new Promise((r) => setTimeout(r, 1500));
			}
			await route.continue();
		});
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}]);
		await Promise.all([
			page.waitForURL(/exec=article&/, { timeout: 15_000 }),
			(async () => {
				await page.locator('.formulaire_editer_article .boutons [type=submit]').first().click();
				await expect(page.locator('.tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
			})(),
		]);
		const [doc] = documents('article', id);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('tableau HTML + PNG : tableau collé, rien envoyé', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{}], { html: '<table><tr><td>A</td><td>B</td></tr></table>', texte: 'A\tB' });
		await expect(page.locator('.tts-editor table')).toHaveCount(1);
		expect(documents('article', id)).toEqual([]);
	});

	test('type refusé : message, rien inséré', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await finDuTexte(page);
		await coller(page, '.tts-editor .ProseMirror', [{ nom: 'doc.pdf', type: 'application/pdf', base64: btoa('%PDF-1.4') }]);
		await expect(page.locator('.tts-etat__message')).toHaveText('Type de fichier non accepté : doc.pdf.');
		expect(documents('article', id)).toEqual([]);
	});
});

const crayons = existsSync(`${process.env.TTS_SITE}/plugins/crayons`);

test.describe('crayon', () => {
	test.skip(!crayons, 'plugin crayons absent du site');
	test.beforeAll(() => {
		activer('crayons');
		configurer('tiptap_spip/crayons', 'oui');
	});

	test('services à la demande : collage envoyé, document lié à l\'article, soumission par cQuery retenue', async ({ page }) => {
		const id = await editer(page, 'Texte du crayon.');
		publier(id);
		await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
		await module(page);
		await page.locator(`.crayon.article-texte-${id}`).dblclick();
		const editeur = page.locator('.crayon-html .tts-editor');
		await expect(editeur.locator('.ProseMirror')).toBeVisible();
		// services chargés à la demande après l'éditeur
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		await editeur.locator('.ProseMirror p').click();
		await page.keyboard.press('End');
		await selectionStable(page);
		await page.route(/spip\.php/, async (route) => {
			if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('deposer_image')) {
				await new Promise((r) => setTimeout(r, 1500));
			}
			await route.continue();
		});
		await coller(page, '.crayon-html .tts-editor .ProseMirror', [{}]);
		await page.locator('.crayon-html .crayon-submit').click();
		await expect(page.locator('.crayon-html .tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
		await expect(page.locator('.crayon-html')).toHaveCount(0, { timeout: 15_000 });
		const [doc] = documents('article', id);
		expect(texte(id)).toBe(`Texte du crayon.<doc${doc.id_document}>`);
	});
});
```

Le test du crayon vérifie que le crayon enregistre bien après la reprise. Il ne prouve rien sur le
bouton : `.crayon-submit` n'a pas de nom (`crayons.js` le relie à `trigger("submit")` sur le
formulaire). Ajouter au même `describe` un test de fermeture :

```js
	test('soumission retenue puis fermeture du crayon : rien n\'est enregistré', async ({ page }) => {
		// même préparation que le test précédent (article public, crayon ouvert, envoi ralenti), puis :
		await coller(page, '.crayon-html .tts-editor .ProseMirror', [{}]);
		await page.locator('.crayon-html .crayon-submit').click();
		await page.locator('.crayon-html .crayon-cancel').click();
		await expect(page.locator('.crayon-html')).toHaveCount(0);
		await page.waitForTimeout(2500);
		expect(texte(id)).toBe('Texte du crayon.');
	});
```

(factoriser la préparation des deux tests du crayon dans une fonction locale `ouvrirCrayon(page)`, qui
renvoie l'`id`).

**Bouton conservé à la reprise d'un formulaire AJAX** : un vrai formulaire AJAX à deux boutons
`type="submit"` nommés, dans le plugin de test `tests/e2e/plugin/tts_test` (lien symbolique dans
`plugins/` des sites jetables).

- `tests/e2e/plugin/tts_test/formulaires/tts_test_ajax.html` :

```html
<div class="formulaire_spip formulaire_tts_test_ajax">
	[<p class="reponse_formulaire reponse_formulaire_ok" role="status">(#ENV*{message_ok})</p>]
	[(#ENV{editable}|oui)
	<form method="post" action="#ENV{action}"><div>
		#ACTION_FORMULAIRE
		<textarea name="texte" rows="5">#ENV{texte}</textarea>
		<p class="boutons">
			<button type="submit" name="brouillon" value="b">Brouillon</button>
			<button type="submit" name="publier" value="p">Publier</button>
		</p>
	</div></form>
	]
</div>
```

- `tests/e2e/plugin/tts_test/formulaires/tts_test_ajax.php` :

```php
<?php

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Formulaire public AJAX de test : deux boutons nommés ; la réponse dit lequel a été posté, et le texte. */
function formulaires_tts_test_ajax_charger_dist($id_article) {
	return ['texte' => '', 'editable' => true];
}

function formulaires_tts_test_ajax_traiter_dist($id_article) {
	$bouton = _request('publier') === 'p' ? 'publier' : (_request('brouillon') === 'b' ? 'brouillon' : 'aucun');
	// message_ok est affiché par #ENV* : texte échappé, sinon <docN> serait lu comme une balise
	return ['message_ok' => 'Bouton : ' . $bouton . ' ; texte : ' . htmlspecialchars((string) _request('texte')), 'editable' => true];
}
```

- `tests/e2e/plugin/tts_test/tts_test_ajax.html` : copie de `tts_test.html` où le formulaire est inclus en
  AJAX, `<div class="ajax">#FORMULAIRE_TTS_TEST_AJAX{#ENV{id_article}}</div>`.
- `tts_test_pipelines.php` : déclarer aussi `tts_test_ajax` dans `tts_test_tiptap_spip_contextes`, avec la
  même fonction de contexte. Le champ `texte` est lié à l'article : services et collage d'images sont
  disponibles.

Test (dans `describe('collage')`) :

```js
	test('formulaire AJAX à deux boutons : la reprise poste le bouton cliqué', async ({ page }) => {
		const id = await editer(page, 'x');
		configurer('tiptap_spip/public', 'oui');
		activer('tts_test');
		await page.goto(`/spip.php?page=tts_test_ajax&id_article=${id}&var_mode=calcul`);
		await expect(page.locator('.formulaire_tts_test_ajax .tts-editor .ProseMirror')).toBeVisible();
		await module(page);
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		await page.route(/spip\.php/, async (route) => {
			if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('deposer_image')) {
				await new Promise((r) => setTimeout(r, 1500));
			}
			await route.continue();
		});
		await page.locator('.formulaire_tts_test_ajax .ProseMirror').click();
		await coller(page, '.formulaire_tts_test_ajax .ProseMirror', [{}]);
		await page.getByRole('button', { name: 'Publier' }).click();
		await expect(page.locator('.formulaire_tts_test_ajax .tts-etat__message')).toHaveText(/Une image est en cours d’envoi/);
		// réponse AJAX : le formulaire est rechargé dans la page, sans navigation
		await expect(page.locator('.formulaire_tts_test_ajax .reponse_formulaire_ok')).toHaveText(/^Bouton : publier ; texte : <doc\d+>$/, { timeout: 15_000 });
	});
```

Avant d'écrire ce test, vérifier dans la page que le formulaire est bien soumis par `ajaxSubmit()` (une
requête XHR `var_ajax=form`, pas de navigation). Sans la restauration de `form.clk` dans `relancer()`,
le message doit afficher `Bouton : aucun`. Le vérifier une fois en commentant la restauration : c'est la
preuve que le test mesure le défaut.

Si l'article doit être publié pour que la page publique le montre, appeler `publier(id)` avant le
`goto`.

Points à vérifier au premier passage :
- l'URL `action` du formulaire de services dans l'espace privé (`exec=article_edit…`) : c'est ce que la route
  intercepte. Si la route n'attrape rien, lire l'URL dans `.tts-services form[action]` et l'adapter ;
- le nom accessible du bouton de mode (`Source`, libellé `mode_source`) ;
- le crayon : `page.route` ralentit les POST `deposer_image` vers la page de services à la demande
  (`spip.php?page=tiptap_spip_services` puis l'`action` de son formulaire). Adapter le motif à l'URL
  observée.

- [ ] **Step 2 : lancer sur 4.4 (Chromium) et corriger**

```bash
cd prive/javascript/tiptap_spip
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images --project=chromium
```

Expected: PASS. Un échec révèle soit un défaut d'implémentation, à corriger dans la tâche concernée avec son
test Vitest, soit un sélecteur mal deviné ci-dessus, à corriger ici.

- [ ] **Step 3 : trois navigateurs, trois versions de SPIP**

```bash
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test images
TTS_SITE=/src/jetables/v4.2.16 TTS_URL=http://127.0.0.1:18932 TTS_PHP=php8.3 npx playwright test images
TTS_SITE=/src/jetables/v5.0-dev TTS_URL=http://127.0.0.1:18933 TTS_PHP=php8.4 npx playwright test images
```

Expected: PASS (crayon sauté sur SPIP 5). Puis lancer la suite e2e complète en Chromium sur 4.4, pour
vérifier l'absence de régression :

```bash
TTS_SITE=/src/jetables/v4.4.21 TTS_URL=http://127.0.0.1:18931 npx playwright test --project=chromium
```

- [ ] **Step 4 : commit**

```bash
git add tests/e2e/images.e2e.js ../../../tests/e2e/plugin/tts_test
git commit -m "test: e2e du collage d'images (visuel, source, article nouveau, AJAX, crayon)"
```

---

### Task 11 : documentation

**Files:**
- Modify: `docs/specs/10-coller-images.md`, `docs/specs/02-architecture.md`, `docs/specs/07-extensibilite.md`, `docs/specs/09-lots-roadmap.md`, `CHANGELOG.md`

- [ ] **Step 1 : spec 10**
  - §3 : bascule de mode refusée pendant un envoi ; collage dans un bloc de code laissé au collage habituel ;
    marqueur supprimé à la main en mode source → rien inséré.
  - §6 : l'annonce se fait par `data-tts-images` sur le `<form>` de services (renouvelé à chaque réponse).
  - §7 : quels cas sont en PHPUnit, lesquels en e2e (décision 1), fixtures enregistrées (décision 6).
  - §5 : retirer « À vérifier sur SPIP 4.2, 4.4 et 5 » et noter le résultat de la Task 3.
  - Nouvelle section « Réalisation » en fin de spec, sur le modèle des plans précédents : fichiers, écarts,
    résultats e2e par site et navigateur.
- [ ] **Step 2 : spec 02 §5** : « Opération prévue au lot L7.1 » devient une ligne du tableau des
  opérations ; mentionner l'envoi par XHR (progression, abandon).
- [ ] **Step 3 : spec 07** : les trois événements `tiptap-spip:image-*` et leur `detail`
  (`{ fichier }`, `{ fichier, id_document, raccourci }`, `{ fichier, message }`).
- [ ] **Step 4 : spec 09** : L7.1 marqué réalisé, comme les lots précédents.
- [ ] **Step 5 : CHANGELOG**, sous « Ajouté » :

```markdown
- Coller une ou plusieurs images (capture d'écran, image copiée) dans l'éditeur, visuel ou source :
  chaque image devient un document de l'objet, inséré en `<docN>` à l'endroit du collage. Réglage
  « Coller des images » dans la configuration de l'éditeur (actif par défaut).
```

- [ ] **Step 6 : vérifier, committer, pousser, demande de fusion**

```bash
cd /src/tiptap-spip && vendor/bin/phpunit && (cd prive/javascript/tiptap_spip && npx vitest run)
git add docs CHANGELOG.md
git commit -m "docs: collage d'images réalisé (spec 10, 02, 07, 09)"
git push -u origin feat/coller-images
glab mr create --target-branch main --title "Coller des images dans l'éditeur (L7.1)" --description "Réf. #4

Collage d'une ou plusieurs images, dans l'éditeur visuel ou en mode source : un document SPIP lié à l'objet et un \`<docN>\` par image, dans l'ordre. Opération \`deposer_image\` du formulaire de services ; soumission retenue pendant les envois.

Tests : PHPUnit, Vitest, e2e sur SPIP 4.2, 4.4 et 5 (Chromium, Firefox, WebKit)."
```

Pas de mention « Generated with Claude Code », pas de trailer.

---

## Couverture de la spec (auto-revue)

| Spec 10 | Tâche |
|---------|-------|
| §1 marqueur, saisie libre, `<docN>`, Ctrl+Z, échec sans insertion, plusieurs images, file sérialisée, mode source | 7, 8 (+ 4 pour la file) |
| §2 renommage `capture-…`, événements | 5, 8 |
| §3 capture toujours installée, décision à chaque collage, services tardifs | 7, 8 |
| §3 arbitrage (5 lignes du tableau) | 5 |
| §3 liste blanche, taille avant envoi | 2, 3, 5 |
| §3 marqueur décoration, mapping, repli, abandon à la destruction | 7, 8 |
| §3 soumission retenue (native, `form-pre-serialize` jQuery + cQuery, relance par le bouton, « sans attendre ») | 9, 10 |
| §3 envoi XHR avec progression | 4 |
| §4 `<docN>` en ligne, `spipModel` ordinaire | 7 |
| §5 contrôles `verifier()`, ajout en mode `document`, objet nouveau `-id_auteur`, disponibilité, forums | 2, 3 |
| §6 configuration `coller_images`, annonce au JS | 1, 3 |
| §7 Vitest, Vitest CVT, PHPUnit, Playwright | 2, 4–10 (écarts : décisions 1 et 6) |
| §8 (L7.2, glisser-déposer) | hors de ce plan |
