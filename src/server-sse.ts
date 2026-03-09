#!/usr/bin/env node
import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { TOOLS, handleToolCall } from './tools/index.js';
import { initCache, closeCache } from './services/cache.js';
import { closeCalendarDB } from './tools/content-calendar.js';
import { log } from './utils/logger.js';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', (error as Error).message);
  process.exit(1);
}

// Initialize cache
initCache();

// Create MCP server factory
function createMCPServer(): Server {
  const mcpServer = new Server(
    { name: 'youtuber-mcp-claude', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log('info', `Tool called: ${name}`, { args });

    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Tool error: ${name}`, { error: errorMessage });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }, null, 2) }],
        isError: true,
      };
    }
  });

  return mcpServer;
}

// Active Streamable HTTP transports
const transports = new Map<string, StreamableHTTPServerTransport>();

// HTTP Server
const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Health check endpoint
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'youtuber-mcp-claude',
      transport: 'streamable-http',
      tools: TOOLS.length,
      sessions: transports.size,
    }));
    return;
  }

  // Streamable HTTP endpoint
  if (url.pathname === '/mcp') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const jsonBody = JSON.parse(body);
          const sessionId = req.headers['mcp-session-id'] as string;

          let transport: StreamableHTTPServerTransport;

          if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId)!;
          } else if (!sessionId && isInitializeRequest(jsonBody)) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => crypto.randomUUID(),
              onsessioninitialized: (sid) => {
                transports.set(sid, transport);
                log('info', `Session initialized: ${sid}`);
              },
            });
            transport.onclose = () => {
              const sid = transport.sessionId;
              if (sid) {
                transports.delete(sid);
                log('info', `Session closed: ${sid}`);
              }
            };
            const server = createMCPServer();
            await server.connect(transport);
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Bad Request: No valid session ID' },
              id: null,
            }));
            return;
          }

          await transport.handleRequest(req, res, jsonBody);
        } catch (error) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(error) }));
          }
        }
      });
      return;
    }

    if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }

    if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Cleanup handlers
function cleanup() {
  closeCache();
  closeCalendarDB();
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// Start HTTP server
httpServer.listen(config.sse.port, config.sse.host, () => {
  log('info', `YouTuber MCP Server (Streamable HTTP) running at http://${config.sse.host}:${config.sse.port}`);
  console.log(`YouTuber MCP Server (Streamable HTTP) running at http://${config.sse.host}:${config.sse.port}`);
  console.log('Endpoints:');
  console.log(`  - MCP:    http://${config.sse.host}:${config.sse.port}/mcp`);
  console.log(`  - Health: http://${config.sse.host}:${config.sse.port}/health`);
  console.log(`  - Tools:  ${TOOLS.length} registered`);
});
