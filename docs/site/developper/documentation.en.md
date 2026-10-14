# Maintain this documentation

The site is built with **MkDocs Material**, like the `wp2spip` documentation. Published pages
are in `docs/site/`; specifications and plans under `docs/specs/` and `docs/superpowers/` are
not published by MkDocs.

## Build locally

With Python 3.10 or newer, from the repository root:

```bash
python3 -m venv .venv-docs
. .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
python -m mkdocs serve
```

The generated output is in `site/`, which Git ignores. A strict build checks navigation,
internal links, and their anchors. External links need separate checking.

## Publish to GitHub Pages

The `.github/workflows/docs.yml` workflow builds pull requests and publishes the site when
documentation changes reach `main`. In the GitHub repository settings, choose **Settings →
Pages → Build and deployment → GitHub Actions**. The intended site URL is
`https://epilibre-design.github.io/tiptap_spip/`.

The publishing repository is `epilibre-design/tiptap_spip`. Source links and the canonical site
URL in `mkdocs.yml` use that repository and the `/tiptap_spip/` prefix.

A local build or pull request does not publish anything: publication depends on merging to
`main` and configuring Pages in the repository. The workflow can also be run manually from the
**Actions** tab once it is on `main`.

## Maintain both languages

French is the default language at the site root. `mkdocs-static-i18n` uses **suffix** structure:
the English translation of `installer.md` is `installer.en.md` beside the French page. English
pages are served under `/en/`.

When changing a published page, update both language files and check internal links and heading
anchors with `python -m mkdocs build --strict`. Navigation labels for English are declared in
`mkdocs.yml`. The project specifications under `docs/specs/` remain in French.

See the [MkDocs documentation](https://www.mkdocs.org/) and
[mkdocs-static-i18n documentation](https://ultrabug.github.io/mkdocs-static-i18n/).
