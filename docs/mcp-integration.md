# MCP Integration

LLMChef supports browser-managed MCP servers over HTTP. The app connects directly from JavaScript to MCP endpoints that you explicitly configure, keeping the project aligned with the local-first model: no bundled helper daemon, no process launcher, and no hidden network targets.

## Supported Transports

### Streamable HTTP

Streamable HTTP is the primary MCP transport in LLMChef.

- Uses the current single-endpoint MCP design
- Negotiates `MCP-Protocol-Version`
- Supports `MCP-Session-Id` session management when provided by the server
- Accepts JSON and `text/event-stream` responses
- Uses your configured headers for authentication

### SSE Fallback

LLMChef can fall back to the older SSE transport for compatible MCP servers that have not moved to Streamable HTTP yet.

## Adding Servers

1. Open **Settings -> Assistant -> MCP**.
2. Select **Add Server**.
3. Enter an HTTP or HTTPS MCP endpoint, for example `https://api.example.com/mcp`.
4. Add optional JSON headers for authentication.
5. Enable the server.

Only `http://` and `https://` URLs are accepted. Tool discovery and tool calls use the same configured endpoint and headers.

## Importing Package Snippets

Many MCP examples are shared as `npx` or `npm exec` commands. LLMChef can import these snippets, including npm and GitHub package specs, for review without executing them.

1. Open **Settings -> Assistant -> MCP -> Imports**.
2. Paste an `npx ...`, `npm exec ...`, or JSON config with `mcpServers`.
3. Review the imported package metadata.
4. If the import includes an HTTP endpoint, LLMChef creates a disabled server draft that you can inspect and enable.

Package imports are local metadata only. LLMChef does not run package commands, spawn processes, or store environment values. Environment variable names are kept so you can see what a package expects.

## Browser MCP Shim

Compatible package imports can also be installed into the browser MCP shim:

1. Import an `npx`/`npm exec` package snippet.
2. Review the package metadata.
3. Click the install action in the imported package row.
4. LLMChef asks the configured ESM registry/bundler for a browser ESM graph,
   stores those modules under `/packages/mcp` in the app VFS, and smoke-tests the
   cached entry module in an isolated Worker.
5. Use the probe action to send MCP `initialize` and `tools/list` over the
   Worker stdio bridge and store detected tool names with the package install.

The default registry/bundler is `https://esm.sh`, and it is contacted only while
you explicitly install a package. After installation, the cached module graph is
loaded locally from the VFS. The Worker shim provides a minimal `process`/stdio
surface for JS packages and disables network APIs, child workers, `importScripts`,
WebSocket, EventSource, and XHR by default.

Each install is pinned with the resolved entry URL, cached module URLs, SHA-256
hashes, module count, install time, last probe status, and VFS root.

This is intentionally narrower than Node. Packages that require native binaries,
real filesystem access, subprocesses, sockets, Docker, or unrestricted Node
modules should be treated as Node-only and will not run in the browser shim.

## Security Model

- MCP endpoints are opt-in and stored locally.
- Requests are limited by LLMChef's outbound host policy.
- Authentication secrets are supplied through per-server headers.
- Package snippets are parsed, not executed.
- Browser-shim package installation is explicit, cached into VFS, and tested in a
  Worker with network disabled.
- Tool responses are bounded by the configured maximum response size.
- Failed connections use bounded retry settings with visible toast feedback.

## Connection Settings

The MCP settings panel exposes:

- **Retry Attempts**: Number of retry attempts after a failed connection.
- **Retry Delay**: Initial delay between retry attempts.
- **Connection Timeout**: Maximum time to wait for the initial connection.
- **Max Response Size**: Maximum returned tool payload size before truncation.

## Tool Flow

1. LLMChef connects to enabled MCP servers.
2. It discovers available tools.
3. Tools are registered with names prefixed by their server.
4. Enabled tools become available to the active model.
5. Results are returned to the conversation context.
