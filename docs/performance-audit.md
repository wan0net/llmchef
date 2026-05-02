# LLMChef Performance Audit

Last checked: 2026-05-02

## Current Build Shape

Command: `npm run build`

The public landing entry now lazy-loads the full chat app. This keeps the hosted web page light while preserving the complete local app behind `#app`.

| Chunk | Minified | Gzip | Notes |
| --- | ---: | ---: | --- |
| `index-*` | ~737 kB | ~209 kB | Public entry and route shell |
| `LLMChefApp-*` | ~1.34 MB | ~406 kB | Chat app shell, loaded only for app route |
| `vendor-mermaid-*` | ~2.62 MB | ~702 kB | Loaded only when Mermaid renderer is used |
| `vendor-ai-*` | ~629 kB | ~150 kB | AI SDK providers |
| `vendor-data-*` | ~611 kB | ~188 kB | Dexie, ZenFS, git data layer |
| `vendor-charts-*` | ~458 kB | ~131 kB | Chart renderer support |
| `vendor-flow-*` | ~127 kB | ~42 kB | Flow renderer support |

## Improvements Already Applied

- Split the landing route from the full LLMChef app with a lazy `LLMChefApp` shell.
- Split chart, flow, and Mermaid vendor chunks so heavy renderers are loaded on demand.
- Kept Pyodide vendored and lazy so Python support does not block initial page load.
- Kept PWA/release builds aligned with the optimized bundle.

## Remaining Hotspots

- Mermaid remains the largest optional renderer. It is isolated, but still expensive when first rendering a Mermaid block.
- The app shell is still large because control modules register many capabilities at startup.
- AI and data vendor chunks are individually large but expected for provider and local-first VFS/database features.

## Next Performance Ideas

- Lazy-register advanced control modules only when their settings tab or prompt control is opened.
- Add hover/focus preloading for the `#app` link on the landing page.
- Consider a lightweight Mermaid preview mode that imports Mermaid only when a diagram is expanded.
- Track bundle output in CI with a size budget for the public `index-*` entry.
