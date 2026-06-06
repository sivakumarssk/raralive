import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Friend = {
  id: string;
  name: string;
  age: number;
  avatarUri?: string;
  canAudio: boolean;
  canVideo: boolean;
};

type FriendZoneScreenProps = {
  receiveCalls: boolean;
  videoCalls: boolean;
  onReceiveCallsToggle: (v: boolean) => void;
  onVideoCallToggle: (v: boolean) => void;
  friends: Friend[];
  onAudioCall: (friend: Friend) => void;
  onVideoCall: (friend: Friend) => void;
  onHistoryPress: () => void;
};

// ── Friend Row ────────────────────────────────────────────────────────────────

function FriendRow({ friend, onAudio, onVideo }: {
  friend: Friend;
  onAudio: () => void;
  onVideo: () => void;
}) {
  return (
    <View style={row.container}>
      <View style={row.avatarWrap}>
        {friend.avatarUri ? (
          <Image source={{ uri: friend.avatarUri }} style={row.avatar} />
        ) : (
          <View style={[row.avatar, row.avatarFallback]}>
            <Text style={row.avatarInitial}>{friend.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={row.onlineDot} />
      </View>

      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>{friend.name}</Text>
        <Text style={row.age}>{friend.age}Y</Text>
      </View>

      <View style={row.actions}>
        {friend.canAudio && (
          <TouchableOpacity onPress={onAudio} activeOpacity={0.85} style={row.actionBtn}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={row.actionGrad}>
              <Ionicons name="call" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        {friend.canVideo && (
          <TouchableOpacity onPress={onVideo} activeOpacity={0.85} style={row.actionBtn}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={row.actionGrad}>
              <Ionicons name="videocam" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Toggle Row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={toggle.row}>
      <Text style={toggle.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E0DDED', true: '#7A0EED' }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E0DDED"
      />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function FriendZoneScreen({
  receiveCalls, videoCalls,
  onReceiveCallsToggle, onVideoCallToggle,
  friends, onAudioCall, onVideoCall, onHistoryPress,
}: FriendZoneScreenProps) {
  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Toggles */}
      <View style={s.togglesCard}>
        <ToggleRow label="Receive calls" value={receiveCalls} onChange={onReceiveCallsToggle} />
        <View style={s.divider} />
        <ToggleRow label="Video call" value={videoCalls} onChange={onVideoCallToggle} />
      </View>

      {/* Section header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Active Friends</Text>
        <TouchableOpacity onPress={onHistoryPress} activeOpacity={0.75} style={s.historyBtn}>
          <Ionicons name="time-outline" size={16} color="#7A0EED" />
        </TouchableOpacity>
      </View>

      {/* Friends list */}
      {friends.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={36} color="#D8D3EC" />
          <Text style={s.emptyText}>No active friends right now</Text>
        </View>
      ) : (
        <View style={s.listCard}>
          {friends.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <View style={s.rowDivider} />}
              <FriendRow friend={f} onAudio={() => onAudioCall(f)} onVideo={() => onVideoCall(f)} />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F3FA' },
  content: { paddingTop: 12, paddingHorizontal: 16 },
  togglesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 16,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0EDF8',
    marginHorizontal: -16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: -0.2,
  },
  historyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0EDF8',
    marginLeft: 68,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#B0AEC0',
    fontWeight: '500',
  },
});

const toggle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1E22',
  },
});

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 42,
    height: 42,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7A0EED',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: -0.1,
  },
  age: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ABADB2',
  },
  actions: {
    flexDirection: 'row',
    gap: 7,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
