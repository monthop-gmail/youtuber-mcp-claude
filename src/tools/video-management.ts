import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import { extractVideoId } from '../utils/helpers.js';

const uploadVideoSchema = z.object({
  file_path: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  category_id: z.string().optional().default('22'),
  privacy_status: z.enum(['public', 'private', 'unlisted']).optional().default('private'),
  scheduled_time: z.string().optional(),
});

const updateVideoSchema = z.object({
  video_id: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category_id: z.string().optional(),
  privacy_status: z.enum(['public', 'private', 'unlisted']).optional(),
});

const deleteVideoSchema = z.object({
  video_id: z.string().min(1),
});

const listVideosSchema = z.object({
  max_results: z.number().int().min(1).max(50).optional().default(10),
  page_token: z.string().optional(),
  status_filter: z.enum(['public', 'private', 'unlisted']).optional(),
});

const setThumbnailSchema = z.object({
  video_id: z.string().min(1),
  image_path: z.string().min(1),
});

export async function uploadVideo(args: Record<string, unknown>) {
  const params = uploadVideoSchema.parse(args);
  return youtubeApi.uploadVideo({
    filePath: params.file_path,
    title: params.title,
    description: params.description,
    tags: params.tags,
    categoryId: params.category_id,
    privacyStatus: params.privacy_status,
    scheduledTime: params.scheduled_time,
  });
}

export async function updateVideo(args: Record<string, unknown>) {
  const params = updateVideoSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.updateVideo({
    videoId,
    title: params.title,
    description: params.description,
    tags: params.tags,
    categoryId: params.category_id,
    privacyStatus: params.privacy_status,
  });
}

export async function deleteVideo(args: Record<string, unknown>) {
  const params = deleteVideoSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.deleteVideo(videoId);
}

export async function listVideos(args: Record<string, unknown>) {
  const params = listVideosSchema.parse(args);
  return youtubeApi.listVideos({
    maxResults: params.max_results,
    pageToken: params.page_token,
    statusFilter: params.status_filter,
  });
}

export async function setThumbnail(args: Record<string, unknown>) {
  const params = setThumbnailSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.setThumbnail({
    videoId,
    imagePath: params.image_path,
  });
}
