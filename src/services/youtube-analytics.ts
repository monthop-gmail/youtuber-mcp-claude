import { google, youtubeAnalytics_v2 } from 'googleapis';
import { getAuthClient } from './auth.js';
import { consumeQuota } from '../utils/rate-limiter.js';
import { getCache, setCache } from './cache.js';
import { config } from '../config.js';
import { parseDateRange } from '../utils/helpers.js';
import type { VideoPerformance, AudienceInsight, RevenueReport } from '../types/youtube.js';

let analyticsClient: youtubeAnalytics_v2.Youtubeanalytics | null = null;

function getAnalytics(): youtubeAnalytics_v2.Youtubeanalytics {
  if (!analyticsClient) {
    analyticsClient = google.youtubeAnalytics({ version: 'v2', auth: getAuthClient() });
  }
  return analyticsClient;
}

export async function getVideoPerformance(videoId: string): Promise<VideoPerformance> {
  const cacheKey = `video_performance:${videoId}`;
  const cached = getCache<VideoPerformance>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'youtubeAnalytics.query (video performance)');
  const analytics = getAnalytics();
  const { startDate, endDate } = parseDateRange('365d');

  const res = await analytics.reports.query({
    ids: `channel==${config.youtube.channelId || 'mine'}`,
    startDate,
    endDate,
    metrics: 'views,likes,comments,estimatedMinutesWatched,averageViewDuration',
    filters: `video==${videoId}`,
  });

  const row = res.data.rows?.[0] || [0, 0, 0, 0, 0];
  const performance: VideoPerformance = {
    videoId,
    views: Number(row[0]) || 0,
    likes: Number(row[1]) || 0,
    comments: Number(row[2]) || 0,
    estimatedMinutesWatched: Number(row[3]) || 0,
    averageViewDuration: Number(row[4]) || 0,
  };

  // Try to get CTR and impressions
  try {
    const ctrRes = await analytics.reports.query({
      ids: `channel==${config.youtube.channelId || 'mine'}`,
      startDate,
      endDate,
      metrics: 'impressions,impressionClickThroughRate',
      filters: `video==${videoId}`,
    });
    const ctrRow = ctrRes.data.rows?.[0];
    if (ctrRow) {
      performance.impressions = Number(ctrRow[0]) || 0;
      performance.clickThroughRate = Number(ctrRow[1]) || 0;
    }
  } catch {
    // CTR/impressions may not be available for all videos
  }

  setCache(cacheKey, performance);
  return performance;
}

export async function getAudienceInsights(dateRange: string = '30d'): Promise<AudienceInsight> {
  const cacheKey = `audience_insights:${dateRange}`;
  const cached = getCache<AudienceInsight>(cacheKey);
  if (cached) return cached;

  const analytics = getAnalytics();
  const { startDate, endDate } = parseDateRange(dateRange);
  const channelFilter = `channel==${config.youtube.channelId || 'mine'}`;

  // Demographics (age + gender)
  consumeQuota(1, 'youtubeAnalytics.query (demographics)');
  const demoRes = await analytics.reports.query({
    ids: channelFilter,
    startDate,
    endDate,
    metrics: 'viewerPercentage',
    dimensions: 'ageGroup,gender',
    sort: '-viewerPercentage',
  });

  const demographics = (demoRes.data.rows || []).map((row) => ({
    ageGroup: String(row[0]),
    gender: String(row[1]),
    viewerPercentage: Number(row[2]) || 0,
  }));

  // Countries
  consumeQuota(1, 'youtubeAnalytics.query (countries)');
  const countryRes = await analytics.reports.query({
    ids: channelFilter,
    startDate,
    endDate,
    metrics: 'views',
    dimensions: 'country',
    sort: '-views',
    maxResults: 10,
  });

  const topCountries = (countryRes.data.rows || []).map((row) => ({
    country: String(row[0]),
    views: Number(row[1]) || 0,
  }));

  // Traffic sources
  consumeQuota(1, 'youtubeAnalytics.query (traffic sources)');
  const trafficRes = await analytics.reports.query({
    ids: channelFilter,
    startDate,
    endDate,
    metrics: 'views',
    dimensions: 'insightTrafficSourceType',
    sort: '-views',
  });

  const trafficSources = (trafficRes.data.rows || []).map((row) => ({
    source: String(row[0]),
    views: Number(row[1]) || 0,
  }));

  // Devices
  consumeQuota(1, 'youtubeAnalytics.query (devices)');
  const deviceRes = await analytics.reports.query({
    ids: channelFilter,
    startDate,
    endDate,
    metrics: 'views',
    dimensions: 'deviceType',
    sort: '-views',
  });

  const devices = (deviceRes.data.rows || []).map((row) => ({
    device: String(row[0]),
    views: Number(row[1]) || 0,
  }));

  const insights: AudienceInsight = { demographics, topCountries, trafficSources, devices };
  setCache(cacheKey, insights, 600);
  return insights;
}

export async function getTopVideos(params: {
  metric: string;
  dateRange?: string;
  limit?: number;
}): Promise<{ videoId: string; title: string; value: number }[]> {
  const dateRange = params.dateRange || '30d';
  const limit = params.limit || 10;
  const cacheKey = `top_videos:${params.metric}:${dateRange}:${limit}`;
  const cached = getCache<{ videoId: string; title: string; value: number }[]>(cacheKey);
  if (cached) return cached;

  const validMetrics: Record<string, string> = {
    views: 'views',
    watch_time: 'estimatedMinutesWatched',
    likes: 'likes',
    comments: 'comments',
  };

  const metric = validMetrics[params.metric];
  if (!metric) throw new Error(`Invalid metric: ${params.metric}. Valid: ${Object.keys(validMetrics).join(', ')}`);

  consumeQuota(1, 'youtubeAnalytics.query (top videos)');
  const analytics = getAnalytics();
  const { startDate, endDate } = parseDateRange(dateRange);

  const res = await analytics.reports.query({
    ids: `channel==${config.youtube.channelId || 'mine'}`,
    startDate,
    endDate,
    metrics: metric,
    dimensions: 'video',
    sort: `-${metric}`,
    maxResults: limit,
  });

  const videoIds = (res.data.rows || []).map((row) => String(row[0]));
  const values = (res.data.rows || []).map((row) => Number(row[1]) || 0);

  // Get video titles
  let titles: Record<string, string> = {};
  if (videoIds.length > 0) {
    const { google: gApi } = await import('googleapis');
    const yt = gApi.youtube({ version: 'v3', auth: getAuthClient() });
    consumeQuota(1, 'videos.list (titles)');
    const videosRes = await yt.videos.list({
      part: ['snippet'],
      id: videoIds,
    });
    for (const item of videosRes.data.items || []) {
      if (item.id) titles[item.id] = item.snippet?.title || '';
    }
  }

  const result = videoIds.map((id, i) => ({
    videoId: id,
    title: titles[id] || '',
    value: values[i],
  }));

  setCache(cacheKey, result, 600);
  return result;
}

export async function getRevenueReport(dateRange: string = '30d'): Promise<RevenueReport> {
  const cacheKey = `revenue:${dateRange}`;
  const cached = getCache<RevenueReport>(cacheKey);
  if (cached) return cached;

  consumeQuota(1, 'youtubeAnalytics.query (revenue)');
  const analytics = getAnalytics();
  const { startDate, endDate } = parseDateRange(dateRange);

  const res = await analytics.reports.query({
    ids: `channel==${config.youtube.channelId || 'mine'}`,
    startDate,
    endDate,
    metrics: 'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue,grossRevenue,monetizedPlaybacks,cpm',
  });

  const row = res.data.rows?.[0] || [0, 0, 0, 0, 0, 0];
  const estimatedRevenue = Number(row[0]) || 0;
  const monetizedPlaybacks = Number(row[4]) || 0;
  const cpm = Number(row[5]) || 0;
  const rpm = monetizedPlaybacks > 0 ? (estimatedRevenue / monetizedPlaybacks) * 1000 : 0;

  const report: RevenueReport = {
    estimatedRevenue,
    rpm,
    cpm,
    monetizedPlaybacks,
    startDate,
    endDate,
  };

  setCache(cacheKey, report, 600);
  return report;
}
