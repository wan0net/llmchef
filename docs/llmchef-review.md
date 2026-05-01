# LLMChef Review

LLMChef is now positioned as a fork of LiteChat with a CyberChef-style operating model: after the first download, the default app should run locally and only talk to explicitly configured LLM/provider endpoints or user-enabled integrations.

## Security Review

- Default runtime resources are local-first. Generated exports, prompt examples, and app metadata avoid loading LLMChef assets from GitHub Pages.
- Markdown, Mermaid, and generated diagram HTML are sanitized before rendering. These remain high-risk surfaces because they intentionally render model/user-provided content.
- Outbound traffic is concentrated in provider calls, provider model-list fetches, optional image providers, optional DuckDuckGo proxy search, optional MCP bridge usage, sync/marketplace URLs configured by the user, and package/update checks.
- Model-list fetching, optional web search/content extraction, marketplace downloads, remote mod scripts, MCP HTTP/bridge calls, OpenRouter endpoint metadata, race-export stylesheet capture, and Formedible location lookups now pass through `src/lib/litechat/outbound-policy.ts`, which blocks non-HTTP(S) URLs, enforces known provider hosts for model-list requests, and keeps an in-memory destination log shown in Settings -> Network.
- A runtime fetch guard is installed at startup to catch provider SDK and other indirect `fetch` calls. Same-origin and local loopback requests are allowed; remote hosts must come from configured providers, service URLs, MCP servers, marketplace sources, remote mods, or sync repositories. Settings -> Network lists both the session ledger and the configured remote host set.
- `docs/local-release.md` documents the local bundle flow. `npm run vendor:pyodide` vendors Pyodide into `public/pyodide/...` before build so runnable Python can work without any CDN or PyPI fallback.
- The Strudel beat control prompt now avoids remote sample-pack guidance and asks for local-first, self-contained patterns.
- The app still has intentional execution surfaces for mods, runnable JavaScript, runnable Python, and generated standalone HTML. Treat these as user-consented execution zones, not passive document rendering.
- Error reports are redacted before export and link to the LLMChef repository.
- The MCP bridge allows configured origins only. Defaults include localhost and the project GitHub Pages origin; deployments should narrow this further when possible.
- `npm audit` currently reports only the Mermaid/UUID issue; the suggested force fix downgrades Mermaid and is not a clean non-breaking fix.

## Optimization Review

- The built app is large: the main bundle is roughly 6 MB before gzip, and `dist` is roughly 16 MB after a production build.
- Mermaid and its diagram dependencies are split into separate chunks, but the app shell still carries a lot of control, provider, and rendering code.
- The build now uses explicit Vite vendor chunks for React, AI SDK/provider adapters, storage/git, editor, diagram, and UI dependencies. Settings tab bodies, optional prompt controls, advanced/specialized block renderers, and heavier modal/panel controls are lazy-loaded when opened or encountered. The Beat control prompt was compacted so the app shell no longer carries a long remote-sample example catalog. Browser Node polyfills were removed after the production build passed without them. Best next reductions are evaluating Mermaid alternatives and auditing remaining always-on controls.
- The runnable-code and workflow surfaces should keep their current explicit-user-action model; optimization work should not hide execution behind automatic previews.

## New Ideas

- Recipes: CyberChef-like chains that transform prompts, files, structured data, and model outputs locally.
- Recipe packs: importable `.llmchef` bundles that can be inspected before activation and used offline after download.
- Endpoint firewall: a visible allowlist of LLM hosts, model-list URLs, search proxies, image providers, and MCP bridges.
- Network ledger: a local activity log showing every outbound request destination, purpose, and triggering feature.
- Capability prompts: runnable blocks request explicit permissions such as network, clipboard, file export, or long-running compute.
- Prompt diff and trace: compare prompt assembly, system prompts, tool calls, and final payloads across providers.
- Local vault: project-scoped files, prompts, recipes, and exports with no external sync by default.
- Evaluation kitchen: race prompts across models with repeatable scoring, exportable scorecards, and local-only history.
