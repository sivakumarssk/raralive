import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

const COIN_IMG = require('@/assets/tabs/coin.png');

type Duration = { days: number; label: string; coins: number };

// Same fixed client-side pricing table the backend enforces
// (ROOM_NAME_DURATION_PRICING in room.controller.js) — mirrors how battle
// durations/targets are hardcoded client constants in battle-modal.tsx.
const DURATIONS: Duration[] = [
  { days: 1,  label: '1 Day',   coins: 100 },
  { days: 7,  label: '7 Days',  coins: 500 },
  { days: 30, label: '30 Days', coins: 1500 },
  { days: 90, label: '90 Days', coins: 4000 },
];

type EditRoomNameScreenProps = {
  roomId: string;
  currentName: string;
};

type RenameResult = { room_name: string; room_name_expires_at: string | null };

function durationLabelFor(days: number): string {
  const match = DURATIONS.find(d => d.days === days);
  return match ? match.label : `${days} Day${days === 1 ? '' : 's'}`;
}

function formatValidTill(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

export function EditRoomNameScreen({ roomId, currentName }: EditRoomNameScreenProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState(1);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showInsufficientCoins, setShowInsufficientCoins] = useState(false);
  const [successResult, setSuccessResult] = useState<RenameResult | null>(null);

  useEffect(() => { setNewName(''); setError(''); }, [roomId]);

  const trimmed = newName.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const token = authStore.getToken();
      const res = await fetch(`${BASE_URL}/rooms/${roomId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ room_name: trimmed, duration_days: selectedDays }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.code === 'INSUFFICIENT_COINS') {
          setSubmitting(false);
          setShowInsufficientCoins(true);
          return;
        }
        setError(json.message || 'Failed to change chatroom name.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setSuccessResult({ room_name: json.data.room_name, room_name_expires_at: json.data.room_name_expires_at ?? null });
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Chatroom Name</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Current name */}
          <View style={s.currentCard}>
            <Text style={s.currentLabel}>Current Chatroom Name</Text>
            <Text style={s.currentValue} numberOfLines={1}>{currentName}</Text>
          </View>

          {/* Duration */}
          <Text style={s.sectionLabel}>Select Duration</Text>
          <View style={s.durationRow}>
            {DURATIONS.map(d => {
              const active = selectedDays === d.days;
              return (
                <TouchableOpacity
                  key={d.days}
                  onPress={() => setSelectedDays(d.days)}
                  activeOpacity={0.8}
                  style={[s.durationCard, active && s.durationCardActive]}>
                  <Text style={[s.durationLabel, active && s.durationLabelActive]}>{d.label}</Text>
                  <Image source={COIN_IMG} style={s.coinIcon} />
                  <Text style={[s.priceText, active && s.priceTextActive]}>{d.coins}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* New name input */}
          <Text style={s.sectionLabel}>Enter New Chatroom Name</Text>
          <View style={s.inputRow}>
            <View style={s.inputAccent} />
            <View style={[s.inputBox, !!error && s.inputBoxError]}>
              <TextInput
                value={newName}
                onChangeText={v => { setNewName(v); if (error) setError(''); }}
                placeholder={currentName}
                placeholderTextColor="#ABADB2"
                style={s.input}
                maxLength={20}
                returnKeyType="done"
              />
              <Text style={s.charCount}>{newName.length}/20</Text>
            </View>
          </View>

          {!!error && (
            <View style={s.errorCard}>
              <Ionicons name="alert-circle-outline" size={14} color="#E14C57" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Note */}
          <View style={s.noteCard}>
            <Ionicons name="lock-closed" size={13} color="#7A0EED" style={s.noteIcon} />
            <View style={s.noteTextBlock}>
              <Text style={s.noteTitle}>Note</Text>
              <Text style={s.noteText}>
                After the selected duration expires, your chatroom name will automatically revert to the previous name.
              </Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Outside KeyboardAvoidingView so it stays pinned to the screen bottom
          instead of sliding up with the keyboard. */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.9}
          disabled={!canSubmit}
          style={[s.okBtn, !canSubmit && s.okBtnDisabled]}>
          {submitting
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.okBtnText}>Change</Text>}
        </TouchableOpacity>
      </View>

      {/* Success — Chatroom Name Updated */}
      <Modal visible={!!successResult} transparent animationType="fade" statusBarTranslucent>
        <View style={m.backdrop}>
          <View style={m.card}>
            <View style={m.successIconWrap}>
              <Ionicons name="checkmark" size={30} color="#FFFFFF" />
            </View>
            <Text style={m.successTitle}>Chatroom Name Updated!</Text>
            <Text style={m.successMessage}>Your chatroom name has been updated successfully.</Text>

            <View style={m.resultCard}>
              <Text style={m.resultLabel}>New Chatroom Name</Text>
              <View style={m.resultNameRow}>
                <Text style={m.resultName} numberOfLines={1}>{successResult?.room_name}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#7A0EED" />
              </View>
              {!!successResult?.room_name_expires_at && (
                <>
                  <Text style={[m.resultLabel, m.validTillLabel]}>Valid Till</Text>
                  <View style={m.validTillRow}>
                    <Ionicons name="calendar-outline" size={13} color="#60626A" />
                    <Text style={m.validTillText}>{formatValidTill(successResult.room_name_expires_at)}</Text>
                    <Text style={m.validTillDuration}>({durationLabelFor(selectedDays)})</Text>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={() => { setSuccessResult(null); router.back(); }}
              activeOpacity={0.9}
              style={m.okBtn}>
              <Text style={m.okBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Insufficient coins — go recharge */}
      <Modal visible={showInsufficientCoins} transparent animationType="fade" statusBarTranslucent>
        <View style={m.backdrop}>
          <View style={m.card}>
            <View style={m.coinsIconWrap}>
              <Ionicons name="wallet-outline" size={28} color="#7A0EED" />
            </View>
            <Text style={m.successTitle}>Insufficient Coins</Text>
            <Text style={m.successMessage}>
              You don't have enough coins for this duration. Recharge your wallet to continue.
            </Text>

            <TouchableOpacity
              onPress={() => { setShowInsufficientCoins(false); router.push('/wallet' as any); }}
              activeOpacity={0.9}
              style={m.okBtn}>
              <Ionicons name="add-circle" size={17} color="#FFFFFF" />
              <Text style={m.okBtnText}>Recharge Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowInsufficientCoins(false)} style={m.dismissBtn} activeOpacity={0.75}>
              <Text style={m.dismissBtnText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBFBFB' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1E22' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },

  currentCard: {
    backgroundColor: '#E9E4F8', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, gap: 4,
  },
  currentLabel: { fontSize: 11, fontWeight: '500', color: '#8A8299' },
  currentValue: { fontSize: 15, fontWeight: '700', color: '#1C1E22' },

  sectionLabel: { fontSize: 12, fontWeight: '500', color: '#8A8C94', marginBottom: 8 },

  durationRow: { flexDirection: 'row', gap: 8 },
  durationCard: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#E8E5F0', borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center', gap: 4,
  },
  durationCardActive: { borderColor: '#7A0EED' },
  durationLabel: { fontSize: 11.5, fontWeight: '600', color: '#1C1E22' },
  durationLabelActive: { color: '#7A0EED' },
  coinIcon: { width: 16, height: 16 },
  priceText: { fontSize: 11.5, fontWeight: '700', color: '#8A8C94' },
  priceTextActive: { color: '#1C1E22' },

  inputRow: { flexDirection: 'row', alignItems: 'stretch' },
  inputAccent: {
    width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: '#7A0EED', marginRight: 10,
  },
  inputBox: {
    flex: 1,
    borderWidth: 1, borderColor: '#E5E1F0', borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18,
  },
  inputBoxError: { borderColor: '#E14C57' },
  input: { fontSize: 14, color: '#1C1E22', padding: 0 },
  charCount: {
    position: 'absolute', right: 12, bottom: 6,
    fontSize: 10, color: '#B8B4C4',
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF0F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  errorText: { flex: 1, fontSize: 11.5, color: '#E14C57', fontWeight: '500' },

  noteCard: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#EEEAFA', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  noteIcon: { marginTop: 2 },
  noteTextBlock: { flex: 1, gap: 2 },
  noteTitle: { fontSize: 12, fontWeight: '700', color: '#1C1E22' },
  noteText: { fontSize: 11, color: '#7A5FC0', lineHeight: 15 },

  bottomBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  okBtn: {
    borderRadius: 24, backgroundColor: '#4A09B6',
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  okBtnDisabled: { backgroundColor: '#D9D3EC' },
  okBtnText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
});

// ── Success / insufficient-coins modals ──────────────────────────────────────
const m = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
  },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 22,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2F6FED',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  coinsIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F0EAFF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: { fontSize: 17, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.2, textAlign: 'center' },
  successMessage: {
    marginTop: 6, fontSize: 12.5, fontWeight: '500', color: '#8A8C94',
    textAlign: 'center', lineHeight: 18,
  },

  resultCard: {
    width: '100%', marginTop: 18,
    backgroundColor: '#F4F1FA', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, gap: 3,
  },
  resultLabel: { fontSize: 10.5, fontWeight: '500', color: '#8A8299' },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1C1E22' },
  validTillLabel: { marginTop: 8 },
  validTillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validTillText: { fontSize: 12.5, fontWeight: '600', color: '#1C1E22' },
  validTillDuration: { fontSize: 11.5, color: '#8A8C94' },

  okBtn: {
    marginTop: 20, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4A09B6', borderRadius: 24, paddingVertical: 14,
  },
  okBtnText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  dismissBtn: { marginTop: 6, paddingVertical: 10 },
  dismissBtnText: { fontSize: 13, fontWeight: '700', color: '#8B8D96' },
});
