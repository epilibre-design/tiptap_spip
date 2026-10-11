<?php

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Formulaire public de test : un textarea « texte », renvoyé tel quel après envoi. */
function formulaires_tts_test_charger_dist($id_article) {
	return ['texte' => '', 'editable' => true];
}

function formulaires_tts_test_traiter_dist($id_article) {
	return ['message_ok' => 'Reçu : ' . strlen((string) _request('texte')) . ' caractères', 'editable' => true];
}
