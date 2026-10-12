<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/inc/tiptap_spip_modeles.php';
require_once dirname(__DIR__, 2) . '/tiptap_spip_fonctions.php';

final class ModelesTest extends TestCase
{
	/** Saisies de modeles/media.yaml du plugin Insérer modèles (2.4.1), libellés retirés. */
	private const MEDIA = [
		['saisie' => 'hidden', 'options' => ['nom' => 'modele', 'defaut' => 'doc']],
		['saisie' => 'selecteur_document', 'options' => ['nom' => 'id_modele', 'obligatoire' => 'oui']],
		['saisie' => 'selection', 'options' => ['nom' => 'align', 'data' => ['left' => 'à gauche', 'center' => 'centré', 'right' => 'à droite']]],
		['saisie' => 'input', 'options' => ['nom' => 'largeur']],
		['saisie' => 'input', 'options' => ['nom' => 'hauteur']],
		['saisie' => 'checkbox', 'options' => ['nom' => 'masquer', 'data' => ['legende' => 'l', 'titre' => 't']]],
		['saisie' => 'input', 'options' => ['nom' => 'titre']],
	];

	protected function setUp(): void {
		test_reset_globals();
	}

	public function testDecritLeModeleProduitEtSesChamps(): void {
		$this->assertSame([
			'modele' => 'doc',
			'id' => 'id_modele',
			'champs' => ['align', 'largeur', 'hauteur', 'masquer', 'titre'],
			'valeurs' => ['left' => 'align', 'center' => 'align', 'right' => 'align'],
			'multiples' => ['masquer'],
		], tiptap_spip_decrire_formulaire_modele(self::MEDIA));
	}

	public function testValeursNuesSeulementPourAlignVarianteEtClasse(): void {
		// le plugin n'écrit une valeur seule (|left) que pour align, variante et classe : les autres
		// choix s'écrivent champ=valeur
		$description = tiptap_spip_decrire_formulaire_modele([
			['saisie' => 'hidden', 'options' => ['nom' => 'modele', 'defaut' => 'carte']],
			['saisie' => 'radio', 'options' => ['nom' => 'variante', 'data' => ['mini' => 'm']]],
			['saisie' => 'radio', 'options' => ['nom' => 'zoom', 'data' => ['3' => 'trois']]],
		]);

		$this->assertSame(['mini' => 'variante'], $description['valeurs']);
		$this->assertNull($description['id']);
	}

	public function testSaisiesImbriquees(): void {
		$description = tiptap_spip_decrire_formulaire_modele([
			['saisie' => 'fieldset', 'options' => ['nom' => 'groupe'], 'saisies' => [
				['saisie' => 'hidden', 'options' => ['nom' => 'modele', 'defaut' => 'img']],
				['saisie' => 'input', 'options' => ['nom' => 'id_modele']],
				['saisie' => 'input', 'options' => ['nom' => 'alt']],
			]],
		]);

		$this->assertSame('img', $description['modele']);
		$this->assertSame(['alt'], $description['champs']);
	}

	public function testSansSaisieModelePasDeDescription(): void {
		$this->assertNull(tiptap_spip_decrire_formulaire_modele([['saisie' => 'input', 'options' => ['nom' => 'titre']]]));
		$this->assertNull(tiptap_spip_decrire_formulaire_modele([['saisie' => 'hidden', 'options' => ['nom' => 'modele', 'defaut' => '']]]));
	}

	public function testCatalogueAbsentSansLePlugin(): void {
		$this->assertNull(tiptap_spip_catalogue_modeles());
	}

	public function testCatalogueEnJsonPourLaConfiguration(): void {
		// null sans le plugin : l'éditeur garde la saisie brute
		$this->assertSame('null', tiptap_spip_catalogue_modeles_json());
	}

	public function testCatalogueParNomDeModele(): void {
		$lister = static fn () => [
			'media' => ['nom' => 'Média', 'parametres' => self::MEDIA],
			'libre' => ['nom' => 'Sans modèle', 'parametres' => [['saisie' => 'input', 'options' => ['nom' => 'x']]]],
		];

		$catalogue = tiptap_spip_catalogue_modeles($lister);

		$this->assertSame(['doc'], array_keys($catalogue));
		$this->assertSame('media', $catalogue['doc']['formulaire']);
		$this->assertSame('Média', $catalogue['doc']['nom']);
		$this->assertSame('id_modele', $catalogue['doc']['id']);
	}
}
