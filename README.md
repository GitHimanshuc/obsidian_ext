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

| Option | Values | Notes |
| --- | --- | --- |
| `folders` | vault folder paths | One folder per `- ` line, or comma-separated inline. Defaults to `Days`. |
| `filter` | `today`, `today+n`, `this-week`, `this-month` | Applies to active blocks. Tasks without due dates stay visible. |
| `sort` | `due`, `prio`, `est`, `effective-prio`, `done` | `done` is for completed-today blocks. |
| `mode` | `active`, `completed-today` | Defaults to `active`. |
| `display` | `task`, `due`, `due-hours`, `made`, `prio`, `est`, `source`, `done` | Comma-separated field list. |

| Sort | Order |
| --- | --- |
| `due` | Earliest due time first |
| `prio` | Highest priority first |
| `est` | Shortest estimated completion time first |
| `effective-prio` | Highest internal score first |
| `done` | Newest completion time first |

Effective priority is internal-only and used for ordering. Overdue tasks get at least base priority `50`; then the score is calculated from base priority, estimate minutes, and hours until due.

| Display Field | Output |
| --- | --- |
| `task` | Task text linked to the source note |
| `due` | Due date and time |
| `due-hours` | Relative hours until due, such as `due 5h` or `overdue 2h` |
| `made` | Added date and time |
| `prio` | Priority |
| `est` | Estimate in minutes |
| `source` | Source note link |
| `done` | Completion date and time |

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
