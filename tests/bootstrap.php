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
	$GLOBALS['_test_config'] = [];
	$GLOBALS['_test_pipelines'] = [];
	$GLOBALS['_test_request'] = [];
	// objets éditoriaux et traitements, comme SPIP 4.4 les déclare (extrait)
	$GLOBALS['_test_objets'] = [
		'spip_articles' => ['type' => 'article', 'table_objet' => 'articles', 'editable' => 'oui', 'champs_editables' => ['surtitre', 'titre', 'descriptif', 'chapo', 'texte', 'ps']],
		'spip_auteurs' => ['type' => 'auteur', 'table_objet' => 'auteurs', 'editable' => 'oui', 'champs_editables' => ['nom', 'bio', 'nom_site']],
		'spip_forum' => ['type' => 'forum', 'table_objet' => 'forums', 'editable' => false, 'champs_editables' => ['titre', 'texte']],
		'spip_syndic_articles' => ['type' => 'syndic_article', 'table_objet' => 'syndic_articles', 'editable' => 'oui', 'champs_editables' => ['titre', 'descriptif']],
	];
	$GLOBALS['table_des_traitements'] = [
		'TEXTE' => [0 => 'propre(%s, $connect, $Pile[0])', 'forums' => 'safehtml(propre(%s))'],
		'CHAPO' => ['propre(%s, $connect, $Pile[0])'],
		'PS' => ['propre(%s, $connect, $Pile[0])'],
		'DESCRIPTIF' => [0 => 'propre(%s, $connect, $Pile[0])', 'syndic_articles' => 'safehtml(%s)'],
		'BIO' => ['safehtml(propre(%s, $connect, $Pile[0]))'],
		'TITRE' => ['supprimer_numero(typo(%s, "TYPO", $connect, $Pile[0]))'],
		'NOM_SITE' => ['typo(%s, "TYPO", $connect, $Pile[0])'],
	];
}

test_reset_globals();

if (!function_exists('recuperer_fond')) {
	/** Simulation : chaîne fixe, ou fonction du contexte. */
	function recuperer_fond(string $fond, array $contexte = [], array $options = []): string {
		$rendu = $GLOBALS['_test_fonds'][$fond] ?? '';
		return is_callable($rendu) ? $rendu($contexte) : $rendu;
	}
}

if (!function_exists('include_spip')) {
	function include_spip(string $chemin): bool {
		return true;
	}
}

if (!function_exists('lire_config')) {
	function lire_config(string $cle, $defaut = null) {
		return $GLOBALS['_test_config'][$cle] ?? $defaut;
	}
}

if (!function_exists('pipeline')) {
	/** Simulation : fonction de $GLOBALS['_test_pipelines'][$nom] appliquée au flux, sinon flux inchangé. */
	function pipeline(string $nom, $flux = null) {
		$f = $GLOBALS['_test_pipelines'][$nom] ?? null;
		return $f ? $f($flux) : $flux;
	}
}

if (!function_exists('ecrire_config')) {
	function ecrire_config(string $cle, $valeur): bool {
		$GLOBALS['_test_config'][$cle] = $valeur;
		return true;
	}
}

if (!function_exists('_request')) {
	function _request(string $nom) {
		return $GLOBALS['_test_request'][$nom] ?? null;
	}
}

if (!function_exists('_T')) {
	/** Simulation : la clé, suivie des arguments. */
	function _T(string $cle, array $args = []): string {
		return $cle . ($args ? ' ' . json_encode($args) : '');
	}
}

if (!function_exists('objet_info')) {
	function objet_info(string $objet, string $info) {
		return $info === 'texte_objets' ? 'public:' . $objet . 's' : null;
	}
}

if (!function_exists('lister_tables_objets_sql')) {
	function lister_tables_objets_sql(): array {
		return $GLOBALS['_test_objets'];
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

// configuration du plugin : incluse par include_spip() dans SPIP, simulée ici
require_once dirname(__DIR__) . '/inc/tiptap_spip_config.php';
