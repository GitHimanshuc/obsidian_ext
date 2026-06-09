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

## General Plugin Standards

- Target: Obsidian community plugins built from TypeScript into bundled JavaScript.
- Entry point: `src/main.ts`, compiled to plugin-root `main.js`.
- Release artifacts: `main.js`, `manifest.json`, and `styles.css` only if CSS is actually needed.
- Keep `main.ts` focused on plugin lifecycle and registration. Put feature logic in separate modules.
- Persist settings with `loadData()` and `saveData()`.
- Register cleanup-aware listeners with Obsidian helpers such as `registerEvent`, `registerDomEvent`, and `registerInterval`.
- Avoid startup scans and long work in `onload`; defer expensive work until the user opens or runs the feature.
- Keep plugins local/offline by default. Do not add network calls, telemetry, or external services without explicit need and documentation.
- Keep dependencies small, browser-compatible, and local to the plugin folder.
- Do not commit `node_modules/` or generated build outputs unless we explicitly decide this workspace should track them.

## Common Commands

Run from the plugin folder:

```bash
npm run dev
npm run build
npm run lint
```

During development, Obsidian can hot-reload/reload the plugin when `main.js` changes. Manifest changes may still need a full app reload.
