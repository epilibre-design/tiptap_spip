<?php

/**
 * Formulaire CVT de services de l'éditeur (spec 02 §5) : #FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}.
 *
 * Les arguments sont signés par SPIP au calcul (formulaire_action_args) et le POST est lié à la
 * session (formulaire_action_sign) : le JS ne peut viser ni un autre objet ni un autre champ.
 * L'éditeur poste en AJAX une opération et ses paramètres ; le résultat revient en JSON dans
 * message_ok, les erreurs de verifier() dans erreurs (cf. formulaires/tiptap_spip.html).
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('tiptap_spip_fonctions');
include_spip('inc/tiptap_spip_depot');
// dans le site public, autoriser() n'est pas chargé d'office (formulaire chargé à la demande, Crayons)
include_spip('inc/autoriser');

/**
 * Vrai si l'auteur connecté peut utiliser les services pour ce champ.
 * Avec objet : droit de modifier l'objet (de le créer s'il est nouveau) et champ texte de sa table.
 * Sans objet (réglages…) : droit de prévisualiser les modèles.
 */
function tiptap_spip_autoriser_services(string $objet, $id_objet, string $champ): bool {
	if ($objet === '') {
		return autoriser('previsualiser', 'tiptapspipmodele');
	}
	include_spip('base/objets');
	$trouver_table = charger_fonction('trouver_table', 'base');
	$desc = $trouver_table(table_objet_sql($objet));
	if (!$desc || !preg_match('/text/i', (string) ($desc['field'][$champ] ?? ''))) {
		return false;
	}
	return intval($id_objet) > 0
		? autoriser('modifier', $objet, intval($id_objet))
		: autoriser('creer', $objet);
}

function formulaires_tiptap_spip_charger_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	if (!tiptap_spip_autoriser_services((string) $objet, $id_objet, (string) $champ)) {
		return false;
	}
	return [
		'operation' => '',
		'modele' => '',
		'cibles' => '',
		'q' => '',
		'objets' => '',
		'raccourci' => '',
		'cles' => '',
		// collage et dépôt de fichiers (spec 10 §6) : configuration annoncée au JS, null si indisponible
		'_depot' => tiptap_spip_depot((string) $objet, intval($id_objet)),
		'editable' => true,
	];
}

function formulaires_tiptap_spip_verifier_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	// verifier() passe avant charger() au POST : l'autorisation est refaite ici
	if (!tiptap_spip_autoriser_services((string) $objet, $id_objet, (string) $champ)) {
		return ['message_erreur' => _T('tiptap_spip:erreur_autorisation')];
	}
	$erreurs = [];
	switch (_request('operation')) {
		case 'previsu_modele':
			$modele = (string) _request('modele');
			if (mb_strlen($modele) > 2000 || !tiptap_spip_est_modele($modele)) {
				$erreurs['modele'] = _T('tiptap_spip:erreur_modele');
			} elseif (!tiptap_spip_modele_existe(tiptap_spip_nom_modele($modele))) {
				$erreurs['modele'] = _T('tiptap_spip:erreur_modele_inconnu');
			}
			break;
		case 'titre_lien':
			if (tiptap_spip_liste(_request('cibles'), 50, 500) === null) {
				$erreurs['cibles'] = _T('tiptap_spip:erreur_cibles');
			}
			break;
		case 'rechercher':
			$q = trim((string) _request('q'));
			if (mb_strlen($q) < 2 || mb_strlen($q) > 100) {
				$erreurs['q'] = _T('tiptap_spip:erreur_recherche');
			}
			$objets = tiptap_spip_liste(_request('objets'), 10, 30);
			if ($objets === null || array_diff($objets, tiptap_spip_objets_recherche())) {
				$erreurs['objets'] = _T('tiptap_spip:erreur_objets');
			}
			break;
		case 'glossaire':
			// sans raccourci : les glossaires du site seuls ; avec : un glossaire connu (ou celui par défaut)
			$raccourci = (string) _request('raccourci');
			if ($raccourci === '') {
				break;
			}
			if (mb_strlen($raccourci) > 500 || !tiptap_spip_est_glossaire($raccourci)) {
				$erreurs['raccourci'] = _T('tiptap_spip:erreur_glossaire');
			} elseif (!in_array(tiptap_spip_nom_glossaire($raccourci), ['', ...tiptap_spip_glossaires()], true)) {
				$erreurs['raccourci'] = _T('tiptap_spip:erreur_glossaire_inconnu');
			}
			break;
		case 'idiomes':
			$cles = tiptap_spip_liste(_request('cles'), 50, 100);
			if ($cles === null || array_filter($cles, static fn ($c) => !tiptap_spip_est_cle_idiome($c))) {
				$erreurs['cles'] = _T('tiptap_spip:erreur_idiomes');
			}
			break;
		case 'deposer_document':
			// messages dans message_erreur : sinon SPIP y met son message générique
			if (!tiptap_spip_depot((string) $objet, intval($id_objet))) {
				$erreurs['message_erreur'] = _T('tiptap_spip:erreur_depot_indisponible');
			} elseif ($erreur = tiptap_spip_controler_document($_FILES, tiptap_spip_images_types(), tiptap_spip_documents_extensions())) {
				$erreurs['message_erreur'] = $erreur;
			}
			break;
		default:
			$erreurs['operation'] = _T('tiptap_spip:erreur_operation');
	}
	return $erreurs;
}

function formulaires_tiptap_spip_traiter_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	$operation = _request('operation');
	if ($operation === 'deposer_document') {
		// _request() ne lit pas $_FILES : le fichier, contrôlé par verifier(), est lu directement
		$depot = tiptap_spip_deposer_document($_FILES['fichier'], (string) $objet, intval($id_objet));
		if (is_string($depot)) {
			return ['message_erreur' => $depot, 'editable' => true];
		}
	}
	$resultat = match ($operation) {
		'previsu_modele' => tiptap_spip_previsu_modele((string) $objet, intval($id_objet), (string) $champ, (string) _request('modele')),
		'titre_lien' => array_map('tiptap_spip_titre_lien', tiptap_spip_liste(_request('cibles'), 50, 500)),
		'rechercher' => tiptap_spip_rechercher(trim((string) _request('q')), tiptap_spip_liste(_request('objets'), 10, 30)),
		'glossaire' => [
			'url' => _request('raccourci') ? tiptap_spip_url_glossaire((string) _request('raccourci'), (string) $objet, intval($id_objet)) : null,
			'glossaires' => tiptap_spip_glossaires_proposes(),
		],
		'deposer_document' => $depot,
		'idiomes' => tiptap_spip_traduire_idiomes(tiptap_spip_liste(_request('cles'), 50, 100), (string) $objet, intval($id_objet)),
	};
	return [
		'message_ok' => tiptap_spip_json(['operation' => $operation, 'resultat' => $resultat]),
		'editable' => true,
	];
}

/** HTML d'un modèle, calculé avec le contexte de l'objet édité (arguments signés) seulement. */
function tiptap_spip_previsu_modele(string $objet, int $id_objet, string $champ, string $modele): string {
	$contexte = [];
	if ($objet !== '') {
		include_spip('base/objets');
		$contexte = ['objet' => $objet, 'id_objet' => $id_objet, id_table_objet($objet) => $id_objet];
	}
	// pas d'indirection PHP dans les modèles de formulaire
	$GLOBALS['_FORCER_EXECUTER_DIRECTEMENT_BALISE_DYNAMIQUE'] = true;
	$html = tiptap_spip_traitements_previsu($modele, strtoupper($champ), $objet, $contexte);
	unset($GLOBALS['_FORCER_EXECUTER_DIRECTEMENT_BALISE_DYNAMIQUE']);
	return $html;
}

/**
 * Titre et URL qu'aura un lien [->cible]. Pour un objet SPIP, le titre n'est donné que si l'auteur
 * peut voir l'objet.
 *
 * @return array{cible: string, titre: ?string, url: ?string, objet: ?string, id: ?int}
 */
function tiptap_spip_titre_lien(string $cible): array {
	include_spip('inc/lien');
	include_spip('base/objets');
	$r = ['cible' => $cible, 'titre' => null, 'url' => null, 'objet' => null, 'id' => null];
	$match = typer_raccourci($cible);
	if ($match && !empty($match[0])) {
		$objet = objet_type($match[0]);
		$id = intval($match[2] ?? 0);
		$r['objet'] = $objet;
		$r['id'] = $id;
		if ($id && autoriser('voir', $objet, $id)) {
			$titre = traiter_raccourci_titre($id, $objet);
			$r['titre'] = $titre ? supprimer_tags(typo($titre['titre'])) : null;
			$r['url'] = generer_objet_url($id, $objet) ?: null;
		}
		return $r;
	}
	if (str_starts_with($cible, '#')) {
		return $r;
	}
	$lien = calculer_url($cible, '', 'tout', '', false);
	if (is_array($lien) && $lien['url'] !== '') {
		$r['titre'] = supprimer_tags((string) $lien['titre']);
		$r['url'] = (string) $lien['url'];
	}
	return $r;
}

/**
 * Objets dont le titre contient $q, visibles par l'auteur, 20 au plus, les plus récemment
 * modifiés d'abord tous types confondus. L'autorisation est appliquée avant de retenir les 20 :
 * des objets invisibles en tête ne masquent pas les objets visibles qui suivent.
 *
 * @param string[] $objets
 * @return list<array{objet: string, id: int, titre: string, raccourci: string}>
 */
function tiptap_spip_rechercher(string $q, array $objets): array {
	include_spip('base/objets');
	include_spip('base/abstract_sql');
	$trouver_table = charger_fonction('trouver_table', 'base');
	$suites = [];
	foreach ($objets as $objet) {
		$table = table_objet_sql($objet);
		$desc = $trouver_table($table);
		if (!$desc) {
			continue;
		}
		// champ titre déclaré par l'objet (« titre, lang », « nom_site AS titre »…) : on garde le premier
		$champ_titre = trim(preg_split('/[\s,]/', (string) ($desc['titre'] ?? 'titre'))[0]);
		if (!isset($desc['field'][$champ_titre])) {
			continue;
		}
		$where = [$champ_titre . ' LIKE ' . sql_quote('%' . addcslashes($q, '%_\\') . '%')];
		if (isset($desc['field']['statut'])) {
			$where[] = "statut != 'poubelle'";
		}
		$suites[] = tiptap_spip_objets_visibles($objet, $table, $champ_titre, isset($desc['field']['maj']), $where);
	}
	return array_map(
		static fn (array $ligne) => [
			'objet' => $ligne['objet'],
			'id' => $ligne['id'],
			'titre' => supprimer_tags(typo($ligne['titre'])),
			'raccourci' => $ligne['objet'] . $ligne['id'],
		],
		tiptap_spip_fusionner_recents($suites, 20)
	);
}

/**
 * Objets d'un type qui vérifient $where, du plus récemment modifié au plus ancien, visibles par
 * l'auteur. Lus par pages de 50, au fur et à mesure que la fusion les demande.
 *
 * @return \Generator<array{objet: string, id: int, titre: string, maj: string}>
 */
function tiptap_spip_objets_visibles(string $objet, string $table, string $champ_titre, bool $avec_maj, array $where): \Generator {
	$id_table = id_table_objet($objet);
	$maj = $avec_maj ? 'maj' : "''";
	$ordre = $avec_maj ? "maj DESC, $id_table DESC" : "$id_table DESC";
	$page = 50;
	$debut = 0;
	do {
		$lignes = sql_allfetsel("$id_table AS id, $champ_titre AS titre, $maj AS maj", $table, $where, '', $ordre, "$debut,$page");
		foreach ($lignes as $ligne) {
			$id = intval($ligne['id']);
			if (autoriser('voir', $objet, $id)) {
				yield ['objet' => $objet, 'id' => $id, 'titre' => (string) $ligne['titre'], 'maj' => (string) $ligne['maj']];
			}
		}
		$debut += $page;
	} while (count($lignes) === $page);
}
