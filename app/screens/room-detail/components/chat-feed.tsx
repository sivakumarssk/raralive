import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import { USER_LEVEL_IMAGES } from '@/utils/userLevel';
import type { ChatMessage } from '../room-detail.data';

function JoinNotice({ msg, compact }: { msg: ChatMessage; compact: boolean }) {
  return (
    <View style={[feed.joinRow, compact && feed.joinRowCompact]}>
      <Text style={[feed.joinText, compact && feed.joinTextCompact]}>
        <Text style={compact ? feed.joinStarCompact : feed.joinStar}>✨ </Text>
        <Text style={[feed.joinName, compact && feed.joinNameCompact]}>{msg.user?.name}</Text>
        <Text> joined the room</Text>
      </Text>
    </View>
  );
}

function GiftNotice({ msg, hasRoomBg, compact }: { msg: ChatMessage; hasRoomBg: boolean; compact: boolean }) {
  const user = msg.user;
  const giftImgUri = msg.giftImageUrl
    ? `${MEDIA_BASE}/${msg.giftImageUrl.replace(/^\//, '')}`
    : null;
  const nameColor = hasRoomBg ? '#FFFFFF' : '#1C1E22';
  const avatarSize = compact ? 28 : 40;

  return (
    <View style={feed.msgRow}>
      {user?.avatarUri ? (
        <Image source={{ uri: user.avatarUri }} style={[feed.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
      ) : (
        <View style={[feed.avatar, feed.avatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
          <Text style={[feed.avatarInitial, compact && feed.avatarInitialCompact]}>{user?.name?.[0] ?? '?'}</Text>
        </View>
      )}

      <View style={feed.bubbleBlock}>
        <Text style={[feed.username, compact && feed.usernameCompact, { color: nameColor }]}>{user?.name}</Text>
        {!compact && (
          <ExpoImage
            source={USER_LEVEL_IMAGES[Math.min(user?.level ?? 0, 100)]}
            style={feed.levelBadge}
            contentFit="contain"
          />
        )}
        <View style={[feed.giftBubble, compact && feed.giftBubbleCompact]}>
          <View style={[feed.giftIconWrap, compact && feed.giftIconWrapCompact, { backgroundColor: msg.giftBgColor ?? '#FFE9D4' }]}>
            {giftImgUri ? (
              <Image source={{ uri: giftImgUri }} style={[feed.giftImg, compact && feed.giftImgCompact]} resizeMode="contain" />
            ) : (
              <Text style={{ fontSize: compact ? 12 : 16 }}>🎁</Text>
            )}
          </View>
          <Text style={[feed.giftText, compact && feed.giftTextCompact]}>
            <Text style={feed.giftMid}>sent a gift to </Text>
            <Text style={feed.giftRecipient}>{msg.giftTo}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChatBubble({ msg, hasRoomBg, compact, isPinned, onPress }: {
  msg: ChatMessage; hasRoomBg: boolean; compact: boolean; isPinned: boolean; onPress?: (msg: ChatMessage) => void;
}) {
  const user = msg.user!;
  const isHighLevel = user.level >= 30;
  const bubbleBg = isHighLevel ? '#7A0EED' : '#ECECEC';
  const textColor = isHighLevel ? '#FFFFFF' : '#1C1E22';
  const nameColor = hasRoomBg ? '#FFFFFF' : '#1C1E22';
  const avatarSize = compact ? 28 : 40;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={feed.msgRow}
      {...(onPress ? { onLongPress: () => onPress(msg), activeOpacity: 0.7 } : {})}>
      <View style={feed.avatarWrap}>
        {user.avatarUri ? (
          <Image source={{ uri: user.avatarUri }} style={[feed.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
        ) : (
          <View style={[feed.avatar, feed.avatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            <Text style={[feed.avatarInitial, compact && feed.avatarInitialCompact]}>{user.name[0]}</Text>
          </View>
        )}
      </View>

      <View style={feed.bubbleBlock}>
        <View style={feed.usernameRow}>
          <Text style={[feed.username, compact && feed.usernameCompact, { color: nameColor }]}>{user.name}</Text>
          {isPinned && <Ionicons name="pin" size={compact ? 10 : 12} color="#F5A623" style={feed.pinIcon} />}
        </View>
        {!compact && (
          <ExpoImage
            source={USER_LEVEL_IMAGES[Math.min(user.level ?? 0, 100)]}
            style={feed.levelBadge}
            contentFit="contain"
          />
        )}
        <View style={[feed.bubble, compact && feed.bubbleCompact, { backgroundColor: bubbleBg }, isPinned && feed.bubblePinned]}>
          <Text style={[feed.bubbleText, compact && feed.bubbleTextCompact, { color: textColor }]}>{msg.text}</Text>
        </View>
      </View>
    </Wrapper>
  );
}

type ChatFeedProps = {
  messages: ChatMessage[];
  hasRoomBg?: boolean;
  /** Smaller avatars/fonts, left-aligned join notices — for compact overlay contexts like the live broadcast screen. */
  compact?: boolean;
  /** Message id currently pinned, if any — shows a pin badge on that bubble. */
  pinnedMessageId?: string | null;
  /** Long-press handler for a chat bubble — opens the comment action sheet. */
  onCommentPress?: (msg: ChatMessage) => void;
};

export function ChatFeed({ messages, hasRoomBg = false, compact = false, pinnedMessageId = null, onCommentPress }: ChatFeedProps) {
  return (
    <View style={[feed.container, compact && feed.containerCompact]}>
      {messages.map((msg) => {
        if (msg.type === 'join') return <JoinNotice key={msg.id} msg={msg} compact={compact} />;
        if (msg.type === 'gift') return <GiftNotice key={msg.id} msg={msg} hasRoomBg={hasRoomBg} compact={compact} />;
        return (
          <ChatBubble
            key={msg.id}
            msg={msg}
            hasRoomBg={hasRoomBg}
            compact={compact}
            isPinned={msg.id === pinnedMessageId}
            onPress={onCommentPress}
          />
        );
      })}
    </View>
  );
}

const feed = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  containerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },

  // Join notice
  joinRow: {
    alignSelf: 'center',
    backgroundColor: 'rgba(230,225,245,0.85)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  joinRowCompact: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  joinText: { fontSize: 12, color: '#60626A', fontWeight: '500' },
  joinTextCompact: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  joinStar: { fontSize: 12 },
  joinStarCompact: { fontSize: 11 },
  joinName: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
  joinNameCompact: { fontSize: 11, fontWeight: '700', color: '#C9A6FF' },

  // Gift notice
  giftBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4EC',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFD9B8',
  },
  giftBubbleCompact: {
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  giftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE9D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftIconWrapCompact: { width: 22, height: 22, borderRadius: 11 },
  giftImg: { width: 24, height: 24 },
  giftImgCompact: { width: 16, height: 16 },
  giftText: { flex: 1, fontSize: 13, lineHeight: 18 },
  giftTextCompact: { fontSize: 11, lineHeight: 15 },
  giftMid: { color: '#60626A' },
  giftRecipient: { fontWeight: '700', color: '#E8944A' },

  // Chat bubble
  msgRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatarWrap: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7A0EED',
  },
  avatarInitialCompact: { fontSize: 12 },
  bubbleBlock: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  pinIcon: { marginLeft: 4 },
  username: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: -24,
  },
  usernameCompact: {
    fontSize: 11,
    marginBottom: 2,
  },
  levelBadge: {
    width: 75,
    height: 75,
    marginBottom: -24,
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  bubblePinned: {
    borderWidth: 1.5,
    borderColor: '#F5A623',
  },
  bubbleCompact: {
    borderRadius: 12,
    borderTopLeftRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});
