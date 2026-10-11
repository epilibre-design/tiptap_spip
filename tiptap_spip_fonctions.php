<?php

/**
 * Fonctions du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Options d'encodage JSON : aucun < > & ' " littéral, donc ni </script> ni balise dans un bloc JSON. */
const TIPTAP_SPIP_JSON = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

/**
 * Filtre : encode une valeur en JSON insérable dans un <script type="application/json">.
 * Valeur vide → chaîne vide (le bloc n'est alors pas affiché).
 *
 * @param mixed $valeur
 */
function tiptap_spip_json($valeur): string {
	return empty($valeur) ? '' : (string) json_encode($valeur, TIPTAP_SPIP_JSON);
}

/** Opérations du formulaire de services. */
function tiptap_spip_operations(): array {
	return ['previsu_modele', 'titre_lien', 'rechercher', 'glossaire'];
}

/** Vrai si $raccourci est exactement un raccourci de glossaire (_RACCOURCI_GLOSSAIRE du core, ancrée). */
function tiptap_spip_est_glossaire(string $raccourci): bool {
	return (bool) preg_match('/^\[\?+\s*([^][<>]+)\]$/', $raccourci);
}

/**
 * Glossaires nommés disponibles (`[?terme#nom]`) : le core appelle glossaire_<nom>() si elle existe
 * (liens_implicite_glose_dist()) ; glossaire_std() est le glossaire par défaut.
 *
 * @param ?string[] $fonctions  fonctions définies (get_defined_functions() par défaut)
 * @return string[] noms triés
 */
function tiptap_spip_glossaires(?array $fonctions = null): array {
	$noms = [];
	foreach ($fonctions ?? get_defined_functions()['user'] as $fonction) {
		if (preg_match('/^glossaire_(\w+)$/', $fonction, $m) && $m[1] !== 'std') {
			$noms[$m[1]] = true;
		}
	}
	$noms = array_keys($noms);
	sort($noms);
	return $noms;
}

/**
 * URL de la définition d'un terme (raccourci valide), telle que SPIP la calcule au rendu de l'objet :
 * dans sa langue (le glossaire par défaut en dépend : @lang@.wikipedia.org), sinon celle du site.
 */
function tiptap_spip_url_glossaire(string $raccourci, string $objet = '', int $id_objet = 0): ?string {
	include_spip('inc/lien');
	include_spip('inc/filtres');
	include_spip('inc/lang');
	$lang = $objet !== '' && $id_objet > 0 ? tiptap_spip_lang_objet($objet, $id_objet) : '';
	lang_select($lang ?: ($GLOBALS['meta']['langue_site'] ?? 'fr'));
	$url = extraire_attribut(traiter_raccourci_glossaire($raccourci), 'href');
	lang_select();
	return is_string($url) && $url !== '' ? $url : null;
}

/** Langue d'un objet, '' si sa table n'en a pas. */
function tiptap_spip_lang_objet(string $objet, int $id_objet): string {
	include_spip('base/objets');
	include_spip('base/abstract_sql');
	$table = table_objet_sql($objet);
	$trouver_table = charger_fonction('trouver_table', 'base');
	$desc = $trouver_table($table);
	if (!$desc || !isset($desc['field']['lang'])) {
		return '';
	}
	return (string) sql_getfetsel('lang', $table, id_table_objet($objet) . '=' . $id_objet);
}

/** Objets proposés par la recherche (filtrés ensuite par les tables présentes). */
function tiptap_spip_objets_recherche(): array {
	return ['article', 'rubrique', 'breve', 'document', 'auteur', 'mot', 'site'];
}

/**
 * Vrai si $modele est exactement un raccourci de modèle (regex du core, ancrée), avec id ou
 * paramètres (sinon c'est une balise HTML).
 */
function tiptap_spip_est_modele(string $modele): bool {
	return (bool) preg_match('/^<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>$/i', $modele, $m)
		&& ($m[2] !== '' || ($m[3] ?? '') !== '');
}

/** Nom du modèle d'un raccourci valide (tiptap_spip_est_modele()). */
function tiptap_spip_nom_modele(string $modele): string {
	preg_match('/^<([a-z_-]{3,})/i', $modele, $m);
	return strtolower($m[1]);
}

/**
 * Vrai si un modèle de ce nom peut être calculé : modèle d'un objet (doc, img, emb des documents,
 * stylisés par styliser_modele()) ou squelette modeles/<nom>.html.
 */
function tiptap_spip_modele_existe(string $nom): bool {
	include_spip('base/objets');
	foreach (lister_tables_objets_sql() as $desc) {
		if (in_array($nom, $desc['modeles'] ?? [], true)) {
			return true;
		}
	}
	return (bool) trouve_modele($nom);
}

/**
 * Fusionne des suites de lignes triées par `maj` décroissante (date de dernière modification) en
 * une liste des $max plus récentes. Les suites sont lues au fur et à mesure (générateurs) : rien
 * n'est lu au-delà du nécessaire. À `maj` égale, l'ordre des suites départage.
 *
 * @param iterable[] $suites
 * @return array[]
 */
function tiptap_spip_fusionner_recents(array $suites, int $max): array {
	$iterateurs = [];
	foreach ($suites as $suite) {
		$iterateur = $suite instanceof \Iterator ? $suite : new \ArrayIterator(is_array($suite) ? $suite : iterator_to_array($suite, false));
		$iterateur->rewind();
		if ($iterateur->valid()) {
			$iterateurs[] = $iterateur;
		}
	}
	$resultat = [];
	while (count($resultat) < $max && $iterateurs) {
		$meilleur = null;
		foreach ($iterateurs as $k => $iterateur) {
			if ($meilleur === null || strcmp((string) $iterateur->current()['maj'], (string) $iterateurs[$meilleur]->current()['maj']) > 0) {
				$meilleur = $k;
			}
		}
		$resultat[] = $iterateurs[$meilleur]->current();
		$iterateurs[$meilleur]->next();
		if (!$iterateurs[$meilleur]->valid()) {
			unset($iterateurs[$meilleur]);
		}
	}
	return $resultat;
}

/**
 * Liste JSON de chaînes, de 1 à $max éléments d'au plus $longueur caractères chacun ; null sinon.
 *
 * @return string[]|null
 */
function tiptap_spip_liste(?string $json, int $max, int $longueur): ?array {
	$liste = json_decode((string) $json, true);
	if (!is_array($liste) || !array_is_list($liste) || !$liste || count($liste) > $max) {
		return null;
	}
	foreach ($liste as $valeur) {
		if (!is_string($valeur) || $valeur === '' || mb_strlen($valeur) > $longueur) {
			return null;
		}
	}
	return $liste;
}

/**
 * Applique à un texte les traitements SPIP d'un champ, puis safehtml().
 * Reprise de traitements_previsu() du porte-plume (et de markdown_editor), qui peut être absent, avec un
 * contexte de modèle limité à l'objet édité : $contexte vient des arguments signés du formulaire.
 *
 * @param array $contexte  ['objet' => …, 'id_objet' => …] et id_<objet>
 */
function tiptap_spip_traitements_previsu(string $texte, string $nom_champ, string $type_objet, array $contexte = []): string {
	include_spip('public/interfaces');
	include_spip('inc/texte');

	global $table_des_traitements;
	$Pile = [0 => $contexte];
	$ps = $table_des_traitements[$nom_champ] ?? null;
	if (is_array($ps)) {
		include_spip('base/abstract_sql');
		$table = table_objet($type_objet);
		$ps = $ps[(strlen($table) && isset($ps[$table])) ? $table : 0] ?? null;
	}
	if (!$ps) {
		$texte = propre($texte, null, $contexte);
	} else {
		eval('$texte=' . str_replace('%s', '$texte', $ps) . ';');
	}

	// PHP issu des modèles : pas d'eval final ici, contrairement aux pages SPIP
	include_spip('inc/autoriser');
	if (defined('_PROTEGE_PHP_MODELES') && autoriser('previsualiser', 'modelesphp')) {
		$texte = echappe_retour($texte, 'php' . _PROTEGE_PHP_MODELES, 'tiptap_spip_eval_php_modeles');
	}

	// toujours sécuriser : le contenu ne vient pas forcément de l'auteur connecté
	return safehtml($texte);
}

/** Évalue le PHP d'un modèle prévisualisé (cf. tiptap_spip_traitements_previsu()). */
function tiptap_spip_eval_php_modeles($php) {
	ob_start();
	try {
		eval('?>' . $php);
		$texte = ob_get_contents();
	} catch (\Throwable $e) {
		$texte = '<!-- Erreur -->';
	}
	ob_end_clean();
	return $texte;
}
