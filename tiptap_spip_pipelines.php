<?php

/**
 * Pipelines du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/**
 * SPIP 4 : charge la configuration, la feuille de style et le bundle de l'éditeur.
 * SPIP 5 passe par l'importmap et les scripts prive/javascript/_inits/.
 */
function tiptap_spip_header_prive($flux) {
	if ((int) substr($GLOBALS['spip_version_branche'] ?? '4', 0, 1) >= 5) {
		return $flux;
	}
	$config = recuperer_fond('prive/javascript/_inits/09_tiptap_spip_config.js');
	$lib = find_in_path('prive/javascript/tiptap_spip.min.js') ?: find_in_path('prive/javascript/tiptap_spip.js');
	if (!$config || !$lib) {
		return $flux;
	}
	if ($css = find_in_path('css/tiptap_spip.css')) {
		$flux .= '<link rel="stylesheet" href="' . timestamp($css) . '" type="text/css" />' . "\n";
	}
	$flux .= "<script>\n" . $config . "\n</script>\n";
	$flux .= "<script type=\"module\">\n"
		. "import { tiptap_spip_init } from '" . protocole_implicite(url_absolue(timestamp($lib))) . "';\n"
		. "tiptap_spip_init();\n"
		. "onAjaxLoad(function () { tiptap_spip_init(this); });\n"
		. "</script>\n";

	return $flux;
}

/**
 * SPIP 5 : déclare le bundle dans l'importmap.
 */
function tiptap_spip_importmap($flux) {
	$flux['data'][] = 'tiptap_spip.js';

	return $flux;
}
