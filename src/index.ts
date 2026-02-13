#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { validateConfig } from './config.js';
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

// Create MCP server
const server = new Server(
  { name: 'youtuber-mcp-claude', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

// Cleanup handlers
function cleanup() {
  closeCache();
  closeCalendarDB();
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', `YouTuber MCP Server running on stdio (${TOOLS.length} tools registered)`);
}

main().catch((error) => {
  console.error('Server startup error:', error);
  cleanup();
  process.exit(1);
});
