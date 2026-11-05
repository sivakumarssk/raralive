import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RS, RT } from '../room-ui';

/** Guidance shown on every report popup — reports are only for rule-breaking. */
export const REPORT_GUIDANCE =
  'Only report when someone breaks the Chat Room rules. False or repeated reports are not counted and may lead to action on your account.';

/** Listed first in every report popup — required by Play's Child Safety Standards policy. */
export const CHILD_SAFETY_REASON = 'Child safety concern (involves a minor)';

/** Reasons for reporting a user — room profile card and the full profile page. */
export const USER_REPORT_REASONS = [
  CHILD_SAFETY_REASON,
  'Inappropriate profile photo',
  'Abuse or hate speech',
  'Sexual content',
  'Spam or scam',
  'Fake account / impersonation',
  'Sharing private information',
  'Something else',
];

// RaraLive report popup — shared by "Report Chatroom" and "Report User".
// Title + question, selectable reason rows, Cancel + gradient Submit.
// onSubmit resolves to null on success, or an error message to show.
export function ReportReasonModal({ visible, title, subtitle, notice, reasons, onClose, onSubmit }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Short guidance under the question (e.g. REPORT_GUIDANCE) */
  notice?: string;
  reasons: string[];
  onClose: () => void;
  onSubmit: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) { setReason(null); setSending(false); setError(''); setSent(false); }
  }, [visible]);

  if (!visible) return null;

  const submit = async () => {
    if (!reason) { setError('Please choose a reason.'); return; }
    setSending(true);
    setError('');
    const err = await onSubmit(reason);
    setSending(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.wrap} pointerEvents="box-none">
        <View style={s.card}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="#60626A" />
          </TouchableOpacity>

          {sent ? (
            <View style={s.sentWrap}>
              <Ionicons name="checkmark-circle" size={36} color="#22B45A" />
              <Text style={[s.title, s.center]}>Report submitted</Text>
              <Text style={[s.subtitle, s.center]}>Thanks for keeping RaRa Live safe. Our team will review it.</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={s.fullBtn}>
                <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                  <Text style={s.gradBtnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={s.head}>
                <Text style={s.title}>{title}</Text>
                <Text style={s.subtitle}>{subtitle ?? 'Why are you reporting this?'}</Text>
              </View>
              {!!notice && (
                <View style={s.notice}>
                  <Ionicons name="information-circle-outline" size={15} color="#7A0EED" />
                  <Text style={s.noticeText}>{notice}</Text>
                </View>
              )}

              <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
                {reasons.map(r => {
                  const selected = reason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => { setReason(r); if (error) setError(''); }}
                      activeOpacity={0.8}
                      style={[s.reason, selected && s.reasonOn]}>
                      <Text style={[s.reasonText, selected && s.reasonTextOn]}>{r}</Text>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={selected ? '#7A0EED' : '#D0CDE0'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {!!error && <Text style={s.error}>{error}</Text>}

              <View style={s.btnRow}>
                <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={sending}
                  activeOpacity={0.85}
                  style={[s.submitWrap, !reason && s.submitDim]}>
                  <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                    {sending
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Text style={s.gradBtnText}>Submit</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,10,40,0.55)' },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RS.cardRadius,
    padding: RS.pad,
    maxHeight: '86%',
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    width: RS.close, height: RS.close, borderRadius: RS.close / 2, backgroundColor: '#F4F3F8',
    alignItems: 'center', justifyContent: 'center',
  },

  head: { marginBottom: 12, paddingRight: RS.close + 8 },
  title: { fontSize: RT.title, fontWeight: '700', color: '#1C1E22' },
  subtitle: { fontSize: RT.secondary, color: '#8A8C93', marginTop: 2, lineHeight: 17 },
  center: { textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10 },
  noticeText: { flex: 1, fontSize: RT.caption, lineHeight: 15, color: '#60626A' },

  list: { flexGrow: 0 },
  listContent: { gap: 6 },
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, borderColor: '#EEEBF6', backgroundColor: '#FAF9FD',
  },
  reasonOn: { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  reasonText: { flex: 1, fontSize: RT.body, color: '#3A3C42' },
  reasonTextOn: { color: '#5A0BB0', fontWeight: '600' },

  error: { fontSize: RT.secondary, color: '#E14C57', marginTop: 8, textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1, height: RS.button, borderRadius: RS.button / 2, backgroundColor: '#F4F3F8',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: RT.button, fontWeight: '700', color: '#60626A' },
  submitWrap: { flex: 1, borderRadius: RS.button / 2, overflow: 'hidden' },
  submitDim: { opacity: 0.6 },
  fullBtn: { alignSelf: 'stretch', borderRadius: RS.button / 2, overflow: 'hidden', marginTop: 14 },
  gradBtn: { height: RS.button, alignItems: 'center', justifyContent: 'center' },
  gradBtnText: { fontSize: RT.button, fontWeight: '700', color: '#FFFFFF' },

  sentWrap: { alignItems: 'center', gap: 4, paddingTop: 4 },
});
