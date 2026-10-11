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
echo propre(stream_get_contents(STDIN));
