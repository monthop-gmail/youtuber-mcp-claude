export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  publishedAt?: string;
  scheduledStartTime?: string;
  thumbnailUrl?: string;
  channelId?: string;
  channelTitle?: string;
}

export interface VideoStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
}

export interface VideoWithStats extends VideoMetadata {
  stats?: VideoStats;
  duration?: string;
}

export interface ChannelStats {
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  hiddenSubscriberCount: boolean;
  title?: string;
  description?: string;
  customUrl?: string;
  thumbnailUrl?: string;
}

export interface VideoPerformance {
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  clickThroughRate?: number;
  impressions?: number;
}

export interface AudienceInsight {
  demographics: { ageGroup: string; gender: string; viewerPercentage: number }[];
  topCountries: { country: string; views: number }[];
  trafficSources: { source: string; views: number }[];
  devices: { device: string; views: number }[];
}

export interface RevenueReport {
  estimatedRevenue: number;
  rpm: number;
  cpm: number;
  monetizedPlaybacks: number;
  startDate: string;
  endDate: string;
}

export interface ContentPlan {
  id: number;
  title: string;
  planned_date: string;
  status: 'idea' | 'scripting' | 'filming' | 'editing' | 'ready' | 'published';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacyStatus: string;
  publishedAt?: string;
  thumbnailUrl?: string;
}

export interface CommentInfo {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  textDisplay: string;
  likeCount: number;
  publishedAt: string;
  updatedAt?: string;
}

export interface CommentThread {
  id: string;
  topLevelComment: CommentInfo;
  totalReplyCount: number;
  replies?: CommentInfo[];
}

export interface SearchResult {
  id: string;
  kind: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl?: string;
}

export interface TrendingTopic {
  title: string;
  videoCount: number;
  topVideos: SearchResult[];
}

export interface CompetitorAnalysis {
  channelStats: ChannelStats;
  topVideos: VideoWithStats[];
  uploadFrequency: string;
  commonTags: { tag: string; count: number }[];
}

export type DateRange = '7d' | '30d' | '90d' | '365d';
export type SortOrder = 'relevance' | 'date' | 'viewCount' | 'rating';
export type PrivacyStatus = 'public' | 'private' | 'unlisted';
export type ContentPlanStatus = 'idea' | 'scripting' | 'filming' | 'editing' | 'ready' | 'published';
