# Todo Plugin

## Purpose

This repo root is the Obsidian plugin root for a local-first todo plugin. Do not reintroduce a nested `todo/` plugin folder.

The plugin scans configured vault folders for todo tasks matching:

```md
- [ ] task text @@ add:YYYY-MM-DD HH:mm, due:YYYY-MM-DD HH:mm, prio:1, est:30
```

Fields after `@@` are optional. Tasks without a due date always remain visible, including inside due-date filters.

Defaults:

- Scan folder: `Days`
- Generated note: `Days/TODO.md`
- Dev vault: `dev-vault/`
- Vault plugin link: `dev-vault/.obsidian/plugins/todo -> .`

## Current Design

- `src/main.ts` owns plugin lifecycle: settings, commands, and the `todo-plugin` Markdown code block renderer.
- `src/settings.ts` owns user settings:
  - `scanFolders`
  - `outputFile`
- `src/todo-index.ts` owns scanning, generated note content, task parsing, rendered task UI, filtering, display fields, template generation, and source task completion.
- `Days/TODO.md` should contain rendered-view blocks, not copied task lines.

Base block:

````md
```todo-plugin
folders:
- Days
```
````

Optional due filter:

````md
```todo-plugin
folders:
- Days/2026
filter: today+3
```
````

Supported filters are `today+n`, `this-week`, and `this-month`.

Optional display fields:

````md
```todo-plugin
folders:
- Days/2026
display: task,due,made,prio,est,source
```
````

Supported display fields are `task`, `due`, `made`, `prio`, `est`, and `source`. The rendered `task` field links to the source note; use `source` only when the path should also be visible.

## UX Rules

- Keep the generated note clean. Do not add visible HTML metadata comments to `TODO.md`.
- Avoid routine success notifications. Use console logging for developer failures unless a user-facing error is clearly needed.
- Task completion should happen from the rendered code block in Reading view and update the original source note.
- The command palette should include `Insert todo task template`; it inserts the `@@` task format with defaults for due date/time, priority, and estimate.
- The rendered block should stay mobile-friendly: native controls, simple due filters, no dense toolbar.
- Keep due filtering and display fields extensible; we expect to add more options later.

## Performance Rules

- Do not scan the vault on plugin load.
- Do not auto-scan on every file change yet.
- Scan only when rendering the `todo-plugin` block.
- Scan by recursively walking configured `TFolder.children`; do not call `getMarkdownFiles()` and filter the whole vault.
- Use `cachedRead` for scan reads.
- When a rendered task is completed, update only the source file and remove that one rendered row. Do not rescan the vault just to redraw.

## Development Rules

- Run plugin commands from the repo root.
- Build source from `src/main.ts` into root `main.js`.
- Release artifacts are `main.js`, `manifest.json`, and `styles.css` only if CSS is actually needed.
- Keep `main.ts` focused on plugin lifecycle and registration. Put feature logic in separate modules.
- Persist settings with `loadData()` and `saveData()`.
- Register cleanup-aware listeners with Obsidian helpers such as `registerEvent`, `registerDomEvent`, and `registerInterval`.
- Avoid startup scans and long work in `onload`; defer expensive work until the user opens or runs the feature.
- Keep the plugin local/offline by default. Do not add network calls, telemetry, or external services without explicit need and documentation.
- Keep dependencies small, browser-compatible, and local to this repo.
- Do not commit `node_modules/`, root `main.js`, or `data.json` unless explicitly requested.

See [README.md](README.md) for user-facing setup and command examples.
