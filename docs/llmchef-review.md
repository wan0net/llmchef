# LLMChef Review

LLMChef is now positioned as a fork of LiteChat with a CyberChef-style operating model: after the first download, the default app should run locally and only talk to explicitly configured LLM/provider endpoints or user-enabled integrations.

## Security Review

- Default runtime resources are local-first. Generated exports, prompt examples, and app metadata avoid loading LLMChef assets from GitHub Pages.
- Markdown, Mermaid, and generated diagram HTML are sanitized before rendering. These remain high-risk surfaces because they intentionally render model/user-provided content.
- Outbound traffic is concentrated in provider calls, provider model-list fetches, optional image providers, optional DuckDuckGo proxy search, optional MCP bridge usage, sync/marketplace URLs configured by the user, and package/update checks.
- Model-list fetching, optional web search/content extraction, marketplace downloads, remote mod scripts, and Formedible location lookups now pass through `src/lib/litechat/outbound-policy.ts`, which blocks non-HTTP(S) URLs, enforces known provider hosts for model-list requests, and keeps an in-memory destination log for future UI surfacing.
- The app still has intentional execution surfaces for mods, runnable JavaScript, runnable Python, and generated standalone HTML. Treat these as user-consented execution zones, not passive document rendering.
- Error reports are redacted before export and link to the LLMChef repository.
- The MCP bridge allows configured origins only. Defaults include localhost and the project GitHub Pages origin; deployments should narrow this further when possible.
- `npm audit` currently reports transitive dependency issues in `vite-plugin-node-polyfills` and `mermaid`; there is no clean non-breaking fix for the Mermaid chain yet.

## Optimization Review

- The built app is large: the main bundle is roughly 6 MB before gzip, and `dist` is roughly 16 MB after a production build.
- Mermaid and its diagram dependencies are split into separate chunks, but the app shell still carries a lot of control, provider, and rendering code.
- Best next reductions are lazy-loading settings panels and control modules, making advanced renderers load on demand, reviewing the need for browser Node polyfills, and separating heavy provider/integration helpers from the initial shell.
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
