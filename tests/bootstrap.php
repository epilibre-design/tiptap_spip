<?php

declare(strict_types=1);

/**
 * Tests unitaires sans SPIP : les fonctions du core utilisées par le plugin sont simulées.
 * Chaque simulation est gardée par function_exists() pour rester compatible avec un futur
 * bootstrap d'intégration qui chargerait le vrai SPIP.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

if (!defined('_ECRIRE_INC_VERSION')) {
	define('_ECRIRE_INC_VERSION', 'test');
}

/** Remet à zéro l'état des simulations ; à appeler dans setUp(). */
function test_reset_globals(): void {
	$GLOBALS['spip_version_branche'] = '4.4.21';
	$GLOBALS['_test_fonds'] = [];
	$GLOBALS['_test_chemins'] = [];
}

test_reset_globals();

if (!function_exists('recuperer_fond')) {
	/** Simulation : chaîne fixe, ou fonction du contexte. */
	function recuperer_fond(string $fond, array $contexte = [], array $options = []): string {
		$rendu = $GLOBALS['_test_fonds'][$fond] ?? '';
		return is_callable($rendu) ? $rendu($contexte) : $rendu;
	}
}

if (!function_exists('find_in_path')) {
	function find_in_path(string $fichier) {
		return $GLOBALS['_test_chemins'][$fichier] ?? false;
	}
}

if (!function_exists('timestamp')) {
	function timestamp(string $fichier): string {
		return $fichier . '?1700000000';
	}
}

if (!function_exists('url_absolue')) {
	function url_absolue(string $url): string {
		return 'https://exemple.test/' . ltrim($url, './');
	}
}

if (!function_exists('protocole_implicite')) {
	function protocole_implicite(string $url): string {
		return preg_replace(',^https?:,', '', $url);
	}
}
