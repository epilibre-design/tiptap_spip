// Fin de la suite e2e : efface les champs équipés des articles que editer() (site.js) a réglés.
import { CHAMPS_ARTICLE, effacerConfig } from './site.js';

export default function nettoyage() {
	if (process.env.TTS_SITE) effacerConfig(CHAMPS_ARTICLE);
}
