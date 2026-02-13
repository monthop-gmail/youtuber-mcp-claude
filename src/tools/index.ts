import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as videoMgmt from './video-management.js';
import * as analytics from './channel-analytics.js';
import * as seo from './seo-optimization.js';
import * as research from './content-research.js';
import * as playlist from './playlist-management.js';
import * as comments from './comment-management.js';
import * as community from './community-post.js';
import * as calendar from './content-calendar.js';
import { getQuotaStatus } from '../utils/rate-limiter.js';

export const TOOLS: Tool[] = [
  // ═══ Video Management ═══
  {
    name: 'upload_video',
    description: 'Upload a video to YouTube channel. Costs 1600 API quota units.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'Absolute path to the video file' },
        title: { type: 'string', description: 'Video title (max 100 characters)' },
        description: { type: 'string', description: 'Video description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Video tags' },
        category_id: { type: 'string', description: 'YouTube category ID (default: 22 = People & Blogs)' },
        privacy_status: { type: 'string', enum: ['public', 'private', 'unlisted'], description: 'Video privacy status (default: private)' },
        scheduled_time: { type: 'string', description: 'ISO 8601 datetime for scheduled publishing (optional)' },
      },
      required: ['file_path', 'title'],
    },
  },
  {
    name: 'update_video',
    description: 'Update an existing video metadata (title, description, tags, privacy).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL' },
        title: { type: 'string', description: 'New video title' },
        description: { type: 'string', description: 'New video description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New video tags' },
        category_id: { type: 'string', description: 'New category ID' },
        privacy_status: { type: 'string', enum: ['public', 'private', 'unlisted'], description: 'New privacy status' },
      },
      required: ['video_id'],
    },
  },
  {
    name: 'delete_video',
    description: 'Delete a video from YouTube channel.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL to delete' },
      },
      required: ['video_id'],
    },
  },
  {
    name: 'list_videos',
    description: 'List videos from your YouTube channel with stats.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        max_results: { type: 'number', description: 'Maximum results (1-50, default: 10)' },
        page_token: { type: 'string', description: 'Page token for pagination' },
        status_filter: { type: 'string', enum: ['public', 'private', 'unlisted'], description: 'Filter by privacy status' },
      },
    },
  },
  {
    name: 'set_thumbnail',
    description: 'Set a custom thumbnail for a video.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL' },
        image_path: { type: 'string', description: 'Absolute path to thumbnail image (JPG/PNG, max 2MB)' },
      },
      required: ['video_id', 'image_path'],
    },
  },

  // ═══ Channel Analytics ═══
  {
    name: 'get_channel_stats',
    description: 'Get channel statistics: subscribers, total views, total videos, and API quota status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_video_performance',
    description: 'Get detailed performance metrics for a specific video (views, likes, watch time, CTR, impressions).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID' },
      },
      required: ['video_id'],
    },
  },
  {
    name: 'get_audience_insights',
    description: 'Get audience demographics, traffic sources, countries, and device breakdown.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_range: { type: 'string', enum: ['7d', '30d', '90d', '365d'], description: 'Date range (default: 30d)' },
      },
    },
  },
  {
    name: 'get_top_videos',
    description: 'Get top performing videos ranked by a specific metric.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        metric: { type: 'string', enum: ['views', 'watch_time', 'likes', 'comments'], description: 'Metric to rank by' },
        date_range: { type: 'string', enum: ['7d', '30d', '90d', '365d'], description: 'Date range (default: 30d)' },
        limit: { type: 'number', description: 'Number of videos to return (default: 10)' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'get_revenue_report',
    description: 'Get revenue report with estimated earnings, RPM, CPM, and monetized playbacks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date_range: { type: 'string', enum: ['7d', '30d', '90d', '365d'], description: 'Date range (default: 30d)' },
      },
    },
  },

  // ═══ SEO Optimization ═══
  {
    name: 'generate_title_suggestions',
    description: 'Generate SEO-optimized title suggestions based on topic analysis and competitor research.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: { type: 'string', description: 'Video topic or subject' },
        target_keywords: { type: 'array', items: { type: 'string' }, description: 'Target keywords to include' },
        style: { type: 'string', enum: ['curiosity', 'how-to', 'listicle', 'tutorial'], description: 'Title style' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'generate_description',
    description: 'Generate an optimized video description template with sections for timestamps, links, and hashtags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Video title' },
        topic: { type: 'string', description: 'Video topic' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'SEO keywords' },
        include_timestamps: { type: 'boolean', description: 'Include timestamp section (default: false)' },
        include_links: { type: 'boolean', description: 'Include links section (default: false)' },
      },
      required: ['title', 'topic'],
    },
  },
  {
    name: 'suggest_tags',
    description: 'Suggest relevant tags based on title, description, and competitor video analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Video title' },
        description: { type: 'string', description: 'Video description (optional)' },
        competitor_video_ids: { type: 'array', items: { type: 'string' }, description: 'Competitor video IDs to analyze tags from' },
      },
      required: ['title'],
    },
  },
  {
    name: 'generate_chapters',
    description: 'Extract or generate video chapters. Provide either video_id (to extract from description) or transcript_text (to generate).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID (to extract existing chapters)' },
        transcript_text: { type: 'string', description: 'Video transcript text (to generate chapters)' },
      },
    },
  },

  // ═══ Content Research ═══
  {
    name: 'search_trending_topics',
    description: 'Discover trending topics on YouTube by analyzing popular videos in a region/category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'YouTube video category ID (e.g., "10" for Music, "20" for Gaming)' },
        region: { type: 'string', description: 'Region code (default: US). Examples: TH, JP, KR' },
        language: { type: 'string', description: 'Language filter (optional)' },
      },
    },
  },
  {
    name: 'analyze_competitor',
    description: 'Analyze a competitor YouTube channel: stats, top videos, upload frequency, common tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel_id: { type: 'string', description: 'YouTube channel ID or channel URL' },
      },
      required: ['channel_id'],
    },
  },
  {
    name: 'search_videos',
    description: 'Search YouTube videos by query with sorting options.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum results (1-50, default: 10)' },
        order: { type: 'string', enum: ['relevance', 'date', 'viewCount', 'rating'], description: 'Sort order (default: relevance)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_video_details',
    description: 'Get full details of a YouTube video: metadata, stats, tags, description.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL' },
      },
      required: ['video_id'],
    },
  },

  // ═══ Playlist Management ═══
  {
    name: 'create_playlist',
    description: 'Create a new YouTube playlist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Playlist title' },
        description: { type: 'string', description: 'Playlist description' },
        privacy_status: { type: 'string', enum: ['public', 'private', 'unlisted'], description: 'Privacy status (default: private)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_to_playlist',
    description: 'Add a video to a playlist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        playlist_id: { type: 'string', description: 'Playlist ID' },
        video_id: { type: 'string', description: 'Video ID or URL to add' },
        position: { type: 'number', description: 'Position in playlist (0-based, optional)' },
      },
      required: ['playlist_id', 'video_id'],
    },
  },
  {
    name: 'list_playlists',
    description: 'List all playlists on your channel with video counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'reorder_playlist',
    description: 'Move a video to a new position within a playlist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        playlist_id: { type: 'string', description: 'Playlist ID' },
        video_id: { type: 'string', description: 'Video ID to move' },
        new_position: { type: 'number', description: 'New position (0-based)' },
      },
      required: ['playlist_id', 'video_id', 'new_position'],
    },
  },

  // ═══ Comment Management ═══
  {
    name: 'get_comments',
    description: 'Get comments on a video with replies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL' },
        max_results: { type: 'number', description: 'Maximum results (1-100, default: 20)' },
        order: { type: 'string', enum: ['time', 'relevance'], description: 'Sort order (default: relevance)' },
      },
      required: ['video_id'],
    },
  },
  {
    name: 'reply_comment',
    description: 'Reply to a comment on a video.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        comment_id: { type: 'string', description: 'Comment ID to reply to' },
        text: { type: 'string', description: 'Reply text' },
      },
      required: ['comment_id', 'text'],
    },
  },
  {
    name: 'delete_comment',
    description: 'Delete a comment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        comment_id: { type: 'string', description: 'Comment ID to delete' },
      },
      required: ['comment_id'],
    },
  },
  {
    name: 'get_comment_summary',
    description: 'Get comment analysis: sentiment breakdown, common themes, and top comments for a video.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string', description: 'YouTube video ID or URL' },
      },
      required: ['video_id'],
    },
  },

  // ═══ Community Post ═══
  {
    name: 'create_community_post',
    description: 'Create a community tab post (Note: YouTube API limitation - provides guidance for manual creation via YouTube Studio).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Post text content' },
        image_path: { type: 'string', description: 'Path to image file (optional)' },
        poll_options: { type: 'array', items: { type: 'string' }, description: 'Poll options (2-5 choices, optional)' },
      },
      required: ['text'],
    },
  },

  // ═══ Content Calendar ═══
  {
    name: 'add_content_plan',
    description: 'Add a new content plan to the calendar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Content title' },
        planned_date: { type: 'string', description: 'Planned date (YYYY-MM-DD)' },
        status: { type: 'string', enum: ['idea', 'scripting', 'filming', 'editing', 'ready', 'published'], description: 'Status (default: idea)' },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['title', 'planned_date'],
    },
  },
  {
    name: 'list_content_plans',
    description: 'List content plans from the calendar with optional filters.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status_filter: { type: 'string', enum: ['idea', 'scripting', 'filming', 'editing', 'ready', 'published'], description: 'Filter by status' },
        date_from: { type: 'string', description: 'Start date filter (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date filter (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'update_content_plan',
    description: 'Update an existing content plan.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plan_id: { type: 'number', description: 'Content plan ID' },
        title: { type: 'string', description: 'New title' },
        planned_date: { type: 'string', description: 'New planned date (YYYY-MM-DD)' },
        status: { type: 'string', enum: ['idea', 'scripting', 'filming', 'editing', 'ready', 'published'], description: 'New status' },
        notes: { type: 'string', description: 'New notes' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'delete_content_plan',
    description: 'Delete a content plan from the calendar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plan_id: { type: 'number', description: 'Content plan ID to delete' },
      },
      required: ['plan_id'],
    },
  },

  // ═══ Utility ═══
  {
    name: 'get_quota_status',
    description: 'Get current YouTube API quota usage status (daily limit: 10,000 units).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // Video Management
    case 'upload_video': return videoMgmt.uploadVideo(args);
    case 'update_video': return videoMgmt.updateVideo(args);
    case 'delete_video': return videoMgmt.deleteVideo(args);
    case 'list_videos': return videoMgmt.listVideos(args);
    case 'set_thumbnail': return videoMgmt.setThumbnail(args);

    // Channel Analytics
    case 'get_channel_stats': return analytics.getChannelStats(args);
    case 'get_video_performance': return analytics.getVideoPerformance(args);
    case 'get_audience_insights': return analytics.getAudienceInsights(args);
    case 'get_top_videos': return analytics.getTopVideos(args);
    case 'get_revenue_report': return analytics.getRevenueReport(args);

    // SEO Optimization
    case 'generate_title_suggestions': return seo.generateTitleSuggestions(args);
    case 'generate_description': return seo.generateDescription(args);
    case 'suggest_tags': return seo.suggestTags(args);
    case 'generate_chapters': return seo.generateChapters(args);

    // Content Research
    case 'search_trending_topics': return research.searchTrendingTopics(args);
    case 'analyze_competitor': return research.analyzeCompetitor(args);
    case 'search_videos': return research.searchVideos(args);
    case 'get_video_details': return research.getVideoDetails(args);

    // Playlist Management
    case 'create_playlist': return playlist.createPlaylist(args);
    case 'add_to_playlist': return playlist.addToPlaylist(args);
    case 'list_playlists': return playlist.listPlaylists(args);
    case 'reorder_playlist': return playlist.reorderPlaylist(args);

    // Comment Management
    case 'get_comments': return comments.getComments(args);
    case 'reply_comment': return comments.replyComment(args);
    case 'delete_comment': return comments.deleteComment(args);
    case 'get_comment_summary': return comments.getCommentSummary(args);

    // Community Post
    case 'create_community_post': return community.createCommunityPost(args);

    // Content Calendar
    case 'add_content_plan': return calendar.addContentPlan(args);
    case 'list_content_plans': return calendar.listContentPlans(args);
    case 'update_content_plan': return calendar.updateContentPlan(args);
    case 'delete_content_plan': return calendar.deleteContentPlan(args);

    // Utility
    case 'get_quota_status': return getQuotaStatus();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
