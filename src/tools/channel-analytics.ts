import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import * as ytAnalytics from '../services/youtube-analytics.js';
import { getQuotaStatus } from '../utils/rate-limiter.js';

const videoPerformanceSchema = z.object({
  video_id: z.string().min(1),
});

const audienceInsightsSchema = z.object({
  date_range: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

const topVideosSchema = z.object({
  metric: z.enum(['views', 'watch_time', 'likes', 'comments']),
  date_range: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

const revenueReportSchema = z.object({
  date_range: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

export async function getChannelStats(_args: Record<string, unknown>) {
  const stats = await youtubeApi.getChannelStats();
  const quota = getQuotaStatus();
  return { ...stats, quotaStatus: quota };
}

export async function getVideoPerformance(args: Record<string, unknown>) {
  const params = videoPerformanceSchema.parse(args);
  return ytAnalytics.getVideoPerformance(params.video_id);
}

export async function getAudienceInsights(args: Record<string, unknown>) {
  const params = audienceInsightsSchema.parse(args);
  return ytAnalytics.getAudienceInsights(params.date_range);
}

export async function getTopVideos(args: Record<string, unknown>) {
  const params = topVideosSchema.parse(args);
  return ytAnalytics.getTopVideos({
    metric: params.metric,
    dateRange: params.date_range,
    limit: params.limit,
  });
}

export async function getRevenueReport(args: Record<string, unknown>) {
  const params = revenueReportSchema.parse(args);
  return ytAnalytics.getRevenueReport(params.date_range);
}
