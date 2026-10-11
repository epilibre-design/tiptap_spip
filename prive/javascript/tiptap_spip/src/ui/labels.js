/**
 * Libellés de l'interface : chaînes de langue SPIP transmises par la configuration
 * (window.spipConfig.tiptap_spip.i18n), français par défaut.
 */
const DEFAUTS = {
	mode_source: 'Source',
	lien: 'Lien',
	modele: 'Modèle',
	lien_cible: 'Cible (art12, rub3, https://…)',
	lien_rechercher: 'Rechercher un contenu',
	lien_bulle: 'Bulle d’aide',
	lien_langue: 'Langue de la cible',
	lien_nouvelle_fenetre: 'Ouvrir dans une nouvelle fenêtre',
	lien_ouvrir: 'Ouvrir',
	lien_retirer: 'Retirer le lien',
	lien_figer: 'Figer le titre',
	lien_cible_obligatoire: 'Indiquez une cible.',
	modele_raccourci: 'Raccourci du modèle',
	modele_modifier: 'Modifier',
	modele_invalide: 'Ce n’est pas un raccourci de modèle.',
	appliquer: 'Appliquer',
	annuler: 'Annuler',
};

export const label = (key) => globalThis.spipConfig?.tiptap_spip?.i18n?.[key] ?? DEFAUTS[key] ?? key;
