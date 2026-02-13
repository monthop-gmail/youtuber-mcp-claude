# Template: สร้างโปรเจกต์ xxx-mcp-claude

## คำสั่งสำหรับ Claude Code

สร้าง MCP Server ชื่อ **xxx-mcp-claude** เป็น [TypeScript/JavaScript/Python] project สำหรับ [คำอธิบายสั้นๆ] ผ่าน Claude Code

---

## ข้อมูลพื้นฐาน

| Item | Value |
|------|-------|
| **ชื่อ Project** | `xxx-mcp-claude` |
| **ภาษา** | [TypeScript / JavaScript / Python / Hybrid] |
| **Docker Port** | [ดูตาราง Port ด้านล่าง] |
| **MCP Server Name** | `xxx` (ใน .mcp.json) |
| **จำนวน Tools** | [จำนวน] tools |
| **Database** | [SQLite / ChromaDB / ไม่มี] |
| **External API** | [ชื่อ API ที่ใช้] |

---

## Port Convention (ที่ใช้แล้ว)

| Port | Project | หมายเหตุ |
|------|---------|----------|
| 3001 | chat-mcp-claude | SQLite FTS5 |
| 3010 | youtube-mcp-claude | yt-dlp, host mode |
| 3011 | audio-mcp-claude | Whisper, host mode |
| 3012 | vdo-mcp-claude | Whisper, host mode |
| 3020 | rag-mcp-claude | ChromaDB, host mode |
| 3030 | youtuber-mcp-claude | YouTube API |
| 3100 | esxi-mcp-claude | VMware ESXi |
| 3200 | thudong-mcp-claude | Survey RAG |
| 3300 | iot-mcp-claude | IoT + VPN |
| 8000 | odoo-mcp-claude | Python, Odoo ERP |
| **[ถัดไป]** | **xxx-mcp-claude** | **[เลือก port ที่ว่าง]** |

---

## เลือก Tech Stack

### Option A: TypeScript (แนะนำสำหรับ project ซับซ้อน 10+ tools)

```
ตัวอย่าง: esxi-mcp-claude, iot-mcp-claude, youtuber-mcp-claude
```

- **Runtime**: Node.js 22+
- **Language**: TypeScript 5+ (strict mode)
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.26.0
- **Build**: `tsc`
- **Validation**: `zod`
- **Dockerfile**: Multi-stage build (builder + production)

### Option B: JavaScript ES Modules (สำหรับ project ง่าย-กลาง 2-10 tools)

```
ตัวอย่าง: chat-mcp-claude, youtube-mcp-claude, samathi101-mcp-claude
```

- **Runtime**: Node.js 22+
- **Language**: JavaScript (ES Modules, "type": "module")
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.26.0
- **Dockerfile**: Single-stage build

### Option C: Python (สำหรับ project ที่ต้องใช้ Python ecosystem)

```
ตัวอย่าง: odoo-mcp-claude
```

- **Runtime**: Python 3.12+
- **MCP SDK**: `mcp` (Python package)
- **Build**: pyproject.toml / pip
- **Dockerfile**: python:3.12-slim

### Option D: Hybrid Python + Node.js (สำหรับ ML/AI workloads)

```
ตัวอย่าง: audio-mcp-claude, vdo-mcp-claude
```

- **Runtime**: Python 3.12 + Node.js 22
- **MCP SDK**: `@modelcontextprotocol/sdk` (Node.js side)
- **ML**: faster-whisper, ffmpeg
- **Dockerfile**: python:3.12-slim + Node.js via apt

---

## โครงสร้างโปรเจกต์

### TypeScript Project

```
xxx-mcp-claude/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio)
│   ├── server-sse.ts               # MCP server SSE mode (Docker)
│   ├── config.ts                   # Configuration & environment variables
│   ├── tools/
│   │   ├── index.ts                # TOOLS[] array + handleToolCall() dispatcher
│   │   ├── [group-a].ts            # Tool group A
│   │   └── [group-b].ts            # Tool group B
│   ├── services/
│   │   ├── [api-name].ts           # External API wrapper
│   │   ├── auth.ts                 # Authentication (ถ้ามี)
│   │   └── cache.ts                # Cache layer (ถ้ามี)
│   ├── types/
│   │   └── [domain].ts             # Type definitions
│   └── utils/
│       ├── helpers.ts              # Utility functions
│       ├── rate-limiter.ts         # Rate limiting (ถ้ามี)
│       └── logger.ts               # Logging (stderr)
├── scripts/                        # Setup scripts (ถ้ามี)
├── data/                           # Persistent data (SQLite DBs)
│   └── .gitkeep
├── dist/                           # Compiled output (gitignored)
├── .mcp.json                       # Claude Code MCP config
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
└── README.md
```

### JavaScript Project

```
xxx-mcp-claude/
├── src/
│   ├── index.js                    # MCP server (stdio)
│   ├── server-sse.js               # MCP server (SSE/Docker)
│   ├── config.js                   # Configuration
│   └── [domain].js                 # Business logic + tools
├── data/
├── .mcp.json
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
└── README.md
```

---

## MCP Tools ที่ต้องสร้าง

### [Group A Name] (`[group-a].ts`)

```typescript
// Tool: tool_name_1
// - รับ: param1, param2?, param3?
// - ส่งคืน: result description
// - Quota/Cost: [ถ้ามี rate limit]

// Tool: tool_name_2
// - รับ: param1
// - ส่งคืน: result description
```

### [Group B Name] (`[group-b].ts`)

```typescript
// Tool: tool_name_3
// ...
```

---

## Configuration

### Environment Variables

```env
# === Required ===
API_KEY=your_api_key
API_SECRET=your_secret

# === Optional ===
PORT=3000
HOST=0.0.0.0
CACHE_TTL_SECONDS=300
DB_PATH=./data/app.db
```

---

## ข้อกำหนดเพิ่มเติม

1. **Error Handling**: ทุก tool ต้องมี try-catch และ return error message ที่ชัดเจน
2. **Input Validation**: validate ทุก input (ใช้ zod สำหรับ TypeScript)
3. **Caching**: cache ผลลัพธ์ใน SQLite ถ้า API มี rate limit (TTL configurable)
4. **Rate Limiting**: track API quota usage (ถ้า API มี daily limit)
5. **Logging**: log ทุก API call ไปที่ stderr (stdout สงวนสำหรับ MCP protocol)
6. **Dual Transport**: ต้องมีทั้ง stdio (index.ts) และ SSE (server-sse.ts)
7. **Health Check**: SSE server ต้องมี `/health` endpoint
8. **Docker**: ใช้ SSE mode, port mapping ตาม convention
9. **Claude Code**: ตั้งค่า `.mcp.json` ชี้ไป `http://localhost:PORT/sse`
10. **TypeScript Strict Mode**: เปิด strict mode (ถ้าใช้ TypeScript)

---

## ลำดับการ Build

1. ตั้งค่า project (package.json, tsconfig, dependencies)
2. สร้าง types/config/logger (foundation)
3. สร้าง services layer (auth, API wrapper, cache)
4. สร้าง MCP tools ทีละกลุ่ม
5. สร้าง tools/index.ts (TOOLS[] + handleToolCall dispatcher)
6. สร้าง src/index.ts (stdio entry point)
7. สร้าง src/server-sse.ts (SSE entry point)
8. สร้าง Docker files (Dockerfile, docker-compose.yml, .dockerignore)
9. สร้าง .mcp.json
10. Build & Test (`npm run build`, `docker compose up -d --build`)
11. เขียน README.md
