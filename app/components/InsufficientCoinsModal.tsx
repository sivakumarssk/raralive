import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  friendZoneCallSessionStore,
  getFriendZoneCallSessionState,
  subscribeFriendZoneCallSession,
} from '@/store/friend-zone-call-session-store';

// Global popup for when a Friend Zone call can't start or continue because
// the caller doesn't have enough coins. Mounted at the root alongside
// IncomingCallOverlay so it shows up regardless of which screen the caller
// is on when the backend ends the call for this reason.
export function InsufficientCoinsModal() {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeFriendZoneCallSession, getFriendZoneCallSessionState);

  const visible = session.phase === 'ended' && session.endReason === 'insufficient_coins';
  if (!visible) return null;

  const handleRecharge = () => {
    friendZoneCallSessionStore.dismissEnded();
    router.push('/wallet' as any);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="wallet-outline" size={30} color="#7A0EED" />
          </View>

          <Text style={styles.title}>Insufficient Coins</Text>
          <Text style={styles.message}>
            You don't have enough coins to continue this call. Recharge your wallet to keep calling.
          </Text>

          <TouchableOpacity style={styles.rechargeBtn} onPress={handleRecharge} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.rechargeBtnText}>Recharge Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => friendZoneCallSessionStore.dismissEnded()}
            activeOpacity={0.75}>
            <Text style={styles.dismissBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#6A6D77',
    textAlign: 'center',
    lineHeight: 19,
  },
  rechargeBtn: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7A0EED',
    borderRadius: 14,
    paddingVertical: 13,
  },
  rechargeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dismissBtn: {
    marginTop: 6,
    paddingVertical: 10,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B8D96',
  },
});
