# Troubleshoot

## I cannot see the editor

Check that the plugin is **active** under **Configuration → Plugin management**. Then open
**Configuration → Visual editor** and check that the field is selected. Only fields using SPIP
typographic shortcuts are offered. On the public site or in Crayons, also check the corresponding
enable option.

If you see SPIP syntax in a text area with a **Source** button, click it to return to visual mode.
Your mode choice is remembered in the browser.

## A passage appears as code

The text may contain an incomplete shortcut, unusual HTML, or syntax added by another plugin.
The editor keeps that passage as source to avoid changing it without your knowledge. Click it to
edit it, or switch to **Source**. A **syntax issue** indicator below the editor flags some
incomplete shortcuts; click it for an explanation.

If your site frequently uses syntax added by another plugin, ask its developer for an
[editor extension](developper/faq.md), or disable the visual editor for the affected fields.

## A model has no catalog or preview

You can enter a shortcut without another plugin. The catalog requires the optional
**Insérer modèles** plugin, its configuration, and the necessary permissions. With the current
version of that optional plugin, the catalog is unavailable on SPIP 5.

A preview may also be missing if the model cannot be rendered in the article's context. The
shortcut remains visible, and SPIP still controls public rendering.

## I want to return to the old editor

Under **Configuration → Visual editor**, deselect the affected fields. You can also deactivate
the plugin in the plugin manager. Saved text still uses SPIP syntax, so it remains editable in
the usual editor.

For a reproducible problem, provide the SPIP version, the affected field, and steps to reproduce
it on the [project issue tracker](https://github.com/epilibre-design/tiptap_spip/issues).
