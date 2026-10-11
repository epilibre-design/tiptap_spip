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
}

