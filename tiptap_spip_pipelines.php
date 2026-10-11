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

/**
 * Champs équipés de l'éditeur pour un objet : un formulaire de services par champ.
 * Le lancement JS équipe le champ texte des formulaires SPIP (spec 02 §6).
 *
 * @return string[]
 */
function tiptap_spip_champs(string $objet): array {
	return ['texte'];
}

/**
 * Ajoute après le </form> d'un formulaire d'édition (editer_<objet>) les formulaires de services de
 * l'éditeur, un par champ équipé, reliés au formulaire d'édition par un identifiant d'instance
 * aléatoire (spec 02 §5 « Intégration ») : deux formulaires d'édition du même objet dans une page
 * gardent chacun leurs services.
 */
function tiptap_spip_formulaire_fond($flux) {
	$form = $flux['args']['form'] ?? '';
	if (!str_starts_with($form, 'editer_') || !str_contains($flux['data'], '<form')) {
		return $flux;
	}
	// formulaires d'objet (editer_objet) : SPIP transmet ['type' => objet, 'id' => id] comme args
	$args = $flux['args']['args'] ?? [];
	$objet = (string) ($args['type'] ?? substr($form, 7));
	$id_objet = intval($args['id'] ?? $args[0] ?? 0);
	$id_objet = $id_objet > 0 ? $id_objet : 0;
	$services = '';
	foreach (tiptap_spip_champs($objet) as $champ) {
		$services .= recuperer_fond('inclure/tiptap_spip_services', [
			'objet' => $objet,
			'id_objet' => $id_objet,
			'champ' => $champ,
		]);
	}
	if (trim($services) === '') {
		return $flux;
	}
	$instance = 'tts-' . bin2hex(random_bytes(6));
	$flux['data'] = preg_replace('/<form\b/i', '<form data-tts-instance="' . $instance . '"', $flux['data'], 1);
	$flux['data'] .= str_replace('data-tts-instance=""', 'data-tts-instance="' . $instance . '"', $services);

	return $flux;
}

/** Déclaration des autorisations. */
function tiptap_spip_autoriser() {
}

/**
 * Prévisualiser un modèle sans objet (réglages…) : accès à l'espace privé, ou administrateur non
 * restreint dans le site public (comme le porte-plume et markdown_editor).
 */
function autoriser_tiptapspipmodele_previsualiser_dist($faire, $type, $id, $qui, $opt) {
	return test_espace_prive()
		? (($qui['statut'] ?? '') === '0minirezo' || ($qui['statut'] ?? '') === '1comite')
		: (($qui['statut'] ?? '') === '0minirezo' && empty($qui['restreint']));
}
