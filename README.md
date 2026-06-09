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
filter: today+3
display: task,due,made,prio,est
```
````

Supported filters: `today+n`, `this-week`, `this-month`.

Supported display fields: `task`, `due`, `made`, `prio`, `est`, `source`. The `task` field links to the source note.

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
