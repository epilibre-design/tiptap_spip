<?php

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Les formulaires tts_test et tts_test_ajax éditent le texte de l'article passé en argument. */
function tts_test_tiptap_spip_contextes($contextes) {
	$contextes['tts_test'] = 'tts_test_contexte';
	$contextes['tts_test_ajax'] = 'tts_test_contexte';
	return $contextes;
}

function tts_test_contexte(array $args): array {
	return ['objet' => 'article', 'id_objet' => intval($args[0] ?? 0), 'champs' => ['texte']];
}
