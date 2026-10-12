<?php

/**
 * Pipelines du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('inc/tiptap_spip_config');

/**
 * Feuilles de style et module de lancement de l'éditeur, à insérer dans le <head>.
 *
 * La configuration est calculée à chaque page, avec `prive` dans son contexte : le même squelette sert
 * l'espace privé et le site public sans partager son cache. Elle n'est pas dans
 * prive/javascript/_inits/ : SPIP 5 en fait un fichier statique, gardé tant que son cache dure (la
 * configuration du plugin n'y serait pas reprise) et chargé dans les deux espaces.
 *
 * Elle est posée dans le module, avant le lancement : en SPIP 5, window.spipConfig est remplacé par
 * le module d'initialisation de SPIP, qui passe avant ce module.
 */
function tiptap_spip_head(bool $prive): string {
	$config = recuperer_fond('prive/javascript/tiptap_spip_config.js', ['prive' => $prive ? 'oui' : 'non']);
	$lib = find_in_path('prive/javascript/tiptap_spip.min.js') ?: find_in_path('prive/javascript/tiptap_spip.js');
	if (!$config || !$lib) {
		return '';
	}
	$head = '';
	foreach (['css/tiptap_spip.css', 'css/tiptap_spip_contenu.css'] as $feuille) {
		if ($css = find_in_path($feuille)) {
			$head .= '<link rel="stylesheet" href="' . timestamp($css) . '" type="text/css" />' . "\n";
		}
	}
	// SPIP 5 : bundle et onAjaxLoad par l'importmap, le bundle étant alors le même module que celui
	// qu'importent les plugins tiers (spec 07) ; SPIP 4 : URL du bundle, onAjaxLoad global
	$imports = tiptap_spip_spip5()
		? "import { onAjaxLoad } from 'ajaxCallback.js';\n"
			. "import { chargerExtensions, tiptap_spip_init } from 'tiptap_spip.js';\n"
		: "import { chargerExtensions, tiptap_spip_init } from '" . protocole_implicite(url_absolue(timestamp($lib))) . "';\n";
	// extensions des plugins tiers (pipeline tiptap_spip_extensions) importées avant le lancement
	$head .= "<script type=\"module\">\n"
		. $imports
		. trim($config) . "\n"
		. "await chargerExtensions();\n"
		. "tiptap_spip_init();\n"
		. "onAjaxLoad(function () { tiptap_spip_init(this); });\n"
		. "</script>\n";

	return $head;
}

/**
 * Espace privé.
 */
function tiptap_spip_header_prive($flux) {
	return $flux . tiptap_spip_head(true);
}

/**
 * Site public : si la configuration active les formulaires publics ou les crayons (spec 02 §6),
 * réglages indépendants ; le lancement JS n'équipe que ce qui est activé (config JS public, crayons).
 */
function tiptap_spip_insert_head($flux) {
	$config = tiptap_spip_config();
	if ($config['public'] !== 'oui' && $config['crayons'] !== 'oui') {
		return $flux;
	}
	return $flux . tiptap_spip_head(false);
}

/**
 * SPIP 5 : déclare le bundle dans l'importmap, pour le lancement (tiptap_spip_head) et les plugins
 * tiers qui l'importent.
 */
function tiptap_spip_importmap($flux) {
	$flux['data'][] = 'tiptap_spip.js';

	return $flux;
}

/**
 * Contextes des formulaires autres que editer_* qui embarquent l'éditeur (spec 02 §6) : nom du
 * formulaire → fonction qui, à partir des arguments de la balise et du contexte du formulaire,
 * renvoie ['objet' => …, 'id_objet' => …, 'champs' => [...]] (objet vide : mode sans objet), ou
 * null pour ne rien équiper. Les plugins complètent la liste par le pipeline tiptap_spip_contextes.
 *
 * @return array<string, callable>
 */
function tiptap_spip_contextes(): array {
	$contextes = [
		// réglages d'identité du site : descriptif du site, sans objet
		'configurer_identite' => static fn () => ['objet' => '', 'id_objet' => 0, 'champs' => ['descriptif_site']],
	];
	return pipeline('tiptap_spip_contextes', $contextes) ?: $contextes;
}

/**
 * Contexte de l'éditeur pour un formulaire : formulaires d'objet (editer_<objet>), ou déclarés par
 * tiptap_spip_contextes.
 *
 * Un formulaire d'objet n'est pris en charge que pour un objet éditable ; ses champs sont ceux de la
 * configuration, éventuellement aucun.
 *
 * @return array{objet: string, id_objet: int, champs: string[], marquer: bool}|null  marquer : poser
 *         data-tts-toolbar sur les textareas des champs (le lancement JS ne les reconnaît pas seul) ;
 *         sinon (formulaires d'objet), data-tts-champs sur le formulaire : seuls ces champs sont équipés
 */
function tiptap_spip_contexte_formulaire(string $form, array $args, array $contexte): ?array {
	if (str_starts_with($form, 'editer_')) {
		// formulaires d'objet (editer_objet) : SPIP transmet ['type' => objet, 'id' => id] comme args
		$objet = (string) ($args['type'] ?? substr($form, 7));
		$champs = tiptap_spip_champs($objet);
		if ($champs === null) {
			return null;
		}
		$id_objet = intval($args['id'] ?? $args[0] ?? 0);
		return ['objet' => $objet, 'id_objet' => max(0, $id_objet), 'champs' => $champs, 'marquer' => false];
	}
	$declares = tiptap_spip_contextes();
	if (!isset($declares[$form]) || !is_callable($declares[$form])) {
		return null;
	}
	$c = $declares[$form]($args, $contexte);
	if (!is_array($c) || empty($c['champs'])) {
		return null;
	}
	return [
		'objet' => (string) ($c['objet'] ?? ''),
		'id_objet' => max(0, intval($c['id_objet'] ?? 0)),
		'champs' => array_values(array_map('strval', $c['champs'])),
		'marquer' => true,
	];
}

/**
 * Ajoute après le </form> d'un formulaire équipé (editer_<objet>, ou déclaré par
 * tiptap_spip_contextes) les formulaires de services de l'éditeur, un par champ, reliés au
 * formulaire par un identifiant d'instance aléatoire (spec 02 §5 « Intégration ») : deux formulaires
 * d'édition du même objet dans une page gardent chacun leurs services.
 */
function tiptap_spip_formulaire_fond($flux) {
	$form = $flux['args']['form'] ?? '';
	if ($form === 'tiptap_spip' || !str_contains($flux['data'], '<form')) {
		return $flux;
	}
	$c = tiptap_spip_contexte_formulaire($form, (array) ($flux['args']['args'] ?? []), (array) ($flux['args']['contexte'] ?? []));
	if (!$c) {
		return $flux;
	}
	$services = '';
	foreach ($c['champs'] as $champ) {
		$services .= recuperer_fond('inclure/tiptap_spip_services', [
			'objet' => $c['objet'],
			'id_objet' => $c['id_objet'],
			'champ' => $champ,
		]);
	}
	// formulaire d'objet : le lancement JS n'équipe que les champs configurés
	$champs = $c['marquer'] ? '' : ' data-tts-champs="' . htmlspecialchars(implode(' ', $c['champs'])) . '"';
	if (trim($services) === '') {
		if ($champs !== '') {
			$flux['data'] = preg_replace('/<form\b/i', '<form' . $champs, $flux['data'], 1);
		}
		return $flux;
	}
	$instance = 'tts-' . bin2hex(random_bytes(6));
	$data = preg_replace('/<form\b/i', '<form data-tts-instance="' . $instance . '"' . $champs, $flux['data'], 1);
	if ($c['marquer']) {
		foreach ($c['champs'] as $champ) {
			$data = preg_replace(
				'/<textarea\b(?![^>]*\bdata-tts-toolbar=)(?=[^>]*\bname=([\'"])' . preg_quote($champ, '/') . '\1)/i',
				'<textarea data-tts-toolbar="minimale"',
				$data
			);
		}
	}
	$flux['data'] = $data . str_replace('data-tts-instance=""', 'data-tts-instance="' . $instance . '"', $services);

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
