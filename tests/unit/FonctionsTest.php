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
}
