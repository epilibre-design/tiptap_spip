<?php

/**
 * Charge le noyau d'un site SPIP depuis sa racine, pour les scripts de test en ligne de commande.
 *
 *   SPIP 4.2 : ecrire/inc_version.php (vendor/ ne contient que les bibliothèques) ;
 *   SPIP 4.4 : noyau trouvé par le paramètre spip.dirs.core du kernel ;
 *   SPIP 5   : même paramètre, lu par Spip::param() (la fonction du kernel est dépréciée).
 */
function tiptap_spip_charger_spip(string $root): void {
	chdir($root);
	$core = 'ecrire/';
	if (is_file($root . '/vendor/autoload.php')) {
		require_once $root . '/vendor/autoload.php';
		if (class_exists(\Spip\Framework\Spip::class)) {
			$core = \Spip\Framework\Spip::param('spip.dirs.core');
		} elseif (function_exists('SpipLeague\Component\Kernel\param')) {
			$core = \SpipLeague\Component\Kernel\param('spip.dirs.core');
		}
	}
	include_once $root . '/' . $core . 'inc_version.php';
}
