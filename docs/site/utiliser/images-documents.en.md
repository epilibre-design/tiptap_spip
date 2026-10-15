# Paste images and drop files

You can add one or more images directly to an article without opening the **Documents** panel:
copy and paste them into the editor, or drag them from your computer. Drag and drop also accepts
other document types allowed by your site, such as PDFs. Each uploaded file becomes a SPIP
document linked to the article being edited. The editor inserts its `<docN>` shortcut into the
text.

![An image added to the visual editing area; screenshot of the French interface](../medias/demo_dragdrop.en.png)

!!! note "Before you start"
    The **Médias** plugin must be enabled, and **Paste images and drop documents** must be turned
    on in the [editor settings](../configurer.md#enable-or-disable-file-uploads). You also need permission to attach documents
    to the article. Accepted file types and size limits depend on the site's settings.

## In visual mode

Place the cursor where you want the image. Copy one or more image files, then press **Ctrl+V**
(or **⌘+V** on a Mac). Each accepted image is uploaded in order, with a placeholder at its
position while the upload runs. Once it finishes, the placeholder becomes a preview of the SPIP
`<docN>` model. Selected text stays in place; the images are added after it.

To drop files, drag one or more files onto the editor. The **Drop files** prompt appears while
you hover over it. Release the mouse where you want the files: they are processed in order and
each gets its own shortcut. A drop on a code block puts the shortcuts after that block. You can
drop images and other documents accepted by SPIP together.

When the clipboard also contains a real text or HTML passage, pasting gives that passage
priority: the text is pasted normally and the accompanying image files are ignored. Dropping
files processes them even when text or HTML accompanies them.

## In source mode

Click **Source** to edit SPIP shortcuts directly. You can paste one or more images here too.
During each upload, a temporary `<!-- envoi… -->` marker appears after the cursor or selected
text. It becomes `<docN>` when the upload succeeds. Selected text stays in place.

Drag and drop works in source mode as well. Shortcuts are inserted **after the text selection**,
regardless of where the mouse is released in the source field: a text field does not give the
editor a precise drop position. Hovering shows the same **Drop files** prompt.

You can keep writing during an upload. Switching between visual and source modes is temporarily
blocked so the placeholders stay in the right place. If you click **Save**, the editor waits for
all uploads before submitting the form. **Save without waiting** cancels the remaining uploads
and saves the text without temporary markers. An upload failure is reported below the editor
and inserts no shortcut.

## With Crayons

Pasting images also works when editing an article with **Crayons**, if the visual editor is
[enabled in Crayons](../configurer.md#choose-where-the-editor-appears). In visual mode, the
editor handles dropped files too: documents are linked to the article and shortcuts are inserted
into the text just as they are in the private area.

If the experimental **Crayons** upload feature (`crayons/upload`) is enabled, a drop **onto the
source mode text field** remains handled by Crayons. Documents are linked to the article and
their shortcuts appear in its side panel; they are not automatically inserted into the text.
Crayons also handles drops on that panel. To insert shortcuts directly into the text, paste the
images or use visual mode.
