<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/inc/tiptap_spip_depot.php';

final class DepotTest extends TestCase
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
			['extension' => 'odt', 'mime_type' => 'application/vnd.oasis.opendocument.text'],
			// ligne que medias ne reconnaît pas : il corrige .jpeg en .jpg avant de chercher
			['extension' => 'jpeg', 'mime_type' => 'image/jpeg'],
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

	public function testTypesRecoupesAvecLaListeBlanche(): void {
		$this->assertSame(self::TYPES, tiptap_spip_images_types());
		$GLOBALS['_test_sql']['spip_types_documents'] = [['extension' => 'png', 'mime_type' => 'image/png']];
		$this->assertSame(['png' => 'image/png'], tiptap_spip_images_types());
	}

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

	public function testDeposerEnModeDocument(): void {
		$appels = [];
		$GLOBALS['visiteur_session'] = ['id_auteur' => 3];
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static function (...$args) use (&$appels) {
			$appels[] = $args;
			return [42];
		};
		$fichier = $this->fichier('capture.png', base64_decode(self::PNG));
		$this->assertSame(['id_document' => 42, 'raccourci' => 'doc42'], tiptap_spip_deposer_document($fichier, 'article', 0));
		$this->assertSame(['new', [['tmp_name' => $fichier['tmp_name'], 'name' => 'capture.png']], 'article', -3, 'document'], $appels[0]);
	}

	public function testDeposerRendLeMessageDeMedias(): void {
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static fn () => ['Image trop grande (5000 px)'];
		$this->assertSame('Image trop grande (5000 px)', tiptap_spip_deposer_document($this->fichier('a.png', 'x'), 'article', 12));
		$GLOBALS['_test_fonctions']['action/ajouter_documents'] = static fn () => [false];
		$this->assertSame(_T('tiptap_spip:erreur_depot_ajout'), tiptap_spip_deposer_document($this->fichier('a.png', 'x'), 'article', 12));
	}
}
