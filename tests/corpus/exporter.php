<?php

/**
 * Exporte les champs chapo, texte et ps des articles d'un site SPIP, un fichier par champ,
 * vers un dossier local NON versionné (corpus réel : jamais commité).
 * Usage : SPIP_ROOT=/chemin/vers/spip php tests/corpus/exporter.php <dossier> [limite=500]
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$out = $argv[1] ?? '';
$limite = max(1, (int) ($argv[2] ?? 500));
if ($root === '' || $out === '') {
	fwrite(STDERR, "Usage : SPIP_ROOT=… php tests/corpus/exporter.php <dossier> [limite]\n");
	exit(2);
}
if (!is_dir($out) && !mkdir($out, 0777, true)) {
	fwrite(STDERR, "Impossible de créer $out\n");
	exit(1);
}
$out = realpath($out);

chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('base/abstract_sql');

$n = 0;
$articles = sql_allfetsel('id_article, chapo, texte, ps', 'spip_articles', '', '', 'id_article DESC', "0,$limite");
foreach ($articles as $article) {
	foreach (['chapo', 'texte', 'ps'] as $champ) {
		$texte = (string) $article[$champ];
		if (trim($texte) === '') {
			continue;
		}
		file_put_contents("$out/article{$article['id_article']}-$champ.spip", $texte);
		$n++;
	}
}
echo "$n fichiers exportés dans $out\n";
