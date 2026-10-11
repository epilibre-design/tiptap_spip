<?php

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Glossaire nommé de test : [?terme#tts12] pointe vers le site de test. */
function glossaire_tts($terme, $id = 0) {
	return 'https://glossaire.test/' . rawurlencode((string) $terme) . '/' . intval($id);
}
