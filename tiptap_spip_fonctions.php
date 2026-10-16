<?php

/**
 * Fonctions du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('inc/tiptap_spip_config');

/**
 * Filtre : chaîne JavaScript entre guillemets, insérable telle quelle dans un <script> (spec 11) :
 * `"`, `'`, `<`, `>` et `&` encodés, donc ni fin de littéral ni `</script>`. Vide → `""`.
 */
function tiptap_spip_js_string(?string $texte): string {
	return (string) json_encode((string) $texte, TIPTAP_SPIP_JSON);
}

/**
 * Filtre : encode une valeur en JSON insérable dans un <script type="application/json">.
 * Valeur vide → chaîne vide (le bloc n'est alors pas affiché).
 *
 * @param mixed $valeur
 */
function tiptap_spip_json($valeur): string {
	return empty($valeur) ? '' : (string) json_encode($valeur, TIPTAP_SPIP_JSON);
}

/**
 * Barres d'outils de l'éditeur (spec 06 §2) : celles de src/ui/barres.json, la déclaration que le
 * bundle embarque aussi, modifiables par le pipeline tiptap_spip_toolbars (flux['data'] : nom de la
 * barre → liste de composants, '|' pour un séparateur).
 *
 * @return array<string, array>
 */
function tiptap_spip_barres(): array {
	$fichier = find_in_path('prive/javascript/tiptap_spip/src/ui/barres.json');
	$barres = $fichier ? json_decode((string) file_get_contents($fichier), true) : null;
	$barres = is_array($barres) ? $barres : [];
	// pipeline() ne rend que data d'un flux ['args' => …, 'data' => …]
	$modifiees = pipeline('tiptap_spip_toolbars', ['args' => [], 'data' => $barres]);
	return is_array($modifiees) ? $modifiees : $barres;
}

/**
 * Filtre pour la configuration JS : barres d'outils en JSON insérable dans un <script>, `null` si
 * aucune (le bundle prend alors les siennes). La valeur filtrée est ignorée.
 */
function tiptap_spip_barres_json($valeur = null): string {
	return (string) json_encode(tiptap_spip_barres() ?: null, TIPTAP_SPIP_JSON);
}

/**
 * Scripts des extensions tierces (spec 07 §3) déclarés par le pipeline tiptap_spip_extensions :
 * flux['data'] = nom → ['src' => chemin ou URL, 'dependances' => [noms]]. Chacun vient après ses
 * dépendances (une dépendance inconnue ou circulaire est ignorée) ; un chemin devient une URL
 * absolue horodatée. Le bundle les importe avant de lancer les éditeurs (chargerExtensions).
 *
 * @return string[] URL dans l'ordre de chargement
 */
function tiptap_spip_extensions(): array {
	$declarees = pipeline('tiptap_spip_extensions', ['args' => [], 'data' => []]);
	$declarees = is_array($declarees) ? $declarees : [];
	$ordre = [];
	$vues = [];
	$visiter = static function (string $nom) use (&$visiter, &$ordre, &$vues, $declarees): void {
		if (isset($vues[$nom]) || !is_array($declarees[$nom] ?? null)) {
			return;
		}
		$vues[$nom] = true;
		foreach ((array) ($declarees[$nom]['dependances'] ?? []) as $dependance) {
			$visiter((string) $dependance);
		}
		$ordre[] = $nom;
	};
	foreach (array_keys($declarees) as $nom) {
		$visiter((string) $nom);
	}
	include_spip('inc/filtres');
	$urls = [];
	foreach ($ordre as $nom) {
		$src = (string) ($declarees[$nom]['src'] ?? '');
		if ($src !== '') {
			$urls[] = preg_match('#^(?:https?:)?//#', $src) ? $src : url_absolue(timestamp($src));
		}
	}
	return $urls;
}

/** Filtre pour la configuration JS : URL des extensions tierces en JSON. La valeur filtrée est ignorée. */
function tiptap_spip_extensions_json($valeur = null): string {
	return (string) json_encode(tiptap_spip_extensions(), TIPTAP_SPIP_JSON | JSON_UNESCAPED_SLASHES);
}

/**
 * Chaînes de langue des plugins tiers (spec 07 §3), ajoutées aux libellés de l'interface par le
 * pipeline tiptap_spip_i18n : flux['data'] = clé → texte (déjà traduit, _T() du plugin).
 *
 * @return array<string, string>
 */
function tiptap_spip_i18n(): array {
	$chaines = [];
	foreach ((array) pipeline('tiptap_spip_i18n', ['args' => [], 'data' => []]) as $cle => $texte) {
		if (is_string($cle) && preg_match('/^\w+$/', $cle) && is_string($texte)) {
			$chaines[$cle] = $texte;
		}
	}
	return $chaines;
}

/** Filtre pour la configuration JS : chaînes des plugins tiers en JSON. La valeur filtrée est ignorée. */
function tiptap_spip_i18n_json($valeur = null): string {
	return (string) json_encode((object) tiptap_spip_i18n(), TIPTAP_SPIP_JSON);
}

/**
 * Catalogue des modèles pour la config JS (`modeles`) : nom du modèle → formulaire du plugin Insérer
 * modèles et ses champs ; null sans le plugin (inc/tiptap_spip_modeles.php).
 */
function tiptap_spip_catalogue_modeles_json($valeur = null): string {
	include_spip('inc/tiptap_spip_modeles');
	return (string) json_encode(tiptap_spip_catalogue_modeles(), TIPTAP_SPIP_JSON);
}

/** Opérations du formulaire de services. */
function tiptap_spip_operations(): array {
	return ['previsu_modele', 'titre_lien', 'rechercher', 'glossaire', 'idiomes'];
}

/**
 * Vrai si $raccourci est exactement un raccourci de glossaire.
 *
 * Provenance des expressions de cette fonction et de tiptap_spip_nom_glossaire() : _RACCOURCI_GLOSSAIRE
 * (ancrée ici) et _RACCOURCI_GLOSES de TextWheel (plugins-dist/textwheel/inc/lien.php, SPIP 4.4.21),
 * © Arnaud Martin, Antoine Pitrou, Philippe Rivière, Emmanuel Saint-James, Collectif SPIP, licence
 * GPL-3.0-or-later. Adaptation du 2026-10-12.
 */
function tiptap_spip_est_glossaire(string $raccourci): bool {
	return (bool) preg_match('/^\[\?+\s*([^][<>]+)\]$/', $raccourci);
}

/**
 * Nom du glossaire d'un raccourci valide (tiptap_spip_est_glossaire()), découpé comme
 * traiter_raccourci_glossaire() : `[?terme#mots12]` → 'mots' ; '' pour le glossaire par défaut.
 */
function tiptap_spip_nom_glossaire(string $raccourci): string {
	preg_match('/^\[\?+\s*([^][<>]+)\]$/', $raccourci, $m);
	if (!preg_match('/^([^|#{]*\w[^|#{]*)([^#]*)(#([^|{}]*))?(.*)$/', $m[1], $r)) {
		return '';
	}
	preg_match('/^(.*?)(\d*)$/', $r[4] ?? '', $n);
	return $n[1];
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
 * Glossaires nommés proposés dans le popover : ceux retenus par la configuration parmi ceux qui
 * existent, tous tant qu'aucun choix n'a été fait. Le glossaire par défaut l'est toujours.
 *
 * @param ?string[] $fonctions  fonctions définies (get_defined_functions() par défaut)
 * @return string[]
 */
function tiptap_spip_glossaires_proposes(?array $fonctions = null): array {
	$tous = tiptap_spip_glossaires($fonctions);
	$choisis = tiptap_spip_config()['glossaires'];
	return $choisis === null ? $tous : array_values(array_intersect($tous, $choisis));
}

/**
 * SPIP 5 : raccourcis de liens traités par le pipeline pre_liens, dont l'écouteur du glossaire, comme
 * le fait expanser_liens() (traiter_raccourci_glossaire() n'y est plus qu'un bouchon qui rend le
 * texte ; pipeline('pre_liens', $texte) passerait un tableau aux fonctions des plugins).
 */
function tiptap_spip_pre_liens(string $texte): string {
	$evenement = new \Spip\Framework\Pipeline\Event\PreLiensEvent($texte);
	pipeline($evenement);
	return $evenement->getText();
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
	$lien = tiptap_spip_spip5() ? tiptap_spip_pre_liens($raccourci) : traiter_raccourci_glossaire($raccourci);
	$url = extraire_attribut((string) $lien, 'href');
	lang_select();
	return is_string($url) && $url !== '' ? $url : null;
}

/**
 * Vrai si $cle est la clé d'un idiome <:module:cle:> (module facultatif).
 *
 * Provenance : expression $preg_idiome de Idiomes (ecrire/src/Texte/Collecteur/Idiomes.php, SPIP 4.4.21),
 * © Arnaud Martin, Antoine Pitrou, Philippe Rivière, Emmanuel Saint-James, licence GNU GPL. Adaptation du
 * 2026-10-12 : réduite à la clé, ancrée.
 */
function tiptap_spip_est_cle_idiome(string $cle): bool {
	return (bool) preg_match('/^(?:[a-z0-9_]+:)?[a-z0-9_]+$/i', $cle);
}

/**
 * Traductions d'idiomes, comme Idiomes::traiter() les calcule au rendu de l'objet : dans sa langue,
 * sinon celle du site ; texte sans balises, null si la chaîne n'existe pas (SPIP laisse alors le
 * raccourci).
 *
 * @param string[] $cles  module:cle ou cle
 * @return list<array{cle: string, texte: ?string}>
 */
function tiptap_spip_traduire_idiomes(array $cles, string $objet = '', int $id_objet = 0): array {
	$traduire = charger_fonction('traduire', 'inc');
	$lang = ($objet !== '' && $id_objet > 0 ? tiptap_spip_lang_objet($objet, $id_objet) : '') ?: ($GLOBALS['meta']['langue_site'] ?? 'fr');
	return array_map(static function (string $cle) use ($traduire, $lang) {
		$desc = $traduire($cle, $lang, true);
		$texte = is_object($desc) ? (string) ($desc->texte ?? '') : '';
		return ['cle' => $cle, 'texte' => $texte === '' ? null : supprimer_tags($texte)];
	}, $cles);
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
 *
 * Provenance : traitements_previsu() du plugin Porte-plume (plugins-dist/porte_plume/
 * porte_plume_fonctions.php, SPIP 4.4.21), de Matthieu Marcillaud et du Collectif SPIP, licence
 * GPL-3.0-or-later. Adaptation du 2026-10-11 : le porte-plume pouvant être absent, la fonction est
 * recopiée ; le contexte des modèles est limité à l'objet édité ($contexte vient des arguments signés
 * du formulaire) au lieu d'une pile vide ; propre() reçoit ce contexte ; la connexion est la principale.
 *
 * @param array $contexte  ['objet' => …, 'id_objet' => …] et id_<objet>
 */
function tiptap_spip_traitements_previsu(string $texte, string $nom_champ, string $type_objet, array $contexte = []): string {
	include_spip('public/interfaces');
	include_spip('inc/texte');

	global $table_des_traitements;
	// variables des traitements évalués (propre(%s, $connect, $Pile[0])) : connexion principale
	$connect = null;
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

/**
 * Évalue le PHP d'un modèle prévisualisé (cf. tiptap_spip_traitements_previsu()).
 *
 * Provenance : traitements_previsu_php_modeles_eval() du plugin Porte-plume (même source et même
 * licence que tiptap_spip_traitements_previsu()), recopiée sans modification de fond le 2026-10-11.
 */
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
