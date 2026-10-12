<?php

/**
 * Configuration du plugin (méta tiptap_spip, page configurer_tiptap_spip) et champs équipés.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Options d'encodage JSON : aucun < > & ' " littéral, donc ni </script> ni balise dans un bloc JSON. */
const TIPTAP_SPIP_JSON = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

/** Niveaux d'intertitres possibles (spec 03 §3) et proposés par défaut. */
const TIPTAP_SPIP_NIVEAUX = [2, 3, 4, 5, 6];
const TIPTAP_SPIP_NIVEAUX_DEFAUT = [2, 3, 4];

/**
 * Configuration lue dans la méta tiptap_spip, chaque valeur absente ou invalide remplacée par son
 * défaut. `champs` (objet → champs équipés) et `glossaires` (glossaires nommés proposés) valent
 * null tant qu'ils n'ont pas été choisis : tous les candidats.
 *
 * @return array{public: string, crayons: string, mode: string, niveaux: int[], champs: ?array, glossaires: ?string[]}
 */
function tiptap_spip_config(): array {
	include_spip('inc/config');
	$meta = lire_config('tiptap_spip', []);
	$meta = is_array($meta) ? $meta : [];
	$noms = static fn ($liste) => array_values(array_filter((array) $liste, static fn ($n) => is_string($n) && preg_match('/^\w+$/', $n)));
	$niveaux = array_values(array_intersect(TIPTAP_SPIP_NIVEAUX, array_map('intval', (array) ($meta['niveaux'] ?? []))));
	$champs = null;
	if (is_array($meta['champs'] ?? null)) {
		$champs = [];
		foreach ($meta['champs'] as $objet => $liste) {
			if (is_string($objet) && preg_match('/^\w+$/', $objet)) {
				$champs[$objet] = $noms($liste);
			}
		}
	}
	return [
		'public' => ($meta['public'] ?? '') === 'oui' ? 'oui' : 'non',
		'crayons' => ($meta['crayons'] ?? '') === 'oui' ? 'oui' : 'non',
		'mode' => ($meta['mode'] ?? '') === 'source' ? 'source' : 'visual',
		'niveaux' => $niveaux ?: TIPTAP_SPIP_NIVEAUX_DEFAUT,
		'champs' => $champs,
		'glossaires' => is_array($meta['glossaires'] ?? null) ? $noms($meta['glossaires']) : null,
	];
}

/**
 * Champs que l'éditeur peut équiper, par objet éditable : ses champs éditables rendus par propre()
 * (traitement propre à sa table, sinon le traitement général), comme texte, chapo, ps, descriptif ou
 * bio. Les champs passés par typo() (titre, nom_site…) n'acceptent pas les raccourcis de blocs.
 *
 * @return array<string, string[]>
 */
function tiptap_spip_champs_candidats(): array {
	include_spip('base/objets');
	include_spip('public/interfaces');
	$traitements = $GLOBALS['table_des_traitements'] ?? [];
	$candidats = [];
	foreach (lister_tables_objets_sql() as $desc) {
		if (!in_array($desc['editable'] ?? false, ['oui', true], true) || empty($desc['type'])) {
			continue;
		}
		$candidats[$desc['type']] = array_values(array_filter(
			(array) ($desc['champs_editables'] ?? []),
			static function ($champ) use ($traitements, $desc) {
				$t = (array) ($traitements[strtoupper((string) $champ)] ?? []);
				return str_contains((string) ($t[$desc['table_objet'] ?? ''] ?? $t[0] ?? ''), 'propre(');
			}
		));
	}
	return $candidats;
}

/**
 * Champs équipés de l'éditeur pour un objet : ceux choisis dans la configuration parmi ses
 * candidats, tous ses candidats tant que rien n'a été choisi pour lui. null pour un objet que SPIP ne
 * déclare pas éditable.
 *
 * @return ?string[]
 */
function tiptap_spip_champs(string $objet): ?array {
	$candidats = tiptap_spip_champs_candidats()[$objet] ?? null;
	$choisis = tiptap_spip_config()['champs'][$objet] ?? null;
	if ($candidats === null || $choisis === null) {
		return $candidats;
	}
	return array_values(array_intersect($candidats, $choisis));
}

/**
 * Champs équipés de chaque objet éditable.
 *
 * @return array<string, string[]>
 */
function tiptap_spip_champs_par_objet(): array {
	$champs = [];
	foreach (array_keys(tiptap_spip_champs_candidats()) as $objet) {
		$champs[$objet] = tiptap_spip_champs($objet);
	}
	return $champs;
}

/**
 * Filtre pour la configuration JS : réglages utiles au navigateur, en JSON insérable dans un
 * <script>. La valeur filtrée est ignorée.
 */
function tiptap_spip_config_js($valeur = null): string {
	$config = tiptap_spip_config();
	return (string) json_encode([
		'public' => $config['public'] === 'oui',
		'crayons' => $config['crayons'] === 'oui',
		'mode' => $config['mode'],
		'niveaux' => $config['niveaux'],
		'champs' => (object) tiptap_spip_champs_par_objet(),
	], TIPTAP_SPIP_JSON);
}
