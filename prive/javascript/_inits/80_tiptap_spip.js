import { chargerExtensions, tiptap_spip_init } from "tiptap_spip.js";
addCSS(spip.tiptap_spip.css, 'tiptap_spip');
// extensions des plugins tiers (pipeline tiptap_spip_extensions) importées avant le lancement
await chargerExtensions();
tiptap_spip_init();
onAjaxLoad(function () { tiptap_spip_init(this); });
