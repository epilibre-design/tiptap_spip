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
