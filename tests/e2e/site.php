<?php

/**
 * Pilote d'un site SPIP JETABLE pour les tests de bout en bout (jamais un site réel : la
 * commande active le plugin et ouvre une session d'administrateur).
 *
 * Usage :
 *   SPIP_ROOT=<site> php tests/e2e/site.php preparer <agent> < texte.spip
 *     active le plugin tiptap_spip, crée un article avec le texte lu sur l'entrée standard et
 *     une session pour l'auteur 1 ; écrit {"id_article": …, "cookie": …} sur la sortie.
 *     <agent> : User-Agent du navigateur de test (la session SPIP en dépend).
 *   SPIP_ROOT=<site> php tests/e2e/site.php texte <id_article>
 *     écrit le texte de l'article, octet pour octet.
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$commande = $argv[1] ?? '';
if ($root === '' || !is_dir($root . '/ecrire') || !in_array($commande, ['preparer', 'texte'], true)) {
	fwrite(STDERR, "Usage : SPIP_ROOT=<site jetable> php tests/e2e/site.php preparer <agent> | texte <id_article>\n");
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

include_spip('inc/plugin');
ecrire_plugin_actifs(['tiptap_spip'], false, 'ajoute');

$id_rubrique = (int) sql_getfetsel('id_rubrique', 'spip_rubriques', '', '', 'id_rubrique', '0,1');
if (!$id_rubrique) {
	$id_rubrique = (int) sql_insertq('spip_rubriques', ['titre' => 'Tests', 'statut' => 'publie', 'id_secteur' => 0]);
	sql_updateq('spip_rubriques', ['id_secteur' => $id_rubrique], 'id_rubrique=' . $id_rubrique);
}
$id_article = (int) sql_insertq('spip_articles', [
	'titre' => 'Test tiptap_spip',
	'texte' => stream_get_contents(STDIN),
	'id_rubrique' => $id_rubrique,
	'id_secteur' => $id_rubrique,
	'statut' => 'prepa',
	'date' => date('Y-m-d H:i:s'),
	'lang' => 'fr',
]);
sql_insertq('spip_auteurs_liens', ['id_auteur' => 1, 'objet' => 'article', 'id_objet' => $id_article]);

include_spip('inc/session');
$auteur = sql_fetsel('*', 'spip_auteurs', 'id_auteur=1');
unset($_COOKIE['spip_session']);
$cookie = ajouter_session($auteur);

echo json_encode(['id_article' => $id_article, 'cookie' => $cookie]), "\n";
