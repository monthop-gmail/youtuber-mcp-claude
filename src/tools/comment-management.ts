import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import { extractVideoId } from '../utils/helpers.js';

const getCommentsSchema = z.object({
  video_id: z.string().min(1),
  max_results: z.number().int().min(1).max(100).optional().default(20),
  order: z.enum(['time', 'relevance']).optional().default('relevance'),
});

const replyCommentSchema = z.object({
  comment_id: z.string().min(1),
  text: z.string().min(1),
});

const deleteCommentSchema = z.object({
  comment_id: z.string().min(1),
});

const commentSummarySchema = z.object({
  video_id: z.string().min(1),
});

export async function getComments(args: Record<string, unknown>) {
  const params = getCommentsSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.getComments({
    videoId,
    maxResults: params.max_results,
    order: params.order,
  });
}

export async function replyComment(args: Record<string, unknown>) {
  const params = replyCommentSchema.parse(args);
  return youtubeApi.replyComment({
    commentId: params.comment_id,
    text: params.text,
  });
}

export async function deleteComment(args: Record<string, unknown>) {
  const params = deleteCommentSchema.parse(args);
  return youtubeApi.deleteComment(params.comment_id);
}

export async function getCommentSummary(args: Record<string, unknown>) {
  const params = commentSummarySchema.parse(args);
  const videoId = extractVideoId(params.video_id);

  // Fetch all available comments
  const comments = await youtubeApi.getComments({
    videoId,
    maxResults: 100,
    order: 'relevance',
  });

  const totalComments = comments.length;
  const totalReplies = comments.reduce((sum, c) => sum + c.totalReplyCount, 0);
  const totalLikes = comments.reduce((sum, c) => sum + c.topLevelComment.likeCount, 0);

  // Top comments by likes
  const topComments = [...comments]
    .sort((a, b) => b.topLevelComment.likeCount - a.topLevelComment.likeCount)
    .slice(0, 5)
    .map((c) => ({
      author: c.topLevelComment.authorDisplayName,
      text: c.topLevelComment.textDisplay.substring(0, 200),
      likes: c.topLevelComment.likeCount,
      replies: c.totalReplyCount,
    }));

  // Extract common words for themes
  const allText = comments.map((c) => c.topLevelComment.textDisplay).join(' ');
  const words = allText
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  const commonThemes = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Analyze sentiment (basic: positive/negative keywords)
  const positiveKeywords = ['great', 'awesome', 'love', 'amazing', 'best', 'thank', 'helpful', 'excellent', 'fantastic', 'good'];
  const negativeKeywords = ['bad', 'terrible', 'worst', 'hate', 'boring', 'waste', 'awful', 'poor', 'disappointed'];

  let positiveCount = 0;
  let negativeCount = 0;
  for (const comment of comments) {
    const text = comment.topLevelComment.textDisplay.toLowerCase();
    if (positiveKeywords.some((kw) => text.includes(kw))) positiveCount++;
    if (negativeKeywords.some((kw) => text.includes(kw))) negativeCount++;
  }

  return {
    totalComments,
    totalReplies,
    totalLikes,
    sentiment: {
      positive: positiveCount,
      negative: negativeCount,
      neutral: totalComments - positiveCount - negativeCount,
      positivePercentage: totalComments > 0 ? Math.round((positiveCount / totalComments) * 100) : 0,
    },
    commonThemes,
    topComments,
  };
}
