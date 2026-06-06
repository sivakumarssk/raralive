import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BASE_URL, type MyRoom } from '@/services/api';
import { authStore } from '@/store/auth-store';

const TAGS = [
  'Music', 'Gaming', 'Talk', 'Comedy', 'Podcast',
  'EDM', 'Hip-Hop', 'Sports', 'News', 'Tech',
  'Chill', 'Study', 'Fitness', 'Art', 'Food',
];

const BASE = BASE_URL;

type Visibility = 'public' | 'private';

type FormErrors = {
  name?: string;
  agentCode?: string;
  tags?: string;
  api?: string;
};

type CreateRoomSheetProps = {
  visible: boolean;
  onClose: () => void;
  hasPublic: boolean;
  hasPrivate: boolean;
  onCreated?: (room: MyRoom) => void;
};

export function CreateRoomSheet({ visible, onClose, hasPublic, hasPrivate, onCreated }: CreateRoomSheetProps) {
  const insets = useSafeAreaInsets();

  // Auto-select the only remaining option
  const defaultVisibility: Visibility = hasPublic ? 'private' : 'public';

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [agentCode, setAgentCode] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Re-sync default when sheet opens
  useEffect(() => {
    if (visible) setVisibility(hasPublic ? 'private' : 'public');
  }, [visible, hasPublic]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    if (errors.tags) setErrors(p => ({ ...p, tags: undefined }));
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Room name is required.';
    if (visibility === 'public' && !agentCode.trim()) next.agentCode = 'Agent code is required for public rooms.';
    if (selectedTags.length === 0) next.tags = 'Select at least one tag.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});

    try {
      const token = authStore.getToken();
      const res = await fetch(`${BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          room_name: name.trim(),
          ...(visibility === 'public' && { agent_code: agentCode.trim() }),
          visibility,
          tags: selectedTags,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrors({ api: json.message || 'Failed to create room.' });
        setSubmitting(false);
        return;
      }
      onCreated?.(json.data as MyRoom);
      handleClose();
    } catch {
      setErrors({ api: 'Network error. Check your connection.' });
    }

    setSubmitting(false);
  };

  const handleClose = () => {
    setName('');
    setAgentCode('');
    setSelectedTags([]);
    setErrors({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableOpacity style={sheet.overlay} activeOpacity={1} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={sheet.kavWrapper}>
        <View style={[sheet.container, { paddingBottom: insets.bottom + 16 }]}>

          <View style={sheet.handle} />

          <View style={sheet.headerRow}>
            <Text style={sheet.headerTitle}>Create Chat Room</Text>
            <TouchableOpacity onPress={handleClose} style={sheet.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color="#60626A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={sheet.scrollContent}>

            {/* Room name */}
            <View style={sheet.field}>
              <Text style={sheet.label}>ROOM NAME</Text>
              <View style={[sheet.inputBox, errors.name && sheet.inputBoxError]}>
                <Ionicons name="chatbubbles-outline" size={18} color="#7A0EED" />
                <TextInput
                  style={sheet.input}
                  placeholder="Give your room a name"
                  placeholderTextColor="#ABADB2"
                  value={name}
                  onChangeText={v => {
                    setName(v);
                    if (errors.name) setErrors(p => ({ ...p, name: undefined }));
                  }}
                  maxLength={40}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                />
                <Text style={sheet.charCount}>{name.length}/40</Text>
              </View>
              {errors.name ? <Text style={sheet.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Visibility — only show if both aren't taken; hide taken option */}
            {!(hasPublic && hasPrivate) && (
              <View style={sheet.field}>
                <Text style={sheet.label}>VISIBILITY</Text>
                <View style={sheet.radioRow}>
                  {!hasPublic && (
                    <TouchableOpacity
                      style={[sheet.radioCard, visibility === 'public' && sheet.radioCardActive]}
                      onPress={() => setVisibility('public')}
                      activeOpacity={0.85}>
                      <View style={[sheet.radioOuter, visibility === 'public' && sheet.radioOuterActive]}>
                        {visibility === 'public' && <View style={sheet.radioInner} />}
                      </View>
                      <Ionicons name="earth-outline" size={20} color={visibility === 'public' ? '#7A0EED' : '#ABADB2'} />
                      <View style={sheet.radioTextBlock}>
                        <Text style={[sheet.radioTitle, visibility === 'public' && sheet.radioTitleActive]}>Public</Text>
                        <Text style={sheet.radioSub}>Anyone can join</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {!hasPrivate && (
                    <TouchableOpacity
                      style={[sheet.radioCard, visibility === 'private' && sheet.radioCardActive]}
                      onPress={() => setVisibility('private')}
                      activeOpacity={0.85}>
                      <View style={[sheet.radioOuter, visibility === 'private' && sheet.radioOuterActive]}>
                        {visibility === 'private' && <View style={sheet.radioInner} />}
                      </View>
                      <Ionicons name="lock-closed-outline" size={20} color={visibility === 'private' ? '#7A0EED' : '#ABADB2'} />
                      <View style={sheet.radioTextBlock}>
                        <Text style={[sheet.radioTitle, visibility === 'private' && sheet.radioTitleActive]}>Private</Text>
                        <Text style={sheet.radioSub}>Invite only</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Agent code — only for public rooms */}
            {visibility === 'public' && (
              <View style={sheet.field}>
                <View style={sheet.labelRow}>
                  <Text style={sheet.label}>AGENT CODE</Text>
                  <View style={sheet.requiredBadge}>
                    <Text style={sheet.requiredText}>REQUIRED</Text>
                  </View>
                </View>
                <View style={[sheet.inputBox, errors.agentCode && sheet.inputBoxError]}>
                  <Ionicons name="key-outline" size={18} color="#7A0EED" />
                  <TextInput
                    style={sheet.input}
                    placeholder="Enter your agent code"
                    placeholderTextColor="#ABADB2"
                    value={agentCode}
                    onChangeText={v => {
                      setAgentCode(v);
                      if (errors.agentCode) setErrors(p => ({ ...p, agentCode: undefined }));
                    }}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    underlineColorAndroid="transparent"
                  />
                </View>
                {errors.agentCode ? <Text style={sheet.errorText}>{errors.agentCode}</Text> : null}
              </View>
            )}

            {/* Tags */}
            <View style={sheet.field}>
              <Text style={sheet.label}>SELECT TAGS</Text>
              <Text style={sheet.hint}>Pick tags that describe your room.</Text>
              <View style={sheet.tagsWrap}>
                {TAGS.map(tag => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.8}
                      style={[sheet.tag, active && sheet.tagActive]}>
                      {active && <Ionicons name="checkmark" size={12} color="#FFFFFF" style={sheet.tagCheck} />}
                      <Text style={[sheet.tagText, active && sheet.tagTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.tags ? <Text style={sheet.errorText}>{errors.tags}</Text> : null}
            </View>

            {errors.api ? (
              <View style={sheet.apiErrorCard}>
                <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                <Text style={sheet.apiErrorText}>{errors.api}</Text>
              </View>
            ) : null}

          </ScrollView>

          <TouchableOpacity onPress={handleCreate} activeOpacity={0.9} style={sheet.createBtn} disabled={submitting}>
            <LinearGradient
              colors={['#7A0EED', '#B50357']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={sheet.createBtnGradient}>
              {submitting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />}
              <Text style={sheet.createBtnLabel}>{submitting ? 'Creating…' : 'Create Room'}</Text>
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kavWrapper: { flex: 1, justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 20, paddingBottom: 12 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: '700', color: '#7A0EED', letterSpacing: 1.2 },
  requiredBadge: { backgroundColor: '#FFF0F1', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  requiredText: { fontSize: 9, fontWeight: '700', color: '#E14C57', letterSpacing: 0.5 },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#F7F5FF',
    borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  inputBoxError: { borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, color: '#1C1E22' },
  charCount: { fontSize: 11, color: '#ABADB2', fontWeight: '500' },
  hint: { fontSize: 11, color: '#ABADB2', lineHeight: 16 },
  errorText: { fontSize: 12, color: '#E14C57', fontWeight: '500' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  radioRow: { flexDirection: 'row', gap: 12 },
  radioCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, backgroundColor: '#F7F5FF',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  radioCardActive: { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ABADB2', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#7A0EED' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7A0EED' },
  radioTextBlock: { flex: 1, gap: 1 },
  radioTitle: { fontSize: 13, fontWeight: '600', color: '#60626A' },
  radioTitleActive: { color: '#7A0EED', fontWeight: '700' },
  radioSub: { fontSize: 11, color: '#ABADB2' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F4F5F8',
    borderWidth: 1, borderColor: 'transparent',
  },
  tagActive: { backgroundColor: '#7A0EED', borderColor: '#7A0EED' },
  tagCheck: { marginRight: 4 },
  tagText: { fontSize: 13, fontWeight: '500', color: '#60626A' },
  tagTextActive: { color: '#FFFFFF', fontWeight: '600' },
  createBtn: {
    marginTop: 12, borderRadius: 48, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  createBtnGradient: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createBtnLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
