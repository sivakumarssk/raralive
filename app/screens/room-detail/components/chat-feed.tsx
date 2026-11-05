import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import { USER_LEVEL_IMAGES } from '@/utils/userLevel';
import type { ChatMessage } from '../room-detail.data';
import { RC } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

function Avatar({ uri, name, size, compact, onPress }: {
  uri?: string; name: string; size: number; compact: boolean; onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper {...(onPress ? { onPress, activeOpacity: 0.7, hitSlop: 6 } : {})}>
      <Image source={avatarSource(uri)} style={[feed.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
    </Wrapper>
  );
}

// Avatar beside a room-chat card, and the pointer at the card's top-left
// corner aimed at it.
const FULL_AVATAR = 34;
const GIFT_CARD_BG = '#FFF6EC';
const TAIL_W = 10;
const TAIL_H = 12;

function CardTail({ color }: { color: string }) {
  return <View style={[feed.cardTail, { borderTopColor: color }]} pointerEvents="none" />;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Time shown at the end of a message: "8:16 PM" for today, "Yesterday 8:16 PM",
// otherwise "Jul 23 8:16 PM". Empty for messages without a server time.
function formatMsgTime(createdAt?: string) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  const year = d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${year} ${time}`;
}

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

/** Plain-text summary of a message — the text, or "Sent Rose ×2 to Name" for a gift. */
export function messagePreviewText(msg: ChatMessage): string {
  if (msg.type === 'gift') {
    const qty = msg.giftQty ?? 1;
    return `Sent ${msg.giftName ?? 'a gift'}${qty > 1 ? ` ×${qty}` : ''}${msg.giftTo ? ` to ${msg.giftTo}` : ''}`;
  }
  return msg.text ?? '';
}

function GiftNotice({ msg, compact, isPinned, onPress, tapToAct, onAvatarPress }: {
  msg: ChatMessage; hasRoomBg: boolean; compact: boolean; isPinned?: boolean;
  onPress?: (msg: ChatMessage) => void; tapToAct?: boolean;
  onAvatarPress?: (userId: string, user?: ChatMessage['user']) => void;
}) {
  const user = msg.user;
  const giftImgUri = msg.giftImageUrl
    ? `${MEDIA_BASE}/${msg.giftImageUrl.replace(/^\//, '')}`
    : null;
  const avatarSize = compact ? 26 : FULL_AVATAR;
  const qty = msg.giftQty ?? 1;
  const time = formatMsgTime(msg.createdAt);

  // Full room chat: a warm gift card (name, time, level) sized to its
  // content, with the gift in a white panel inside — "Sent <recipient>", the
  // gift picture with its ×qty, and a faded gift box behind on the right.
  if (!compact) {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
      <Wrapper
        style={feed.msgRow}
        {...(onPress ? { [tapToAct ? 'onPress' : 'onLongPress']: () => onPress(msg), activeOpacity: 0.7 } : {})}>
        <Avatar
          uri={user?.avatarUri}
          name={user?.name ?? '?'}
          size={avatarSize}
          compact={compact}
          onPress={user?.id && onAvatarPress ? () => onAvatarPress(user.id!, user) : undefined}
        />
        <View style={[feed.card, feed.giftMsgCard, isPinned && feed.bubblePinned]}>
          <CardTail color={GIFT_CARD_BG} />
          <View style={feed.cardHeader}>
            <Text style={feed.cardName} numberOfLines={1}>{user?.name}</Text>
            {isPinned && <Ionicons name="pin" size={11} color="#F5A623" />}
            {!!time && <Text style={feed.cardTime}>{time}</Text>}
          </View>
          <ExpoImage
            source={USER_LEVEL_IMAGES[Math.min(user?.level ?? 0, 100)]}
            style={feed.cardLevel}
            contentFit="contain"
          />
          <View style={feed.giftPanel}>
            <Ionicons name="gift" size={50} color="rgba(122,14,237,0.10)" style={feed.giftPanelMark} />
            <Text style={feed.giftPanelText} numberOfLines={1}>
              <Text style={feed.giftMid}>Sent </Text>
              <Text style={feed.giftPanelRecipient}>{msg.giftTo}</Text>
            </Text>
            <View style={feed.giftMsgImgRow}>
              {giftImgUri ? (
                <Image source={{ uri: giftImgUri }} style={feed.giftMsgImg} resizeMode="contain" />
              ) : (
                <Text style={feed.giftMsgEmoji}>🎁</Text>
              )}
              <Text style={feed.giftMsgQty}>×{qty}</Text>
            </View>
          </View>
        </View>
      </Wrapper>
    );
  }

  return (
    <View style={[feed.giftCard, compact && feed.giftCardCompact]}>
      <Avatar
        uri={user?.avatarUri}
        name={user?.name ?? '?'}
        size={avatarSize}
        compact={compact}
        onPress={user?.id && onAvatarPress ? () => onAvatarPress(user.id!, user) : undefined}
      />

      <View style={feed.giftCardBody}>
        <View style={feed.giftCardNameRow}>
          <Text style={[feed.giftCardName, compact && feed.giftCardNameCompact]} numberOfLines={1} ellipsizeMode="tail">{user?.name}</Text>
        </View>
        <ExpoImage
          source={USER_LEVEL_IMAGES[Math.min(user?.level ?? 0, 100)]}
          style={[feed.giftLevelBadge, compact && feed.giftLevelBadgeCompact]}
          contentFit="contain"
        />
        <Text style={[feed.giftCardLine, compact && feed.giftCardLineCompact]} numberOfLines={1}>
          <Text style={feed.giftMid}>sent a </Text>
          <Text style={feed.giftName}>{msg.giftName ?? 'gift'}</Text>
          <Text style={feed.giftMid}> to </Text>
        </Text>
        <Text style={[feed.giftCardLine, compact && feed.giftCardLineCompact]} numberOfLines={1} ellipsizeMode="tail">
          <Text style={[feed.giftRecipient, compact && feed.giftRecipientCompact]}>{msg.giftTo}</Text>
        </Text>
      </View>

      <View style={[feed.giftCardImgWrap, compact && feed.giftCardImgWrapCompact, { backgroundColor: msg.giftBgColor ?? '#FFE9D4' }]}>
        {giftImgUri ? (
          <Image source={{ uri: giftImgUri }} style={[feed.giftCardImg, compact && feed.giftCardImgCompact]} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: compact ? 20 : 28 }}>🎁</Text>
        )}
      </View>

      <View style={[feed.giftQtyPill, compact && feed.giftQtyPillCompact]}>
        <Text style={[feed.giftQtyPillText, compact && feed.giftQtyPillTextCompact]}>×{qty}</Text>
      </View>

      {!!time && <Text style={[feed.giftTime, compact && feed.giftTimeCompact]}>{time}</Text>}
    </View>
  );
}

function ChatBubble({ msg, hasRoomBg, compact, isPinned, onPress, tapToAct, onAvatarPress }: {
  msg: ChatMessage; hasRoomBg: boolean; compact: boolean; isPinned: boolean;
  onPress?: (msg: ChatMessage) => void; tapToAct?: boolean; onAvatarPress?: (userId: string, user?: ChatMessage['user']) => void;
}) {
  const user = msg.user!;
  const isHighLevel = user.level >= 30;
  const avatarSize = compact ? 28 : FULL_AVATAR;
  const time = formatMsgTime(msg.createdAt);

  const Wrapper = onPress ? TouchableOpacity : View;

  // Full room chat: one card holding name + time, level badge and the message
  if (!compact) {
    const cardBg = isHighLevel ? '#7A0EED' : hasRoomBg ? 'rgba(255,255,255,0.92)' : '#F1F1F4';
    return (
      <Wrapper
        style={feed.msgRow}
        {...(onPress ? { [tapToAct ? 'onPress' : 'onLongPress']: () => onPress(msg), activeOpacity: 0.7 } : {})}>
        <Avatar
          uri={user.avatarUri}
          name={user.name}
          size={avatarSize}
          compact={compact}
          onPress={user.id && onAvatarPress ? () => onAvatarPress(user.id!, user) : undefined}
        />
        <View style={[feed.card, { backgroundColor: cardBg }, isPinned && feed.bubblePinned]}>
          <CardTail color={cardBg} />
          <View style={feed.cardHeader}>
            <Text style={[feed.cardName, isHighLevel && feed.onPurple]} numberOfLines={1}>{user.name}</Text>
            {isPinned && <Ionicons name="pin" size={11} color="#F5A623" />}
            {!!time && <Text style={[feed.cardTime, isHighLevel && feed.onPurpleMuted]}>{time}</Text>}
          </View>
          <ExpoImage
            source={USER_LEVEL_IMAGES[Math.min(user.level ?? 0, 100)]}
            style={feed.cardLevel}
            contentFit="contain"
          />
          <Text style={[feed.cardText, isHighLevel && feed.onPurple]}>{msg.text}</Text>
        </View>
      </Wrapper>
    );
  }

  // Compact overlay (live broadcast): name above a small bubble
  const bubbleBg = isHighLevel ? '#7A0EED' : '#ECECEC';
  const textColor = isHighLevel ? '#FFFFFF' : '#1C1E22';
  const nameColor = hasRoomBg ? '#FFFFFF' : '#1C1E22';

  return (
    <Wrapper
      style={feed.msgRow}
      {...(onPress ? { [tapToAct ? 'onPress' : 'onLongPress']: () => onPress(msg), activeOpacity: 0.7 } : {})}>
      <View style={feed.avatarWrap}>
        <Avatar
          uri={user.avatarUri}
          name={user.name}
          size={avatarSize}
          compact={compact}
          onPress={user.id && onAvatarPress ? () => onAvatarPress(user.id!, user) : undefined}
        />
      </View>

      <View style={feed.bubbleBlock}>
        <View style={feed.usernameRow}>
          <Text style={[feed.username, compact && feed.usernameCompact, { color: nameColor }]}>{user.name}</Text>
          {isPinned && <Ionicons name="pin" size={compact ? 10 : 12} color="#F5A623" style={feed.pinIcon} />}
          {!!time && (
            <Text style={[feed.msgTime, compact && feed.msgTimeCompact, { color: hasRoomBg ? 'rgba(255,255,255,0.75)' : '#8A8C93' }]}>
              {time}
            </Text>
          )}
        </View>
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
  /** Tap handler for a sender's avatar — navigates to their profile. */
  onAvatarPress?: (userId: string, user?: ChatMessage['user']) => void;
  /** Space kept free on the right (e.g. for a floating icon column) so messages never run under it. */
  rightInset?: number;
  /** Open message actions on a normal tap instead of a long-press. */
  tapToAct?: boolean;
  /** Reports each chat message's y offset inside the feed (used to scroll to the pinned one). */
  onMessageLayout?: (messageId: string, y: number) => void;
};

export function ChatFeed({ messages, hasRoomBg = false, compact = false, pinnedMessageId = null, onCommentPress, onAvatarPress, rightInset, tapToAct, onMessageLayout }: ChatFeedProps) {
  return (
    <View style={[feed.container, compact && feed.containerCompact, rightInset != null && { paddingRight: rightInset }]}>
      {messages.map((msg) => {
        // A chat bubble needs a sender — skip anything malformed rather than crash
        if (msg.type !== 'join' && msg.type !== 'gift' && !msg.user) return null;
        if (msg.type === 'join') return <JoinNotice key={msg.id} msg={msg} compact={compact} />;
        if (msg.type === 'gift') {
          const gift = (
            <GiftNotice
              key={msg.id}
              msg={msg}
              hasRoomBg={hasRoomBg}
              compact={compact}
              isPinned={msg.id === pinnedMessageId}
              onPress={onCommentPress}
              tapToAct={tapToAct}
              onAvatarPress={onAvatarPress}
            />
          );
          if (!onMessageLayout) return gift;
          return (
            <View key={msg.id} onLayout={e => onMessageLayout(msg.id, e.nativeEvent.layout.y)}>
              {gift}
            </View>
          );
        }
        const bubble = (
          <ChatBubble
            key={msg.id}
            msg={msg}
            hasRoomBg={hasRoomBg}
            compact={compact}
            isPinned={msg.id === pinnedMessageId}
            onPress={onCommentPress}
            tapToAct={tapToAct}
            onAvatarPress={onAvatarPress}
          />
        );
        if (!onMessageLayout) return bubble;
        return (
          <View key={msg.id} onLayout={e => onMessageLayout(msg.id, e.nativeEvent.layout.y)}>
            {bubble}
          </View>
        );
      })}
    </View>
  );
}

const feed = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
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

  // Gift notice — full-width card: avatar, name+level, "sent a X to Y" line,
  // gift image, quantity pill
  giftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    // Spans the full chat width so every gift card lines up; long names end in "..."
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Live-broadcast overlay keeps the narrower card so the video stays visible
  giftCardCompact: {
    alignSelf: 'flex-start',
    width: '88%',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  // Takes the free space (pushes gift + qty to the right edge); long sender /
  // recipient names end in "..." instead of widening the card
  giftCardBody: { flex: 1, gap: 2 },
  giftCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  giftCardName: { fontSize: 12.5, fontWeight: '600', color: '#3A3C42', flexShrink: 1 },
  giftCardNameCompact: { fontSize: 11 },
  giftLevelBadge: { width: 40, height: 15, alignSelf: 'flex-start' },
  giftLevelBadgeCompact: { width: 36, height: 13 },
  giftCardLine: { fontSize: 13, lineHeight: 18 },
  giftCardLineCompact: { fontSize: 10.5, lineHeight: 14 },
  giftMid: { color: '#60626A' },
  giftName: { fontWeight: '700', color: '#7A0EED' },
  giftRecipient: { fontSize: 12, fontWeight: '700', color: '#E8944A' },
  giftRecipientCompact: { fontSize: 10 },
  giftCardImgWrap: {
    width: 46, height: 46, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  giftCardImgWrapCompact: { width: 34, height: 34, borderRadius: 9 },
  giftCardImg: { width: 40, height: 40 },
  giftCardImgCompact: { width: 28, height: 28 },
  giftQtyPill: { paddingHorizontal: 6, paddingVertical: 5 },
  giftQtyPillCompact: { paddingHorizontal: 4, paddingVertical: 3 },
  giftQtyPillText: { fontSize: 13, fontWeight: '800', color: RC.number },
  giftQtyPillTextCompact: { fontSize: 10 },
  // Pinned to the card's top-right corner, above the qty pill
  giftTime: { position: 'absolute', top: 5, right: 12, fontSize: 10, fontWeight: '500', color: '#8A8C93' },
  giftTimeCompact: { top: 3, right: 8, fontSize: 9 },

  // Chat bubble
  msgRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  // Full-room message card: name + time, level badge, message — all inside
  // Same full width for every card, however short the message
  card: {
    flex: 1,
    borderRadius: 14,
    borderTopLeftRadius: 0, // the pointer continues from this corner
    marginLeft: 2, // room for the pointer
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  // Pointer at the card's top-left corner: flat along the card's top edge,
  // tip pointing left toward the avatar, sloping back down into the card
  cardTail: {
    position: 'absolute', left: -TAIL_W, top: 0,
    width: 0, height: 0,
    borderTopWidth: TAIL_H, borderLeftWidth: TAIL_W,
    borderLeftColor: 'transparent',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: '#3A3C42' },
  // Pushed to the card's top-right corner
  cardTime: { marginLeft: 'auto', paddingLeft: 8, fontSize: 11, fontWeight: '500', color: '#7D8FB3' },
  cardLevel: { width: 40, height: 15, marginTop: 4 },
  cardText: { fontSize: 15, lineHeight: 21, color: '#1C1E22', marginTop: 6 },
  // Gift message: light warm card, gift picture + ×qty inside under the text
  // Gift message card: warm background, and only as wide as its content
  // (chat cards stretch full width) so it stays compact.
  giftMsgCard: { backgroundColor: GIFT_CARD_BG, flex: 0, flexShrink: 1, minWidth: 210, paddingBottom: 8 },
  // Gift panel inside the gift card (room chat)
  giftPanel: {
    marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    paddingRight: 62, // clear of the faded gift box
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  giftPanelMark: { position: 'absolute', right: 8, top: '50%', marginTop: -25 },
  giftPanelText: { fontSize: 13, lineHeight: 18 },
  giftPanelRecipient: { fontWeight: '600', color: '#1C1E22' },
  giftMsgImgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  giftMsgImg: { width: 34, height: 34 },
  giftMsgEmoji: { fontSize: 24 },
  giftMsgQty: { fontSize: 14, fontWeight: '800', color: RC.number, fontStyle: 'italic' },
  onPurple: { color: '#FFFFFF' },
  onPurpleMuted: { color: 'rgba(255,255,255,0.75)' },
  avatarWrap: {},
  avatar: {
    width: FULL_AVATAR,
    height: FULL_AVATAR,
    borderRadius: FULL_AVATAR / 2,
  },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
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
    marginBottom: -27,
  },
  usernameCompact: {
    fontSize: 11,
    marginBottom: 2,
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
  // Time sits on the top line next to the name. Same negative bottom margin as
  // `username` so it doesn't push the level badge / bubble down.
  msgTime: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6,
    marginBottom: -27,
  },
  msgTimeCompact: { fontSize: 9, marginBottom: 2 },
});
