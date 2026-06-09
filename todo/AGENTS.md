# Todo Plugin

## Purpose

This is a local-first Obsidian plugin for collecting dated unchecked tasks into one generated todo note.

The plugin scans configured vault folders for tasks matching:

```md
- [ ] task text @@ add:YYYY-MM-DD HH:mm, due:YYYY-MM-DD HH:mm, prio:1, est:30
```

Fields after `@@` are optional. Tasks without a due date always remain visible, including inside due-date filters.

The default scan folder is `Days`, and the default generated note is `Days/TODO.md`.

## Current Design

- `src/main.ts` owns plugin lifecycle only: load settings, register the refresh command, register the `todo-plugin` Markdown code block renderer.
- `src/settings.ts` owns user settings:
  - `scanFolders`
  - `outputFile`
- `src/todo-index.ts` owns scanning, generated note content, rendered task UI, and source task completion.
- `Days/TODO.md` should contain a small rendered-view block, not copied task lines:

````md
```todo-plugin
folders:
- Days
```
````

Blocks may optionally open with a due filter:

````md
```todo-plugin
folders:
- Days/2026
filter: today+3
```
````

Supported block filters are `today+n`, `this-week`, and `this-month`.

Blocks may also choose display fields and order:

````md
```todo-plugin
folders:
- Days/2026
display: task,due,made,prio,est,source
```
````

Supported display fields are `task`, `due`, `made`, `prio`, `est`, and `source`.

## UX Rules

- Keep the generated note clean. Do not add visible HTML metadata comments to `TODO.md`.
- Avoid routine success notifications. Use console logging for developer failures unless a user-facing error is clearly needed.
- Task completion should happen from the rendered code block in Reading view and update the original source note.
- The command palette should include `Insert todo task template`; it inserts the `@@` task format with defaults for due date/time, priority, and estimate.
- The rendered `task` display field should link to the source note. Use `source` only when the file path should also be visible.
- The rendered block should stay mobile-friendly: native controls, simple due filters, no dense toolbar.
- Keep due filtering extensible; we expect to add more filter options later.

## Performance Rules

- Do not scan the vault on plugin load.
- Do not auto-scan on every file change yet.
- Scan only when rendering the `todo-plugin` block.
- Scan by recursively walking configured `TFolder.children`; do not call `getMarkdownFiles()` and filter the whole vault.
- Use `cachedRead` for scan reads.
- When a rendered task is completed, update only the source file and remove that one rendered row. Do not rescan the vault just to redraw.

## Development

See the workspace [README](../README.md) for general Obsidian plugin development commands and conventions.
