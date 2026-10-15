<?php

/**
 * Fichiers collés ou déposés dans l'éditeur (spec 10 §5, §8) : disponibilité de l'opération
 * deposer_document et annonce au JS, contrôle du fichier envoyé, ajout comme document SPIP lié à l'objet.
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
 * Plus gros fichier accepté : la plus petite des limites définies (upload_max_filesize, post_max_size,
 * _IMG_MAX_SIZE ou _DOC_MAX_SIZE en Ko) ; 0 : sans limite connue.
 */
function tiptap_spip_taille_max(string $upload, string $post, ?int $max_ko): int {
	$limites = array_filter([tiptap_spip_octets($upload), tiptap_spip_octets($post), $max_ko ? $max_ko * 1024 : 0]);
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
 * Extensions dont medias borne la taille par _IMG_MAX_SIZE, et non par _DOC_MAX_SIZE
 * (inc/verifier_taille_document_acceptable.php) : celles que decoder_type_image() rend pour un fichier
 * reconnu par getimagesize() (metadata/image.php). Liste technique de limite de taille, pas de types
 * d'images : swf y figure parce que metadata/swf.php passe par metadata/image.php, mais un SWF n'est ni
 * une image ni collable (images de tiptap_spip_depot()). Il n'est déposable que si le site en autorise
 * l'envoi.
 */
const TIPTAP_SPIP_EXTENSIONS_LIMITE_IMAGE = ['gif', 'jpg', 'png', 'psd', 'bmp', 'tif', 'webp', 'svg', 'swf'];

/**
 * Extensions de tous les types que le site accepte en envoi (boîte « Documents »), dans l'ordre de
 * spip_types_documents ; seules celles que medias reconnaît après corriger_extension().
 *
 * @return string[]
 */
function tiptap_spip_documents_extensions(): array {
	include_spip('base/abstract_sql');
	include_spip('inc/documents');
	$extensions = [];
	foreach (sql_allfetsel('extension', 'spip_types_documents', "upload='oui'") as $ligne) {
		$extension = (string) $ligne['extension'];
		if (corriger_extension($extension) === $extension) {
			$extensions[] = $extension;
		}
	}
	return array_values(array_unique($extensions));
}

/**
 * Identifiant auquel lier le document : celui de l'objet, ou -id_auteur pour un objet nouveau, comme
 * la boîte « Documents » (medias_post_insertion le rattache à la création de l'objet).
 */
function tiptap_spip_depot_id_lien(int $id_objet): int {
	return $id_objet > 0 ? $id_objet : -intval($GLOBALS['visiteur_session']['id_auteur'] ?? 0);
}

/**
 * Dépôt de fichiers pour l'éditeur d'un objet (spec 10 §5, §6, §8), ou null si deposer_document est
 * indisponible (sans objet, plugin medias inactif, réglage coller_images désactivé, pas le droit de
 * joindre un document, aucun type envoyable) :
 * - images : types collables (liste blanche acceptée par le site), extension de chacun (le JS renomme
 *   le fichier avec elle), taille maximale (_IMG_MAX_SIZE) ;
 * - documents : extensions déposables (tous les types envoyables) ; documents_limite_image : celles que medias
 *   borne par _IMG_MAX_SIZE (documents_limite_image : liste de limite de taille, pas de types d'images ;
 *   taille_image) ; taille maximale des autres (_DOC_MAX_SIZE).
 *
 * @return ?array{images: string[], extensions: array<string, string>, taille_image: int, documents: string[], documents_limite_image: string[], taille_document: int}
 */
function tiptap_spip_depot(string $objet, int $id_objet): ?array {
	if ($objet === '' || tiptap_spip_config()['coller_images'] !== 'oui' || !test_plugin_actif('medias')) {
		return null;
	}
	include_spip('inc/autoriser');
	if (!autoriser('joindredocument', $objet, tiptap_spip_depot_id_lien($id_objet))) {
		return null;
	}
	$documents = tiptap_spip_documents_extensions();
	if (!$documents) {
		return null;
	}
	// type MIME → première extension acceptée
	$extensions = [];
	foreach (tiptap_spip_images_types() as $extension => $type) {
		$extensions[$type] ??= $extension;
	}
	$upload = (string) ini_get('upload_max_filesize');
	$post = (string) ini_get('post_max_size');
	return [
		'images' => array_keys($extensions),
		'extensions' => $extensions,
		'taille_image' => tiptap_spip_taille_max($upload, $post, defined('_IMG_MAX_SIZE') ? (int) _IMG_MAX_SIZE : null),
		'documents' => $documents,
		'documents_limite_image' => array_values(array_intersect($documents, TIPTAP_SPIP_EXTENSIONS_LIMITE_IMAGE)),
		'taille_document' => tiptap_spip_taille_max($upload, $post, defined('_DOC_MAX_SIZE') ? (int) _DOC_MAX_SIZE : null),
	];
}

/**
 * Contrôle du fichier de deposer_document : un seul fichier, champ « fichier », envoi PHP complet ;
 * image de la liste blanche : extension et type réel (finfo) concordants ; autre document : extension
 * déposable (medias refait ses contrôles, comme pour la boîte « Documents »).
 *
 * @param array $files  $_FILES
 * @param array<string, string> $images  extension → type MIME des images (tiptap_spip_images_types)
 * @param string[] $documents  extensions déposables (tiptap_spip_documents_extensions)
 * @param ?callable(string): bool $est_envoye  is_uploaded_file par défaut, remplaçable dans les tests
 * @return ?string  message d'erreur, null si le fichier est accepté
 */
function tiptap_spip_controler_document(array $files, array $images, array $documents, ?callable $est_envoye = null): ?string {
	$est_envoye ??= 'is_uploaded_file';
	$fichier = $files['fichier'] ?? null;
	if (count($files) !== 1 || !is_array($fichier) || !is_string($fichier['tmp_name'] ?? null) || !is_string($fichier['name'] ?? null)) {
		return _T('tiptap_spip:erreur_depot_fichier');
	}
	$erreur = (int) ($fichier['error'] ?? UPLOAD_ERR_NO_FILE);
	if ($erreur === UPLOAD_ERR_INI_SIZE || $erreur === UPLOAD_ERR_FORM_SIZE) {
		return _T('tiptap_spip:erreur_depot_taille');
	}
	if ($erreur !== UPLOAD_ERR_OK || !$est_envoye($fichier['tmp_name'])) {
		return _T('tiptap_spip:erreur_depot_fichier');
	}
	include_spip('inc/documents');
	$extension = corriger_extension(strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION)));
	$reel = (new finfo(FILEINFO_MIME_TYPE))->file($fichier['tmp_name']);
	// une image de la liste blanche, ou un fichier qui en a le type réel : extension et type concordants
	if (isset($images[$extension]) || in_array($reel, $images, true)) {
		return ($images[$extension] ?? null) === $reel ? null : _T('tiptap_spip:erreur_depot_type');
	}
	return in_array($extension, $documents, true) ? null : _T('tiptap_spip:erreur_depot_type');
}

/**
 * Ajoute le fichier aux documents de l'objet, en mode document comme Crayons (action_crayons_upload) : le
 * raccourci inséré est <docN> (spec 10 §4). medias refait ses contrôles de taille et de dimensions.
 *
 * @param array $fichier  $_FILES['fichier'], contrôlé par tiptap_spip_controler_document()
 * @return array{id_document: int, raccourci: string}|string  message d'erreur de medias
 */
function tiptap_spip_deposer_document(array $fichier, string $objet, int $id_objet) {
	$ajouter = charger_fonction('ajouter_documents', 'action');
	$ajoutes = $ajouter('new', [['tmp_name' => $fichier['tmp_name'], 'name' => $fichier['name']]], $objet, tiptap_spip_depot_id_lien($id_objet), 'document');
	$id = reset($ajoutes);
	if (is_numeric($id) && intval($id) > 0) {
		return ['id_document' => intval($id), 'raccourci' => 'doc' . intval($id)];
	}
	return is_string($id) && $id !== '' ? $id : _T('tiptap_spip:erreur_depot_ajout');
}
