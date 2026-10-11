<?php

/**
 * Pilote d'un site SPIP JETABLE pour les tests de bout en bout (jamais un site réel : la
 * commande active le plugin et ouvre une session d'administrateur).
 *
 * Usage :
 *   SPIP_ROOT=<site> php tests/e2e/site.php preparer <agent> [titre] [id_auteur] < texte.spip
 *     active le plugin tiptap_spip, crée un article avec le texte lu sur l'entrée standard, lié à
 *     l'auteur (1 par défaut), et une session pour cet auteur ; écrit
 *     {"id_article": …, "cookie": …} sur la sortie.
 *     <agent> : User-Agent du navigateur de test (la session SPIP en dépend).
 *   SPIP_ROOT=<site> php tests/e2e/site.php texte <id_article>
 *     écrit le texte de l'article, octet pour octet.
 *   SPIP_ROOT=<site> php tests/e2e/site.php modifier <id_article> < texte.spip
 *     remplace le texte de l'article par l'entrée standard.
 *   SPIP_ROOT=<site> php tests/e2e/site.php document <id_article>
 *     crée une image (PNG 1×1) liée à l'article ; écrit son id_document.
 *   SPIP_ROOT=<site> php tests/e2e/site.php auteur <statut>
 *     crée un auteur (0minirezo, 1comite…) ; écrit son id_auteur.
 *   SPIP_ROOT=<site> php tests/e2e/site.php inserer <table> <champs JSON>
 *     insère une ligne telle quelle ; écrit son id.
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$commande = $argv[1] ?? '';
if ($root === '' || !is_dir($root . '/ecrire') || !in_array($commande, ['preparer', 'texte', 'modifier', 'document', 'auteur', 'inserer'], true)) {
	fwrite(STDERR, "Usage : SPIP_ROOT=<site jetable> php tests/e2e/site.php preparer <agent> [titre] [id_auteur] | texte <id_article> | modifier <id_article> | document <id_article> | auteur <statut> | inserer <table> <champs JSON>\n");
	exit(2);
}

// la session SPIP est liée à l'IP et au User-Agent du navigateur
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = $commande === 'preparer' ? (string) ($argv[2] ?? '') : '';

chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('base/abstract_sql');

if ($commande === 'texte') {
	echo (string) sql_getfetsel('texte', 'spip_articles', 'id_article=' . (int) ($argv[2] ?? 0));
	exit(0);
}

if ($commande === 'modifier') {
	sql_updateq('spip_articles', ['texte' => stream_get_contents(STDIN)], 'id_article=' . (int) ($argv[2] ?? 0));
	exit(0);
}

if ($commande === 'auteur') {
	$login = 'tts' . bin2hex(random_bytes(4));
	echo (int) sql_insertq('spip_auteurs', ['nom' => $login, 'login' => $login, 'statut' => (string) ($argv[2] ?? '1comite'), 'email' => $login . '@exemple.test']), "\n";
	exit(0);
}

if ($commande === 'inserer') {
	echo (int) sql_insertq((string) ($argv[2] ?? ''), json_decode((string) ($argv[3] ?? '{}'), true)), "\n";
	exit(0);
}

if ($commande === 'document') {
	$id_article = (int) ($argv[2] ?? 0);
	$fichier = 'png/tts-' . bin2hex(random_bytes(4)) . '.png';
	@mkdir(_DIR_IMG . 'png', 0777, true);
	file_put_contents(_DIR_IMG . $fichier, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
	$id_document = (int) sql_insertq('spip_documents', [
		'extension' => 'png',
		'titre' => 'Image de test',
		'fichier' => $fichier,
		'taille' => filesize(_DIR_IMG . $fichier),
		'largeur' => 1,
		'hauteur' => 1,
		'media' => 'image',
		'mode' => 'document',
		'distant' => 'non',
		'statut' => 'publie',
		'date' => date('Y-m-d H:i:s'),
	]);
	sql_insertq('spip_documents_liens', ['id_document' => $id_document, 'objet' => 'article', 'id_objet' => $id_article, 'vu' => 'non']);
	echo $id_document, "\n";
	exit(0);
}

include_spip('inc/plugin');
ecrire_plugin_actifs(['tiptap_spip'], false, 'ajoute');

$id_rubrique = (int) sql_getfetsel('id_rubrique', 'spip_rubriques', '', '', 'id_rubrique', '0,1');
if (!$id_rubrique) {
	$id_rubrique = (int) sql_insertq('spip_rubriques', ['titre' => 'Tests', 'statut' => 'publie', 'id_secteur' => 0]);
	sql_updateq('spip_rubriques', ['id_secteur' => $id_rubrique], 'id_rubrique=' . $id_rubrique);
}
$id_article = (int) sql_insertq('spip_articles', [
	'titre' => (string) ($argv[3] ?? 'Test tiptap_spip'),
	'texte' => stream_get_contents(STDIN),
	'id_rubrique' => $id_rubrique,
	'id_secteur' => $id_rubrique,
	'statut' => 'prepa',
	'date' => date('Y-m-d H:i:s'),
	'lang' => 'fr',
]);
$id_auteur = (int) ($argv[4] ?? 1);
sql_insertq('spip_auteurs_liens', ['id_auteur' => $id_auteur, 'objet' => 'article', 'id_objet' => $id_article]);

include_spip('inc/session');
$auteur = sql_fetsel('*', 'spip_auteurs', 'id_auteur=' . $id_auteur);
unset($_COOKIE['spip_session']);
$cookie = ajouter_session($auteur);

echo json_encode(['id_article' => $id_article, 'cookie' => $cookie]), "\n";
