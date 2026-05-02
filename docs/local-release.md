# Local Release Packaging

LLMChef is built to behave like a CyberChef-style static tool: download the app bundle once, serve it locally, and then only talk to hosts you configure.

## Standard Local Bundle

```bash
npm run release:local
```

This creates:

- `public/release/latest.zip`
- `public/release/llmchef-<version>.zip`

The ZIP contains the static app under `dist/`, with release and version folders stripped so the archive can be served directly.

## Python Runtime

Runnable Python blocks load Pyodide from the app's same-origin base path, such as `/pyodide/v<version>/full/pyodide.js` in the local bundle or `/llmchef/pyodide/v<version>/full/pyodide.js` on GitHub Pages.

To include Pyodide in the static bundle:

```bash
npm install --save-dev pyodide@0.27.7
npm run release:local
```

If `public/pyodide/v0.27.7/full/pyodide.js` is missing, Python runnable blocks will fail closed instead of contacting a CDN.

Python packages are also resolved from the local Pyodide bundle. LLMChef does not fall back to PyPI package installation at runtime.

## Offline Check

After unzipping `latest.zip`, serve the folder from localhost. The root page is the LLMChef website, and the app is available at `/#app`. Open Settings -> Network from the app. Same-origin assets and loopback are allowed by default. Other remote hosts only appear when providers, MCP servers, marketplace sources, remote mods, service URLs, or sync repositories are configured.
