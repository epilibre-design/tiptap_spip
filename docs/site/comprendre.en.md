# How the editor works

This page explains what happens behind the interface. You do not need it to write an article.

## SPIP text remains the source of truth

An existing article contains shortcuts such as `{{bold}}`, `[[a note]]`, or `<doc12|center>`.
When opened, the editor **reads that text** and builds a visual representation. As you edit, it
**writes SPIP syntax back** into the form field. SPIP still handles saving; the database is not
converted to another format.

```text
Saved SPIP text → read → visual editing → write → saved SPIP text
```

The intermediate representation uses Tiptap and ProseMirror in the browser. The **Source** button
lets you return to and edit the SPIP text directly.

## SPIP controls public rendering

The editor does not replace SPIP's processing on the public site. SPIP still resolves links,
notes, models, and other shortcuts when a page is displayed. The editor requests a model preview
from the server; the page's final output remains authoritative.

## Preserve content the editor does not understand

An unknown or malformed fragment, or syntax belonging to another plugin, may remain as raw
source in the visual view. Its text is preserved unless you explicitly correct or change it.
**Source** is always available for editing it. After a substantial change to complex content,
check its public rendering.

## Extend the editor without changing its core

Another SPIP plugin can declare how to read and write **its own** shortcut, add a button, and
provide the corresponding public rendering. The [FAQ example](developper/faq.md) shows both sides:
JavaScript for editing and PHP for SPIP rendering. Parser and extension point details are in the
[project specifications](https://github.com/epilibre-design/tiptap_spip/tree/main/docs/specs)
(in French).
