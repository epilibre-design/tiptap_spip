<?php

/**
 * Catalogue des modèles (spec 05 §3, question Q3) : formulaires YAML du plugin Insérer modèles,
 * facultatif. L'éditeur ouvre son formulaire en modalbox et en reprend le raccourci produit.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/**
 * Champs dont le plugin écrit la valeur seule (`|left`) plutôt que `champ=valeur` (cf. son traiter()).
 */
const TIPTAP_SPIP_MODELES_VALEURS_NUES = ['variante', 'classe', 'align'];

/**
 * Description d'un formulaire de modèle tirée de ses saisies (imbrications comprises) : ce qu'il faut
 * pour préremplir le formulaire avec un modèle existant.
 *
 * @param array $parametres  saisies du YAML (clé `parametres`)
 * @return ?array{modele: string, id: ?string, champs: string[], valeurs: array<string, string>, multiples: string[]}
 *   modele : défaut de la saisie `modele` ; id : `id_modele` s'il existe ; champs : les autres champs ;
 *   valeurs : valeur seule → champ (align, variante, classe) ; multiples : cases à cocher, écrites
 *   `champ=a,b`. Null sans saisie `modele`.
 */
function tiptap_spip_decrire_formulaire_modele(array $parametres): ?array {
	$modele = '';
	$id = null;
	$champs = [];
	$valeurs = [];
	$multiples = [];
	$parcourir = static function (array $saisies) use (&$parcourir, &$modele, &$id, &$champs, &$valeurs, &$multiples): void {
		foreach ($saisies as $saisie) {
			if (!is_array($saisie)) {
				continue;
			}
			$options = is_array($saisie['options'] ?? null) ? $saisie['options'] : [];
			$nom = (string) ($options['nom'] ?? '');
			if (is_array($saisie['saisies'] ?? null)) {
				$parcourir($saisie['saisies']);
			} elseif ($nom === 'modele') {
				$modele = (string) ($options['defaut'] ?? '');
			} elseif ($nom === 'id_modele') {
				$id = $nom;
			} elseif ($nom !== '') {
				$champs[] = $nom;
				if (($saisie['saisie'] ?? '') === 'checkbox') {
					$multiples[] = $nom;
				}
				if (in_array($nom, TIPTAP_SPIP_MODELES_VALEURS_NUES, true) && is_array($options['data'] ?? null)) {
					foreach (array_keys($options['data']) as $valeur) {
						$valeurs[(string) $valeur] = $nom;
					}
				}
			}
		}
	};
	$parcourir($parametres);
	if ($modele === '') {
		return null;
	}
	return ['modele' => $modele, 'id' => $id, 'champs' => $champs, 'valeurs' => $valeurs, 'multiples' => $multiples];
}

/**
 * Catalogue des modèles proposés : nom du modèle → description de son formulaire
 * (+ `formulaire`, nom du YAML, et `nom`, son libellé). Les modèles ignorés dans la configuration du
 * plugin sont exclus ; un modèle produit par deux formulaires garde le premier.
 *
 * @param ?callable $lister  formulaires → ['nom' => …, 'parametres' => saisies] ; par défaut ceux du
 *   plugin (inserer_modeles_lister_formulaires_modeles(true), saisies par charger_infos_formulaire_modele())
 * @return ?array  null sans le plugin Insérer modèles
 */
function tiptap_spip_catalogue_modeles(?callable $lister = null): ?array {
	if (!$lister) {
		if (!defined('_DIR_PLUGIN_INSERER_MODELES')) {
			return null;
		}
		include_spip('inc/inserer_modeles');
		if (!function_exists('inserer_modeles_lister_formulaires_modeles')) {
			return null;
		}
		// la liste ne donne que nom, catégorie et icône : saisies lues dans le YAML de chaque formulaire
		$lister = static function (): array {
			$liste = [];
			foreach (inserer_modeles_lister_formulaires_modeles(true) as $formulaire => $infos) {
				$liste[$formulaire] = $infos + ['parametres' => charger_infos_formulaire_modele($formulaire)['parametres'] ?? []];
			}
			return $liste;
		};
	}
	$catalogue = [];
	foreach ($lister() as $formulaire => $infos) {
		$description = tiptap_spip_decrire_formulaire_modele(is_array($infos['parametres'] ?? null) ? $infos['parametres'] : []);
		if ($description && !isset($catalogue[$description['modele']])) {
			$catalogue[$description['modele']] = ['formulaire' => (string) $formulaire, 'nom' => (string) ($infos['nom'] ?? $formulaire)] + $description;
		}
	}
	return $catalogue;
}
