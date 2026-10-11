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
	return ['previsu_modele', 'titre_lien', 'rechercher'];
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
