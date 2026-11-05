import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { agoraStore } from '@/store/agora-store';
import { roomStore, useMinimizedRoom } from '@/store/room-store';
import { formatRestriction, getActiveRoomId, onJoinBlocked, onKickedFromRoom, socketStore, subscribeSocket, type RoomRestriction } from '@/store/socket-store';

// Floating JOIN bubble for a minimized chat room. Shown only while that room's
// session is still running in the background (room socket + voice kept alive
// by the minimize). Tap → back into the same room on the same connection;
// drag → anywhere on screen. Leaving is done from inside the room (Exit).

const SIZE = 56;
const EDGE = 8;

// Where the user left the bubble — kept for the app session so it stays put
// across screens and across separate minimizes.
let lastPosition: { x: number; y: number } | null = null;

function leaveRoom() {
  agoraStore.leave();
  socketStore.leave();
  roomStore.clear();
}

export function MiniRoomPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const minimized = useMinimizedRoom();

  // Only while the minimized room's socket is still in that room
  const [activeRoomId, setActiveRoomId] = useState(getActiveRoomId);
  useEffect(() => subscribeSocket(() => setActiveRoomId(getActiveRoomId())), []);

  // Removed from the room while minimized — end the session and say why
  useEffect(() => {
    const end = (message: string, info: RoomRestriction) => {
      if (!roomStore.getMinimized()) return;
      leaveRoom();
      Alert.alert('Chat Room', formatRestriction(message, info.expiresAt));
    };
    const unsubKick = onKickedFromRoom(end);
    const unsubBlock = onJoinBlocked(end);
    return () => { unsubKick(); unsubBlock(); };
  }, []);

  // Drag bounds: inside the visible screen, clear of the status bar
  const bounds = {
    minX: EDGE,
    maxX: width - SIZE - EDGE,
    minY: insets.top + EDGE,
    maxY: height - SIZE - insets.bottom - EDGE,
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const clamp = (x: number, y: number) => {
    const b = boundsRef.current;
    return {
      x: Math.min(Math.max(x, b.minX), b.maxX),
      y: Math.min(Math.max(y, b.minY), b.maxY),
    };
  };

  // First time: bottom-right, just above the tab bar (where the old JOIN button sat)
  const position = useRef(new Animated.ValueXY(
    lastPosition ?? clamp(width - SIZE - 20, height - SIZE - insets.bottom - 100),
  )).current;
  const current = useRef(lastPosition ?? clamp(width - SIZE - 20, height - SIZE - insets.bottom - 100));
  const dragStart = useRef(current.current);

  // Screen size changed (rotation, split screen) → pull it back on screen
  useEffect(() => {
    const next = clamp(current.current.x, current.current.y);
    current.current = next;
    lastPosition = next;
    position.setValue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, insets.top, insets.bottom]);

  const panResponder = useRef(PanResponder.create({
    // Only a real drag takes over — a tap still reaches the buttons
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderGrant: () => { dragStart.current = current.current; },
    onPanResponderMove: (_, g) => {
      const next = clamp(dragStart.current.x + g.dx, dragStart.current.y + g.dy);
      current.current = next;
      position.setValue(next);
    },
    onPanResponderRelease: () => { lastPosition = current.current; },
    onPanResponderTerminate: () => { lastPosition = current.current; },
  })).current;

  if (!minimized || activeRoomId !== minimized.roomId) return null;

  const handleOpen = () => {
    // Same session: the room socket and voice are still connected, so the
    // room screen picks its live state straight back up (no new connection).
    router.push({ pathname: '/room/[id]', params: { id: minimized.roomId } });
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.container, { transform: position.getTranslateTransform() }]}>
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.85} accessibilityLabel={`Rejoin ${minimized.roomName}`}>
        <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
          <Ionicons name="enter-outline" size={22} color="#FFFFFF" />
          <Text style={styles.label}>Join</Text>
        </LinearGradient>
        {/* Room still live in the background */}
        <View style={styles.liveDot} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    zIndex: 999,
  },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    elevation: 8,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
