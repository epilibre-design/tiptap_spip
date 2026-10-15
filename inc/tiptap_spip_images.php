<?php

/**
 * Images collées dans l'éditeur (spec 10 §5) : disponibilité de l'opération deposer_image, contrôle du
 * fichier envoyé et ajout comme document SPIP lié à l'objet édité.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('inc/tiptap_spip_config');

/** Types d'images acceptés par défaut (spec 10 §3), recoupés avec spip_types_documents. */
const TIPTAP_SPIP_IMAGES_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Taille d'une directive de php.ini (« 8M », « 512K », « 1G ») en octets ; 0 : sans limite. */
function tiptap_spip_octets(string $valeur): int {
	if (!preg_match('/^\s*(\d+)\s*([kmg]?)/i', $valeur, $m)) {
		return 0;
	}
	$n = (int) $m[1];
	return match (strtolower($m[2])) {
		'g' => $n * 1024 ** 3,
		'm' => $n * 1024 ** 2,
		'k' => $n * 1024,
		default => $n,
	};
}

/**
 * Plus grande image acceptée : la plus petite des limites définies (upload_max_filesize,
 * post_max_size, _IMG_MAX_SIZE en Ko) ; 0 : sans limite connue.
 */
function tiptap_spip_images_taille_max(string $upload, string $post, ?int $img_max_ko): int {
	$limites = array_filter([tiptap_spip_octets($upload), tiptap_spip_octets($post), $img_max_ko ? $img_max_ko * 1024 : 0]);
	return $limites ? min($limites) : 0;
}

/**
 * Types d'images que le site accepte en envoi : extension → type MIME, parmi la liste blanche. Seules
 * les extensions que medias reconnaît comptent : il corrige l'extension envoyée (corriger_extension,
 * .jpeg → .jpg) avant de la chercher.
 *
 * @return array<string, string>
 */
function tiptap_spip_images_types(): array {
	include_spip('base/abstract_sql');
	include_spip('inc/documents');
	$types = [];
	foreach (sql_allfetsel('extension, mime_type', 'spip_types_documents', "upload='oui'") as $ligne) {
		$extension = (string) $ligne['extension'];
		if (in_array($ligne['mime_type'], TIPTAP_SPIP_IMAGES_TYPES, true) && corriger_extension($extension) === $extension) {
			$types[(string) $ligne['extension']] = (string) $ligne['mime_type'];
		}
	}
	return $types;
}

/**
 * Identifiant auquel lier le document : celui de l'objet, ou -id_auteur pour un objet nouveau, comme
 * la boîte « Documents » (medias_post_insertion le rattache à la création de l'objet).
 */
function tiptap_spip_images_id_lien(int $id_objet): int {
	return $id_objet > 0 ? $id_objet : -intval($GLOBALS['visiteur_session']['id_auteur'] ?? 0);
}

/**
 * Collage d'images pour l'éditeur d'un objet (spec 10 §5, « Disponibilité ») : types acceptés, extension
 * de chacun (le JS renomme le fichier avec elle) et taille maximale, ou null si l'opération deposer_image est indisponible (sans objet, plugin medias
 * inactif, réglage désactivé, pas le droit de joindre un document, aucun type d'image accepté).
 *
 * @return ?array{types: string[], extensions: array<string, string>, taille: int}
 */
function tiptap_spip_images(string $objet, int $id_objet): ?array {
	if ($objet === '' || tiptap_spip_config()['coller_images'] !== 'oui' || !test_plugin_actif('medias')) {
		return null;
	}
	include_spip('inc/autoriser');
	if (!autoriser('joindredocument', $objet, tiptap_spip_images_id_lien($id_objet))) {
		return null;
	}
	// type MIME → première extension acceptée
	$extensions = [];
	foreach (tiptap_spip_images_types() as $extension => $type) {
		$extensions[$type] ??= $extension;
	}
	if (!$extensions) {
		return null;
	}
	return [
		'types' => array_keys($extensions),
		'extensions' => $extensions,
		'taille' => tiptap_spip_images_taille_max(
			(string) ini_get('upload_max_filesize'),
			(string) ini_get('post_max_size'),
			defined('_IMG_MAX_SIZE') ? (int) _IMG_MAX_SIZE : null
		),
	];
}

/**
 * Contrôle du fichier de deposer_image : un seul fichier, champ « fichier », envoi PHP complet,
 * extension et type réel (finfo) concordants et acceptés par le site.
 *
 * @param array $files  $_FILES
 * @param array<string, string> $types  extension → type MIME acceptés (tiptap_spip_images_types)
 * @param ?callable(string): bool $est_envoye  is_uploaded_file par défaut, remplaçable dans les tests
 * @return ?string  message d'erreur, null si le fichier est accepté
 */
function tiptap_spip_controler_image(array $files, array $types, ?callable $est_envoye = null): ?string {
	$est_envoye ??= 'is_uploaded_file';
	$fichier = $files['fichier'] ?? null;
	if (count($files) !== 1 || !is_array($fichier) || !is_string($fichier['tmp_name'] ?? null) || !is_string($fichier['name'] ?? null)) {
		return _T('tiptap_spip:erreur_image_fichier');
	}
	$erreur = (int) ($fichier['error'] ?? UPLOAD_ERR_NO_FILE);
	if ($erreur === UPLOAD_ERR_INI_SIZE || $erreur === UPLOAD_ERR_FORM_SIZE) {
		return _T('tiptap_spip:erreur_image_taille');
	}
	if ($erreur !== UPLOAD_ERR_OK || !$est_envoye($fichier['tmp_name'])) {
		return _T('tiptap_spip:erreur_image_fichier');
	}
	$extension = strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION));
	$reel = (new finfo(FILEINFO_MIME_TYPE))->file($fichier['tmp_name']);
	if (!isset($types[$extension]) || $types[$extension] !== $reel) {
		return _T('tiptap_spip:erreur_image_type');
	}
	return null;
}

/**
 * Ajoute l'image aux documents de l'objet, en mode document comme Crayons (action_crayons_upload) : le
 * raccourci inséré est <docN> (spec 10 §4). medias refait ses contrôles de taille et de dimensions.
 *
 * @param array $fichier  $_FILES['fichier'], contrôlé par tiptap_spip_controler_image()
 * @return array{id_document: int, raccourci: string}|string  message d'erreur de medias
 */
function tiptap_spip_deposer_image(array $fichier, string $objet, int $id_objet) {
	$ajouter = charger_fonction('ajouter_documents', 'action');
	$ajoutes = $ajouter('new', [['tmp_name' => $fichier['tmp_name'], 'name' => $fichier['name']]], $objet, tiptap_spip_images_id_lien($id_objet), 'document');
	$id = reset($ajoutes);
	if (is_numeric($id) && intval($id) > 0) {
		return ['id_document' => intval($id), 'raccourci' => 'doc' . intval($id)];
	}
	return is_string($id) && $id !== '' ? $id : _T('tiptap_spip:erreur_image_ajout');
}
