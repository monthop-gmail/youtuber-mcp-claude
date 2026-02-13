# Prompt: สร้างโปรเจกต์ youtuber-mcp-claude

## คำสั่งสำหรับ Claude Code

สร้าง MCP Server ชื่อ **youtuber-mcp-claude** เป็น TypeScript project สำหรับจัดการช่อง YouTube ผ่าน Claude Desktop / Claude Code โดยใช้ YouTube Data API v3 และ YouTube Analytics API

---

## โครงสร้างโปรเจกต์

```
youtuber-mcp-claude/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── config.ts                   # Configuration & environment variables
│   ├── tools/
│   │   ├── index.ts                # Export all tools
│   │   ├── video-management.ts     # Upload, update, delete, schedule videos
│   │   ├── channel-analytics.ts    # Channel stats, video performance, audience insights
│   │   ├── seo-optimization.ts     # Title generator, description, tags, chapters
│   │   ├── content-research.ts     # Trending topics, competitor analysis, keyword research
│   │   ├── playlist-management.ts  # Create, update, reorder playlists
│   │   ├── comment-management.ts   # Reply, moderate, analyze comments
│   │   ├── community-post.ts       # Create community tab posts
│   │   └── content-calendar.ts     # Content planning & scheduling
│   ├── services/
│   │   ├── youtube-api.ts          # YouTube Data API v3 wrapper
│   │   ├── youtube-analytics.ts    # YouTube Analytics API wrapper
│   │   ├── auth.ts                 # Google OAuth 2.0 handler
│   │   └── cache.ts               # SQLite cache layer
│   ├── types/
│   │   ├── youtube.ts              # YouTube API type definitions
│   │   └── tools.ts                # MCP tool type definitions
│   └── utils/
│       ├── helpers.ts              # Utility functions
│       ├── rate-limiter.ts         # API rate limiting
│       └── logger.ts               # Logging utility
├── scripts/
│   └── setup-oauth.ts              # OAuth setup wizard
├── data/
│   └── .gitkeep                    # SQLite DB location
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **YouTube API**: `googleapis` (official Google API client)
- **Database**: `better-sqlite3` (สำหรับ cache & content calendar)
- **Auth**: Google OAuth 2.0 (googleapis built-in)
- **Build**: `tsup` หรือ `tsc`

---

## MCP Tools ที่ต้องสร้าง

### 1. Video Management (`video-management.ts`)

```typescript
// Tool: upload_video
// - รับ: file_path, title, description, tags[], category_id, privacy_status, scheduled_time?
// - ส่งคืน: video_id, url, status

// Tool: update_video
// - รับ: video_id, title?, description?, tags[]?, category_id?, privacy_status?
// - ส่งคืน: updated video info

// Tool: delete_video
// - รับ: video_id
// - ส่งคืน: success/failure

// Tool: list_videos
// - รับ: max_results?, page_token?, status_filter? (public/private/unlisted)
// - ส่งคืน: video list with basic stats

// Tool: set_thumbnail
// - รับ: video_id, image_path
// - ส่งคืน: thumbnail URL
```

### 2. Channel Analytics (`channel-analytics.ts`)

```typescript
// Tool: get_channel_stats
// - รับ: (ไม่มี input)
// - ส่งคืน: subscribers, total_views, total_videos, watch_time

// Tool: get_video_performance
// - รับ: video_id
// - ส่งคืน: views, likes, comments, watch_time, avg_view_duration, ctr, impressions

// Tool: get_audience_insights
// - รับ: date_range? (7d, 30d, 90d, 365d)
// - ส่งคืน: demographics (age, gender, country), traffic_sources, devices

// Tool: get_top_videos
// - รับ: metric (views/watch_time/likes/comments), date_range?, limit?
// - ส่งคืน: ranked video list

// Tool: get_revenue_report
// - รับ: date_range?
// - ส่งคืน: estimated_revenue, rpm, cpm, monetized_playbacks
```

### 3. SEO Optimization (`seo-optimization.ts`)

```typescript
// Tool: generate_title_suggestions
// - รับ: topic, target_keywords[]?, style? (curiosity/how-to/listicle/tutorial)
// - ส่งคืน: 5-10 title options with estimated SEO score

// Tool: generate_description
// - รับ: title, topic, keywords[]?, include_timestamps?, include_links?
// - ส่งคืน: optimized description text

// Tool: suggest_tags
// - รับ: title, description?, competitor_video_ids[]?
// - ส่งคืน: recommended tags[] with relevance score

// Tool: generate_chapters
// - รับ: video_id หรือ transcript_text
// - ส่งคืน: chapters with timestamps
```

### 4. Content Research (`content-research.ts`)

```typescript
// Tool: search_trending_topics
// - รับ: category?, region?, language?
// - ส่งคืน: trending topics with search volume estimates

// Tool: analyze_competitor
// - รับ: channel_id หรือ channel_url
// - ส่งคืน: channel_stats, top_videos, upload_frequency, common_tags

// Tool: search_videos
// - รับ: query, max_results?, order? (relevance/date/viewCount/rating)
// - ส่งคืน: search results with stats

// Tool: get_video_details
// - รับ: video_id หรือ video_url
// - ส่งคืน: full video details (title, description, tags, stats, comments)
```

### 5. Playlist Management (`playlist-management.ts`)

```typescript
// Tool: create_playlist
// - รับ: title, description?, privacy_status?
// - ส่งคืน: playlist_id, url

// Tool: add_to_playlist
// - รับ: playlist_id, video_id, position?
// - ส่งคืน: success

// Tool: list_playlists
// - ส่งคืน: all playlists with video count

// Tool: reorder_playlist
// - รับ: playlist_id, video_id, new_position
// - ส่งคืน: updated order
```

### 6. Comment Management (`comment-management.ts`)

```typescript
// Tool: get_comments
// - รับ: video_id, max_results?, order? (time/relevance)
// - ส่งคืน: comments with replies

// Tool: reply_comment
// - รับ: comment_id, text
// - ส่งคืน: reply info

// Tool: delete_comment
// - รับ: comment_id
// - ส่งคืน: success

// Tool: get_comment_summary
// - รับ: video_id
// - ส่งคืน: sentiment analysis, common themes, top comments
```

### 7. Community Post (`community-post.ts`)

```typescript
// Tool: create_community_post
// - รับ: text, image_path?, poll_options[]?
// - ส่งคืน: post_id, url
```

### 8. Content Calendar (`content-calendar.ts`)

```typescript
// Tool: add_content_plan
// - รับ: title, planned_date, status (idea/scripting/filming/editing/ready/published), notes?
// - ส่งคืน: plan_id

// Tool: list_content_plans
// - รับ: status_filter?, date_range?
// - ส่งคืน: all plans

// Tool: update_content_plan
// - รับ: plan_id, title?, planned_date?, status?, notes?
// - ส่งคืน: updated plan

// Tool: delete_content_plan
// - รับ: plan_id
// - ส่งคืน: success
```

---

## OAuth 2.0 Setup

สร้าง script `setup-oauth.ts` ที่:
1. เปิด browser ให้ user authorize
2. รับ authorization code
3. แลก code เป็น access_token + refresh_token
4. บันทึก tokens ลง `.env` หรือ `tokens.json`
5. Auto-refresh token เมื่อหมดอายุ

Required OAuth Scopes:
```
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.force-ssl
https://www.googleapis.com/auth/yt-analytics.readonly
https://www.googleapis.com/auth/yt-analytics-monetary.readonly
```

---

## .env.example

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token
YOUTUBE_CHANNEL_ID=your_channel_id
CACHE_TTL_SECONDS=300
```

---

## MCP Server Configuration (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "youtuber-mcp-claude": {
      "command": "node",
      "args": ["path/to/youtuber-mcp-claude/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "xxx",
        "GOOGLE_CLIENT_SECRET": "xxx",
        "GOOGLE_REFRESH_TOKEN": "xxx"
      }
    }
  }
}
```

---

## ข้อกำหนดเพิ่มเติม

1. **Error Handling**: ทุก tool ต้องมี try-catch และ return error message ที่ชัดเจน
2. **Rate Limiting**: ใช้ YouTube API quota อย่างประหยัด (10,000 units/day default)
3. **Caching**: cache ผลลัพธ์ analytics/stats ใน SQLite (TTL 5 นาที default)
4. **Input Validation**: validate ทุก input ด้วย zod schema
5. **Logging**: log ทุก API call พร้อม quota usage
6. **README.md**: เขียนคู่มือการติดตั้ง, setup OAuth, และตัวอย่างการใช้งานทุก tool
7. **TypeScript Strict Mode**: เปิด strict mode ใน tsconfig.json
8. **Unit Tests**: เขียน test พื้นฐานสำหรับ utility functions

---

## ลำดับการ Build

1. ตั้งค่า project (package.json, tsconfig, dependencies)
2. สร้าง Auth service + OAuth setup script
3. สร้าง YouTube API wrapper service
4. สร้าง MCP server skeleton (index.ts)
5. สร้าง tools ทีละกลุ่ม (เริ่มจาก video-management)
6. เพิ่ม caching layer
7. เพิ่ม rate limiter
8. เขียน README
9. ทดสอบทุก tool
