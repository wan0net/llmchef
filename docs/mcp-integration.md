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

## Security Model

- MCP endpoints are opt-in and stored locally.
- Requests are limited by LLMChef's outbound host policy.
- Authentication secrets are supplied through per-server headers.
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
