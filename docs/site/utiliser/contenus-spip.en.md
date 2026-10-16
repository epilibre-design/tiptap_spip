# Insert SPIP content

The editor retains SPIP-specific features. Dialogs spare you from memorizing their syntax, while
you can still [access the source](../premiers-pas.md#switch-to-source-and-back).

## Links to a page or document

Select the link text and click **Link**. Enter a web address or search for a site object, such
as an article or section. The dialog also lets you add a tooltip, a language, or an option to
open in a new window. To edit an existing link, place the cursor inside it and reopen **Link**.

In source mode, an internal link might be written `[Read the article->art12]`.

## Notes and glossaries

**Note** inserts a numbered reference in the text. Its dialog has a small editor of its own and
supports bold text, links, lists, and more. A panel below the editor gathers the text's notes;
click one to edit it. You can also name a note or place it without an in-text reference.

See [Enter footnotes](notes-de-bas-de-page.md) for the dialog steps and options.

**Glossary** associates a term with a definition: select the word, then open **Glossary**. You
can choose a glossary, specify a tooltip or language, and check the destination with
**View definition**.

## Images, documents, and other models

A shortcut such as `<doc12|center>` is a SPIP **model**. The editor can show a preview, but SPIP
calculates the final display. The **Model** button always lets you enter the shortcut. If the
optional **Insérer modèles** plugin is installed and compatible with your SPIP version, its
catalog and forms are offered. On SPIP 5, the catalog is unavailable with the current version
of that optional plugin: enter the shortcut directly.

To upload files from the editor, see [Paste images and drop files](images-documents.md).

## Multiple languages in one text

The **Multi** button creates language-specific versions of a passage. See
[Use multis](multilinguisme.md) to enable the button, switch the displayed language while editing,
and fill in the multi window.

In the multi window, choose the language of each version from the list. It offers the languages
enabled in that configuration; a language already present in the multi is still offered.
**No language** is the version shown when no other one matches.

## If a passage appears as code

A malformed shortcut or syntax added by another plugin may remain as raw source. Click it to
view and, if needed, correct its source; you can also use **Source**. This keeps the editor from
rewriting a fragment it cannot represent. For syntax specific to your site, a developer can
create an [editor extension](../developper/faq.md).
