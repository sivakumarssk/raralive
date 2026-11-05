import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { avatarSource } from '@/utils/default-avatar';

// Short-lived "Welcome <name>" pill at the bottom-left of the chat, with the
// host's small avatar. Slides in, stays 3s, fades out, then calls onDone.
// Remount (new `key`) to show it again for the next person. Tapping it opens
// the joined user's profile popup.
export function WelcomeToast({ name, hostAvatarUri, hostName, onPress, onDone }: {
  name: string;
  hostAvatarUri?: string;
  hostName: string;
  onPress?: () => void;
  onDone: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => { if (finished) onDone(); });
    return () => seq.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });

  return (
    <Animated.View style={[t.wrap, { opacity: anim, transform: [{ translateX }] }]}>
      <TouchableOpacity
        style={t.pill}
        activeOpacity={0.75}
        disabled={!onPress}
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}>
        <Image source={avatarSource(hostAvatarUri)} style={t.avatar} />
        <Text style={t.text} numberOfLines={1}>
          Welcome <Text style={t.name}>{name}</Text>
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const t = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    maxWidth: '70%',
    zIndex: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 2,
    borderRadius: 14,
    backgroundColor: 'rgba(155,92,246)',
  },
  avatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#FFFFFF' },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  text: { flexShrink: 1, fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
  name: { fontWeight: '700' },
});
