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

	private static function fluxCvt(string $form, array $args, string $html): array {
		return ['args' => ['form' => $form, 'args' => $args, 'contexte' => []], 'data' => $html];
	}

	public function testFormulaireDeclareParTiptapSpipContextes(): void {
		$GLOBALS['_test_pipelines']['tiptap_spip_contextes'] = static fn (array $c) => $c + [
			'contact_article' => static fn (array $args) => ['objet' => 'article', 'id_objet' => $args[0], 'champs' => ['message']],
		];
		$html = '<form action="x"><textarea name="message"></textarea><textarea name="autre"></textarea></form>';

		$data = tiptap_spip_formulaire_fond(self::fluxCvt('contact_article', [7], $html))['data'];

		$this->assertStringContainsString('<textarea data-tts-toolbar="minimale" name="message">', $data);
		$this->assertStringContainsString('<textarea name="autre">', $data);
		$this->assertStringContainsString('data-tts-objet="article" data-tts-id="7" data-tts-champ="message"', $data);
		$this->assertMatchesRegularExpression('/^<form data-tts-instance="tts-[0-9a-f]{12}"/', $data);
	}

	public function testBarreDejaIndiqueeConservee(): void {
		$GLOBALS['_test_pipelines']['tiptap_spip_contextes'] = static fn (array $c) => $c + [
			'contact' => static fn () => ['objet' => '', 'champs' => ['message']],
		];
		$html = "<form><textarea data-tts-toolbar='forum' name='message'></textarea></form>";

		$data = tiptap_spip_formulaire_fond(self::fluxCvt('contact', [], $html))['data'];

		$this->assertStringContainsString("<textarea data-tts-toolbar='forum' name='message'>", $data);
		$this->assertSame(1, substr_count($data, 'data-tts-toolbar'));
	}

	public function testReglagesDIdentiteSansObjetParDefaut(): void {
		$html = "<form><textarea name='descriptif_site' id='descriptif_site' rows='7'></textarea></form>";

		$data = tiptap_spip_formulaire_fond(self::fluxCvt('configurer_identite', [], $html))['data'];

		$this->assertStringContainsString('<textarea data-tts-toolbar="minimale" name=\'descriptif_site\'', $data);
		$this->assertStringContainsString('data-tts-objet="" data-tts-id="0" data-tts-champ="descriptif_site"', $data);
	}

	public function testContexteNulOuFormulaireNonDeclare(): void {
		$GLOBALS['_test_pipelines']['tiptap_spip_contextes'] = static fn (array $c) => $c + ['vide' => static fn () => null];
		foreach (['vide', 'inconnu', 'tiptap_spip'] as $form) {
			$flux = self::fluxCvt($form, [], '<form><textarea name="texte"></textarea></form>');
			$this->assertSame($flux, tiptap_spip_formulaire_fond($flux), $form);
		}
	}
}
