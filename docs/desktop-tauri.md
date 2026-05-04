# LLMChef Desktop Shell

LLMChef can run as a Tauri v2 desktop app while keeping the browser app as the source of truth. The desktop shell packages the same Vite build and does not add hidden backend services.

## Commands

```bash
npm run tauri:dev
npm run tauri:build
```

`npm run tauri:dev` starts the Vite development server and opens the Tauri window. `npm run tauri:build` runs the normal production web build and then creates desktop bundles under `src-tauri/target/`.

## Project Layout

```text
src-tauri/
  Cargo.toml
  tauri.conf.json
  capabilities/default.json
  src/
    main.rs
    lib.rs
  icons/
```

The Tauri app identity is `net.wan0.llmchef`, and the frontend distribution is `../dist`.

## Security Posture

The first desktop shell is intentionally conservative:

- No shell plugin.
- No filesystem plugin.
- No broad OS permissions.
- No local process bridge.
- No extra network surface beyond the web app's configured provider and sync requests.

The default Tauri capability only grants core app, event, and window APIs. Future native sync features should add narrowly scoped Tauri plugins and capabilities only when the UI exposes what will be read, written, or contacted.

## Roadmap

- Add a native folder picker and file watcher for explicit project sync.
- Expose desktop-only sync status in the existing network/VFS ledger.
- Keep browser export/import compatibility so web, desktop, and local ZIP workflows remain interchangeable.
- Investigate mobile packaging only after desktop sync permissions are narrow and well tested.
