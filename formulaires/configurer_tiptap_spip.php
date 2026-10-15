<?php

/**
 * Configuration de l'éditeur (spec 02 « Configuration (CFG) ») : #FORMULAIRE_CONFIGURER_TIPTAP_SPIP,
 * page configurer_tiptap_spip. Écrit la méta tiptap_spip, lue par tiptap_spip_config().
 * L'autorisation configurer est vérifiée par le core pour tout formulaire configurer_*.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('inc/tiptap_spip_config');
include_spip('tiptap_spip_fonctions');

/** Champs dont le fichier de langue a un libellé (champ_<nom>) ; les autres sont affichés par leur nom. */
const TIPTAP_SPIP_CHAMPS_NOMMES = ['texte', 'chapo', 'ps', 'descriptif', 'bio'];

function formulaires_configurer_tiptap_spip_charger_dist() {
	$config = tiptap_spip_config();
	$objets = [];
	foreach (tiptap_spip_champs_candidats() as $objet => $champs) {
		if ($champs) {
			$objets[$objet] = [
				'titre' => _T((string) (objet_info($objet, 'texte_objets') ?: $objet)),
				'champs' => array_combine($champs, array_map(
					static fn ($c) => in_array($c, TIPTAP_SPIP_CHAMPS_NOMMES, true) ? _T('tiptap_spip:champ_' . $c) : $c,
					$champs
				)),
			];
		}
	}
	return [
		'public' => $config['public'],
		'crayons' => $config['crayons'],
		'coller_images' => $config['coller_images'],
		'mode' => $config['mode'],
		'niveaux' => $config['niveaux'],
		'champs' => tiptap_spip_champs_par_objet(),
		'glossaires' => tiptap_spip_glossaires_proposes(),
		'_objets' => $objets,
		'_niveaux' => TIPTAP_SPIP_NIVEAUX,
		'_glossaires' => tiptap_spip_glossaires(),
	];
}

/** Valeurs cochées d'une liste de cases (tableau de chaînes, sinon vide). */
function tiptap_spip_cases($valeur): array {
	return array_values(array_filter((array) $valeur, 'is_string'));
}

function formulaires_configurer_tiptap_spip_verifier_dist() {
	$erreurs = [];
	if (!in_array(_request('mode'), ['visual', 'source'], true)) {
		$erreurs['mode'] = _T('tiptap_spip:cfg_erreur_choix');
	}
	$niveaux = tiptap_spip_cases(_request('niveaux'));
	if (!$niveaux || array_diff($niveaux, array_map('strval', TIPTAP_SPIP_NIVEAUX))) {
		$erreurs['niveaux'] = _T('tiptap_spip:cfg_erreur_niveaux');
	}
	$candidats = tiptap_spip_champs_candidats();
	foreach ((array) _request('champs') as $objet => $champs) {
		if (!isset($candidats[$objet]) || array_diff(tiptap_spip_cases($champs), $candidats[$objet])) {
			$erreurs['champs'] = _T('tiptap_spip:cfg_erreur_choix');
		}
	}
	if (array_diff(tiptap_spip_cases(_request('glossaires')), tiptap_spip_glossaires())) {
		$erreurs['glossaires'] = _T('tiptap_spip:cfg_erreur_choix');
	}
	return $erreurs;
}

function formulaires_configurer_tiptap_spip_traiter_dist() {
	$demandes = (array) _request('champs');
	$champs = [];
	foreach (tiptap_spip_champs_candidats() as $objet => $candidats) {
		// une case par champ candidat : un objet sans case cochée n'a aucun champ équipé
		if ($candidats) {
			$champs[$objet] = array_values(array_intersect($candidats, tiptap_spip_cases($demandes[$objet] ?? [])));
		}
	}
	$glossaires = tiptap_spip_glossaires();
	ecrire_config('tiptap_spip', [
		'public' => _request('public') === 'oui' ? 'oui' : 'non',
		'crayons' => _request('crayons') === 'oui' ? 'oui' : 'non',
		'coller_images' => _request('coller_images') === 'oui' ? 'oui' : 'non',
		'mode' => _request('mode') === 'source' ? 'source' : 'visual',
		'niveaux' => array_values(array_intersect(TIPTAP_SPIP_NIVEAUX, array_map('intval', tiptap_spip_cases(_request('niveaux'))))),
		'champs' => $champs,
		// sans glossaire nommé sur le site, rien à choisir : ceux qui seront déclarés seront proposés
		'glossaires' => $glossaires ? array_values(array_intersect($glossaires, tiptap_spip_cases(_request('glossaires')))) : null,
	]);
	return ['message_ok' => _T('config_info_enregistree'), 'editable' => true];
}
