# Run the tests

The tests primarily protect the round trip between SPIP markup, the Tiptap document and the saved text. Run them from the plugin repository. End-to-end tests use **a disposable SPIP site**: their driver creates articles, activates plugins and opens an administrator session. Never point them at a site with data you need to keep.

## Choose a test suite

| Suite | What it checks | Command |
|---|---|---|
| Vitest | Parser, serializer, schema, properties and the CVT services client | `npm test` |
| PHPUnit | PHP functions, forms and pipelines with lightweight mocks | `composer tests-unit` |
| Rendering equivalence | Compares `propre(source)` with `propre(serialize(parse(source)))` across the corpus, using SPIP as the oracle | `SPIP_ROOT=/path/to/spip npm run equivalence` |
| Playwright | Editing and saving on a real SPIP site, AJAX services, UI, public hosts and accessibility | `TTS_SITE=/path/to/spip TTS_URL=http://127.0.0.1:18931 npm run e2e` |

Run `npm` commands in `prive/javascript/tiptap_spip/` and `composer tests-unit` at the repository root. Install dependencies with `npm ci` and `composer install` for the suites you need. For Playwright, also install the browsers with `npx playwright install`.

Vitest does not need a SPIP site. Rendering equivalence and Playwright do. The versioned corpus lives in [`tests/corpus/`](https://github.com/epilibre-design/tiptap_spip/tree/main/tests/corpus); the [test specification](https://github.com/epilibre-design/tiptap_spip/blob/main/docs/specs/08-tests-recette.md) describes the invariants, coverage and accepted differences.

## Prepare a site for Playwright

Install SPIP in a separate directory with a SQLite database and an administrator account, then finish its setup in the browser. Use a compatible version (SPIP 4.2, 4.4 or 5). The directory must contain `ecrire/` and `plugins/`; the test server must be able to write to the database and cache directories. Tests modify this site and leave test articles behind.

From the repository root, link the plugin and its test companion into the site:

```bash
export TTS_REPO="$PWD"
export TTS_SITE="/path/to/disposable-spip-site"
mkdir -p "$TTS_SITE/plugins"
ln -s "$TTS_REPO" "$TTS_SITE/plugins/tiptap_spip"
ln -s "$TTS_REPO/tests/e2e/plugin/tts_test" "$TTS_SITE/plugins/tts_test"
```

The destination paths must be free before creating these links. If you already installed the plugins on this disposable site, use those installations or replace them after checking.

In one terminal, start the server from the repository root:

```bash
PHP_CLI_SERVER_WORKERS=4 php -d opcache.revalidate_freq=0 \
  -S 127.0.0.1:18931 -t "$TTS_SITE"
```

Choose a free port and keep the server running. `PHP_CLI_SERVER_WORKERS=4` avoids a stall during SPIP 4.2's first public render. `opcache.revalidate_freq=0` lets the server see newly activated plugin pipelines immediately.

In a second terminal, from the same repository:

```bash
export TTS_SITE="/path/to/disposable-spip-site"
export TTS_URL="http://127.0.0.1:18931"
cd prive/javascript/tiptap_spip
npm ci
npx playwright install
npm run build
npm run e2e
```

`npm run build` rebuilds the script served by SPIP after changes to its sources. Playwright runs Chromium, Firefox and WebKit by default, with one worker. For a focused run, use:

```bash
npm run e2e -- --project=chromium tests/e2e/hotes.e2e.js
```

`TTS_SITE` is the installed site's root; `TTS_URL` is the address where PHP serves **that same site**. For SPIP 4.2, set `TTS_PHP=php8.3` for the driver if needed, and start the server with a compatible PHP version too. If `TTS_SITE` or `TTS_URL` is missing, most E2E tests are skipped: check the Playwright summary before interpreting the result.

## What an E2E test does

The Playwright configuration uses browser agent `tts-e2e` and the Chromium, Firefox and WebKit projects. Its [JavaScript helper](https://github.com/epilibre-design/tiptap_spip/blob/main/prive/javascript/tiptap_spip/tests/e2e/site.js) calls the [PHP driver](https://github.com/epilibre-design/tiptap_spip/blob/main/tests/e2e/site.php) with `SPIP_ROOT=TTS_SITE`. The driver activates `tiptap_spip`, creates an article, prepares a session tied to that browser agent and later reads the saved text directly from the database.

Article tests open the edit page, interact with the editor and submit the SPIP form. To check that saving without changes preserves text, they also submit the same form with the editor script blocked. They compare **the two saved values**, because an HTML textarea may convert line endings or ignore an initial newline. Other E2E files test CVT services through real AJAX calls, UI commands, styles, keyboard use and accessibility.

### What is `tts_test` for?

The [`tests/e2e/plugin/tts_test`](https://github.com/epilibre-design/tiptap_spip/tree/main/tests/e2e/plugin/tts_test) plugin supplies two fixtures:

- A public `tts_test` form with a `texte` field. Its `tiptap_spip_contextes` pipeline declares that the field corresponds to the article ID passed to the form. The test visits `spip.php?page=tts_test&id_article=…` and checks that the editor and services share the form's instance ID. The form only displays the number of characters received: it **does not save** the article.
- `glossaire_tts()`, which provides a predictable URL for the named `tts` glossary so glossary links can be tested.

`hotes.e2e.js` activates `tts_test` and, when the **Crayons** plugin is present on the disposable site, also tests public editing through Crayons. Without Crayons, those cases are skipped; the `tts_test` form case remains available. Other E2E files activate `tts_test` for the glossary. This plugin is a test fixture, not a production dependency.

## Run the other checks

From `prive/javascript/tiptap_spip/`:

```bash
npm test
SPIP_ROOT="$TTS_SITE" npm run equivalence
```

Use `TTS_FC_SEED` to replay a property-test seed; `TTS_FC_RUNS` increases the number of generated cases. The equivalence oracle uses `TTS_PHP` when set. Expected rendering differences are recorded in `tests/corpus/ecarts.yaml`; a new difference fails the check.

From the repository root, for PHP tests that do not need a SPIP site:

```bash
composer install
composer tests-unit
```
