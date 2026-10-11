<?php

/**
 * Oracle de rendu : lit un texte SPIP sur l'entrée standard et écrit propre($texte).
 * Usage : SPIP_ROOT=/chemin/vers/spip php tests/equivalence/propre.php < texte.spip
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
if ($root === '' || !is_dir($root . '/ecrire')) {
	fwrite(STDERR, "SPIP_ROOT doit désigner la racine d'un site SPIP\n");
	exit(2);
}
chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	// SPIP 4.4+ : le noyau est chargé par composer
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('inc/texte');
include_spip('inc/lang');
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
// <multi> ne rend qu'une langue, celle du contexte : chaque langue citée par un multi est rendue aussi
if (strpos($texte, '<multi>') !== false && preg_match_all('@\[([a-z]{2,3}(?:_[a-z]{2,3})?(?:_[a-z]{2,3})?)\]@i', $texte, $m)) {
	$langues = array_diff(array_unique(array_map('strtolower', $m[1])), [$GLOBALS['spip_lang']]);
	sort($langues);
	foreach ($langues as $langue) {
		lang_select($langue);
		echo "\n<!-- langue $langue -->\n" . oracle_rendu($texte);
		lang_select();
	}
}
