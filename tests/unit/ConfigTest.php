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

	public function testSansPluginDIntertitresHierarchiques(): void {
		$this->assertNull(tiptap_spip_intertitres());
		$this->assertSame([2, 3, 4], tiptap_spip_niveaux_defaut());
	}

	public function testIntertitresDEnluminuresTypographiques(): void {
		$GLOBALS['_test_plugins'][] = 'typoenluminee';
		$this->assertSame([1 => 3, 2 => 4, 3 => 5, 4 => 6, 5 => null], tiptap_spip_intertitres());
		$this->assertSame([3, 4, 5, 6], tiptap_spip_config()['niveaux']);

		// balises de sa configuration : un rendu qui n'est pas un titre h2 à h6 vaut null
		$GLOBALS['_test_config']['bte/titraille1open'] = '<h2 class="spip">';
		$GLOBALS['_test_config']['bte/titraille2open'] = '<p class="chapeau">';
		$GLOBALS['_test_config']['bte/titraille4open'] = '<h1>';
		$this->assertSame([1 => 2, 2 => null, 3 => 5, 4 => null, 5 => null], tiptap_spip_intertitres());

		// globales debut_intertitre… si config_intertitre est posée
		$GLOBALS['config_intertitre'] = true;
		$GLOBALS['debut_intertitre'] = '<h4 class="spip">';
		$this->assertSame([1 => 4, 2 => 4, 3 => 5, 4 => 6, 5 => null], tiptap_spip_intertitres());

		// niveaux choisis dans la configuration de l'éditeur : conservés
		$GLOBALS['_test_config']['tiptap_spip'] = ['niveaux' => [2, 3]];
		$this->assertSame([2, 3], tiptap_spip_config()['niveaux']);
	}

	public function testIntertitresHierarchiques(): void {
		$GLOBALS['_test_plugins'][] = 'porte_plume_intertitres';
		$this->assertSame([1 => 2, 2 => 3, 3 => 4, 4 => 5, 5 => 6], tiptap_spip_intertitres());
		$this->assertSame([2, 3, 4, 5, 6], tiptap_spip_niveaux_defaut());

		// niveau de départ de la globale debut_intertitre ; au-delà de h6, un div
		$GLOBALS['debut_intertitre'] = '<h3 class="spip">';
		$this->assertSame([1 => 3, 2 => 4, 3 => 5, 4 => 6, 5 => null], tiptap_spip_intertitres());

		// Enluminures typographiques l'emporte : il remplace les raccourcis avant TextWheel
		$GLOBALS['_test_plugins'][] = 'typoenluminee';
		$this->assertSame([1 => 3, 2 => 4, 3 => 5, 4 => 6, 5 => null], tiptap_spip_intertitres());
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
			'{"public":false,"crayons":true,"mode":"source","niveaux":[2,5],"intertitres":null,"champs":{"article":["descriptif","chapo","texte","ps"],"auteur":[],"syndic_article":[]},"multilingue":false,"langues":[]}',
			tiptap_spip_config_js()
		);

		// table des intertitres hiérarchiques : un objet pour le JS (clés 1 à 5)
		$GLOBALS['_test_plugins'][] = 'typoenluminee';
		$this->assertStringContainsString('"intertitres":{"1":3,"2":4,"3":5,"4":6,"5":null}', tiptap_spip_config_js());
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

	public function testLanguesActiveesSinonLangueDuSite(): void {
		$GLOBALS['meta']['langue_site'] = 'fr';
		$this->assertSame([['code' => 'fr', 'nom' => 'français']], tiptap_spip_langues());
		$GLOBALS['meta']['langues_multilingue'] = 'en, fr,en,xx';
		$this->assertSame(
			[['code' => 'en', 'nom' => 'English'], ['code' => 'fr', 'nom' => 'français'], ['code' => 'xx', 'nom' => 'xx']],
			tiptap_spip_langues()
		);
		// codes que SPIP ne lit pas dans un multi : écartés, et le site reste monolingue
		$GLOBALS['meta']['langues_multilingue'] = 'fr,sh_latn,ber_tam_tfng';
		$this->assertSame([['code' => 'fr', 'nom' => 'français']], tiptap_spip_langues());
		$this->assertFalse(tiptap_spip_multilingue());
		unset($GLOBALS['meta']['langues_multilingue'], $GLOBALS['meta']['langue_site']);
	}
}
