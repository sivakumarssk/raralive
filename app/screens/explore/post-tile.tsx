import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEDIA_BASE } from '@/services/api';
import type { FeedPost } from '@/screens/home/home-screen';

function resolveMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\/+/, '')}`;
}

function shortCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// ── Video previews ────────────────────────────────────────────────────────────
// A frame from each video, made by one hidden, muted player, one video at a
// time (so a screen full of tiles doesn't open a player each). Kept for the
// session: each video's preview is made once. null = couldn't make one.

// The first frame — the same picture the Home feed shows for a paused video
const PREVIEW_AT_S = 0;
const PREVIEW_MAX_W = 360;

const previews = new Map<string, VideoThumbnail | null>();
const waiting = new Map<string, Set<(t: VideoThumbnail | null) => void>>();
const queue: string[] = [];
let busy = false;
let previewPlayer: VideoPlayer | null = null;

async function makePreview(uri: string): Promise<VideoThumbnail | null> {
  if (!previewPlayer) {
    previewPlayer = createVideoPlayer(null);
    previewPlayer.muted = true;
  }
  await previewPlayer.replaceAsync({ uri });
  try {
    const [thumb] = await previewPlayer.generateThumbnailsAsync(PREVIEW_AT_S, { maxWidth: PREVIEW_MAX_W });
    return thumb ?? null;
  } catch {
    return null;
  }
}

async function pump() {
  if (busy) return;
  const uri = queue.shift();
  if (!uri) return;
  busy = true;
  let thumb: VideoThumbnail | null = null;
  try { thumb = await makePreview(uri); } catch { thumb = null; }
  previews.set(uri, thumb);
  waiting.get(uri)?.forEach(cb => cb(thumb));
  waiting.delete(uri);
  busy = false;
  pump();
}

/** The video's preview frame — undefined while it's being made. */
function useVideoPreview(uri: string | null, isVideo: boolean) {
  const [thumb, setThumb] = useState<VideoThumbnail | null | undefined>(
    () => (uri && isVideo ? previews.get(uri) : null),
  );
  useEffect(() => {
    if (!uri || !isVideo) return;
    if (previews.has(uri)) { setThumb(previews.get(uri)); return; }
    const cb = (t: VideoThumbnail | null) => setThumb(t);
    if (!waiting.has(uri)) waiting.set(uri, new Set());
    waiting.get(uri)!.add(cb);
    if (!queue.includes(uri)) queue.push(uri);
    pump();
    return () => { waiting.get(uri)?.delete(cb); };
  }, [uri, isVideo]);
  return thumb;
}

/**
 * A post as a thumbnail (Explore strips and category grids): the photo, or a
 * preview frame for a video (with a play mark) — a dark tile until the frame
 * is ready. Optional corner badge (likes, views, …). Tap opens the post.
 */
export function PostTile({ post, width, height, badge }: {
  post: FeedPost;
  width: number;
  height: number;
  badge?: { icon: 'heart' | 'bookmark' | 'eye' | 'flame'; count?: number };
}) {
  const media = post.media?.[0];
  const uri = resolveMedia(media?.media_url);
  const isVideo = media?.media_type === 'video';
  const preview = useVideoPreview(uri, isVideo);
  const iconSize = Math.min(width, height) * 0.3;

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}` as never)}
      style={({ pressed }) => [s.tile, { width, height }, pressed && { opacity: 0.85 }]}
      accessibilityLabel={`Open post by ${post.username ?? post.full_name ?? 'user'}`}>
      {uri && !isVideo ? (
        <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : isVideo && preview ? (
        <>
          <ExpoImage source={preview} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          <View style={s.playMark} pointerEvents="none">
            <Ionicons name="play" size={iconSize * 0.55} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, s.videoBg]}>
          <Ionicons name={isVideo ? 'play-circle' : 'image-outline'} size={iconSize} color="rgba(255,255,255,0.85)" />
        </View>
      )}
      {badge && (
        <View style={s.badge}>
          <Ionicons name={badge.icon} size={11} color={badge.icon === 'heart' ? '#FF5C7A' : badge.icon === 'flame' ? '#FFB020' : '#FFFFFF'} />
          {badge.count != null && <Text style={s.badgeText}>{shortCount(badge.count)}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#E9E5F5' },
  videoBg: { backgroundColor: '#2A1B45', alignItems: 'center', justifyContent: 'center' },
  playMark: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
