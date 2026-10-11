<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_pipelines.php';

final class FormulaireFondTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
		$GLOBALS['_test_fonds']['inclure/tiptap_spip_services'] = static fn (array $c) => sprintf(
			'<div class="tts-services" hidden data-tts-instance="" data-tts-objet="%s" data-tts-id="%d" data-tts-champ="%s"><form></form></div>',
			$c['objet'],
			$c['id_objet'],
			$c['champ']
		);
	}

	private static function flux(string $form, array $args): array {
		return ['args' => ['form' => $form, 'args' => $args], 'data' => '<div><form action="x"><textarea name="texte"></textarea></form></div>'];
	}

	public function testServicesApresLeFormulaireAvecLeMemeIdentifiantDInstance(): void {
		$data = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];

		$this->assertMatchesRegularExpression('/^<div><form data-tts-instance="(tts-[0-9a-f]{12})" action="x">/', $data);
		preg_match('/data-tts-instance="(tts-[0-9a-f]{12})"/', $data, $m);
		$apres = substr($data, strpos($data, '</form></div>') + strlen('</form></div>'));
		$this->assertStringStartsWith('<div class="tts-services" hidden data-tts-instance="' . $m[1] . '" data-tts-objet="article" data-tts-id="12" data-tts-champ="texte">', $apres);
	}

	public function testIdentifiantDifferentAChaqueCalcul(): void {
		$a = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];
		$b = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];

		preg_match('/tts-[0-9a-f]{12}/', $a, $ma);
		preg_match('/tts-[0-9a-f]{12}/', $b, $mb);
		$this->assertNotSame($ma[0], $mb[0]);
	}

	public function testNouvelObjetIdZero(): void {
		$data = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 'oui']))['data'];

		$this->assertStringContainsString('data-tts-id="0"', $data);
	}

	public function testAutresFormulairesInchanges(): void {
		$flux = self::flux('forum', ['article', 3]);

		$this->assertSame($flux, tiptap_spip_formulaire_fond($flux));
	}

	public function testSansServicesRendusRienNeChange(): void {
		$GLOBALS['_test_fonds']['inclure/tiptap_spip_services'] = '  ';
		$flux = self::flux('editer_article', ['type' => 'article', 'id' => 12]);

		$this->assertSame($flux, tiptap_spip_formulaire_fond($flux));
	}
}
