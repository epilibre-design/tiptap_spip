<?php

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Formulaire public AJAX de test : deux boutons nommés ; la réponse dit lequel a été posté, et le texte. */
function formulaires_tts_test_ajax_charger_dist($id_article) {
	return ['texte' => '', 'editable' => true];
}

function formulaires_tts_test_ajax_traiter_dist($id_article) {
	$bouton = _request('publier') === 'p' ? 'publier' : (_request('brouillon') === 'b' ? 'brouillon' : 'aucun');
	// message_ok est affiché par #ENV* : texte échappé, sinon <docN> serait lu comme une balise
	return ['message_ok' => 'Bouton : ' . $bouton . ' ; texte : ' . htmlspecialchars((string) _request('texte')), 'editable' => true];
}
