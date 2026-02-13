import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import { extractVideoId } from '../utils/helpers.js';

const titleSuggestionsSchema = z.object({
  topic: z.string().min(1),
  target_keywords: z.array(z.string()).optional().default([]),
  style: z.enum(['curiosity', 'how-to', 'listicle', 'tutorial']).optional(),
});

const generateDescriptionSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  keywords: z.array(z.string()).optional().default([]),
  include_timestamps: z.boolean().optional().default(false),
  include_links: z.boolean().optional().default(false),
});

const suggestTagsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  competitor_video_ids: z.array(z.string()).optional().default([]),
});

const generateChaptersSchema = z.object({
  video_id: z.string().optional(),
  transcript_text: z.string().optional(),
});

export async function generateTitleSuggestions(args: Record<string, unknown>) {
  const params = titleSuggestionsSchema.parse(args);

  // Search YouTube for similar videos to analyze title patterns
  const searchResults = await youtubeApi.searchVideos({
    query: params.topic,
    maxResults: 20,
    order: 'viewCount',
  });

  const topTitles = searchResults.results.map((r) => r.title);

  // Analyze patterns
  const patterns = {
    withNumbers: topTitles.filter((t) => /\d+/.test(t)),
    withQuestions: topTitles.filter((t) => /\?/.test(t)),
    withHowTo: topTitles.filter((t) => /how to|วิธี/i.test(t)),
    avgLength: Math.round(topTitles.reduce((sum, t) => sum + t.length, 0) / topTitles.length),
  };

  // Build templates based on style
  const templates: Record<string, string[]> = {
    curiosity: [
      `${params.topic} - What Nobody Tells You`,
      `The Truth About ${params.topic}`,
      `Why ${params.topic} Changes Everything`,
      `${params.topic}: You Won't Believe What Happened`,
      `I Tried ${params.topic} for 30 Days - Here's What Happened`,
    ],
    'how-to': [
      `How to ${params.topic} (Step by Step Guide)`,
      `${params.topic} Tutorial for Beginners`,
      `Complete Guide to ${params.topic} (${new Date().getFullYear()})`,
      `${params.topic} Made Easy - Beginner to Pro`,
      `Learn ${params.topic} in 10 Minutes`,
    ],
    listicle: [
      `Top 10 ${params.topic} Tips You Need to Know`,
      `5 ${params.topic} Mistakes Everyone Makes`,
      `7 Best ${params.topic} Strategies for ${new Date().getFullYear()}`,
      `${params.topic}: 10 Things I Wish I Knew Sooner`,
      `3 ${params.topic} Hacks That Actually Work`,
    ],
    tutorial: [
      `${params.topic} Tutorial - Complete Walkthrough`,
      `${params.topic} from Scratch (Full Tutorial)`,
      `Master ${params.topic} - Step by Step Tutorial`,
      `${params.topic} Tutorial ${new Date().getFullYear()} (Updated)`,
      `${params.topic} - Everything You Need to Know`,
    ],
  };

  const suggestions = params.style
    ? templates[params.style]
    : Object.values(templates).flat().slice(0, 10);

  return {
    suggestions: suggestions.map((title, i) => ({
      title,
      charCount: title.length,
      hasKeywords: params.target_keywords.some((kw) =>
        title.toLowerCase().includes(kw.toLowerCase())
      ),
      rank: i + 1,
    })),
    topPerformingTitles: topTitles.slice(0, 5),
    patterns,
    tips: [
      `Average title length in your niche: ${patterns.avgLength} characters`,
      `${patterns.withNumbers.length}/${topTitles.length} top videos use numbers in titles`,
      `${patterns.withQuestions.length}/${topTitles.length} top videos use questions`,
      'Keep titles under 60 characters for full display',
      'Include main keyword near the beginning of the title',
    ],
  };
}

export async function generateDescription(args: Record<string, unknown>) {
  const params = generateDescriptionSchema.parse(args);

  let description = `${params.title}\n\n`;
  description += `In this video, we explore ${params.topic}.\n\n`;

  if (params.include_timestamps) {
    description += `📌 Timestamps:\n`;
    description += `0:00 - Introduction\n`;
    description += `[Add your timestamps here]\n\n`;
  }

  if (params.keywords.length > 0) {
    description += `${params.keywords.join(' | ')}\n\n`;
  }

  description += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (params.include_links) {
    description += `🔗 Links & Resources:\n`;
    description += `[Add your links here]\n\n`;
  }

  description += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  description += `📱 Follow me:\n`;
  description += `[Add your social links here]\n\n`;

  description += `#${params.topic.replace(/\s+/g, '')}`;
  if (params.keywords.length > 0) {
    description += ` ${params.keywords.map((k) => `#${k.replace(/\s+/g, '')}`).join(' ')}`;
  }

  return {
    description,
    charCount: description.length,
    tips: [
      'First 150 characters appear in search results - make them count',
      'Include 3-5 relevant hashtags at the end',
      'Add timestamps for longer videos (10+ minutes)',
      'Include links to related videos/playlists',
      'Use keywords naturally in the first 2-3 sentences',
    ],
  };
}

export async function suggestTags(args: Record<string, unknown>) {
  const params = suggestTagsSchema.parse(args);

  // Collect tags from competitor videos
  const tagFrequency: Record<string, number> = {};

  for (const competitorId of params.competitor_video_ids) {
    try {
      const videoId = extractVideoId(competitorId);
      const details = await youtubeApi.getVideoDetails(videoId);
      for (const tag of details.tags) {
        const normalizedTag = tag.toLowerCase().trim();
        tagFrequency[normalizedTag] = (tagFrequency[normalizedTag] || 0) + 1;
      }
    } catch {
      // Skip invalid video IDs
    }
  }

  // Generate tags from title and description
  const titleWords = params.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  for (const word of titleWords) {
    tagFrequency[word] = (tagFrequency[word] || 0) + 1;
  }

  if (params.description) {
    const descWords = params.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    for (const word of descWords.slice(0, 20)) {
      tagFrequency[word] = (tagFrequency[word] || 0) + 0.5;
    }
  }

  // Sort by frequency
  const sortedTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, score], i) => ({
      tag,
      relevanceScore: Math.round(score * 10) / 10,
      rank: i + 1,
    }));

  return {
    tags: sortedTags,
    totalCharCount: sortedTags.map((t) => t.tag).join(',').length,
    tips: [
      'YouTube allows up to 500 characters for tags',
      'Use a mix of broad and specific tags',
      'Include your brand/channel name as a tag',
      'Add common misspellings if relevant',
      'First 3-5 tags carry the most weight',
    ],
  };
}

export async function generateChapters(args: Record<string, unknown>) {
  const params = generateChaptersSchema.parse(args);

  if (params.video_id) {
    const videoId = extractVideoId(params.video_id);
    const details = await youtubeApi.getVideoDetails(videoId);

    // Try to extract existing chapters from description
    const chapterRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(.+)/g;
    const chapters: { timestamp: string; title: string }[] = [];
    let match;

    while ((match = chapterRegex.exec(details.description)) !== null) {
      chapters.push({
        timestamp: match[1],
        title: match[2].trim(),
      });
    }

    if (chapters.length > 0) {
      return {
        source: 'existing_description',
        chapters,
        videoTitle: details.title,
      };
    }

    return {
      source: 'no_chapters_found',
      videoTitle: details.title,
      message: 'No chapters found in video description. Provide transcript_text to generate chapters.',
    };
  }

  if (params.transcript_text) {
    // Split transcript into segments based on topic changes
    const lines = params.transcript_text.split('\n').filter((l) => l.trim());
    const segmentSize = Math.ceil(lines.length / 8);
    const chapters: { timestamp: string; title: string; preview: string }[] = [];

    for (let i = 0; i < lines.length; i += segmentSize) {
      const segment = lines.slice(i, i + segmentSize);
      const minutes = Math.floor((i / lines.length) * 30);
      const seconds = Math.floor(((i / lines.length) * 30 - minutes) * 60);
      chapters.push({
        timestamp: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        title: segment[0].substring(0, 60).trim(),
        preview: segment.slice(0, 2).join(' ').substring(0, 100),
      });
    }

    return {
      source: 'generated_from_transcript',
      chapters,
      tips: [
        'First chapter must start at 0:00',
        'Minimum 3 chapters required by YouTube',
        'Each chapter title should be descriptive but concise',
        'Review and adjust timestamps manually for accuracy',
      ],
    };
  }

  throw new Error('Either video_id or transcript_text must be provided');
}
