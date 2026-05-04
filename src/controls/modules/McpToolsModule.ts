import { type ControlModule } from "@/types/llmchef/control";
import {
  type LLMChefModApi,
} from "@/types/llmchef/modding";
import { useMcpStore } from "@/store/mcp.store";
import type { McpServerConfig } from "@/types/llmchef/mcp";
import { mcpEvent } from "@/types/llmchef/events/mcp.events";
import { experimental_createMCPClient } from "ai";
import { Tool } from "ai";
import { emitter } from "@/lib/llmchef/event-emitter";
import { assertAllowedOutboundUrl } from "@/lib/llmchef/outbound-policy";
import { toast } from "sonner";
import { z } from "zod";

interface McpClient {
  id: string;
  name: string;
  client: any; // MCP client instance
  tools: Record<string, Tool>;
  sessionId?: string; // For Streamable HTTP session management
  transport: 'streamable-http' | 'sse'; // Track which transport is being used
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  timeout: number;
}

const MCP_PROTOCOL_VERSION = "2025-11-25";

export class McpToolsModule implements ControlModule {
  readonly id = "core-mcp-tools";
  private unregisterCallbacks: (() => void)[] = [];
  private mcpToolUnregisterCallbacks: (() => void)[] = []; // Track MCP tool registrations for cleanup
  public mcpClients: Map<string, McpClient> = new Map(); // Make public for access
  private modApi?: LLMChefModApi;
  private connectionAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async initialize(modApi: LLMChefModApi): Promise<void> {
    this.modApi = modApi;


    // Store global reference for AI service access
    (globalThis as any).mcpToolsModuleInstance = this;

    // Load initial MCP state
    emitter.emit(mcpEvent.loadMcpStateRequest, undefined);

    // Set up event listeners
    this.setupEventListeners();

    // Initialize MCP clients for enabled servers
    await this.initializeMcpClients();
  }

  register(): void {
    // Tools are registered dynamically when MCP clients connect

  }

  destroy(): void {


    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.retryTimeouts.clear();
    this.connectionAttempts.clear();

    // Disconnect all MCP clients
    this.mcpClients.forEach((client) => {
      try {
        if (client.client && typeof client.client.disconnect === 'function') {
          client.client.disconnect();
        }
      } catch (error) {
        console.error(`[${this.id}] Error disconnecting MCP client ${client.id}:`, error);
      }
    });
    this.mcpClients.clear();

    // Unregister all callbacks
    this.unregisterCallbacks.forEach(callback => callback());
    this.unregisterCallbacks = [];

    // Unregister MCP tool callbacks
    this.mcpToolUnregisterCallbacks.forEach(callback => callback());
    this.mcpToolUnregisterCallbacks = [];
  }

  private setupEventListeners(): void {
    // Listen for MCP server changes
    const handleServersChanged = () => {

      this.initializeMcpClients().catch(error => {
        console.error(`[${this.id}] Error reinitializing MCP clients:`, error);
      });
    };

    emitter.on(mcpEvent.serversChanged, handleServersChanged);

    this.unregisterCallbacks.push(() => {
      emitter.off(mcpEvent.serversChanged, handleServersChanged);
    });
  }

  private getRetryConfig(): RetryConfig {
    const mcpState = useMcpStore.getState();
    return {
      maxAttempts: mcpState.retryAttempts,
      baseDelay: mcpState.retryDelay,
      timeout: mcpState.connectionTimeout,
    };
  }

  private async initializeMcpClients(): Promise<void> {
    try {
      // Get current MCP servers from store
      const mcpState = useMcpStore.getState();
      const enabledServers = mcpState.servers.filter(server => server.enabled);



      // Clear existing retry attempts and timeouts
      this.connectionAttempts.clear();
      this.retryTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      this.retryTimeouts.clear();

      // Disconnect existing clients and unregister their tools
      this.mcpClients.forEach((client) => {
        try {
          if (client.client && typeof client.client.disconnect === 'function') {
            client.client.disconnect();
          }
        } catch (error) {
          console.error(`[${this.id}] Error disconnecting existing MCP client ${client.id}:`, error);
        }
      });
      this.mcpClients.clear();

      // Unregister existing MCP tools before reconnecting
      this.mcpToolUnregisterCallbacks.forEach(callback => callback());
      this.mcpToolUnregisterCallbacks = [];

      // Connect to enabled servers
      for (const server of enabledServers) {
        this.connectToMcpServerWithRetry(server);
      }

    } catch (error) {
      console.error(`[${this.id}] Error initializing MCP clients:`, error);
      toast.error("Failed to initialize MCP clients", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  private async connectToMcpServerWithRetry(server: McpServerConfig): Promise<void> {
    const retryConfig = this.getRetryConfig();
    const currentAttempt = this.connectionAttempts.get(server.id) || 0;



    try {
      await this.connectToMcpServer(server);

      // Reset connection attempts on success
      this.connectionAttempts.delete(server.id);

      // Clear any pending retry timeout
      const existingTimeout = this.retryTimeouts.get(server.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.retryTimeouts.delete(server.id);
      }

      toast.success(`Connected to MCP server: ${server.name}`, {
        description: `Successfully connected and loaded tools`,
      });

    } catch (error) {
      console.error(`[${this.id}] Failed to connect to MCP server ${server.name} (attempt ${currentAttempt + 1}):`, error);

      // Update server status to indicate connection failure
      const mcpState = useMcpStore.getState();
      mcpState.setServerStatus({
        serverId: server.id,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastConnected: undefined,
        toolCount: 0,
        tools: [],
      });

      // Check if we should retry
      if (currentAttempt < retryConfig.maxAttempts) {
        this.connectionAttempts.set(server.id, currentAttempt + 1);

        const nextAttempt = currentAttempt + 1;
        const delay = retryConfig.baseDelay * Math.pow(1.5, currentAttempt); // Exponential backoff



        const timeout = setTimeout(() => {
          this.retryTimeouts.delete(server.id);
          this.connectToMcpServerWithRetry(server);
        }, delay);

        this.retryTimeouts.set(server.id, timeout);

        toast.warning(`MCP server connection failed: ${server.name}`, {
          description: `Retrying in ${Math.round(delay / 1000)}s (attempt ${nextAttempt + 1}/${retryConfig.maxAttempts + 1})`,
        });

      } else {
        // All retry attempts exhausted
        this.connectionAttempts.delete(server.id);

        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        toast.error(`Failed to connect to MCP server: ${server.name}`, {
          description: `All ${retryConfig.maxAttempts + 1} connection attempts failed. ${errorMessage}`,
          duration: 10000, // Show error longer
        });

        console.error(`[${this.id}] All retry attempts exhausted for MCP server ${server.name}`);
      }
    }
  }

  private async connectToMcpServer(server: McpServerConfig): Promise<void> {


    const retryConfig = this.getRetryConfig();

    try {
      let mcpClient: any;
      let transportType: 'streamable-http' | 'sse' = 'streamable-http';

      if (!server.url.startsWith('http://') && !server.url.startsWith('https://')) {
        throw new Error('MCP server URL must use http:// or https://.');
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${retryConfig.timeout}ms`));
        }, retryConfig.timeout);
      });

      try {
        mcpClient = await Promise.race([
          this.connectWithStreamableHttp(server),
          timeoutPromise,
        ]);
        transportType = 'streamable-http';
      } catch (streamableError) {
        console.debug(`[${this.id}] Streamable HTTP transport failed, falling back to SSE:`, streamableError);
        mcpClient = await Promise.race([
          this.connectWithSseTransport(server),
          timeoutPromise,
        ]);
        transportType = 'sse';
      }



      await this.handleSuccessfulConnection(server, mcpClient, transportType);



    } catch (error) {
      // Enhance error messages for common issues
      let enhancedError = error;

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          enhancedError = new Error(`Network error: Unable to reach MCP server at ${server.url}. Please check if the server is running and accessible.`);
        } else if (error.message.includes('timeout')) {
          enhancedError = new Error(`Connection timeout: MCP server at ${server.url} did not respond within ${retryConfig.timeout}ms.`);
        } else if (error.message.includes('401') || error.message.includes('403')) {
          enhancedError = new Error(`Authentication error: Invalid credentials for MCP server at ${server.url}.`);
        } else if (error.message.includes('404')) {
          enhancedError = new Error(`Server not found: MCP server endpoint ${server.url} does not exist.`);
        } else if (error.message.includes('500')) {
          enhancedError = new Error(`Server error: MCP server at ${server.url} returned an internal server error.`);
        }
      }

      console.error(`[${this.id}] Failed to connect to MCP server ${server.name}:`, enhancedError);
      throw enhancedError;
    }
  }

  /**
   * Attempt connection using Streamable HTTP transport (MCP 2025-11-25)
   */
  private async connectWithStreamableHttp(server: McpServerConfig): Promise<any> {


    // For Streamable HTTP, we need to implement a custom transport that follows the new spec
    // Since the Vercel AI SDK doesn't yet support Streamable HTTP natively,
    // we'll use a custom transport that implements the new protocol
    const transport = this.createStreamableHttpTransport(server);

    return experimental_createMCPClient({
      transport,
    });
  }

  private getMcpHttpHeaders(
    server: McpServerConfig,
    sessionId?: string | null,
    protocolVersion?: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(sessionId ? { 'MCP-Session-Id': sessionId } : {}),
      ...(protocolVersion ? { 'MCP-Protocol-Version': protocolVersion } : {}),
      ...server.headers,
    };
  }

  private parseSseMessages(text: string): any[] {
    return text
      .split(/\r?\n\r?\n/)
      .map((eventBlock) =>
        eventBlock
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
      )
      .filter(Boolean)
      .map((data) => JSON.parse(data));
  }

  private async readMcpHttpMessages(response: Response): Promise<any[]> {
    if (response.status === 202 || !response.body) return [];
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      return this.parseSseMessages(text);
    }

    const text = await response.text();
    if (!text.trim()) return [];
    return [JSON.parse(text)];
  }


  /**
   * Fallback to the deprecated SSE transport for backwards compatibility
   */
  private async connectWithSseTransport(server: McpServerConfig): Promise<any> {


    return experimental_createMCPClient({
      transport: {
        type: "sse",
        url: server.url,
        headers: server.headers || {},
      },
    });
  }

  /**
   * Create a custom transport that implements the new Streamable HTTP protocol
   */
  private createStreamableHttpTransport(server: McpServerConfig): any {
    let sessionId: string | null = null;
    let isConnected = false;
    let protocolVersion = MCP_PROTOCOL_VERSION;
    const getMcpHttpHeaders = this.getMcpHttpHeaders.bind(this);
    const readMcpHttpMessages = this.readMcpHttpMessages.bind(this);

    return {
      async start(): Promise<void> {


        // Send InitializeRequest to establish session
        const serverUrl = assertAllowedOutboundUrl(server.url, `mcp:init:${server.name}`);
        const initResponse = await fetch(serverUrl, {
          method: 'POST',
          headers: getMcpHttpHeaders(server),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `init_${Date.now()}`,
            method: 'initialize',
            params: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: {
                tools: {},
                roots: { listChanged: true },
              },
              clientInfo: {
                name: 'LLMChef',
                version: '1.0.0',
              },
            },
          }),
        });

        if (!initResponse.ok) {
          throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`);
        }

        // Extract session ID from response headers if provided
        sessionId = initResponse.headers.get('Mcp-Session-Id');

        const initMessages = await readMcpHttpMessages(initResponse);
        const initResult = initMessages[initMessages.length - 1];

        if (!initResult) {
          throw new Error("MCP Initialize Error: server returned no initialize result");
        }
        if (initResult.error) {
          throw new Error(`MCP Initialize Error: ${initResult.error.message}`);
        }
        protocolVersion = initResult.result?.protocolVersion || MCP_PROTOCOL_VERSION;

        // Send InitializedNotification
        const initializedResponse = await fetch(serverUrl, {
          method: 'POST',
          headers: getMcpHttpHeaders(server, sessionId, protocolVersion),
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialized',
            params: {},
          }),
        });

        if (!initializedResponse.ok) {
          throw new Error(`Failed to send initialized notification: ${initializedResponse.status}`);
        }
        await readMcpHttpMessages(initializedResponse);

        isConnected = true;
      },

      async send(message: any): Promise<void> {
        if (!isConnected) {
          throw new Error('Transport not connected');
        }

        const serverUrl = assertAllowedOutboundUrl(server.url, `mcp:message:${server.name}`);
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: getMcpHttpHeaders(server, sessionId, protocolVersion),
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          // Handle session expiration (404 with session ID)
          if (response.status === 404 && sessionId) {
            sessionId = null;
            isConnected = false;
            throw new Error('Session expired, reinitializing connection');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const messages = await readMcpHttpMessages(response);
        messages.forEach((result) => this.onmessage?.(result));
      },

      async close(): Promise<void> {
        if (sessionId) {
          // Explicitly terminate session if supported
          try {
            const serverUrl = assertAllowedOutboundUrl(server.url, `mcp:close:${server.name}`);
            await fetch(serverUrl, {
              method: 'DELETE',
              headers: getMcpHttpHeaders(server, sessionId, protocolVersion),
            });
          } catch (error) {
            console.debug(`[${this.id}] MCP session close request failed:`, error);
          }
        }
        isConnected = false;
        sessionId = null;
        this.onclose?.();
      },

      // Callbacks that will be set by the MCP client
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
      onmessage: undefined as ((message: any) => void) | undefined,
    };
  }

  /**
   * Handle successful connection regardless of transport type
   */
  private async handleSuccessfulConnection(
    server: McpServerConfig,
    mcpClient: any,
    transportType: 'streamable-http' | 'sse'
  ): Promise<void> {


    // Get available tools from the MCP client
    let tools;
    try {


      if (mcpClient.tools && Array.isArray(mcpClient.tools)) {
        // Convert array of tools to object format expected by the rest of the code
        tools = {};
        mcpClient.tools.forEach((tool: any) => {
          tools[tool.name] = {
            description: tool.description,
            inputSchema: tool.inputSchema, // MCP uses inputSchema, AI SDK v5 also uses inputSchema
          };
        });


      } else {
        console.error("[%s] MCP client missing tools array:", this.id, mcpClient);
        throw new Error('MCP client missing tools array');
      }


    } catch (error) {
      console.error(`[${this.id}] Failed to retrieve tools from ${server.name}:`, error);
      console.error(`[${this.id}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace available');
      throw error;
    }



    // Store the client with transport info
    const clientInfo: McpClient = {
      id: server.id,
      name: server.name,
      client: mcpClient,
      tools: tools,
      transport: transportType,
    };

    this.mcpClients.set(server.id, clientInfo);

    // Register MCP tools for individual control (but mark them as MCP tools)
    // Store tools for later registration when user enables them

    // Update the existing clientInfo with the tools
    clientInfo.tools = tools;

    // Register MCP tools with LLMChef control registry so they show up in UI tool selector
    if (this.modApi) {
      Object.entries(tools).forEach(([toolName, tool]) => {
        const prefixedToolName = `mcp_${server.name}_${toolName}`;



        // Tool definition for LLMChef registry
        const mcpTool = tool as any;

        // Convert JSON schema to Zod schema
        let parametersSchema: z.ZodSchema<any>;
        if (mcpTool.parameters && typeof mcpTool.parameters === 'object' && mcpTool.parameters.properties) {
          // Convert JSON schema properties to Zod object
          const zodObject: Record<string, z.ZodSchema<any>> = {};
          const required = mcpTool.parameters.required || [];

          for (const [propName, propSchema] of Object.entries(mcpTool.parameters.properties as Record<string, any>)) {
            let zodProp: z.ZodSchema<any>;

            // Basic type conversion from JSON schema to Zod
            switch (propSchema.type) {
              case 'string':
                zodProp = z.string();
                break;
              case 'number':
                zodProp = z.number();
                break;
              case 'boolean':
                zodProp = z.boolean();
                break;
              case 'array':
                zodProp = z.array(z.any());
                break;
              case 'object':
                zodProp = z.object({}).passthrough();
                break;
              default:
                zodProp = z.any();
            }

            // Add description if available
            if (propSchema.description) {
              zodProp = zodProp.describe(propSchema.description);
            }

            // Make optional if not in required array
            if (!required.includes(propName)) {
              zodProp = zodProp.optional();
            }

            zodObject[propName] = zodProp;
          }

          parametersSchema = z.object(zodObject);
        } else {
          // No parameters or invalid parameters
          parametersSchema = z.object({});
        }

        const toolDefinition: Tool<any> = {
          description: mcpTool.description || `MCP tool ${toolName} from ${server.name}`,
          inputSchema: parametersSchema,
        };

        // Tool implementation that calls the MCP client
        const toolImplementation = async (args: any) => {
          const result = await clientInfo.client.callTool({
            name: toolName,
            arguments: args
          });

          // Extract the actual content from MCP result format
          if (result && result.content) {
            if (Array.isArray(result.content)) {
              // Handle array of content items
              const textContent = result.content
                .map((item: any) => {
                  if (item.type === 'text') {
                    return item.text;
                  } else if (item.type === 'image') {
                    return `[Image: ${item.mimeType || 'unknown format'}]`;
                  }
                  return JSON.stringify(item);
                })
                .join('\n');
              return textContent;
            } else if (typeof result.content === 'string') {
              return result.content;
            } else {
              return JSON.stringify(result.content);
            }
          } else {
            // Fallback to stringifying the whole result
            return JSON.stringify(result);
          }
        };

        // Register with LLMChef control registry (shows in UI tool selector)
        const unregisterTool = this.modApi!.registerTool(
          prefixedToolName,
          toolDefinition,
          toolImplementation
        );

        this.mcpToolUnregisterCallbacks.push(unregisterTool);

        // Emit discovery event
        emitter.emit(mcpEvent.toolDiscovered, {
          toolName,
          serverId: server.id,
          serverName: server.name,
          toolDefinition: mcpTool,
        });


      });
    }

    // Update server status to indicate successful connection
    const mcpState = useMcpStore.getState();
    mcpState.setServerStatus({
      serverId: server.id,
      connected: true,
      error: undefined,
      lastConnected: new Date(),
      toolCount: Object.keys(tools).length,
      tools: Object.keys(tools),
    });

    // DON'T emit serversChanged - that would trigger infinite reconnection loop!
    // The UI will be updated by the server status changes through the MCP store

    // Show success toast with transport info
    const transportNames = {
      'streamable-http': 'Streamable HTTP (latest)',
      'sse': 'SSE (legacy)',
    };

    toast.success(`Connected to MCP server: ${server.name}`, {
      description: `Using ${transportNames[transportType]} transport with ${Object.keys(tools).length} tools`,
    });
  }

  // Public method to manually retry connection for a specific server
  public retryServerConnection(serverId: string): void {
    const mcpState = useMcpStore.getState();
    const server = mcpState.servers.find(s => s.id === serverId);

    if (!server) {
      console.error(`[${this.id}] Server with ID ${serverId} not found`);
      return;
    }

    if (!server.enabled) {

      return;
    }

    // Clear existing retry attempts and timeouts for this server
    this.connectionAttempts.delete(serverId);
    const existingTimeout = this.retryTimeouts.get(serverId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.retryTimeouts.delete(serverId);
    }

    // Disconnect existing client if any
    const existingClient = this.mcpClients.get(serverId);
    if (existingClient) {
      try {
        if (existingClient.client && typeof existingClient.client.disconnect === 'function') {
          existingClient.client.disconnect();
        }
      } catch (error) {
        console.error(`[${this.id}] Error disconnecting existing client for ${server.name}:`, error);
      }
      this.mcpClients.delete(serverId);
    }

    // Start fresh connection attempt
    this.connectToMcpServerWithRetry(server);
  }

  // Get connection status for all servers
  public getConnectionStatus(): Record<string, { connected: boolean; error?: string; toolCount: number }> {
    const status: Record<string, { connected: boolean; error?: string; toolCount: number }> = {};

    const mcpState = useMcpStore.getState();
    mcpState.servers.forEach(server => {
      const serverStatus = mcpState.serverStatuses[server.id];
      status[server.id] = {
        connected: serverStatus?.connected || false,
        error: serverStatus?.error,
        toolCount: serverStatus?.toolCount || 0,
      };
    });

    return status;
  }

  /**
   * Register a specific MCP tool with the AI SDK when user enables it
   */
  public registerMcpToolWithAI(serverId: string, toolName: string): () => void {
    const clientInfo = this.mcpClients.get(serverId);
    if (!clientInfo) {
      console.error(`[${this.id}] No MCP client found for server ${serverId}`);
      return () => {};
    }

    const tool = clientInfo.tools[toolName];
    if (!tool) {
      console.error(`[${this.id}] Tool ${toolName} not found in server ${clientInfo.name}`);
      return () => {};
    }

    if (!this.modApi) {
      console.error(`[${this.id}] ModApi not available for tool registration`);
      return () => {};
    }

    const prefixedToolName = `mcp_${clientInfo.name}_${toolName}`;



    try {
      // Tool definition (without execute function)
      const toolDefinition: Tool<any> = {
        description: tool.description || `MCP tool ${toolName} from ${clientInfo.name}`,
        inputSchema: tool.inputSchema || z.object({}),
      };

      // Tool implementation (separate from definition)
      const toolImplementation = async (args: any) => {
        // Use the connected MCP client to call the tool
        const result = await clientInfo.client.callTool({
          name: toolName,
          arguments: args
        });

        // Handle MCP tool response format
        let content = "";
        if (result && result.content) {
          if (Array.isArray(result.content)) {
            content = result.content
              .map((item: any) => {
                if (item.type === 'text') {
                  return item.text;
                } else if (item.type === 'image') {
                  return `[Image: ${item.mimeType || 'unknown format'}]`;
                }
                return JSON.stringify(item);
              })
              .join('\n');
          } else if (typeof result.content === 'string') {
            content = result.content;
          } else {
            content = JSON.stringify(result.content);
          }
        } else {
          content = JSON.stringify(result);
        }

        // Truncate very large responses to prevent API errors
        const { maxResponseSize } = useMcpStore.getState();
        if (content.length > maxResponseSize) {
          content = content.substring(0, maxResponseSize) + '\n\n[... response truncated due to size ...]';
        }

        return content;
      };

      // Register the MCP tool with proper 3-parameter format
      const unregisterTool = this.modApi.registerTool(
        prefixedToolName,
        toolDefinition,
        toolImplementation
      );



      // Track for cleanup
      this.mcpToolUnregisterCallbacks.push(unregisterTool);

      // Emit tool registered event
      emitter.emit(mcpEvent.toolRegistered, {
        toolName,
        serverId: clientInfo.id,
        serverName: clientInfo.name,
        prefixedToolName,
      });

      return unregisterTool;

    } catch (error) {
      console.error(`[${this.id}] Error registering MCP tool ${toolName} with AI SDK:`, error);
      return () => {};
         }
   }

  /**
   * Unregister a specific MCP tool from the AI SDK when user disables it
   */
  public unregisterMcpToolFromAI(serverId: string, toolName: string): void {
    const clientInfo = this.mcpClients.get(serverId);
    if (!clientInfo) {
      console.error(`[${this.id}] No MCP client found for server ${serverId}`);
      return;
    }

    const prefixedToolName = `mcp_${clientInfo.name}_${toolName}`;


         // Find and call the unregister callback for this specific tool
     // Note: This is a limitation - we don't track individual tool unregister callbacks
     // For now, emit an event to signal the tool should be disabled
     emitter.emit(mcpEvent.toolUnregistered, {
       toolName,
       serverId: clientInfo.id,
       prefixedToolName,
     });
  }

}
