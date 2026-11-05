import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { CHILD_SAFETY_REASON, REPORT_GUIDANCE, ReportReasonModal } from './report-reason-modal';

export type SupportKind = 'help' | 'report';

const COPY: Record<'help', { title: string; hint: string; placeholder: string }> = {
  help: {
    title: 'Chatroom Help & Support',
    hint: 'Tell us what you need help with. Our team will review it.',
    placeholder: 'Write your message...',
  },
};

const MAX_LEN = 2000;

const CHATROOM_REPORT_REASONS = [
  CHILD_SAFETY_REASON,
  'Offensive chatroom name',
  'Inappropriate profile photo',
  'Abuse or hate speech',
  'Sexual content',
  'Spam or scam',
  'Fake account / impersonation',
  'Sharing private information',
  'Something else',
];

// Help: popup to write a message for the current chatroom. Report: reason picker.
// Submitted messages show in the admin panel under "Support".
export function SupportSheet({ kind, roomId, onClose }: {
  kind: SupportKind | null;
  roomId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (kind) { setMessage(''); setError(''); setSent(false); setSending(false); }
  }, [kind]);

  // Sends to the admin "Support" page. Resolves to null on success, else an error.
  const post = async (type: SupportKind, text: string): Promise<string | null> => {
    try {
      const token = authStore.getToken();
      const res = await fetch(`${BASE_URL}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type, room_id: roomId || null, message: text }),
      });
      const json = await res.json();
      return json.success ? null : (json.message || 'Could not send. Please try again.');
    } catch {
      return 'Network error. Please try again.';
    }
  };

  if (!kind) return null;

  // Chat room report → moderation (3 different reporters ban the room for 24h)
  const reportRoom = async (reason: string): Promise<string | null> => {
    if (!roomId) return 'Something went wrong.';
    try {
      const token = authStore.getToken();
      const res = await fetch(`${BASE_URL}/reports/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && json.success ? null : (json.message || 'Could not send. Please try again.');
    } catch {
      return 'Network error. Please try again.';
    }
  };

  if (kind === 'report') {
    return (
      <ReportReasonModal
        visible
        title="Report Chatroom"
        subtitle="What's wrong with this chatroom?"
        notice={REPORT_GUIDANCE}
        reasons={CHATROOM_REPORT_REASONS}
        onClose={onClose}
        onSubmit={reportRoom}
      />
    );
  }

  const copy = COPY[kind];

  const submit = async () => {
    const text = message.trim();
    if (!text) { setError('Please write a message.'); return; }
    setSending(true);
    setError('');
    const err = await post('help', text);
    setSending(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={s.backdrop} />
        </TouchableWithoutFeedback>

        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>{copy.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Ionicons name="close" size={16} color="#60626A" />
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={s.sentWrap}>
              <Ionicons name="checkmark-circle" size={44} color="#22B45A" />
              <Text style={s.sentTitle}>Message sent</Text>
              <Text style={s.hint}>Thanks! Our team will look into it.</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={s.submitBtn}>
                <Text style={s.submitText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.hint}>{copy.hint}</Text>
              <TextInput
                style={s.input}
                value={message}
                onChangeText={t => { setMessage(t); if (error) setError(''); }}
                placeholder={copy.placeholder}
                placeholderTextColor="#ABADB2"
                multiline
                maxLength={MAX_LEN}
                textAlignVertical="top"
                autoFocus
              />
              <View style={s.metaRow}>
                <Text style={s.error} numberOfLines={2}>{error}</Text>
                <Text style={s.count}>{message.length}/{MAX_LEN}</Text>
              </View>
              <TouchableOpacity
                onPress={submit}
                disabled={sending}
                activeOpacity={0.85}
                style={[s.submitBtn, sending && s.submitBtnDisabled]}>
                {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.submitText}>Submit</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F4F3F8', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: '#8A8C93', lineHeight: 17, textAlign: 'left' },
  input: {
    marginTop: 12,
    minHeight: 110,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E4F2',
    backgroundColor: '#F7F5FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1E22',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  error: { flex: 1, fontSize: 12, color: '#E14C57' },
  count: { fontSize: 11, color: '#ABADB2' },
  submitBtn: {
    marginTop: 12, height: 40, borderRadius: 20, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  sentWrap: { alignItems: 'center', paddingTop: 8, gap: 6 },
  sentTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },

});
