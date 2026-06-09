# Obsidian Extension Workspace

Local-first workspace for developing multiple Obsidian plugins.

## Shared Info

- Dev vault: `dev-vault/`
- Vault plugins folder: `dev-vault/.obsidian/plugins/`
- Plugin development notes: [todo/AGENTS.md](todo/AGENTS.md)

## Plugins

### Todo Plugin

- Plugin name: `Todo Plugin`
- Plugin id: `todo_plugin`
- Version: `1.0.0`
- Author: `Himanshu`
- Source folder: `todo/`
- Vault plugin link: `dev-vault/.obsidian/plugins/todo`
- Enabled in vault as: `todo_plugin`

## Development

From a plugin folder:

```bash
npm install
npm run dev
```

Build for release:

```bash
npm run build
```

Keep dependencies local to each plugin unless a global install becomes necessary.
