# Boilerplate: TypeScript MCP Server

Code templates สำหรับ project ใหม่ เปลี่ยน `xxx` เป็นชื่อ project จริง

---

## 1. package.json

```json
{
  "name": "xxx-mcp-claude",
  "version": "1.0.0",
  "description": "MCP Server for [description]",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "prepare": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "dotenv": "^16.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

**เพิ่มตามต้องการ:**
- SQLite: `"better-sqlite3": "^11.0.0"` + `"@types/better-sqlite3": "^7.6.0"` (devDep)
- Google API: `"googleapis": "^144.0.0"`
- HTTP Client: `"axios": "^1.7.0"`
- SSH: `"ssh2": "^1.16.0"` + `"@types/ssh2": "^1.15.0"` (devDep)
- HTML Scraping: `"cheerio": "^1.0.0"`

---

## 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 3. src/config.ts

```typescript
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

export const config = {
  // === Service-specific config ===
  api: {
    key: process.env.API_KEY || '',
    // endpoint: process.env.API_ENDPOINT || '',
  },
  // === SSE server config ===
  sse: {
    host: process.env.SSE_HOST || '0.0.0.0',
    port: parseInt(process.env.SSE_PORT || '3000', 10),
  },
  // === Cache config (ถ้ามี) ===
  // cache: {
  //   ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  //   dbPath: process.env.CACHE_DB_PATH || join(PROJECT_ROOT, 'data', 'cache.db'),
  // },
  projectRoot: PROJECT_ROOT,
};

export function validateConfig(): void {
  if (!config.api.key) {
    throw new Error('API_KEY environment variable is required');
  }
}
```

---

## 4. src/utils/logger.ts

```typescript
export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
}
```

---

## 5. src/tools/index.ts (Tool Registry Pattern)

```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as groupA from './group-a.js';
// import * as groupB from './group-b.js';

export const TOOLS: Tool[] = [
  {
    name: 'tool_name',
    description: 'What this tool does',
    inputSchema: {
      type: 'object' as const,
      properties: {
        param1: { type: 'string', description: 'Description' },
        param2: { type: 'number', description: 'Description (optional)' },
      },
      required: ['param1'],
    },
  },
  // ... more tools
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'tool_name': return groupA.toolName(args);
    // case 'tool_name_2': return groupB.toolName2(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

---

## 6. src/tools/group-a.ts (Tool Implementation Pattern)

```typescript
import { z } from 'zod';
import { log } from '../utils/logger.js';

// Zod schema for input validation
const toolNameSchema = z.object({
  param1: z.string().min(1),
  param2: z.number().optional().default(10),
});

export async function toolName(args: Record<string, unknown>) {
  const params = toolNameSchema.parse(args);
  log('info', 'tool_name called', { params });

  // Business logic here
  const result = { /* ... */ };

  return result;
}
```

---

## 7. src/index.ts (Stdio Entry Point)

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { validateConfig } from './config.js';
import { TOOLS, handleToolCall } from './tools/index.js';
import { log } from './utils/logger.js';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', (error as Error).message);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  { name: 'xxx-mcp-claude', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log('info', `Tool called: ${name}`);

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Tool error: ${name}`, { error: errorMessage });
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: errorMessage }, null, 2) },
      ],
      isError: true,
    };
  }
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', `xxx MCP Server running on stdio (${TOOLS.length} tools)`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

---

## 8. src/server-sse.ts (SSE Entry Point for Docker)

```typescript
#!/usr/bin/env node
import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { TOOLS, handleToolCall } from './tools/index.js';
import { log } from './utils/logger.js';

// Validate
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', (error as Error).message);
  process.exit(1);
}

// Create MCP server
const mcpServer = new Server(
  { name: 'xxx-mcp-claude', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register handlers (เหมือน index.ts)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log('info', `Tool called: ${name}`);

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Tool error: ${name}`, { error: errorMessage });
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: errorMessage }, null, 2) },
      ],
      isError: true,
    };
  }
});

// SSE connections
const connections = new Map<string, SSEServerTransport>();

// HTTP Server
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'xxx-mcp-claude',
      tools: TOOLS.length,
      connections: connections.size,
    }));
    return;
  }

  // SSE endpoint
  if (url.pathname === '/sse') {
    const transport = new SSEServerTransport('/message', res);
    const sessionId = crypto.randomUUID();
    connections.set(sessionId, transport);
    log('info', `SSE connected: ${sessionId}`);

    res.on('close', () => {
      connections.delete(sessionId);
      log('info', `SSE disconnected: ${sessionId}`);
    });

    await mcpServer.connect(transport);
    return;
  }

  // Message endpoint
  if (url.pathname === '/message' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        for (const transport of connections.values()) {
          await transport.handlePostMessage(req, res, body);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active SSE connection' }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Start
httpServer.listen(config.sse.port, config.sse.host, () => {
  log('info', `xxx MCP Server (SSE) at http://${config.sse.host}:${config.sse.port}`);
  console.log(`xxx MCP Server (SSE) running at http://${config.sse.host}:${config.sse.port}`);
  console.log(`  SSE:    http://${config.sse.host}:${config.sse.port}/sse`);
  console.log(`  Health: http://${config.sse.host}:${config.sse.port}/health`);
  console.log(`  Tools:  ${TOOLS.length} registered`);
});
```

---

## 9. Dockerfile (Multi-stage TypeScript)

```dockerfile
# Build stage
FROM node:22-slim AS builder

# เพิ่ม build dependencies ตามต้องการ
# สำหรับ better-sqlite3:
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:22-slim

# เพิ่ม runtime dependencies ตามต้องการ
# สำหรับ better-sqlite3:
# RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server-sse.js"]
```

---

## 10. docker-compose.yml

```yaml
services:
  xxx-mcp:
    build: .
    container_name: xxx-mcp-claude
    restart: unless-stopped
    ports:
      - "XXXX:3000"    # เลือก port ที่ว่าง
    volumes:
      - ./data:/app/data
    environment:
      - API_KEY=${API_KEY}
      # เพิ่ม env vars ตามต้องการ
      - SSE_HOST=0.0.0.0
      - SSE_PORT=3000
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

**Variations:**

```yaml
# สำหรับ host network mode (เช่น ต้อง access local services):
    network_mode: host

# สำหรับ resource limits (ML workloads):
    deploy:
      resources:
        limits:
          memory: 1024M
        reservations:
          memory: 256M

# สำหรับ VPN/network access:
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    devices:
      - /dev/net/tun:/dev/net/tun

# สำหรับ external service dependency:
  xxx-mcp:
    depends_on:
      - database-service
  database-service:
    image: some-database:latest
    volumes:
      - db-data:/data
volumes:
  db-data:
```

---

## 11. .mcp.json (Claude Code Config)

```json
{
  "mcpServers": {
    "xxx": {
      "url": "http://localhost:XXXX/sse"
    }
  }
}
```

---

## 12. .gitignore

```
node_modules/
dist/
.env
tokens.json
data/*.db
*.log
```

---

## 13. .dockerignore

```
node_modules
dist
npm-debug.log
.git
.gitignore
*.md
!README.md
*.db
.env
.DS_Store
references
scripts
```

---

## 14. .env.example

```env
# === Required ===
API_KEY=your_api_key

# === Optional ===
SSE_HOST=0.0.0.0
SSE_PORT=3000
CACHE_TTL_SECONDS=300
```

---

## 15. SQLite Cache Service (Optional)

```typescript
// src/services/cache.ts
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { log } from '../utils/logger.js';

let db: Database.Database | null = null;

export function initCache(): void {
  const dir = dirname(config.cache.dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(config.cache.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
  `);
  db.prepare('DELETE FROM cache WHERE expires_at < ?').run(Date.now());
  log('info', `Cache initialized at ${config.cache.dbPath}`);
}

export function getCache<T>(key: string): T | null {
  if (!db) return null;
  const row = db.prepare(
    'SELECT value FROM cache WHERE key = ? AND expires_at > ?'
  ).get(key, Date.now()) as { value: string } | undefined;
  return row ? JSON.parse(row.value) as T : null;
}

export function setCache(key: string, value: unknown, ttlSeconds?: number): void {
  if (!db) return;
  const ttl = ttlSeconds ?? config.cache.ttlSeconds;
  const expiresAt = Date.now() + ttl * 1000;
  db.prepare(
    'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)'
  ).run(key, JSON.stringify(value), expiresAt);
}

export function invalidateCache(pattern: string): void {
  if (!db) return;
  db.prepare('DELETE FROM cache WHERE key LIKE ?').run(pattern);
}

export function closeCache(): void {
  if (db) { db.close(); db = null; }
}
```

---

## Checklist ก่อน Deploy

- [ ] `npm run build` ผ่านไม่มี error
- [ ] `.env` ตั้งค่าครบ
- [ ] `docker compose up -d --build` สำเร็จ
- [ ] `curl http://localhost:XXXX/health` ตอบ `{"status":"ok"}`
- [ ] `.mcp.json` port ตรงกับ docker-compose.yml
- [ ] เปิด Claude Code ใน project directory แล้วเห็น MCP tools
- [ ] ทดสอบเรียก tool อย่างน้อย 1 ตัว
