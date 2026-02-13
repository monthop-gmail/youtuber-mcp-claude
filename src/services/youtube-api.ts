import { google, youtube_v3 } from 'googleapis';
import { createReadStream } from 'fs';
import { getAuthClient } from './auth.js';
import { consumeQuota } from '../utils/rate-limiter.js';
import { getCache, setCache, invalidateCache } from './cache.js';
import { log } from '../utils/logger.js';
import { config } from '../config.js';
import type { VideoWithStats, ChannelStats, PlaylistInfo, CommentThread, SearchResult } from '../types/youtube.js';

let youtubeClient: youtube_v3.Youtube | null = null;

function getYouTube(): youtube_v3.Youtube {
  if (!youtubeClient) {
    youtubeClient = google.youtube({ version: 'v3', auth: getAuthClient() });
  }
  return youtubeClient;
}

// ─── VIDEO OPERATIONS ───

export async function listVideos(params: {
  maxResults?: number;
  pageToken?: string;
  statusFilter?: string;
}): Promise<{ videos: VideoWithStats[]; nextPageToken?: string; totalResults?: number }> {
  const cacheKey = `list_videos:${JSON.stringify(params)}`;
  const cached = getCache<{ videos: VideoWithStats[]; nextPageToken?: string; totalResults?: number }>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'channels.list');
  const yt = getYouTube();
  const channelId = config.youtube.channelId;

  consumeQuota(1, 'search.list (own videos)');
  const searchRes = await yt.search.list({
    part: ['snippet'],
    channelId,
    type: ['video'],
    maxResults: params.maxResults || 10,
    pageToken: params.pageToken,
    order: 'date',
  });

  const videoIds = (searchRes.data.items || [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);

  if (videoIds.length === 0) {
    return { videos: [], nextPageToken: undefined };
  }

  consumeQuota(1, 'videos.list');
  const videosRes = await yt.videos.list({
    part: ['snippet', 'statistics', 'status', 'contentDetails'],
    id: videoIds,
  });

  const videos: VideoWithStats[] = (videosRes.data.items || [])
    .filter((item) => {
      if (!params.statusFilter) return true;
      return item.status?.privacyStatus === params.statusFilter;
    })
    .map((item) => ({
      id: item.id || '',
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      tags: item.snippet?.tags || [],
      categoryId: item.snippet?.categoryId || '',
      privacyStatus: (item.status?.privacyStatus as 'public' | 'private' | 'unlisted') || 'private',
      publishedAt: item.snippet?.publishedAt || undefined,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
      channelId: item.snippet?.channelId || undefined,
      channelTitle: item.snippet?.channelTitle || undefined,
      duration: item.contentDetails?.duration || undefined,
      stats: {
        viewCount: parseInt(item.statistics?.viewCount || '0', 10),
        likeCount: parseInt(item.statistics?.likeCount || '0', 10),
        commentCount: parseInt(item.statistics?.commentCount || '0', 10),
        favoriteCount: parseInt(item.statistics?.favoriteCount || '0', 10),
      },
    }));

  const result = {
    videos,
    nextPageToken: searchRes.data.nextPageToken || undefined,
    totalResults: searchRes.data.pageInfo?.totalResults || undefined,
  };
  setCache(cacheKey, result);
  return result;
}

export async function uploadVideo(params: {
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: string;
  scheduledTime?: string;
}): Promise<{ videoId: string; url: string; status: string }> {
  consumeQuota(1600, 'videos.insert (upload)');
  const yt = getYouTube();

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title: params.title,
      description: params.description,
      tags: params.tags,
      categoryId: params.categoryId,
    },
    status: {
      privacyStatus: params.privacyStatus,
    },
  };

  if (params.scheduledTime && params.privacyStatus === 'private') {
    requestBody.status!.privacyStatus = 'private';
    requestBody.status!.publishAt = params.scheduledTime;
  }

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media: {
      body: createReadStream(params.filePath),
    },
  });

  invalidateCache('list_videos:%');
  log('info', 'Video uploaded', { videoId: res.data.id });

  return {
    videoId: res.data.id || '',
    url: `https://www.youtube.com/watch?v=${res.data.id}`,
    status: res.data.status?.uploadStatus || 'unknown',
  };
}

export async function updateVideo(params: {
  videoId: string;
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: string;
}): Promise<VideoWithStats> {
  consumeQuota(1, 'videos.list (get current)');
  const yt = getYouTube();

  const current = await yt.videos.list({
    part: ['snippet', 'status'],
    id: [params.videoId],
  });

  const currentItem = current.data.items?.[0];
  if (!currentItem) throw new Error(`Video not found: ${params.videoId}`);

  const snippet = currentItem.snippet || {};
  const status = currentItem.status || {};

  consumeQuota(50, 'videos.update');
  const res = await yt.videos.update({
    part: ['snippet', 'status'],
    requestBody: {
      id: params.videoId,
      snippet: {
        title: params.title ?? snippet.title,
        description: params.description ?? snippet.description,
        tags: params.tags ?? snippet.tags,
        categoryId: params.categoryId ?? snippet.categoryId,
      },
      status: {
        privacyStatus: params.privacyStatus ?? status.privacyStatus,
      },
    },
  });

  invalidateCache('list_videos:%');
  invalidateCache(`video_details:${params.videoId}`);

  return {
    id: res.data.id || '',
    title: res.data.snippet?.title || '',
    description: res.data.snippet?.description || '',
    tags: res.data.snippet?.tags || [],
    categoryId: res.data.snippet?.categoryId || '',
    privacyStatus: (res.data.status?.privacyStatus as 'public' | 'private' | 'unlisted') || 'private',
    publishedAt: res.data.snippet?.publishedAt || undefined,
  };
}

export async function deleteVideo(videoId: string): Promise<{ success: boolean; videoId: string }> {
  consumeQuota(50, 'videos.delete');
  const yt = getYouTube();
  await yt.videos.delete({ id: videoId });
  invalidateCache('list_videos:%');
  invalidateCache(`video_details:${videoId}`);
  log('info', 'Video deleted', { videoId });
  return { success: true, videoId };
}

export async function setThumbnail(params: {
  videoId: string;
  imagePath: string;
}): Promise<{ videoId: string; thumbnailUrl: string }> {
  consumeQuota(50, 'thumbnails.set');
  const yt = getYouTube();
  const res = await yt.thumbnails.set({
    videoId: params.videoId,
    media: {
      body: createReadStream(params.imagePath),
    },
  });
  const url = res.data.items?.[0]?.high?.url || res.data.items?.[0]?.default?.url || '';
  return { videoId: params.videoId, thumbnailUrl: url };
}

// ─── CHANNEL OPERATIONS ───

export async function getChannelStats(channelId?: string): Promise<ChannelStats> {
  const id = channelId || config.youtube.channelId;
  const cacheKey = `channel_stats:${id}`;
  const cached = getCache<ChannelStats>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'channels.list');
  const yt = getYouTube();
  const params: youtube_v3.Params$Resource$Channels$List = {
    part: ['snippet', 'statistics'],
  };
  if (id) {
    params.id = [id];
  } else {
    params.mine = true;
  }

  const res = await yt.channels.list(params);
  const channel = res.data.items?.[0];
  if (!channel) throw new Error('Channel not found');

  const stats: ChannelStats = {
    subscriberCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
    videoCount: parseInt(channel.statistics?.videoCount || '0', 10),
    viewCount: parseInt(channel.statistics?.viewCount || '0', 10),
    hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount || false,
    title: channel.snippet?.title || undefined,
    description: channel.snippet?.description || undefined,
    customUrl: channel.snippet?.customUrl || undefined,
    thumbnailUrl: channel.snippet?.thumbnails?.high?.url || undefined,
  };

  setCache(cacheKey, stats);
  return stats;
}

// ─── SEARCH OPERATIONS ───

export async function searchVideos(params: {
  query: string;
  maxResults?: number;
  order?: string;
}): Promise<{ results: SearchResult[]; totalResults: number }> {
  const cacheKey = `search:${JSON.stringify(params)}`;
  const cached = getCache<{ results: SearchResult[]; totalResults: number }>(cacheKey);
  if (cached) return cached;

  consumeQuota(100, 'search.list');
  const yt = getYouTube();
  const res = await yt.search.list({
    part: ['snippet'],
    q: params.query,
    type: ['video'],
    maxResults: params.maxResults || 10,
    order: params.order || 'relevance',
  });

  const results: SearchResult[] = (res.data.items || []).map((item) => ({
    id: item.id?.videoId || '',
    kind: item.id?.kind || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    channelId: item.snippet?.channelId || '',
    channelTitle: item.snippet?.channelTitle || '',
    publishedAt: item.snippet?.publishedAt || '',
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
  }));

  const result = {
    results,
    totalResults: res.data.pageInfo?.totalResults || 0,
  };
  setCache(cacheKey, result, 600);
  return result;
}

export async function getVideoDetails(videoId: string): Promise<VideoWithStats> {
  const cacheKey = `video_details:${videoId}`;
  const cached = getCache<VideoWithStats>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'videos.list');
  const yt = getYouTube();
  const res = await yt.videos.list({
    part: ['snippet', 'statistics', 'contentDetails', 'status'],
    id: [videoId],
  });

  const item = res.data.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);

  const video: VideoWithStats = {
    id: item.id || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    tags: item.snippet?.tags || [],
    categoryId: item.snippet?.categoryId || '',
    privacyStatus: (item.status?.privacyStatus as 'public' | 'private' | 'unlisted') || 'public',
    publishedAt: item.snippet?.publishedAt || undefined,
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
    channelId: item.snippet?.channelId || undefined,
    channelTitle: item.snippet?.channelTitle || undefined,
    duration: item.contentDetails?.duration || undefined,
    stats: {
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      likeCount: parseInt(item.statistics?.likeCount || '0', 10),
      commentCount: parseInt(item.statistics?.commentCount || '0', 10),
      favoriteCount: parseInt(item.statistics?.favoriteCount || '0', 10),
    },
  };

  setCache(cacheKey, video);
  return video;
}

// ─── PLAYLIST OPERATIONS ───

export async function createPlaylist(params: {
  title: string;
  description?: string;
  privacyStatus?: string;
}): Promise<{ playlistId: string; url: string }> {
  consumeQuota(50, 'playlists.insert');
  const yt = getYouTube();
  const res = await yt.playlists.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: params.title,
        description: params.description || '',
      },
      status: {
        privacyStatus: params.privacyStatus || 'private',
      },
    },
  });
  invalidateCache('list_playlists');
  return {
    playlistId: res.data.id || '',
    url: `https://www.youtube.com/playlist?list=${res.data.id}`,
  };
}

export async function addToPlaylist(params: {
  playlistId: string;
  videoId: string;
  position?: number;
}): Promise<{ success: boolean; playlistItemId: string }> {
  consumeQuota(50, 'playlistItems.insert');
  const yt = getYouTube();
  const requestBody: youtube_v3.Schema$PlaylistItem = {
    snippet: {
      playlistId: params.playlistId,
      resourceId: {
        kind: 'youtube#video',
        videoId: params.videoId,
      },
    },
  };
  if (params.position !== undefined) {
    requestBody.snippet!.position = params.position;
  }
  const res = await yt.playlistItems.insert({
    part: ['snippet'],
    requestBody,
  });
  return { success: true, playlistItemId: res.data.id || '' };
}

export async function listPlaylists(): Promise<PlaylistInfo[]> {
  const cacheKey = 'list_playlists';
  const cached = getCache<PlaylistInfo[]>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'playlists.list');
  const yt = getYouTube();
  const res = await yt.playlists.list({
    part: ['snippet', 'contentDetails', 'status'],
    mine: true,
    maxResults: 50,
  });

  const playlists: PlaylistInfo[] = (res.data.items || []).map((item) => ({
    id: item.id || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    itemCount: item.contentDetails?.itemCount || 0,
    privacyStatus: item.status?.privacyStatus || '',
    publishedAt: item.snippet?.publishedAt || undefined,
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
  }));

  setCache(cacheKey, playlists);
  return playlists;
}

export async function reorderPlaylist(params: {
  playlistId: string;
  videoId: string;
  newPosition: number;
}): Promise<{ success: boolean }> {
  consumeQuota(1, 'playlistItems.list');
  const yt = getYouTube();

  const items = await yt.playlistItems.list({
    part: ['snippet'],
    playlistId: params.playlistId,
    maxResults: 50,
  });

  const targetItem = (items.data.items || []).find(
    (item) => item.snippet?.resourceId?.videoId === params.videoId
  );
  if (!targetItem) throw new Error(`Video ${params.videoId} not found in playlist ${params.playlistId}`);

  consumeQuota(50, 'playlistItems.update');
  await yt.playlistItems.update({
    part: ['snippet'],
    requestBody: {
      id: targetItem.id,
      snippet: {
        playlistId: params.playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: params.videoId,
        },
        position: params.newPosition,
      },
    },
  });

  return { success: true };
}

// ─── COMMENT OPERATIONS ───

export async function getComments(params: {
  videoId: string;
  maxResults?: number;
  order?: string;
}): Promise<CommentThread[]> {
  const cacheKey = `comments:${JSON.stringify(params)}`;
  const cached = getCache<CommentThread[]>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'commentThreads.list');
  const yt = getYouTube();
  const res = await yt.commentThreads.list({
    part: ['snippet', 'replies'],
    videoId: params.videoId,
    maxResults: params.maxResults || 20,
    order: params.order === 'relevance' ? 'relevance' : 'time',
  });

  const threads: CommentThread[] = (res.data.items || []).map((item) => ({
    id: item.id || '',
    topLevelComment: {
      id: item.snippet?.topLevelComment?.id || '',
      authorDisplayName: item.snippet?.topLevelComment?.snippet?.authorDisplayName || '',
      authorProfileImageUrl: item.snippet?.topLevelComment?.snippet?.authorProfileImageUrl || undefined,
      textDisplay: item.snippet?.topLevelComment?.snippet?.textDisplay || '',
      likeCount: item.snippet?.topLevelComment?.snippet?.likeCount || 0,
      publishedAt: item.snippet?.topLevelComment?.snippet?.publishedAt || '',
      updatedAt: item.snippet?.topLevelComment?.snippet?.updatedAt || undefined,
    },
    totalReplyCount: item.snippet?.totalReplyCount || 0,
    replies: item.replies?.comments?.map((reply) => ({
      id: reply.id || '',
      authorDisplayName: reply.snippet?.authorDisplayName || '',
      authorProfileImageUrl: reply.snippet?.authorProfileImageUrl || undefined,
      textDisplay: reply.snippet?.textDisplay || '',
      likeCount: reply.snippet?.likeCount || 0,
      publishedAt: reply.snippet?.publishedAt || '',
      updatedAt: reply.snippet?.updatedAt || undefined,
    })),
  }));

  setCache(cacheKey, threads, 120);
  return threads;
}

export async function replyComment(params: {
  commentId: string;
  text: string;
}): Promise<{ success: boolean; replyId: string }> {
  consumeQuota(50, 'comments.insert');
  const yt = getYouTube();
  const res = await yt.comments.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        parentId: params.commentId,
        textOriginal: params.text,
      },
    },
  });
  return { success: true, replyId: res.data.id || '' };
}

export async function deleteComment(commentId: string): Promise<{ success: boolean }> {
  consumeQuota(50, 'comments.delete');
  const yt = getYouTube();
  await yt.comments.delete({ id: commentId });
  return { success: true };
}

// ─── TRENDING / CATEGORIES ───

export async function getTrendingVideos(params: {
  categoryId?: string;
  regionCode?: string;
  maxResults?: number;
}): Promise<VideoWithStats[]> {
  const cacheKey = `trending:${JSON.stringify(params)}`;
  const cached = getCache<VideoWithStats[]>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'videos.list (trending)');
  const yt = getYouTube();
  const res = await yt.videos.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    chart: 'mostPopular',
    regionCode: params.regionCode || 'US',
    videoCategoryId: params.categoryId || undefined,
    maxResults: params.maxResults || 10,
  });

  const videos: VideoWithStats[] = (res.data.items || []).map((item) => ({
    id: item.id || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    tags: item.snippet?.tags || [],
    categoryId: item.snippet?.categoryId || '',
    privacyStatus: 'public' as const,
    publishedAt: item.snippet?.publishedAt || undefined,
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
    channelId: item.snippet?.channelId || undefined,
    channelTitle: item.snippet?.channelTitle || undefined,
    duration: item.contentDetails?.duration || undefined,
    stats: {
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      likeCount: parseInt(item.statistics?.likeCount || '0', 10),
      commentCount: parseInt(item.statistics?.commentCount || '0', 10),
      favoriteCount: parseInt(item.statistics?.favoriteCount || '0', 10),
    },
  }));

  setCache(cacheKey, videos, 1800);
  return videos;
}

export async function getChannelVideos(channelId: string, maxResults: number = 10): Promise<VideoWithStats[]> {
  const cacheKey = `channel_videos:${channelId}:${maxResults}`;
  const cached = getCache<VideoWithStats[]>(cacheKey);
  if (cached) return cached;

  consumeQuota(100, 'search.list (channel videos)');
  const yt = getYouTube();
  const searchRes = await yt.search.list({
    part: ['snippet'],
    channelId,
    type: ['video'],
    order: 'viewCount',
    maxResults,
  });

  const videoIds = (searchRes.data.items || [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);

  if (videoIds.length === 0) return [];

  consumeQuota(1, 'videos.list');
  const videosRes = await yt.videos.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    id: videoIds,
  });

  const videos: VideoWithStats[] = (videosRes.data.items || []).map((item) => ({
    id: item.id || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    tags: item.snippet?.tags || [],
    categoryId: item.snippet?.categoryId || '',
    privacyStatus: 'public' as const,
    publishedAt: item.snippet?.publishedAt || undefined,
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || undefined,
    channelId: item.snippet?.channelId || undefined,
    channelTitle: item.snippet?.channelTitle || undefined,
    duration: item.contentDetails?.duration || undefined,
    stats: {
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      likeCount: parseInt(item.statistics?.likeCount || '0', 10),
      commentCount: parseInt(item.statistics?.commentCount || '0', 10),
      favoriteCount: parseInt(item.statistics?.favoriteCount || '0', 10),
    },
  }));

  setCache(cacheKey, videos, 600);
  return videos;
}
