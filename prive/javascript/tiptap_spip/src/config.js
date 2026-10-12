/**
 * Configuration posée par le serveur (prive/javascript/tiptap_spip_config.js.html) :
 * window.spipConfig.tiptap_spip, objet vide sans elle (tests, page sans le plugin).
 */
export const config = () => globalThis.spipConfig?.tiptap_spip ?? {};
