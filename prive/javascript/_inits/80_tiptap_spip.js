import { tiptap_spip_init } from "tiptap_spip.js";
addCSS(spip.tiptap_spip.css, 'tiptap_spip');
tiptap_spip_init();
onAjaxLoad(function () { tiptap_spip_init(this); });
