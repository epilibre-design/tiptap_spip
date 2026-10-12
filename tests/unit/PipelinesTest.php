<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_pipelines.php';

final class PipelinesTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
		$GLOBALS['_test_fonds']['prive/javascript/_inits/09_tiptap_spip_config.js'] = 'window.spipConfig ??= {};';
		$GLOBALS['_test_chemins'] = [
			'prive/javascript/tiptap_spip.min.js' => 'plugins/tiptap_spip/prive/javascript/tiptap_spip.min.js',
			'prive/javascript/tiptap_spip.js' => 'plugins/tiptap_spip/prive/javascript/tiptap_spip.js',
			'css/tiptap_spip.css' => 'plugins/tiptap_spip/css/tiptap_spip.css',
		];
	}

	public function testHeaderPriveSpip4ChargeConfigCssEtModule(): void {
		$flux = tiptap_spip_header_prive('<head>');

		$this->assertStringStartsWith('<head>', $flux);
		$this->assertStringContainsString('<script>' . "\n" . 'window.spipConfig ??= {};', $flux);
		$this->assertStringContainsString('href="plugins/tiptap_spip/css/tiptap_spip.css?1700000000"', $flux);
		$this->assertStringContainsString(
			"import { tiptap_spip_init } from '//exemple.test/plugins/tiptap_spip/prive/javascript/tiptap_spip.min.js?1700000000';",
			$flux
		);
		$this->assertStringContainsString('onAjaxLoad(function () { tiptap_spip_init(this); });', $flux);
	}

	public function testHeaderPriveSansBundleMinifiePrendLeBundleNormal(): void {
		unset($GLOBALS['_test_chemins']['prive/javascript/tiptap_spip.min.js']);

		$this->assertStringContainsString('/prive/javascript/tiptap_spip.js?', tiptap_spip_header_prive(''));
	}

	public function testHeaderPriveSansBundleNeChargeRien(): void {
		$GLOBALS['_test_chemins'] = [];

		$this->assertSame('<head>', tiptap_spip_header_prive('<head>'));
	}

	public function testHeaderPriveSpip5LaissePasserLeFlux(): void {
		$GLOBALS['spip_version_branche'] = '5.0.0';

		$this->assertSame('<head>', tiptap_spip_header_prive('<head>'));
	}

	public function testConfigurationCalculeeSelonLEspace(): void {
		$contextes = [];
		$GLOBALS['_test_fonds']['prive/javascript/_inits/09_tiptap_spip_config.js'] = static function (array $c) use (&$contextes) {
			$contextes[] = $c;
			return 'window.spipConfig ??= {};';
		};
		$GLOBALS['_test_chemins']['css/tiptap_spip_contenu.css'] = 'plugins/tiptap_spip/css/tiptap_spip_contenu.css';
		$GLOBALS['_test_config']['tiptap_spip'] = ['public' => 'oui'];

		$prive = tiptap_spip_header_prive('');
		tiptap_spip_insert_head('');

		$this->assertSame([['prive' => 'oui'], ['prive' => 'non']], $contextes);
		$this->assertStringContainsString('href="plugins/tiptap_spip/css/tiptap_spip_contenu.css?1700000000"', $prive);
	}

	public function testSitePublicSeulementSiActive(): void {
		$this->assertSame('<head>', tiptap_spip_insert_head('<head>'));

		$GLOBALS['_test_config']['tiptap_spip'] = ['public' => 'oui'];
		$this->assertStringContainsString('tiptap_spip_init();', tiptap_spip_insert_head('<head>'));
	}

	public function testImportmapDeclareLeBundle(): void {
		$flux = tiptap_spip_importmap(['args' => [], 'data' => ['autre.js']]);

		$this->assertSame(['autre.js', 'tiptap_spip.js'], $flux['data']);
	}
}
