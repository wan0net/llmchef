# LLMChef MCP Bridge Specification

## Overview

The LLMChef MCP Bridge is a lightweight local service that enables browser-based LLMChef to connect to stdio MCP servers. Since browsers cannot directly spawn processes or access local file systems, the bridge acts as a secure proxy between LLMChef and local MCP server processes.

## Architecture

```
┌─────────────┐    HTTP/JSON     ┌─────────────┐    stdio     ┌─────────────┐
│   LLMChef  │ ←──────────────→ │ MCP Bridge  │ ←──────────→ │ MCP Server  │
│  (Browser)  │                  │ (localhost) │              │  (Process)  │
└─────────────┘                  └─────────────┘              └─────────────┘
```

## API Endpoints

### Health Check
```http
GET /health
```
**Response**: `200 OK` with service status

### List Active Servers
```http
GET /servers
X-MCP-Bridge-Token: <token>
```
**Response**: `200 OK` with active profile-backed server state

### Send MCP Message to a Profile
Bridge profiles are configured through `MCP_BRIDGE_SERVERS`. For example:

```bash
MCP_BRIDGE_TOKEN=secret \
MCP_BRIDGE_SERVERS='{"myfs":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}}' \
node bin/mcp-bridge.js
```

```http
POST /servers/myfs/mcp
Content-Type: application/json
X-MCP-Bridge-Token: secret

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```
**Response**: MCP response from stdio server

### SSE Compatibility Endpoint
```http
POST /servers/myfs/sse
Content-Type: application/json
X-MCP-Bridge-Token: secret
```
**Response**: `text/event-stream` containing one MCP JSON-RPC response event

## Security Considerations

### Network Security
- **Localhost Only**: Bridge binds only to 127.0.0.1, not 0.0.0.0
- **CORS Origin Allowlist**: The bridge only allows configured origins, local development origins, or requests with no browser `Origin` header.
- **Bridge Token**: `/servers` endpoints require `Authorization: Bearer <token>` or `X-MCP-Bridge-Token`.
- **Request Validation**: All requests validated before processing

### Process Security
- **Sandboxing**: MCP servers run in isolated child processes
- **Resource Limits**: CPU and memory limits on spawned processes
- **Path Validation**: Working directory and file path validation
- **Named Profiles**: Commands and arguments come from `MCP_BRIDGE_SERVERS`; legacy URL-supplied commands require `MCP_BRIDGE_ALLOW_DYNAMIC=true`.
- **Command Restrictions**: Allowlist of permitted commands

### Session Management
- **Session Isolation**: Each MCP server gets unique session ID
- **Timeout Handling**: Sessions expire after inactivity
- **Clean Shutdown**: Proper cleanup of child processes

## Configuration

### Default Configuration
```json
{
  "port": 3001,
  "host": "127.0.0.1",
  "cors": {
    "origin": ["http://localhost:3000", "http://localhost:5173"],
    "methods": ["GET", "POST"]
  },
  "security": {
    "allowedCommands": ["npx", "node", "python", "python3"],
    "maxProcesses": 10,
    "processTimeout": 300000,
    "maxMemory": "512MB"
  }
}
```

### Environment Variables
- `MCP_BRIDGE_PORT`: Service port (default: 3001)
- `MCP_BRIDGE_HOST`: Bind address (default: 127.0.0.1)
- `MCP_BRIDGE_VERBOSE`: Enable verbose logging
- `MCP_BRIDGE_ALLOWED_ORIGINS`: Comma-separated browser origin allowlist
- `MCP_BRIDGE_TOKEN`: Required token for protected bridge endpoints; generated at startup if omitted
- `MCP_BRIDGE_SERVERS`: JSON object of named stdio server profiles
- `MCP_BRIDGE_ALLOWED_COMMANDS`: Comma-separated list of commands allowed in profiles
- `MCP_BRIDGE_ALLOW_DYNAMIC`: Set to `true` to temporarily allow legacy URL-supplied command/args mode

## Error Handling

### HTTP Status Codes
- `200 OK`: Success
- `400 Bad Request`: Invalid request format
- `404 Not Found`: Session not found
- `429 Too Many Requests`: Rate limited
- `500 Internal Server Error`: Server error

### Error Response Format
```json
{
  "error": {
    "code": "PROCESS_SPAWN_FAILED",
    "message": "Failed to spawn MCP server process",
    "details": {
      "command": "npx",
      "args": ["-y", "nonexistent-server"],
      "exitCode": 1
    }
  }
}
```

## Implementation Guidelines

### Process Management
```javascript
// Spawn MCP server process
const process = spawn(command, args, {
  cwd: workingDirectory,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle process lifecycle
process.on('exit', (code) => {
  console.log(`MCP server exited with code ${code}`);
  cleanupSession(sessionId);
});
```

### Message Routing
```javascript
// Route HTTP messages to stdio
app.post('/mcp/:sessionId/message', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Send to stdio
  session.process.stdin.write(JSON.stringify(req.body) + '\n');

  // Wait for response
  const response = await session.waitForResponse(req.body.id);
  res.json(response);
});
```

### Session Cleanup
```javascript
// Cleanup on session end
function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.process.kill('SIGTERM');
    session.cleanup();
    sessions.delete(sessionId);
  }
}
```

## Installation & Usage

### NPM Package Structure
```
llmchef-mcp-bridge/
├── package.json
├── bin/
│   └── llmchef-mcp-bridge
├── src/
│   ├── index.js
│   ├── server.js
│   ├── session.js
│   └── config.js
└── README.md
```

### CLI Interface
```bash
# Basic usage
llmchef-mcp-bridge

# With options
llmchef-mcp-bridge --port 3001 --verbose

# Show help
llmchef-mcp-bridge --help
```

## Testing

### Health Check Test
```bash
curl http://localhost:3001/health
```

### MCP Server Test
```bash
MCP_BRIDGE_TOKEN=secret \
MCP_BRIDGE_SERVERS='{"myfs":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}}' \
node bin/mcp-bridge.js

curl -X POST http://localhost:3001/servers/myfs/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Bridge-Token: secret" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Compatibility

### Supported Platforms
- **Windows**: Windows 10+ with Node.js 18+
- **macOS**: macOS 10.15+ with Node.js 18+
- **Linux**: Ubuntu 18.04+ / equivalent with Node.js 18+

### MCP Compatibility
- **Protocol Version**: 2025-11-25
- **Transport**: stdio only (HTTP/SSE handled directly by LLMChef)

## License

MIT License - See LICENSE file for details.
