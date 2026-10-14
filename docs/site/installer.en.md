# Install the editor

The plugin works with **SPIP 4.2, 4.3, 4.4, and 5**. You need webmaster access to install and
activate a plugin in SPIP's plugin manager. If you do not have that access, send this page to your
site administrator.

For a version whose contents will not change, open the
[list of versions (tags)](https://github.com/epilibre-design/tiptap_spip/tags) and choose the ZIP
for the latest tag. The first published version, `1.0.0`, is available directly:

```text
https://github.com/epilibre-design/tiptap_spip/archive/refs/tags/1.0.0.zip
```

GitHub currently labels this first release a **prerelease**: its contents are fixed, but it is not
announced as stable. To try the newest changes instead, use the `main` branch archive:

```text
https://github.com/epilibre-design/tiptap_spip/archive/refs/heads/main.zip
```

The `main` archive follows project changes, so its contents may vary. Keep the tag number you
installed if you need to obtain the same version later.

## Method 1: install from a URL in SPIP

1. Sign in to the private area as a webmaster.
2. Open **Configuration → Plugin management → Add plugins**.
3. Under **Download a plugin from its archive**, paste the direct ZIP URL into **Archive URL**.
   You can use the `1.0.0` URL above. For a newer version, open the tags page and copy its ZIP URL.
4. Start the download, then activate **Visual editor for SPIP** in the plugin manager. SPIP may
   ask for your webmaster password.

The [official SPIP plugin management guide](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins)
(in French) describes manual installation through SVP and the required permissions.

## Method 2: upload files via FTP

1. Download the ZIP for your chosen tag, or the `main` ZIP for a trial, and extract it on your
   computer.
2. Rename the resulting folder to `tiptap_spip`.
3. Upload **that folder** to `plugins/` at the root of your SPIP site. The file `paquet.xml`
   should then be at `plugins/tiptap_spip/paquet.xml`.
4. In the private area, open **Configuration → Plugin management** and activate
   **Visual editor for SPIP**.

FTP installation does not update the files automatically. To update, download a new archive,
back up the site first, replace the plugin files, and check that the plugin remains active. See
also the [SPIP FTP documentation](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins)
(in French).

**Porte-plume**, **Insérer modèles** and **Coloration Code** can complement the editor. See
[Optional plugins](installer/plugins-complementaires.md) for what they provide.

## Check the installation

Edit an article with a **Text** field: a toolbar and a visual writing area should appear. Make a
few words bold, then save the article with SPIP's usual button. Your existing text should remain.

The editor is enabled by default on compatible fields in the private area. It is configured
separately for public-site forms and Crayons, where it is disabled by default. See
[Configure the editor](configurer.md) if an expected field has no toolbar.

!!! tip "Porte-plume remains available"
    **Source** shows SPIP syntax, and fields you deselect in the configuration keep their usual
    editor.
