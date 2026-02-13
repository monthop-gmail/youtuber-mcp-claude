import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import { extractVideoId, extractChannelId, formatCount } from '../utils/helpers.js';
import type { CompetitorAnalysis } from '../types/youtube.js';

const trendingTopicsSchema = z.object({
  category: z.string().optional(),
  region: z.string().optional().default('US'),
  language: z.string().optional(),
});

const analyzeCompetitorSchema = z.object({
  channel_id: z.string().min(1),
});

const searchVideosSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().min(1).max(50).optional().default(10),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional().default('relevance'),
});

const getVideoDetailsSchema = z.object({
  video_id: z.string().min(1),
});

export async function searchTrendingTopics(args: Record<string, unknown>) {
  const params = trendingTopicsSchema.parse(args);

  const trending = await youtubeApi.getTrendingVideos({
    categoryId: params.category,
    regionCode: params.region,
    maxResults: 25,
  });

  // Group by topic/theme based on tags and titles
  const topicMap: Record<string, { count: number; totalViews: number; videos: string[] }> = {};

  for (const video of trending) {
    const tags = video.tags.slice(0, 5);
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!topicMap[normalizedTag]) {
        topicMap[normalizedTag] = { count: 0, totalViews: 0, videos: [] };
      }
      topicMap[normalizedTag].count++;
      topicMap[normalizedTag].totalViews += video.stats?.viewCount || 0;
      if (topicMap[normalizedTag].videos.length < 3) {
        topicMap[normalizedTag].videos.push(video.title);
      }
    }
  }

  const topics = Object.entries(topicMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([topic, data]) => ({
      topic,
      videoCount: data.count,
      estimatedTotalViews: formatCount(data.totalViews),
      sampleVideos: data.videos,
    }));

  return {
    region: params.region,
    topics,
    trendingVideos: trending.slice(0, 10).map((v) => ({
      title: v.title,
      channelTitle: v.channelTitle,
      views: formatCount(v.stats?.viewCount || 0),
      publishedAt: v.publishedAt,
    })),
  };
}

export async function analyzeCompetitor(args: Record<string, unknown>) {
  const params = analyzeCompetitorSchema.parse(args);
  const channelId = extractChannelId(params.channel_id);

  const channelStats = await youtubeApi.getChannelStats(channelId);
  const topVideos = await youtubeApi.getChannelVideos(channelId, 20);

  // Analyze upload frequency
  const publishDates = topVideos
    .map((v) => v.publishedAt)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  let uploadFrequency = 'Unknown';
  if (publishDates.length >= 2) {
    const daysBetween: number[] = [];
    for (let i = 0; i < publishDates.length - 1; i++) {
      const diff = (publishDates[i].getTime() - publishDates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
      daysBetween.push(diff);
    }
    const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
    if (avgDays <= 1) uploadFrequency = 'Daily';
    else if (avgDays <= 3) uploadFrequency = 'Every 2-3 days';
    else if (avgDays <= 7) uploadFrequency = 'Weekly';
    else if (avgDays <= 14) uploadFrequency = 'Bi-weekly';
    else if (avgDays <= 30) uploadFrequency = 'Monthly';
    else uploadFrequency = `Every ~${Math.round(avgDays)} days`;
  }

  // Analyze common tags
  const tagCount: Record<string, number> = {};
  for (const video of topVideos) {
    for (const tag of video.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      tagCount[normalizedTag] = (tagCount[normalizedTag] || 0) + 1;
    }
  }

  const commonTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  const analysis: CompetitorAnalysis = {
    channelStats,
    topVideos: topVideos.slice(0, 10),
    uploadFrequency,
    commonTags,
  };

  return analysis;
}

export async function searchVideos(args: Record<string, unknown>) {
  const params = searchVideosSchema.parse(args);
  return youtubeApi.searchVideos({
    query: params.query,
    maxResults: params.max_results,
    order: params.order,
  });
}

export async function getVideoDetails(args: Record<string, unknown>) {
  const params = getVideoDetailsSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.getVideoDetails(videoId);
}
