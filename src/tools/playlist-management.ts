import { z } from 'zod';
import * as youtubeApi from '../services/youtube-api.js';
import { extractVideoId } from '../utils/helpers.js';

const createPlaylistSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  privacy_status: z.enum(['public', 'private', 'unlisted']).optional().default('private'),
});

const addToPlaylistSchema = z.object({
  playlist_id: z.string().min(1),
  video_id: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const reorderPlaylistSchema = z.object({
  playlist_id: z.string().min(1),
  video_id: z.string().min(1),
  new_position: z.number().int().min(0),
});

export async function createPlaylist(args: Record<string, unknown>) {
  const params = createPlaylistSchema.parse(args);
  return youtubeApi.createPlaylist({
    title: params.title,
    description: params.description,
    privacyStatus: params.privacy_status,
  });
}

export async function addToPlaylist(args: Record<string, unknown>) {
  const params = addToPlaylistSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.addToPlaylist({
    playlistId: params.playlist_id,
    videoId,
    position: params.position,
  });
}

export async function listPlaylists(_args: Record<string, unknown>) {
  return youtubeApi.listPlaylists();
}

export async function reorderPlaylist(args: Record<string, unknown>) {
  const params = reorderPlaylistSchema.parse(args);
  const videoId = extractVideoId(params.video_id);
  return youtubeApi.reorderPlaylist({
    playlistId: params.playlist_id,
    videoId,
    newPosition: params.new_position,
  });
}
