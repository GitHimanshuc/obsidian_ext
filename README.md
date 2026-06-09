# Todo Plugin

Local-first Obsidian plugin that collects `@@` todo tasks from configured vault folders into a rendered todo note.

## Info

- Plugin id: `todo_plugin`
- Plugin root: `.`
- Dev vault: `dev-vault/`
- Vault plugin link: `dev-vault/.obsidian/plugins/todo -> .`
- Default scan folder: `Days`
- Default output note: `Days/TODO.md`
- Development notes: [AGENTS.md](AGENTS.md)

## Task Format

```md
- [ ] task text @@ add:YYYY-MM-DD HH:mm, due:YYYY-MM-DD HH:mm, prio:1, est:30
```

Fields after `@@` are optional. Tasks without a due date stay visible in every due filter.

When a task is completed from a rendered todo block, the plugin updates the source line to checked and records completion time:

```md
- [x] task text @@ add:YYYY-MM-DD HH:mm, due:YYYY-MM-DD HH:mm, prio:1, est:30, done:YYYY-MM-DD HH:mm
```

Use the command palette command `Insert todo task template` to insert a starter task with:

- current date/time for `add`
- current date and `17:00` for `due`
- `prio:1`
- `est:30`

## Todo Blocks

````md
```todo-plugin
folders:
- Days
filter: today
sort: effective-prio
display: task,due,made,prio,est
```
````

Supported filters:

- `today`
- `today+n`
- `this-week`
- `this-month`

Supported sort options:

- `due`: earliest due time first
- `prio`: highest priority first
- `est`: shortest estimated completion time first
- `effective-prio`: internal priority score based on priority, estimate, and time until due
- `done`: newest completion time first, for completed-today blocks

Effective priority is internal-only and used for ordering. Overdue tasks get at least base priority `50`; then the score is calculated from base priority, estimate minutes, and hours until due.

Supported display fields: `task`, `due`, `due-hours`, `made`, `prio`, `est`, `source`, `done`. Use `due-hours` for relative hours instead of date and time. The `task` field links to the source note.

Completed-today blocks show checked tasks completed today:

````md
```todo-plugin
folders:
- Days
mode: completed-today
sort: done
display: task,done,source
```
````

See `dev-vault/Days/TODO.md` for examples covering filters, sort modes, completed-today blocks, and cross-folder scans.

## Development

Install and run from the repo root:

```bash
npm install
npm run dev
```

Build and check:

```bash
npm run build
npm run lint
```

Keep dependencies local to this repo. Reload the plugin in Obsidian after `main.js` changes.

## BRAT Release Notes

BRAT installs from GitHub Releases, not just from repository files.

For each release:

1. Update `manifest.json` version.
2. Commit the change.
3. Create a tag that exactly matches the manifest version, for example `1.0.0`.
4. Push the commit and tag.
5. Publish the GitHub release after it has `main.js` and `manifest.json` attached.

Do not use `v1.0.0` unless `manifest.json` also says `v1.0.0`. BRAT expects the release/tag version to match the manifest version.

Required release assets:

- `main.js`
- `manifest.json`
- `styles.css` only if the plugin has styles

If BRAT says `manifest.json` does not exist in the release, the release probably exists but has no uploaded assets. Upload `main.js` and `manifest.json` to that release.

The release workflow runs when a tag is pushed. Make sure the tag points to a commit that already contains `.github/workflows/release.yml`; otherwise GitHub Actions will not create the release assets.
