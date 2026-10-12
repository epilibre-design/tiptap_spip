<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_fonctions.php';
require_once dirname(__DIR__, 2) . '/formulaires/configurer_tiptap_spip.php';

// glossaires nommés du site
function glossaire_wikipedia() {
}

function glossaire_mots() {
}

final class ConfigurerTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
	}

	public function testChargerLaConfigurationEtLesChoixPossibles(): void {
		$GLOBALS['_test_config']['tiptap_spip'] = ['crayons' => 'oui', 'champs' => ['article' => ['texte']]];
		$valeurs = formulaires_configurer_tiptap_spip_charger_dist();

		$this->assertSame('non', $valeurs['public']);
		$this->assertSame('oui', $valeurs['crayons']);
		$this->assertSame('visual', $valeurs['mode']);
		$this->assertSame([2, 3, 4], $valeurs['niveaux']);
		$this->assertSame(['article' => ['texte'], 'auteur' => ['bio'], 'syndic_article' => []], $valeurs['champs']);
		$this->assertSame(['mots', 'wikipedia'], $valeurs['glossaires']);
		// objets sans champ candidat : pas proposés
		$this->assertSame(['article', 'auteur'], array_keys($valeurs['_objets']));
		$this->assertSame('public:articles', $valeurs['_objets']['article']['titre']);
		$this->assertSame(['descriptif' => 'tiptap_spip:champ_descriptif', 'chapo' => 'tiptap_spip:champ_chapo', 'texte' => 'tiptap_spip:champ_texte', 'ps' => 'tiptap_spip:champ_ps'], $valeurs['_objets']['article']['champs']);
		$this->assertSame([2, 3, 4, 5, 6], $valeurs['_niveaux']);
		$this->assertSame(['mots', 'wikipedia'], $valeurs['_glossaires']);
	}

	public function testVerifierRefuseLesValeursHorsListe(): void {
		$GLOBALS['_test_request'] = ['mode' => 'source', 'niveaux' => ['2', '5'], 'champs' => ['article' => ['texte']], 'glossaires' => ['mots']];
		$this->assertSame([], formulaires_configurer_tiptap_spip_verifier_dist());

		$GLOBALS['_test_request'] = ['mode' => 'autre', 'niveaux' => [], 'champs' => ['article' => ['titre'], 'forum' => ['texte']], 'glossaires' => ['inconnu']];
		$this->assertSame(
			['mode', 'niveaux', 'champs', 'glossaires'],
			array_keys(formulaires_configurer_tiptap_spip_verifier_dist())
		);
		$GLOBALS['_test_request']['niveaux'] = ['1', '3'];
		$this->assertArrayHasKey('niveaux', formulaires_configurer_tiptap_spip_verifier_dist());
	}

	public function testTraiterEcritLaMeta(): void {
		$GLOBALS['_test_request'] = ['public' => 'oui', 'mode' => 'source', 'niveaux' => ['2', '5'], 'champs' => ['article' => ['texte', 'ps']]];
		$retour = formulaires_configurer_tiptap_spip_traiter_dist();

		$this->assertSame('config_info_enregistree', $retour['message_ok']);
		$this->assertTrue($retour['editable']);
		// objet sans case cochée : aucun champ ; glossaires sans case cochée : aucun glossaire nommé
		$this->assertSame(
			['public' => 'oui', 'crayons' => 'non', 'mode' => 'source', 'niveaux' => [2, 5], 'champs' => ['article' => ['texte', 'ps'], 'auteur' => []], 'glossaires' => []],
			$GLOBALS['_test_config']['tiptap_spip']
		);
		$this->assertSame(['texte', 'ps'], tiptap_spip_champs('article'));
	}

}
