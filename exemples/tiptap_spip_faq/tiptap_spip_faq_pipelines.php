<?php

/**
 * Pipelines de l'exemple FAQ : ce qu'un plugin tiers déclare pour ajouter un raccourci à l'éditeur
 * visuel sans modifier tiptap_spip (spec 07 §3), et le rendu du raccourci, qui reste à sa charge.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/**
 * Raccourci <faq|q=Question>, une ligne, le contenu, une ligne </faq> (comme le motif du JS) ; fins
 * de ligne CRLF comprises, telles que le navigateur les enregistre.
 */
const TIPTAP_SPIP_FAQ = '/^<faq\|q=([^>\r\n]*)>\r?\n(.*?)\r?\n<\/faq>/ms';

/** Script de l'extension, chargé par l'éditeur avant le lancement. */
function tiptap_spip_faq_tiptap_spip_extensions($flux) {
	$flux['data']['faq'] = ['src' => find_in_path('javascript/tiptap_spip_faq.js')];
	return $flux;
}

/** Bouton « FAQ » dans la barre d'édition, après le cadre. */
function tiptap_spip_faq_tiptap_spip_toolbars($flux) {
	$edition = $flux['data']['edition'] ?? [];
	$position = array_search('cadre', $edition, true);
	array_splice($edition, $position === false ? count($edition) : $position + 1, 0, ['faq']);
	$flux['data']['edition'] = $edition;
	return $flux;
}

/** Libellés du bouton et de son popover. */
function tiptap_spip_faq_tiptap_spip_i18n($flux) {
	foreach (['faq', 'faq_question', 'faq_question_invalide'] as $cle) {
		$flux['data'][$cle] = _T('tiptap_spip_faq:' . $cle);
	}
	return $flux;
}

function tiptap_spip_faq_header_prive_css($flux) {
	return $flux . tiptap_spip_faq_css();
}

function tiptap_spip_faq_insert_head_css($flux) {
	return $flux . tiptap_spip_faq_css();
}

function tiptap_spip_faq_css(): string {
	$css = find_in_path('css/tiptap_spip_faq.css');
	return $css ? '<link rel="stylesheet" href="' . timestamp($css) . '" type="text/css" />' . "\n" : '';
}

/**
 * Rendu : chaque FAQ devient un bloc, la question en tête ; le contenu reste traité par propre()
 * (lignes vides autour pour qu'il soit mis en paragraphes). <faq|q=…> a la forme d'un modèle : la
 * transformation passe donc avant les modèles et les échappements (pre_echappe_html_propre).
 */
function tiptap_spip_faq_pre_echappe_html_propre($texte) {
	if (!str_contains((string) $texte, '<faq')) {
		return $texte;
	}
	return preg_replace_callback(TIPTAP_SPIP_FAQ, static fn ($m) => '<div class="faq">'
		. '<p class="faq__question"><strong>' . htmlspecialchars($m[1], ENT_NOQUOTES) . '</strong></p>'
		. "\n\n" . $m[2] . "\n\n</div>", (string) $texte);
}
