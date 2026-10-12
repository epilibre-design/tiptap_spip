<?php

/**
 * Oracle de rendu : lit un texte SPIP sur l'entrée standard et écrit propre($texte).
 * Usage : SPIP_ROOT=/chemin/vers/spip php tests/equivalence/propre.php < texte.spip
 *         SPIP_ROOT=/chemin/vers/spip php tests/equivalence/propre.php --branche
 *           écrit la branche majeure de SPIP (4, 5…), qui choisit le diff figé d'un écart (ecarts.yaml)
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
if ($root === '' || !is_dir($root . '/ecrire')) {
	fwrite(STDERR, "SPIP_ROOT doit désigner la racine d'un site SPIP\n");
	exit(2);
}
require_once __DIR__ . '/../charger_spip.php';
tiptap_spip_charger_spip($root);
if (($argv[1] ?? '') === '--branche') {
	echo (int) ($GLOBALS['spip_version_branche'] ?? 0);
	exit(0);
}
include_spip('inc/texte');
$texte = stream_get_contents(STDIN);

/** propre() dans la langue courante, suivi du texte des notes (que SPIP accumule pour #NOTES). */
function oracle_rendu(string $texte): string {
	// notes remises à zéro : chaque langue est numérotée depuis 1 (état global de inc_notes_dist())
	$GLOBALS['les_notes'] = '';
	$GLOBALS['compt_note'] = 0;
	$GLOBALS['notes_vues'] = [];
	$html = propre($texte);
	$notes = charger_fonction('notes', 'inc', true);
	$bas = $notes ? (string) $notes([]) : '';
	return $html . ($bas === '' ? '' : "\n<!-- notes -->\n" . $bas);
}

echo oracle_rendu($texte);
// <multi> ne rend qu'une langue, celle du contexte : chaque langue citée par un multi est rendue aussi.
// Codes gardés tels quels (la casse compte : [EN] n'est choisi que pour EN) et posés directement :
// lang_select() ignore une langue que le site ne propose pas.
if (strpos($texte, '<multi>') !== false && preg_match_all('@\[([a-z]{2,3}(?:_[a-z]{2,3})?(?:_[a-z]{2,3})?)\]@i', $texte, $m)) {
	$defaut = $GLOBALS['spip_lang'];
	$langues = array_diff(array_unique($m[1]), [$defaut]);
	sort($langues);
	foreach ($langues as $langue) {
		$GLOBALS['spip_lang'] = $langue;
		echo "\n<!-- langue $langue -->\n" . oracle_rendu($texte);
	}
	$GLOBALS['spip_lang'] = $defaut;
}
