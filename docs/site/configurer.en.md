# Configure the editor

After activating the plugin, open **Configuration → Visual editor** in the private area. The
settings below apply to the site; each writer can then choose visual or source mode in their
browser.

## Choose where the editor appears

**Enabled fields** lists compatible fields on your editable objects, such as an article's text,
introduction, or postscript. Deselect a field to keep SPIP's usual editor there. Some short
fields, such as the title, do not appear in this list.

The editor works in the private area whenever a field is selected. **On the public site** and
**In Crayons** are independent options, both disabled by default. Enable them if you want the
editor in those contexts too. The **Crayons** plugin must be installed to use the latter option.

## Set editing preferences

- **Initial mode**: choose **Visual** or **Source**. If someone has already changed modes in
  their browser, their remembered choice takes precedence next time.
- **Available heading levels**: select the levels shown in the **Heading** menu. The
  **Intertitle** level uses the classic SPIP shortcut; later levels use HTML heading tags.
- **Available glossaries**: choose the named glossaries shown in the glossary dialog. Shortcuts
  already in your text remain readable.
- **Available models**: if **Insérer modèles** is installed, configure its catalog in that
  plugin's settings. Otherwise, direct entry of the shortcut remains available.

Save the form, then reopen an editing page to check the affected fields.

## When a field is missing

The editor supports editable fields whose content SPIP processes with typographic shortcuts,
such as **Text**. A custom field may need integration by the plugin that adds it. See
[Troubleshoot](problemes.md) and, for developers, [Build an extension](developper/faq.md).
