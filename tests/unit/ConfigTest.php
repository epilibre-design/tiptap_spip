<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;


final class ConfigTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
	}

	public function testDefautsSansConfiguration(): void {
		$this->assertSame(
			['public' => 'non', 'crayons' => 'non', 'mode' => 'visual', 'niveaux' => [2, 3, 4], 'champs' => null, 'glossaires' => null],
			tiptap_spip_config()
		);
	}

	public function testValeursInvalidesRemplaceesParLesDefauts(): void {
		$GLOBALS['_test_config']['tiptap_spip'] = ['public' => 'oui', 'mode' => 'autre', 'niveaux' => ['1', '3', 9], 'champs' => 'x', 'glossaires' => ['mots', 3]];
		$config = tiptap_spip_config();

		$this->assertSame('oui', $config['public']);
		$this->assertSame('visual', $config['mode']);
		$this->assertSame([3], $config['niveaux']);
		$this->assertNull($config['champs']);
		$this->assertSame(['mots'], $config['glossaires']);

		$GLOBALS['_test_config']['tiptap_spip'] = ['mode' => 'source', 'niveaux' => [1, 7]];
		$this->assertSame('source', tiptap_spip_config()['mode']);
		$this->assertSame([2, 3, 4], tiptap_spip_config()['niveaux']);
	}

	public function testChampsCandidatsTraitesParPropre(): void {
		$this->assertSame(
			['article' => ['descriptif', 'chapo', 'texte', 'ps'], 'auteur' => ['bio'], 'syndic_article' => []],
			tiptap_spip_champs_candidats()
		);
	}

	public function testChampsEquipesSelonLaConfiguration(): void {
		$this->assertSame(['descriptif', 'chapo', 'texte', 'ps'], tiptap_spip_champs('article'));
		$this->assertNull(tiptap_spip_champs('forum'));
		$this->assertNull(tiptap_spip_champs('inconnu'));

		$GLOBALS['_test_config']['tiptap_spip'] = ['champs' => ['article' => ['texte', 'titre', 'ps'], 'auteur' => []]];
		$this->assertSame(['texte', 'ps'], tiptap_spip_champs('article'));
		$this->assertSame([], tiptap_spip_champs('auteur'));
		$this->assertSame(['article' => ['texte', 'ps'], 'auteur' => [], 'syndic_article' => []], tiptap_spip_champs_par_objet());
	}

	public function testConfigurationJs(): void {
		$GLOBALS['_test_config']['tiptap_spip'] = ['crayons' => 'oui', 'mode' => 'source', 'niveaux' => [2, 5], 'champs' => ['auteur' => []]];

		$this->assertSame(
			'{"public":false,"crayons":true,"mode":"source","niveaux":[2,5],"champs":{"article":["descriptif","chapo","texte","ps"],"auteur":[],"syndic_article":[]},"multilingue":false}',
			tiptap_spip_config_js()
		);
	}

	public function testMultilingueAPartirDeDeuxLangues(): void {
		unset($GLOBALS['meta']['langues_multilingue']);
		$this->assertFalse(tiptap_spip_multilingue());
		$GLOBALS['meta']['langues_multilingue'] = '';
		$this->assertFalse(tiptap_spip_multilingue());
		$GLOBALS['meta']['langues_multilingue'] = 'fr';
		$this->assertFalse(tiptap_spip_multilingue());
		$GLOBALS['meta']['langues_multilingue'] = 'fr,en';
		$this->assertTrue(tiptap_spip_multilingue());
		unset($GLOBALS['meta']['langues_multilingue']);
	}
}
