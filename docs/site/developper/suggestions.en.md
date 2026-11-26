# Provide suggestions while typing

A plugin can show a list after a character, for example `@bo` to insert “Bonjour !”.
The shared layer handles the list, keyboard and asynchronous requests; the plugin provides
results and an insertion command. The core already reserves `:` for emojis. Choose another
character for your provider: a duplicate `:` is ignored with a warning. Removing the Emoji
button through the toolbar pipeline keeps inline emoji suggestions enabled.

## Load a provider

Declare the pipeline in your `paquet.xml`:

```xml
<pipeline nom="tiptap_spip_extensions" inclure="monplugin_pipelines.php" />
```

Then add the script in `monplugin_pipelines.php`:

```php
function monplugin_tiptap_spip_extensions($flux) {
    $flux['data']['monplugin_formules'] = [
        'src' => find_in_path('javascript/monplugin_formules.js'),
    ];
    return $flux;
}
```

The script loads before editors are created. Use the bundle API, also exported as a module,
without loading another copy of Tiptap or ProseMirror.

```js
const { ui, registerExtension } = window.tiptapSpip;
const catalogue = [
  { id: 'bonjour', title: 'Bonjour', subtext: 'Greeting', context: 'Bonjour !' },
  { id: 'bonsoir', title: 'Bonsoir', context: 'Bonsoir !' },
];

registerExtension(ui.creerSuggestions({
  name: 'monpluginFormules',
  char: '@',
  minQueryLength: 1,
  queryPattern: /[a-z]+/i,
  labels: {
    suggestions: 'Phrases', loading: 'Searching…',
    empty: 'No phrases', error: 'Search unavailable',
  },
  items: ({ query }) => ui.filtrerSuggestions(catalogue, query),
  command: ({ editor, range, item }) => editor.commands.insertContentAt(
    range, { type: 'text', text: item.context },
  ),
}), { toolbars: ['edition', 'forum'] });
```

Adapt labels to the interface language, for example using the `tiptap_spip_i18n` pipeline and
`window.tiptapSpip.label` as in the [FAQ tutorial](faq.md). The shared layer adds no query
translation or implicit synonyms.

## Contract

`ui.creerSuggestions(options)` returns a Tiptap extension for `registerExtension`.
Providers are inherited by the editor’s footnote and multilingual subeditors.

| Option | Contract |
|---|---|
| `name`, `char` | Unique name and one trigger character per editor |
| `items({ editor, query, signal })` | An array or promise of an array; forward `signal` to `fetch` when needed |
| `command({ editor, range, item })` | Synchronous command returning `true` after insertion or `false` before any mutation |
| `labels` | Four required strings: `suggestions`, `loading`, `empty`, `error` |
| `minQueryLength` | Nonnegative integer opening threshold; default `0` |
| `queryPattern` | Regular expression matching the whole query; `g` and `y` flags are removed |
| `allowedPrefixes` | Allowed characters before the trigger; default ordinary space `[' ']`; block start always allowed |
| `startOfLine` | Require the trigger at block start; default `false` |
| `allowSpaces` | Allow spaces within the query; default `false` |
| `allow({ editor, state, range })` | Optional additional boolean eligibility check |

Each item requires string `id` and `title`. `subtext` and `keywords` are optional;
`context` can hold command data. Titles and subtexts render as text, never as HTML.
The array returned by `items` keeps its order, with no additional filtering.

`ui.filtrerSuggestions(items, query)` returns a new list without mutating items.
It ranks exact matches, prefixes, then substrings across `title`, `subtext` and `keywords`,
case insensitively; ties keep the original order. An empty query keeps all items.
Providers may use their own filter.

Search exceptions are logged and show an error state distinct from an empty result.
Aborted or stale responses are ignored. Command exceptions are logged and treated as a refusal;
the provider must check preconditions before mutating the document. The factory cannot roll
back partial mutations.

## Interaction and limits

The list requires an editable, focused editor and an empty selection. It remains closed
during IME composition and in code or raw content. The query is reevaluated after composition:
on keyboards composing a whole word, opening after the first character waits for confirmation.

No option is initially active. Down selects the first result, Up the last; Enter only accepts
an active option. Without results, Up/Down remain available for editing. Modified keys,
including Shift+Enter and Shift+arrow, remain with the editor. Clicking an option accepts it;
clicking list padding or an empty state keeps editor focus. Tab and Shift+Tab close the list
without blocking normal navigation.

Escape closes without deleting the query, before closing a note or leaving full screen.
Dismissal persists within the same range even when the query temporarily fails the pattern or
falls below the threshold. Inserting whitespace or entering a new trigger range allows reopening.
The range ends at the cursor: in `@bo|njour`, only `@bo` is replaced. An atom is not a block start.

Accepting a suggestion creates a separate history step. After acceptance and further typing,
Undo removes that typing, then restores the query. Restoration may reopen the list.
Opening, searching and dismissing do not create undo steps.

Two providers using the same character cannot coexist in one editor. A core provider wins
when present; otherwise the first third party wins. The second is ignored with one warning
per conflict. Providers restricted to disjoint toolbars may share a character.
The factory fixes keyboard priority internally.

Only the two functions are public. The native Suggestion engine, internal list and explicit
selector wrapper are not exposed.
