import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView } from 'expo-video';
import { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoldIcon } from '@/components/ui/bold-icon';
import {
  Avatar,
  POST_ICON_WEIGHT,
  formatCount,
  timeAgo,
  usePostInteractions,
  type FeedPost,
} from '@/screens/home/home-screen';
import { sharePost } from '@/utils/share';

/**
 * One post full screen on black, like a reel: the photo / video fills the
 * screen (fitted, never cropped), actions down the right side, author +
 * Follow, caption, tags and time at the bottom left. Double tap likes, a tap
 * plays / pauses a video, videos start on their own. Same behaviour as the
 * feed card (usePostInteractions).
 */
export function PostReel({ post, currentUserId, following, onFollowChange, onOpenComments, onTagPress, onBack }: {
  post: FeedPost;
  currentUserId: string;
  following: boolean;
  onFollowChange: (userId: string, nowFollowing: boolean) => void;
  onOpenComments: () => void;
  onTagPress?: (tag: { id: string; parent_id: string | null }) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [captionOpen, setCaptionOpen] = useState(false);
  const {
    mediaUri, isVideo, mediaError, setMediaError,
    liked, saved, likesCount, commentsCount, downloading, followLoading, videoPlaying,
    likeScale, bigHeartScale, bigHeartOpacity,
    isOwnPost, displayName, initial, color, avatarUri, videoPlayer,
    handleFollow, handleLike, handleSave, handleMediaTap, handleDownload,
  } = usePostInteractions(post, { currentUserId, following, onFollowChange, autoPlay: true });

  return (
    <View style={s.root}>
      {/* Media, fitted to the screen on black */}
      {mediaUri && !mediaError ? (
        isVideo ? (
          <VideoView player={videoPlayer} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        ) : (
          <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="contain" onError={() => setMediaError(true)} />
        )
      ) : (
        <View style={s.placeholder}>
          <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={48} color="rgba(255,255,255,0.3)" />
        </View>
      )}

      {/* Tap layer on top of the media (the native video surface swallows touches) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleMediaTap} />

      {isVideo && !mediaError && !videoPlaying && (
        <View style={s.center} pointerEvents="none">
          <View style={s.playCircle}>
            <Ionicons name="play" size={34} color="#FFFFFF" style={{ paddingLeft: 4 }} />
          </View>
        </View>
      )}
      <View style={s.center} pointerEvents="none">
        <Animated.View style={{ opacity: bigHeartOpacity, transform: [{ scale: bigHeartScale }] }}>
          <Ionicons name="heart" size={110} color="#FF3B5C" style={s.bigHeart} />
        </Animated.View>
      </View>

      {/* Soft fades so the white text and icons read on any picture */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={[s.topFade, { height: insets.top + 90 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
        style={[s.bottomFade, { height: insets.bottom + 280 }]}
      />

      {/* Back */}
      <TouchableOpacity style={[s.back, { top: insets.top + 6 }]} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Actions down the right side */}
      <View style={[s.actions, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity style={s.action} onPress={handleLike} activeOpacity={0.8} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <BoldIcon name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#FF3B5C' : '#FFFFFF'} weight={POST_ICON_WEIGHT} />
          </Animated.View>
          <Text style={s.actionText}>{formatCount(likesCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={onOpenComments} activeOpacity={0.8} accessibilityLabel="Comments">
          <BoldIcon name="chatbubble-outline" size={28} color="#FFFFFF" weight={POST_ICON_WEIGHT} />
          <Text style={s.actionText}>{formatCount(commentsCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.action}
          onPress={() => sharePost({ id: post.id, authorName: displayName, caption: post.caption })}
          activeOpacity={0.8}
          accessibilityLabel="Share post">
          <BoldIcon name="arrow-redo-outline" size={28} color="#FFFFFF" weight={POST_ICON_WEIGHT} />
          <Text style={s.actionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={handleSave} activeOpacity={0.8} accessibilityLabel={saved ? 'Remove from saved' : 'Save post'}>
          <BoldIcon name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color={saved ? '#C9A6FF' : '#FFFFFF'} weight={POST_ICON_WEIGHT} />
          <Text style={s.actionText}>{saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={handleDownload} disabled={downloading} activeOpacity={0.8} accessibilityLabel="Download">
          {downloading
            ? <ActivityIndicator size="small" color="#FFFFFF" style={s.spinner} />
            : <BoldIcon name="download-outline" size={28} color="#FFFFFF" weight={POST_ICON_WEIGHT} />}
        </TouchableOpacity>
      </View>

      {/* Author, caption, tags, time — bottom left, clear of the actions */}
      <View style={[s.info, { bottom: insets.bottom + 24 }]}>
        <View style={s.authorRow}>
          <TouchableOpacity
            style={s.author}
            onPress={() => router.push(`/user/${post.user_id}` as never)}
            activeOpacity={0.8}>
            <View style={s.avatarRing}>
              <Avatar initial={initial} color={color} uri={avatarUri} size={36} />
            </View>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
          </TouchableOpacity>
          {!isOwnPost && (
            <TouchableOpacity
              style={[s.follow, following && s.following]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={s.followText}>{following ? 'Following' : 'Follow'}</Text>}
            </TouchableOpacity>
          )}
        </View>

        {!!post.caption && (
          <Text
            style={[s.caption, captionOpen && { maxHeight: height * 0.3 }]}
            numberOfLines={captionOpen ? 12 : 2}
            onPress={() => setCaptionOpen(o => !o)}>
            {post.caption}
          </Text>
        )}

        {!!post.tag_list?.length && (
          <View style={s.tagRow}>
            {post.tag_list.map(t => (
              <Text key={t.id} style={s.tag} onPress={() => onTagPress?.(t)}>#{t.name}</Text>
            ))}
          </View>
        )}

        <Text style={s.time}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  );
}

const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  bigHeart: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },

  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  back: { position: 'absolute', left: 10, padding: 4 },

  actions: { position: 'absolute', right: 10, alignItems: 'center', gap: 20 },
  action: { alignItems: 'center', gap: 4, minWidth: 48 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', ...TEXT_SHADOW },
  spinner: { height: 28 },

  info: { position: 'absolute', left: 14, right: 78, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  avatarRing: { borderRadius: 20, borderWidth: 1.5, borderColor: '#FFFFFF', padding: 1 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: '#FFFFFF', ...TEXT_SHADOW },
  follow: {
    paddingHorizontal: 14, height: 30, borderRadius: 8, justifyContent: 'center',
    borderWidth: 1.2, borderColor: '#FFFFFF',
  },
  following: { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.12)' },
  followText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  caption: { fontSize: 14, lineHeight: 20, color: '#FFFFFF', ...TEXT_SHADOW },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontSize: 13, fontWeight: '700', color: '#E2D2FF', ...TEXT_SHADOW },
  time: { fontSize: 12, color: 'rgba(255,255,255,0.75)', ...TEXT_SHADOW },
});
