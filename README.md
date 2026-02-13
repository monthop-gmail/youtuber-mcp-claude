# youtuber-mcp-claude

MCP (Model Context Protocol) Server สำหรับจัดการช่อง YouTube ผ่าน Claude Code

ใช้ YouTube Data API v3 และ YouTube Analytics API เพื่อให้ Claude สามารถจัดการวิดีโอ วิเคราะห์ข้อมูล ทำ SEO และวางแผน content ได้

รันเป็น Docker container (SSE mode) แล้วเชื่อมต่อกับ Claude Code ผ่าน `.mcp.json`

## Features

| Category | Tools | Description |
|----------|-------|-------------|
| Video Management | 5 tools | Upload, update, delete, list videos, set thumbnail |
| Channel Analytics | 5 tools | Channel stats, video performance, audience insights, top videos, revenue |
| SEO Optimization | 4 tools | Title suggestions, description generator, tag suggestions, chapters |
| Content Research | 4 tools | Trending topics, competitor analysis, video search, video details |
| Playlist Management | 4 tools | Create, add videos, list, reorder playlists |
| Comment Management | 4 tools | Get comments, reply, delete, comment summary/sentiment |
| Community Post | 1 tool | Community post guidance (API limitation) |
| Content Calendar | 4 tools | Plan, list, update, delete content plans (SQLite) |
| Utility | 1 tool | API quota status |

**Total: 32 tools**

## Prerequisites

- Docker & Docker Compose
- Google Cloud Project with YouTube Data API v3 and YouTube Analytics API enabled
- OAuth 2.0 credentials

## Quick Start (Docker)

```bash
cd youtuber-mcp-claude

# 1. ตั้งค่า environment
cp .env.example .env
# แก้ไข .env ใส่ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 2. Setup OAuth (ครั้งแรก - ต้อง npm install ก่อน)
npm install --ignore-scripts
npm run setup-oauth
# จะเปิด browser ให้ authorize แล้วบันทึก refresh token ลง .env

# 3. Build & Run Docker
docker compose up -d --build

# 4. ตรวจสอบ
curl http://localhost:3030/health
```

## เชื่อมต่อกับ Claude Code

ไฟล์ `.mcp.json` ถูกตั้งค่าไว้แล้ว:

```json
{
  "mcpServers": {
    "youtuber": {
      "url": "http://localhost:3030/sse"
    }
  }
}
```

เมื่อเปิด Claude Code ใน directory นี้ จะเชื่อมต่อ MCP server อัตโนมัติ

### Manual Installation (ไม่ใช้ Docker)

```bash
npm install --ignore-scripts
cp .env.example .env
npm run setup-oauth
npm run build
npm start  # stdio mode
```

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   - **YouTube Data API v3**
   - **YouTube Analytics API**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Application type: **Web application** (or Desktop)
6. Authorized redirect URI: `http://localhost:3000/oauth/callback`
7. Copy **Client ID** and **Client Secret** to `.env`

## OAuth Setup

```bash
npm run setup-oauth
```

This will:
1. Open a browser for Google authorization
2. Start a local HTTP server to receive the callback
3. Exchange the authorization code for tokens
4. Save the refresh token to `.env`

### Required Scopes
- `youtube` - Manage YouTube account
- `youtube.upload` - Upload videos
- `youtube.force-ssl` - Manage comments
- `yt-analytics.readonly` - View analytics
- `yt-analytics-monetary.readonly` - View revenue reports

## Configuration

### Docker Compose

```bash
# Start
docker compose up -d --build

# Stop
docker compose down

# Logs
docker compose logs -f youtuber-mcp

# Rebuild
docker compose up -d --build --force-recreate
```

Port: **3030** (host) -> 3000 (container)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | - | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | No | `http://localhost:3000/oauth/callback` | OAuth redirect URI |
| `GOOGLE_REFRESH_TOKEN` | Yes | - | OAuth refresh token (from setup-oauth) |
| `YOUTUBE_CHANNEL_ID` | No | - | Your YouTube channel ID |
| `CACHE_TTL_SECONDS` | No | `300` | Cache TTL in seconds |
| `YOUTUBE_DAILY_QUOTA` | No | `10000` | YouTube API daily quota limit |
| `SSE_HOST` | No | `0.0.0.0` | SSE server host (Docker mode) |
| `SSE_PORT` | No | `3000` | SSE server port (Docker mode) |

## Tool Usage Examples

### Video Management
```
"Upload my video at /path/to/video.mp4 with title 'My Tutorial'"
"List my recent videos"
"Update the description of video dQw4w9WgXcQ"
"Set thumbnail for my latest video"
```

### Analytics
```
"Show my channel stats"
"What's the performance of my latest video?"
"Show audience demographics for the last 90 days"
"What are my top 5 videos by watch time?"
"Show my revenue report for the last 30 days"
```

### SEO
```
"Suggest titles for a video about 'Python tutorials'"
"Generate a description for my cooking video"
"Suggest tags based on my competitors' videos"
"Generate chapters from this transcript"
```

### Content Research
```
"What's trending in the gaming category in Thailand?"
"Analyze the channel UCxxxxxx"
"Search for videos about 'machine learning'"
```

### Content Calendar
```
"Add a content plan: 'React Tutorial' for next Monday"
"Show all my content plans"
"Update plan #3 status to 'filming'"
"What content is planned for this week?"
```

## API Quota Usage

YouTube Data API has a daily quota of **10,000 units** (default). Key costs:

| Operation | Quota Cost |
|-----------|-----------|
| List/Get (videos, playlists, channels) | 1 unit |
| Search | 100 units |
| Upload video | 1,600 units |
| Update/Delete | 50 units |
| Analytics queries | Separate quota |

Use `get_quota_status` to check remaining quota.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+ (strict mode)
- **MCP SDK**: @modelcontextprotocol/sdk
- **YouTube API**: googleapis
- **Database**: better-sqlite3 (cache & content calendar)
- **Validation**: zod
- **Auth**: Google OAuth 2.0

## Project Structure

```
src/
├── index.ts                    # MCP server entry point (stdio)
├── server-sse.ts               # MCP server SSE mode (Docker)
├── config.ts                   # Configuration
├── tools/
│   ├── index.ts                # Tool registry & dispatcher (32 tools)
│   ├── video-management.ts     # Upload, update, delete, list, thumbnail
│   ├── channel-analytics.ts    # Stats, performance, audience, revenue
│   ├── seo-optimization.ts     # Titles, descriptions, tags, chapters
│   ├── content-research.ts     # Trending, competitor, search
│   ├── playlist-management.ts  # Create, add, list, reorder
│   ├── comment-management.ts   # Get, reply, delete, summarize
│   ├── community-post.ts       # Community post guidance
│   └── content-calendar.ts     # SQLite-based content planning
├── services/
│   ├── auth.ts                 # Google OAuth 2.0
│   ├── youtube-api.ts          # YouTube Data API v3 wrapper
│   ├── youtube-analytics.ts    # YouTube Analytics API wrapper
│   └── cache.ts                # SQLite cache with TTL
├── types/
│   ├── youtube.ts              # YouTube type definitions
│   └── tools.ts                # Tool type definitions
└── utils/
    ├── helpers.ts              # URL parsing, date formatting
    ├── rate-limiter.ts         # API quota management
    └── logger.ts               # Logging (stderr)
```

## License

MIT
