# Maintenir cette documentation

Le site est construit avec **MkDocs Material**, comme la documentation de `wp2spip`. Les pages
publiques sont dans `docs/site/` ; les spécifications et plans de `docs/specs/` et
`docs/superpowers/` ne sont pas publiés par MkDocs.

## Construire localement

Avec Python 3.10 ou plus récent, depuis la racine du dépôt :

```bash
python3 -m venv .venv-docs
. .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
python -m mkdocs serve
```

Le résultat généré est dans `site/`, ignoré par Git. La construction stricte vérifie la navigation,
les liens internes et leurs ancres. Les liens vers les sites externes demandent une vérification
séparée.

## Publier sur GitHub Pages

Le workflow `.github/workflows/docs.yml` construit les PR et publie le site quand les fichiers de
documentation arrivent sur `main`. Dans les paramètres du dépôt GitHub, choisissez **Settings →
Pages → Build and deployment → GitHub Actions**. Le site est prévu à l’adresse
`https://epilibre-design.github.io/tiptap_spip/`.

Le dépôt de publication est `epilibre-design/tiptap_spip`. Les liens vers les sources et l’URL
canonique du site dans `mkdocs.yml` utilisent ce dépôt et le préfixe `/tiptap_spip/`.

Un build local ou une PR ne publie rien : la publication dépend de la fusion sur `main` et du
paramétrage Pages du dépôt. Le workflow peut aussi être lancé manuellement depuis l’onglet
**Actions** une fois présent sur `main`.

## Maintenir les deux langues

Le français est la langue par défaut, servi à la racine du site. `mkdocs-static-i18n` utilise la
structure **suffixe** : la traduction de `installer.md` est `installer.en.md`, à côté de la page
française. Les pages anglaises sont servies sous `/en/`.

Pour modifier une page publiée, mettez à jour les deux langues et vérifiez les liens internes et
les ancres avec `python -m mkdocs build --strict`. Les titres de navigation anglais sont déclarés
dans `mkdocs.yml`. Les spécifications de `docs/specs/` restent en français.

Voir la [documentation de MkDocs](https://www.mkdocs.org/) et celle de
[mkdocs-static-i18n](https://ultrabug.github.io/mkdocs-static-i18n/).
