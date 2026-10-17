# Install from Git

Use this method if you have server access and want to follow the plugin repository. From the root of your SPIP installation, clone the repository into `plugins/`.

Over SSH, with access to `git.spip.net` configured:

```sh
git clone git@git.spip.net:spip-contrib-extensions/tiptap_spip.git plugins/tiptap_spip
```

Or over HTTPS:

```sh
git clone https://git.spip.net/spip-contrib-extensions/tiptap_spip.git plugins/tiptap_spip
```

The file `paquet.xml` should be at `plugins/tiptap_spip/paquet.xml`. In the private area, open **Configuration → Plugin management** and activate **Visual editor for SPIP**.

To fetch later changes, run `git pull` in `plugins/tiptap_spip/`, then check that the plugin remains active. If you need a fixed version, choose a [repository tag](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/tags).

After activation, follow the [getting started guide](../premiers-pas.md).
