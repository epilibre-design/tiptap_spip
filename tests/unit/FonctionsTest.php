<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_fonctions.php';

final class FonctionsTest extends TestCase
{
	public function testJsonSansCaractereHtmlLitteral(): void {
		$json = tiptap_spip_json(['html' => "<p class='a'>x & \"y\"</p></script>"]);

		$this->assertDoesNotMatchRegularExpression('/[<>&\'"]\w|<\/script/', str_replace(['{"html":"', '"}'], '', $json));
		$this->assertSame(['html' => "<p class='a'>x & \"y\"</p></script>"], json_decode($json, true));
		$this->assertSame('', tiptap_spip_json([]));
		$this->assertSame('', tiptap_spip_json(''));
	}

	public function testUnSeulModeleAvecIdOuParametres(): void {
		foreach (['<doc12>', '<doc12|center>', '<img3 | left />', '<emb5|legende=<i>x</i>>', '<monmodele|a=b>'] as $modele) {
			$this->assertTrue(tiptap_spip_est_modele($modele), $modele);
		}
		foreach (['<span>', '<doc>', '<doc1> <doc2>', 'texte <doc1>', '<doc1>x', '<a href="x">', ''] as $modele) {
			$this->assertFalse(tiptap_spip_est_modele($modele), $modele);
		}
		$this->assertSame('doc', tiptap_spip_nom_modele('<DOC12|center>'));
	}

	public function testUnSeulRaccourciDeGlossaire(): void {
		foreach (['[?SPIP]', '[??SPIP]', '[? SPIP#mots12|bulle{fr}]', '[?a b]'] as $raccourci) {
			$this->assertTrue(tiptap_spip_est_glossaire($raccourci), $raccourci);
		}
		foreach (['[?]', '[?a] [?b]', 'x [?a]', '[?a<b]', '[SPIP]', '[?a]x', ''] as $raccourci) {
			$this->assertFalse(tiptap_spip_est_glossaire($raccourci), $raccourci);
		}
	}

	public function testNomDuGlossaireCommeLeCore(): void {
		$this->assertSame('', tiptap_spip_nom_glossaire('[?SPIP]'));
		$this->assertSame('', tiptap_spip_nom_glossaire('[?SPIP#12|bulle]'));
		$this->assertSame('mots', tiptap_spip_nom_glossaire('[?SPIP#mots12{fr}]'));
		$this->assertSame('wikipedia', tiptap_spip_nom_glossaire('[?SPIP|bulle#wikipedia]'));
	}

	public function testGlossairesNommesDesFonctionsDefinies(): void {
		$this->assertSame(
			['mots', 'wikipedia'],
			tiptap_spip_glossaires(['glossaire_wikipedia', 'glossaire_std', 'autre', 'glossaire_mots', 'glossaire_mots', 'glossaire_'])
		);
	}

	public function testGlossairesProposesSelonLaConfiguration(): void {
		test_reset_globals();
		$fonctions = ['glossaire_wikipedia', 'glossaire_mots'];
		$this->assertSame(['mots', 'wikipedia'], tiptap_spip_glossaires_proposes($fonctions));

		$GLOBALS['_test_config']['tiptap_spip'] = ['glossaires' => ['wikipedia', 'disparu']];
		$this->assertSame(['wikipedia'], tiptap_spip_glossaires_proposes($fonctions));
	}

	public function testCleDIdiome(): void {
		foreach (['tiptap_spip:lien', 'info_titre', 'A_b:C9'] as $cle) {
			$this->assertTrue(tiptap_spip_est_cle_idiome($cle), $cle);
		}
		foreach (['', 'a:b:c', 'a b', ':cle', '<:cle:>'] as $cle) {
			$this->assertFalse(tiptap_spip_est_cle_idiome($cle), $cle);
		}
	}

	public function testListeJsonDeChaines(): void {
		$this->assertSame(['art1', 'rub2'], tiptap_spip_liste('["art1","rub2"]', 50, 500));
		$this->assertNull(tiptap_spip_liste('[]', 50, 500));
		$this->assertNull(tiptap_spip_liste('{"a":"b"}', 50, 500));
		$this->assertNull(tiptap_spip_liste('["a", 3]', 50, 500));
		$this->assertNull(tiptap_spip_liste('[""]', 50, 500));
		$this->assertNull(tiptap_spip_liste('["a","b","c"]', 2, 500));
		$this->assertNull(tiptap_spip_liste('["abcdef"]', 50, 5));
		$this->assertNull(tiptap_spip_liste('pas du json', 50, 500));
		$this->assertNull(tiptap_spip_liste(null, 50, 500));
	}

	public function testFusionDesPlusRecentsEntreTypes(): void {
		$lignes = static fn (string $objet, array $majs) => array_map(
			static fn ($maj, $i) => ['objet' => $objet, 'id' => $i + 1, 'maj' => $maj],
			$majs,
			array_keys($majs)
		);
		$articles = $lignes('article', ['2026-10-05', '2026-10-01']);
		$rubriques = $lignes('rubrique', ['2026-10-09', '2026-10-03', '2026-09-01']);

		$fusion = tiptap_spip_fusionner_recents([$articles, $rubriques, []], 4);

		$this->assertSame(
			[['rubrique', 1], ['article', 1], ['rubrique', 2], ['article', 2]],
			array_map(static fn ($l) => [$l['objet'], $l['id']], $fusion)
		);
	}

	public function testFusionNeConsommeQueLeNecessaire(): void {
		$lus = 0;
		$source = static function () use (&$lus) {
			foreach (['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06'] as $i => $maj) {
				$lus++;
				yield ['objet' => 'article', 'id' => $i + 1, 'maj' => $maj];
			}
		};

		$this->assertCount(2, tiptap_spip_fusionner_recents([$source()], 2));
		$this->assertLessThanOrEqual(3, $lus);
	}

	public function testBarresDuFichierDuBundleModifieesParLePipeline(): void {
		test_reset_globals();
		$GLOBALS['_test_chemins']['prive/javascript/tiptap_spip/src/ui/barres.json'] = dirname(__DIR__, 2) . '/prive/javascript/tiptap_spip/src/ui/barres.json';
		$barres = tiptap_spip_barres();
		$this->assertSame(['edition', 'forum', 'minimale'], array_keys($barres));
		$this->assertContains('note', $barres['edition']);

		$GLOBALS['_test_pipelines']['tiptap_spip_toolbars'] = static function (array $flux): array {
			$flux['data']['edition'][] = ['composant' => 'faq', 'titre' => '<b>'];
			return $flux;
		};
		$edition = tiptap_spip_barres()['edition'];
		$this->assertSame(['composant' => 'faq', 'titre' => '<b>'], end($edition));
		$this->assertStringNotContainsString('<', tiptap_spip_barres_json());
	}

	public function testSansFichierDeBarresNull(): void {
		test_reset_globals();
		$this->assertSame('null', tiptap_spip_barres_json());
	}

	public function testExtensionsTiercesOrdonneesSelonLeursDependances(): void {
		test_reset_globals();
		$GLOBALS['_test_pipelines']['tiptap_spip_extensions'] = static function (array $flux): array {
			$flux['data']['faq'] = ['src' => 'plugins/faq/javascript/faq.js', 'dependances' => ['base']];
			$flux['data']['base'] = ['src' => 'plugins/base/base.js'];
			$flux['data']['cdn'] = ['src' => 'https://cdn.test/x.js', 'dependances' => ['inconnue']];
			$flux['data']['vide'] = ['src' => ''];
			$flux['data']['boucle'] = ['src' => 'b.js', 'dependances' => ['boucle']];
			return $flux;
		};

		$this->assertSame([
			'https://exemple.test/plugins/base/base.js?1700000000',
			'https://exemple.test/plugins/faq/javascript/faq.js?1700000000',
			'https://cdn.test/x.js',
			'https://exemple.test/b.js?1700000000',
		], tiptap_spip_extensions());
		$this->assertStringNotContainsString('<', tiptap_spip_extensions_json());
	}

	public function testSansExtensionTierceListeVide(): void {
		test_reset_globals();
		$this->assertSame([], tiptap_spip_extensions());
		$this->assertSame('[]', tiptap_spip_extensions_json());
		$this->assertSame('{}', tiptap_spip_i18n_json());
	}

	public function testChainesDeLanguesDesPluginsTiers(): void {
		test_reset_globals();
		$GLOBALS['_test_pipelines']['tiptap_spip_i18n'] = static function (array $flux): array {
			$flux['data'] += ['faq' => 'FAQ', 'faq_question' => 'Question <b>', 'mauvaise cle' => 'x', 'nombre' => 3];
			return $flux;
		};

		$this->assertSame(['faq' => 'FAQ', 'faq_question' => 'Question <b>'], tiptap_spip_i18n());
		$this->assertSame('{"faq":"FAQ","faq_question":"Question \\u003Cb\\u003E"}', tiptap_spip_i18n_json());
	}
}
