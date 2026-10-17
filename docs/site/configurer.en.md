# Configure the editor

After activating the plugin, open **Configuration → Visual editor** in the private area. The
settings below apply to the site; each writer can then choose visual or source mode in their
browser.

## Choose where the editor appears

**Fields using the editor** lists compatible fields on your editable objects, such as an article's text,
introduction, or postscript. Deselect a field to keep SPIP's usual editor there. Some short
fields, such as the title, do not appear in this list.

The editor works in the private area whenever a field is selected. **On the public site** and
**In crayons** are independent options, both disabled by default. Enable them if you want the
editor in those contexts too. The **Crayons** plugin must also be active for the latter option to have any effect.

## Enable or disable file uploads

In the **Documents** section, **Paste images and drop documents** is selected by default. Leave
it selected to allow image pasting and file dropping in fields using the editor. Clear it to
disable both features, then save the settings. This setting also applies to the editor inside
Crayons; it does not disable Crayons' own upload feature.

Uploaded files are attached to the edited object and inserted into the text as `<docN>`
shortcuts. Permission to attach documents to that object is still required. See
[Paste images and drop files](utiliser/images-documents.md).

## Set editing preferences

- **Mode when opening**: choose **Visual** or **Source**. If someone has already changed modes in
  their browser, their remembered choice takes precedence next time.
- **Heading levels offered**: select the levels shown in the **Heading** menu. The
  **Subheading** level uses the classic SPIP shortcut; later levels use HTML heading tags.
- **Glossaries offered**: choose the named glossaries shown in the glossary dialog. Shortcuts
  already in your text remain readable.
- **Models offered**: if **Insérer modèles** is installed, configure its catalog in that
  plugin's settings. Otherwise, direct entry of the shortcut remains available.

Save the form, then reopen an editing page to check the affected fields.

## When a field is missing

The editor supports editable fields whose content SPIP processes with typographic shortcuts,
such as **Text**. A custom field may need integration by the plugin that adds it. See
[Troubleshoot](problemes.md) and, for developers, [Build a FAQ extension](developper/faq.md).
