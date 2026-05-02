#!/usr/bin/env node

/**
 * LLMChef MCP Bridge
 * 
 * Creates named, local stdio MCP server profiles for browser LLMChef.
 * 
 * Endpoints:
 * - GET /health - Health check
 * - GET /servers - List active servers
 * - POST /servers/{name}/sse - SSE endpoint for a named server profile
 * - POST /servers/{name}/mcp - Direct MCP endpoint for a named server profile
 */

import http from 'http';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { Transform } from 'stream';
import { URL } from 'url';

function parseCsv(value) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseServerProfiles(rawValue) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('MCP_BRIDGE_SERVERS must be a JSON object');
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([name, server]) => {
        if (!server || typeof server !== 'object') {
          throw new Error(`Server profile "${name}" must be an object`);
        }
        if (typeof server.command !== 'string' || !server.command.trim()) {
          throw new Error(`Server profile "${name}" is missing command`);
        }
        if (server.args !== undefined && !Array.isArray(server.args)) {
          throw new Error(`Server profile "${name}" args must be an array`);
        }
        return [
          name,
          {
            command: server.command.trim(),
            args: (server.args || []).map(arg => String(arg)),
            enabled: server.enabled !== false,
          },
        ];
      }),
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR: Invalid MCP_BRIDGE_SERVERS:`, err.message);
    process.exit(1);
  }
}

const generatedToken = !process.env.MCP_BRIDGE_TOKEN;

// Configuration
const config = {
  port: parseInt(process.env.MCP_BRIDGE_PORT) || 3001,
  host: process.env.MCP_BRIDGE_HOST || '127.0.0.1',
  verbose: process.env.MCP_BRIDGE_VERBOSE === 'true' || false,
  allowedOrigins: parseCsv(process.env.MCP_BRIDGE_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://wan0net.github.io'),
  allowedCommands: parseCsv(process.env.MCP_BRIDGE_ALLOWED_COMMANDS || 'npx,node,python,python3'),
  serverProfiles: parseServerProfiles(process.env.MCP_BRIDGE_SERVERS),
  token: process.env.MCP_BRIDGE_TOKEN || randomBytes(24).toString('base64url'),
  allowDynamicServers: process.env.MCP_BRIDGE_ALLOW_DYNAMIC === 'true',
};

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--port':
    case '-p':
      config.port = parseInt(args[++i]);
      break;
    case '--host':
    case '-h':
      config.host = args[++i];
      break;
    case '--verbose':
    case '-v':
      config.verbose = true;
      break;
    case '--help':
      console.log(`
LLMChef MCP Bridge

Usage: node mcp-bridge.js [options]

Options:
  -p, --port <port>     Port to bind to (default: 3001)
  -h, --host <host>     Host to bind to (default: 127.0.0.1)
  -v, --verbose         Enable verbose logging
  --help                Show this help

Endpoints:
  GET /health                          Health check
  GET /servers                         List active servers
  POST /servers/{name}/sse             SSE endpoint for named profile
  POST /servers/{name}/mcp             Direct MCP endpoint for named profile

Server Profiles:
  Configure profiles with MCP_BRIDGE_SERVERS JSON.

  Example:
  MCP_BRIDGE_TOKEN=secret \\
  MCP_BRIDGE_SERVERS='{"myfs":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}}' \\
  node bin/mcp-bridge.js

  LLMChef should connect to stdio://myfs and send the bridge token.

Dynamic URL command mode is disabled by default. To temporarily allow legacy
stdio://command?args=... URLs, set MCP_BRIDGE_ALLOW_DYNAMIC=true.
      `);
      process.exit(0);
  }
}

// Global state
const servers = new Map(); // name -> server instance

// Utility functions
function log(...args) {
  if (config.verbose) {
    console.log(`[${new Date().toISOString()}]`, ...args);
  }
}

function error(...args) {
  console.error(`[${new Date().toISOString()}] ERROR:`, ...args);
}

function assertCommandAllowed(command) {
  if (!config.allowedCommands.includes(command)) {
    throw new Error(`Command is not allowed: ${command}`);
  }
}

// Parse server configuration from named profiles, with legacy dynamic mode opt-in.
function parseServerConfig(serverName, url) {
  const profile = config.serverProfiles[serverName];
  if (profile) {
    if (!profile.enabled) {
      throw new Error(`Server profile is disabled: ${serverName}`);
    }
    assertCommandAllowed(profile.command);
    return { ...profile };
  }

  const urlObj = new URL(url, `http://localhost:${config.port}`);
  const command = urlObj.searchParams.get('command');
  const argsStr = urlObj.searchParams.get('args');

  if (!config.allowDynamicServers) {
    throw new Error(`Unknown MCP server profile "${serverName}". Add it to MCP_BRIDGE_SERVERS.`);
  }
  if (!command) {
    throw new Error('Missing required parameter: command');
  }
  assertCommandAllowed(command);
  
  const args = argsStr ? argsStr.split(',').map(arg => arg.trim()).filter(arg => arg) : [];
  
  return {
    command,
    args,
    enabled: true
  };
}

// JSON Line Parser
class JsonLineParser extends Transform {
  constructor() {
    super({ objectMode: true });
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          this.push(parsed);
        } catch (err) {
          error('JSON parse error:', err.message, 'Line:', trimmed);
        }
      }
    }
    callback();
  }

  _flush(callback) {
    if (this.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.buffer.trim());
        this.push(parsed);
      } catch (err) {
        error('JSON parse error in flush:', err.message);
      }
    }
    callback();
  }
}

// MCP Server Instance
class McpServer {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.process = null;
    this.jsonParser = null;
    this.initialized = false;
    this.pendingRequests = new Map();
    this.requestId = 1;
    this.stdinQueue = [];
    this.stdinWriting = false;
  }

  async start() {
    if (this.process) return; // Already started

    log(`Starting dynamic MCP server: ${this.name} (${this.config.command} ${this.config.args.join(' ')})`);
    
    try {
      this.process = spawn(this.config.command, this.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      // Set up JSON parser
      this.jsonParser = new JsonLineParser();
      this.process.stdout.pipe(this.jsonParser);
      
      this.jsonParser.on('data', (message) => {
        this.handleMessage(message);
      });

      this.process.on('exit', (code) => {
        log(`Server ${this.name} exited with code ${code}`);
        this.cleanup();
      });

      this.process.on('error', (err) => {
        error(`Server ${this.name} error:`, err);
        this.cleanup();
      });

      // Initialize the server
      await this.initialize();
      log(`Dynamic server ${this.name} started and initialized`);

    } catch (err) {
      error(`Failed to start server ${this.name}:`, err);
      throw err;
    }
  }

  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'llmchef-mcp-bridge',
        version: '1.0.0'
      }
    });

    if (response) {
      this.initialized = true;
      await this.sendNotification('initialized', {});
    }
  }

  handleMessage(message) {
    log(`Server ${this.name} message:`, JSON.stringify(message));

    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      clearTimeout(timeout);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP Error'));
      } else {
        resolve(message.result);
      }
    }
  }

  async sendRequest(method, params) {
    const id = this.requestId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.writeMessage(message);
    });
  }

  async sendNotification(method, params) {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };
    await this.writeMessage(message);
  }

  async writeMessage(message) {
    const jsonStr = JSON.stringify(message) + '\n';
    this.stdinQueue.push(jsonStr);
    if (!this.stdinWriting) {
      await this.processStdinQueue();
    }
  }

  async processStdinQueue() {
    this.stdinWriting = true;
    
    while (this.stdinQueue.length > 0) {
      const message = this.stdinQueue.shift();
      
      if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
        error(`Cannot write to server ${this.name}: stdin not available`);
        break;
      }

      try {
        await new Promise((resolve, reject) => {
          const writeCallback = (err) => {
            if (err) {
              error(`Write error to server ${this.name}:`, err);
              reject(err);
            } else {
              resolve();
            }
          };

          if (!this.process.stdin.write(message, 'utf8', writeCallback)) {
            this.process.stdin.once('drain', resolve);
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (err) {
        error(`Failed to write to server ${this.name}:`, err);
        break;
      }
    }
    
    this.stdinWriting = false;
  }

  async handleClientRequest(message) {
    if (!this.initialized) {
      throw new Error(`Server ${this.name} not initialized`);
    }

    // Handle the MCP request and return a proper JSON-RPC response
    try {
      const result = await this.sendRequest(message.method, message.params);
      
      // Return proper JSON-RPC response format
      return {
        jsonrpc: "2.0",
        id: message.id || null,
        result: result
      };
    } catch (error) {
      // Return proper JSON-RPC error format
      return {
        jsonrpc: "2.0",
        id: message.id || null,
        error: {
          code: -1,
          message: error.message
        }
      };
    }
  }

  cleanup() {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
    this.jsonParser = null;
    this.initialized = false;
    this.pendingRequests.clear();
    this.stdinQueue = [];
    
    // Remove from global servers map
    servers.delete(this.name);
  }
}

// Get or create server dynamically
async function getOrCreateServer(name, serverConfig) {
  if (servers.has(name)) {
    return servers.get(name);
  }

  log(`Creating new dynamic server: ${name}`);
  const server = new McpServer(name, serverConfig);
  servers.set(name, server);
  
  try {
    await server.start();
    return server;
  } catch (err) {
    servers.delete(name);
    throw err;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  error(`HTTP ${statusCode}: ${message}`);
  sendJson(res, statusCode, { error: message });
}

function isAuthorized(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const bridgeToken = req.headers['x-mcp-bridge-token'] || '';
  return bearerToken === config.token || bridgeToken === config.token;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.allowedOrigins.includes('*')) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    return false;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-MCP-Bridge-Token, MCP-Protocol-Version, MCP-Session-Id');
  return true;
}

async function handleHealth(req, res) {
  sendJson(res, 200, { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeServers: Array.from(servers.keys()),
    configuredProfiles: Object.keys(config.serverProfiles),
    version: '1.0.0',
    mode: config.allowDynamicServers ? 'profile+dynamic' : 'profile'
  });
}

async function handleServersList(req, res) {
  const serverList = Array.from(servers.entries()).map(([name, server]) => ({
    name,
    command: server.config.command,
    args: server.config.args,
    initialized: server.initialized,
    running: server.process && !server.process.killed
  }));
  
  sendJson(res, 200, { 
    servers: serverList,
    count: serverList.length 
  });
}

async function handleServerRequest(req, res, serverName) {
  try {
    const serverConfig = parseServerConfig(serverName, req.url);
    
    // Get or create the server
    const server = await getOrCreateServer(serverName, serverConfig);
    
    if (!server.initialized) {
      return sendError(res, 503, `Server ${serverName} not initialized`);
    }

    const isSSE = req.url.includes('/sse');
    
    if (isSSE) {
      // SSE endpoint
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Parse JSON body
      const message = await parseJsonBody(req);
      
      log(`SSE request for server ${serverName}, message:`, JSON.stringify(message));
      
      // Handle the MCP request if present
      if (message && message.method) {
        log(`Processing SSE MCP request: ${message.method}`);
        try {
          const result = await server.handleClientRequest(message);
          // Send the raw MCP response
          res.write(`data: ${JSON.stringify(result)}\n\n`);
          // End the response after sending the data
          res.end();
        } catch (err) {
          log(`SSE MCP request failed:`, err.message);
          // Send MCP-format error response
          res.write(`data: ${JSON.stringify({ 
            jsonrpc: "2.0", 
            id: message.id || null, 
            error: { 
              code: -1, 
              message: err.message 
            } 
          })}\n\n`);
          res.end();
        }
      } else {
        log(`SSE connection established for server ${serverName}, but no valid message received`);
        // Send an error for invalid requests
        res.write(`data: ${JSON.stringify({ 
          jsonrpc: "2.0", 
          id: null, 
          error: { 
            code: -32600, 
            message: "Invalid Request - no method specified" 
          } 
        })}\n\n`);
        res.end();
      }
    } else {
      // Direct MCP endpoint
      const message = await parseJsonBody(req);
      
      try {
        const result = await server.handleClientRequest(message);
        // Send the raw MCP response for direct endpoints too
        sendJson(res, 200, result);
      } catch (err) {
        // Send MCP-format error response
        sendJson(res, 500, { 
          jsonrpc: "2.0", 
          id: message.id || null, 
          error: { 
            code: -1, 
            message: err.message 
          } 
        });
      }
    }
    
  } catch (err) {
    error(`Server request error:`, err);
    sendError(res, 400, err.message);
  }
}

// Graceful shutdown
function gracefulShutdown() {
  log('Shutting down gracefully...');
  
  // Close all servers
  for (const [name, server] of servers.entries()) {
    log(`Stopping server: ${name}`);
    server.cleanup();
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);
  
  log(`${req.method} ${req.url}`);
  
  if (!applyCors(req, res)) {
    sendError(res, 403, 'Origin is not allowed by MCP_BRIDGE_ALLOWED_ORIGINS');
    return;
  }
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    if (url.pathname === '/health') {
      await handleHealth(req, res);
    } else if (url.pathname === '/servers') {
      if (!isAuthorized(req)) {
        sendError(res, 401, 'Missing or invalid MCP bridge token');
        return;
      }
      await handleServersList(req, res);
    } else if (url.pathname.startsWith('/servers/')) {
      if (!isAuthorized(req)) {
        sendError(res, 401, 'Missing or invalid MCP bridge token');
        return;
      }
      const pathParts = url.pathname.split('/');
      if (pathParts.length >= 4) {
        const serverName = pathParts[2];
        await handleServerRequest(req, res, serverName);
      } else {
        sendError(res, 404, 'Invalid server endpoint');
      }
    } else {
      sendError(res, 404, 'Not found');
    }
  } catch (err) {
    error('Request error:', err);
    sendError(res, 500, 'Internal server error');
  }
});

// Start server
server.listen(config.port, config.host, () => {
  console.log(`✅ LLMChef MCP Bridge running on ${config.host}:${config.port}`);
  console.log(`🔐 Bridge token: ${config.token}${generatedToken ? ' (generated for this session)' : ''}`);
  console.log(`📦 Configured profiles: ${Object.keys(config.serverProfiles).join(', ') || '(none)'}`);
  console.log(`🔄 Legacy dynamic command mode: ${config.allowDynamicServers ? 'enabled' : 'disabled'}`);
  console.log(`📋 Health check: http://${config.host}:${config.port}/health`);
  console.log(`📊 Active servers: http://${config.host}:${config.port}/servers`);
  console.log(`\n🚀 Ready to accept profile-backed server requests!`);
}); 
