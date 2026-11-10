import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { ROOM_NAME_MAX, charCount, limitChars } from '@/utils/text-limits';
import { ROOM_TAGS } from '../room-tags';
import { LocationPicker, type PickedLocation } from './location-picker';

const BRAND_GRADIENT = ['#7A0EED', '#FF1A8C'] as const;
const MAX_TAGS = 2;

// One scale for the whole sheet so every row lines up.
const C = {
  brand: '#7A0EED',
  label: '#6A11D8',
  title: '#1E1446',
  text: '#2E1F5E',
  muted: '#8C8AA0',
  placeholder: '#A9A6BC',
  border: '#DDD0F5',
  surface: '#F7F4FD',
  surfaceActive: '#F3E9FF',
  error: '#E2336B',
};
const FIELD_H = 48;   // inputs, location and the Create button
const RADIUS = 14;    // every box
const PAD_X = 14;     // inner left/right padding of every box
const ICON = 20;      // leading icon in every box
const ROW_GAP = 10;   // icon ↔ text inside a box
const SECTION_GAP = 18;

const BASE = BASE_URL;

type Visibility = 'public' | 'private';

type FormErrors = {
  name?: string;
  agentCode?: string;
  tags?: string;
  location?: string;
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

  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Re-sync default when sheet opens
  useEffect(() => {
    if (visible) setVisibility(hasPublic ? 'private' : 'public');
  }, [visible, hasPublic]);

  // Tags are optional, at most MAX_TAGS.
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
      if (errors.tags) setErrors(p => ({ ...p, tags: undefined }));
      return;
    }
    if (selectedTags.length >= MAX_TAGS) {
      setErrors(p => ({ ...p, tags: `You can pick up to ${MAX_TAGS} tags.` }));
      return;
    }
    setSelectedTags(prev => [...prev, tag]);
    if (errors.tags) setErrors(p => ({ ...p, tags: undefined }));
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Room name is required.';
    if (visibility === 'public' && !agentCode.trim()) next.agentCode = 'Agent code is required for public rooms.';
    if (!location) next.location = 'Select your location.';
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
          ...(location && { city: location.city, state: location.state }),
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
    setLocation(null);
    setShowLocationPicker(false);
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
            <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sheet.headerIcon}>
              <MaterialCommunityIcons name="chat" size={18} color="#FFFFFF" />
            </LinearGradient>
            <Text style={sheet.headerTitle}>Create Chat Room</Text>
            <TouchableOpacity onPress={handleClose} style={sheet.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={sheet.scrollContent}>

            {/* Room name */}
            <View style={sheet.field}>
              <Text style={sheet.label}>Room name</Text>
              <View style={[sheet.inputBox, errors.name && sheet.inputBoxError]}>
                <Ionicons name="chatbubble-outline" size={ICON} color={C.brand} />
                <TextInput
                  style={sheet.input}
                  placeholder="Give your room a name"
                  placeholderTextColor={C.placeholder}
                  value={name}
                  onChangeText={v => {
                    // Any text (emoji, fancy fonts) — counted as people see it
                    setName(limitChars(v, ROOM_NAME_MAX));
                    if (errors.name) setErrors(p => ({ ...p, name: undefined }));
                  }}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                />
                <Text style={sheet.charCount}>{charCount(name)}/{ROOM_NAME_MAX}</Text>
              </View>
              {errors.name ? <Text style={sheet.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Visibility — only show if both aren't taken; hide taken option */}
            {!(hasPublic && hasPrivate) && (
              <View style={sheet.field}>
                <Text style={sheet.label}>Visibility</Text>
                <View style={sheet.radioRow}>
                  {!hasPublic && (
                    <TouchableOpacity
                      style={[sheet.radioCard, visibility === 'public' && sheet.radioCardActive]}
                      onPress={() => setVisibility('public')}
                      activeOpacity={0.85}>
                      <View style={[sheet.radioOuter, visibility === 'public' && sheet.radioOuterActive]}>
                        {visibility === 'public' && <View style={sheet.radioInner} />}
                      </View>
                      <Ionicons name="earth" size={ICON} color={visibility === 'public' ? C.brand : C.muted} />
                      <View style={sheet.radioTextBlock}>
                        <Text numberOfLines={1} style={[sheet.radioTitle, visibility === 'public' && sheet.radioTitleActive]}>Public</Text>
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
                      <Ionicons name="lock-closed" size={ICON} color={visibility === 'private' ? C.brand : C.muted} />
                      <View style={sheet.radioTextBlock}>
                        <Text numberOfLines={1} style={[sheet.radioTitle, visibility === 'private' && sheet.radioTitleActive]}>Private</Text>
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
                  <Text style={sheet.label}>Agent code</Text>
                  <View style={sheet.requiredBadge}>
                    <Text style={sheet.requiredText}>Required</Text>
                  </View>
                </View>
                <View style={[sheet.inputBox, errors.agentCode && sheet.inputBoxError]}>
                  <MaterialCommunityIcons name="card-account-details" size={ICON} color={C.brand} />
                  <TextInput
                    style={sheet.input}
                    placeholder="Enter your agent code"
                    placeholderTextColor={C.placeholder}
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

            {/* Location — state → city picker */}
            <View style={sheet.field}>
              <Text style={sheet.label}>Location</Text>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(true)}
                activeOpacity={0.85}
                style={[sheet.locationSelect, location && sheet.locationSelectFilled, errors.location && sheet.inputBoxError]}>
                <MaterialCommunityIcons name="map-marker" size={ICON} color={C.brand} />
                <Text style={[sheet.locationText, !location && sheet.locationPlaceholder]} numberOfLines={1}>
                  {location ? `${location.city}, ${location.state}` : 'Select state & city'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={C.brand} />
              </TouchableOpacity>
              {errors.location ? <Text style={sheet.errorText}>{errors.location}</Text> : null}
            </View>

            {/* Tags */}
            <View style={sheet.field}>
              <View style={sheet.labelBlock}>
                <Text style={sheet.label}>Select tags</Text>
                <Text style={sheet.hint}>Optional · pick up to {MAX_TAGS} tags that describe your room.</Text>
              </View>
              <View style={sheet.tagsWrap}>
                {ROOM_TAGS.map(tag => {
                  const active = selectedTags.includes(tag.label);
                  const atLimit = !active && selectedTags.length >= MAX_TAGS;
                  const content = (
                    <>
                      <MaterialCommunityIcons name={tag.icon} size={14} color={active ? '#FFFFFF' : tag.color} />
                      <Text style={[sheet.tagText, active && sheet.tagTextActive]}>{tag.label}</Text>
                      {active && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                    </>
                  );
                  return (
                    <TouchableOpacity key={tag.label} onPress={() => toggleTag(tag.label)} activeOpacity={0.8}>
                      {active ? (
                        <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[sheet.tag, sheet.tagActive]}>
                          {content}
                        </LinearGradient>
                      ) : (
                        <View style={[sheet.tag, atLimit && sheet.tagDimmed]}>{content}</View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.tags ? <Text style={sheet.errorText}>{errors.tags}</Text> : null}
            </View>

            {errors.api ? (
              <View style={sheet.apiErrorCard}>
                <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                <Text style={sheet.apiErrorText}>{errors.api}</Text>
              </View>
            ) : null}

          </ScrollView>

          <TouchableOpacity onPress={handleCreate} activeOpacity={0.9} style={sheet.createBtn} disabled={submitting}>
            <LinearGradient
              colors={BRAND_GRADIENT}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={sheet.createBtnGradient}>
              {submitting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="add-circle-outline" size={ICON} color="#FFFFFF" />}
              <Text style={sheet.createBtnLabel}>{submitting ? 'Creating…' : 'Create Room'}</Text>
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {showLocationPicker && (
        <LocationPicker
          initial={location}
          onClose={() => setShowLocationPicker(false)}
          onConfirm={picked => {
            setLocation(picked);
            setShowLocationPicker(false);
            if (errors.location) setErrors(p => ({ ...p, location: undefined }));
          }}
        />
      )}
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kavWrapper: { flex: 1, justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#FCFBFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D9D3EA', alignSelf: 'center', marginBottom: 14 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, marginBottom: SECTION_GAP },
  headerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: C.title, letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFEBF8', alignItems: 'center', justifyContent: 'center' },

  // Sections
  scrollContent: { gap: SECTION_GAP, paddingBottom: 4 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelBlock: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: C.label },
  requiredBadge: { backgroundColor: '#FFE9F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  requiredText: { fontSize: 10, fontWeight: '700', color: C.error },
  hint: { fontSize: 12, color: C.muted },
  errorText: { fontSize: 12, fontWeight: '500', color: C.error },

  // Text inputs
  inputBox: {
    height: FIELD_H, borderRadius: RADIUS, backgroundColor: '#FFFFFF',
    borderWidth: 1.2, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD_X, gap: ROW_GAP,
  },
  inputBoxError: { borderColor: '#F07A9C' },
  input: { flex: 1, fontSize: 14, fontWeight: '500', color: C.text, padding: 0 },
  charCount: { fontSize: 12, fontWeight: '500', color: C.muted },

  // Visibility
  radioRow: { flexDirection: 'row', gap: ROW_GAP },
  radioCard: {
    // A little taller than the inputs so the subtitle shows in full
    flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: ROW_GAP,
    paddingHorizontal: PAD_X, paddingVertical: 8, borderRadius: RADIUS, backgroundColor: C.surface,
    borderWidth: 1.2, borderColor: '#ECE7F7',
  },
  radioCardActive: { borderColor: C.brand, backgroundColor: C.surfaceActive },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#B4AFC6', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: C.brand },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand },
  radioTextBlock: { flex: 1 },
  radioTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  radioTitleActive: { color: C.text },
  radioSub: { fontSize: 11, color: C.muted },

  // Location
  locationSelect: {
    height: FIELD_H, borderRadius: RADIUS, backgroundColor: C.surfaceActive,
    borderWidth: 1.2, borderColor: '#E4D8F8',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD_X, gap: ROW_GAP,
  },
  locationSelectFilled: { borderColor: C.brand },
  locationText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  locationPlaceholder: { color: C.label },

  // Tags — same weight selected or not, so picking one doesn't shift the row
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 32, paddingHorizontal: 10,
    borderRadius: 16, backgroundColor: C.surface,
    borderWidth: 1.2, borderColor: '#ECE7F7',
  },
  tagActive: { borderColor: 'transparent' },
  tagDimmed: { opacity: 0.45 },
  tagText: { fontSize: 12, fontWeight: '600', color: C.text },
  tagTextActive: { color: '#FFFFFF' },

  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F3', borderRadius: RADIUS, paddingHorizontal: PAD_X, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FFCDD8',
  },
  apiErrorText: { flex: 1, fontSize: 13, fontWeight: '500', color: C.error, lineHeight: 18 },

  // Create button
  createBtn: {
    marginTop: 14, borderRadius: 24, overflow: 'hidden',
    shadowColor: C.brand, shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  createBtnGradient: { height: FIELD_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ROW_GAP },
  createBtnLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
