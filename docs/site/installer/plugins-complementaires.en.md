# Optional plugins

**Insérer modèles** and **Coloration Code** are optional: the visual editor works without them. You
can activate them in SPIP's plugin manager. **Porte-plume**, which ships with SPIP, coexists with the
visual editor.

## Porte-plume

Porte-plume is one of the plugins that ship with SPIP. The visual editor does not rely on it: it
recognizes fields equipped with Porte-plume's editing and forum toolbars, removes the toolbar and
takes its place. Porte-plume remains available on fields you exclude in the
[configuration](../configurer.md).

The visual editor's **Source** button shows SPIP syntax in a plain text area, without the
Porte-plume toolbar.

Plugin documentation: [Porte-plume on SPIP-Contrib](https://contrib.spip.net/Porte-plume-3117) (in French).

## Insérer modèles

This plugin adds a catalog and forms to **Model** for inserting a model or editing an existing
model's parameters. Its catalog depends on the models configured in the plugin and the author's
permissions.

Without Insérer modèles, you can still enter a shortcut such as `<doc12|center>` directly. With
the current version of this plugin, its catalog is unavailable on SPIP 5. See also
[Insert SPIP content](../utiliser/contenus-spip.md#images-documents-and-other-models).

Plugin documentation: [Insérer modèles on SPIP-Contrib](https://contrib.spip.net/Plugin-Inserer-Modeles) (in French).

## Coloration Code

This plugin highlights the code in code blocks on the public site. When it is active, the visual
editor also highlights code blocks as you type, with the same languages and theme as the site:
for example, type ```` ```php ```` followed by a space, then your code.

The language comes from the block (```` ```php ````) or from the tag's class
(`<code class="css">`). A block without a language stays plain text. Without Coloration Code, the
editor does not highlight code: it only shows the language of ```` ```php ```` blocks in the top
right corner, as SPIP does.

Plugin documentation: [Coloration Code on SPIP-Contrib](https://contrib.spip.net/Coloration-Code) (in French).
