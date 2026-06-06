import { Image, StyleSheet, Text, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import type { ChatMessage } from '../room-detail.data';

function JoinNotice({ msg }: { msg: ChatMessage }) {
  return (
    <View style={feed.joinRow}>
      <Text style={feed.joinText}>
        <Text style={feed.joinStar}>✨ </Text>
        <Text style={feed.joinName}>{msg.user?.name}</Text>
        <Text> joined the room</Text>
      </Text>
    </View>
  );
}

function GiftNotice({ msg }: { msg: ChatMessage }) {
  const user = msg.user;
  const giftImgUri = msg.giftImageUrl
    ? `${MEDIA_BASE}/${msg.giftImageUrl.replace(/^\//, '')}`
    : null;

  return (
    <View style={feed.msgRow}>
      {/* Sender avatar — same as regular message */}
      {user?.avatarUri ? (
        <Image source={{ uri: user.avatarUri }} style={feed.avatar} />
      ) : (
        <View style={[feed.avatar, feed.avatarFallback]}>
          <Text style={feed.avatarInitial}>{user?.name?.[0] ?? '?'}</Text>
        </View>
      )}

      {/* Bubble block */}
      <View style={feed.bubbleBlock}>
        <Text style={feed.username}>{user?.name}</Text>
        <View style={feed.giftBubble}>
          {/* Gift image */}
          <View style={[feed.giftIconWrap, { backgroundColor: msg.giftBgColor ?? '#FFE9D4' }]}>
            {giftImgUri ? (
              <Image source={{ uri: giftImgUri }} style={feed.giftImg} resizeMode="contain" />
            ) : (
              <Text style={{ fontSize: 16 }}>🎁</Text>
            )}
          </View>
          {/* Text */}
          <Text style={feed.giftText}>
            <Text style={feed.giftMid}>sent a gift to </Text>
            <Text style={feed.giftRecipient}>{msg.giftTo}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const user = msg.user!;
  const isHighLevel = user.level >= 30;
  const bubbleBg = isHighLevel ? '#7A0EED' : '#ECECEC';
  const textColor = isHighLevel ? '#FFFFFF' : '#1C1E22';

  return (
    <View style={feed.msgRow}>
      {/* Avatar */}
      <View style={feed.avatarWrap}>
        {user.avatarUri ? (
          <Image source={{ uri: user.avatarUri }} style={feed.avatar} />
        ) : (
          <View style={[feed.avatar, feed.avatarFallback]}>
            <Text style={feed.avatarInitial}>{user.name[0]}</Text>
          </View>
        )}
      </View>

      {/* Bubble block */}
      <View style={feed.bubbleBlock}>
        {/* Username + level badge */}
        <View style={feed.nameRow}>
          <Text style={feed.username}>{user.name}</Text>
          {/* <View style={[feed.levelBadge, { backgroundColor: levelBg }]}>
            <Ionicons name="trophy-outline" size={9} color="#FFFFFF" />
            <Text style={feed.levelBadgeText}>Lv.{user.level}</Text>
          </View> */}
        </View>
        {/* Bubble */}
        <View style={[feed.bubble, { backgroundColor: bubbleBg }]}>
          <Text style={[feed.bubbleText, { color: textColor }]}>{msg.text}</Text>
        </View>
      </View>
    </View>
  );
}

type ChatFeedProps = {
  messages: ChatMessage[];
};

export function ChatFeed({ messages }: ChatFeedProps) {
  return (
    <View style={feed.container}>
      {messages.map((msg) => {
        if (msg.type === 'join') return <JoinNotice key={msg.id} msg={msg} />;
        if (msg.type === 'gift') return <GiftNotice key={msg.id} msg={msg} />;
        return <ChatBubble key={msg.id} msg={msg} />;
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

  // Join notice
  joinRow: {
    alignSelf: 'center',
    backgroundColor: 'rgba(230,225,245,0.85)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  joinText: {
    fontSize: 12,
    color: '#60626A',
    fontWeight: '500',
  },
  joinStar: { fontSize: 12 },
  joinName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A0EED',
  },

  // Gift notice
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF4EC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#E8944A',
  },
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
  giftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE9D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftImg: {
    width: 24,
    height: 24,
  },
  giftText: { flex: 1, fontSize: 13, lineHeight: 18 },
  giftSender: { fontWeight: '700', color: '#E8944A' },
  giftMid: { color: '#60626A' },
  giftName: { fontWeight: '700', color: '#7A0EED' },
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
  bubbleBlock: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1E22',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
