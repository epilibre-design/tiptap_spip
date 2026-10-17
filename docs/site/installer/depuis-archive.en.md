# Install from an archive

Use this method to install the plugin from a ZIP file. For a typical installation through SPIP's plugin catalogue, follow the [standard installation](../installer.md).

## Choose an archive

The [`main` branch archive](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/archive/main/tiptap_spip-main.zip) is the recommended download for this method. It contains the project's latest changes, so its contents may change.

To obtain the exact same version again later, choose a version from the [GitLab tags](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/tags), download its ZIP, and keep its tag number.

## Install from an archive URL in SPIP

1. Sign in to the private area as a webmaster.
2. Open **Configuration → Plugin management → Add plugins**.
3. Under **Download a plugin from its archive**, paste the direct ZIP URL into **Archive URL**. For the `main` branch, use:

   ```text
   https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/archive/main/tiptap_spip-main.zip
   ```

4. Start the download, then activate **Visual editor for SPIP** in the plugin manager. SPIP may ask for your webmaster password.

The [official SPIP plugin management guide](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins) (in French) describes manual installation through SVP and the required permissions.

## Upload files via FTP

1. Download your chosen ZIP archive and extract it on your computer.
2. Rename the resulting folder to `tiptap_spip`.
3. Upload **that folder** to `plugins/` at the root of your SPIP site. The file `paquet.xml` should then be at `plugins/tiptap_spip/paquet.xml`.
4. In the private area, open **Configuration → Plugin management** and activate **Visual editor for SPIP**.

FTP installation does not update the files automatically. To update, download a new archive, back up the site first, replace the plugin files, and check that the plugin remains active. See also the [SPIP FTP documentation](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins) (in French).

After activation, follow the [getting started guide](../premiers-pas.md).
