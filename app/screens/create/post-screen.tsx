import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

import type { MediaAsset } from './create-screen';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_W - 32;

// Tags shown as suggestions only — user taps to add or types custom
const TRENDING_TAGS = [
  '#vibecheck', '#raralive', '#ootd', '#weekend',
  '#creative', '#lifestyle', '#music', '#mood',
  '#trending', '#viral', '#fyp', '#explore',
];

const CATEGORIES = [
  { id: 'featured',       label: 'FEATURED',       icon: 'star' as const },
  { id: 'music',          label: 'MUSIC',           icon: 'musical-note' as const },
  { id: 'gaming',         label: 'GAMING',          icon: 'game-controller' as const },
  { id: 'entertainment',  label: 'ENTERTAINMENT',   icon: 'tv' as const },
  { id: 'art',            label: 'ART',             icon: 'color-palette' as const },
  { id: 'sports',         label: 'SPORTS',          icon: 'football' as const },
  { id: 'food',           label: 'FOOD',            icon: 'restaurant' as const },
];


type PostScreenProps = {
  assets: MediaAsset[];
  onBack: () => void;
  onPublish: () => void;
};

export function PostScreen({ assets, onBack, onPublish }: PostScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 56 + bottomInset;

  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('featured');
  const [allowComments, setAllowComments] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const previewRef = useRef<FlatList>(null);

  const MAX_CAPTION = 2200;
  const primary = assets[0];

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) setTags((prev) => [...prev, tag]);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const addCustomTag = () => {
    let raw = customTagInput.trim().replace(/\s+/g, '').toLowerCase();
    if (!raw) return;
    if (!raw.startsWith('#')) raw = '#' + raw;
    if (raw.length < 2) return;
    addTag(raw);
    setCustomTagInput('');
    setShowTagInput(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const token = authStore.getToken();
      const form = new FormData();
      if (caption.trim()) form.append('caption', caption.trim());
      if (selectedCategory) form.append('category', selectedCategory);
      form.append('tags', JSON.stringify(tags));
      form.append('allow_comments', String(allowComments));
      for (const asset of assets) {
        const filename = asset.uri.split('/').pop() ?? 'media';
        const mime = asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        form.append('media', { uri: asset.uri, name: filename, type: mime } as any);
      }
      const res = await fetch(`${BASE_URL}/posts`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'Failed to publish.');
      onPublish();
    } catch (e: any) {
      const { Alert } = require('react-native');
      Alert.alert('Publish failed', e.message ?? 'Something went wrong.');
    } finally {
      setPublishing(false);
    }
  };

  // Trending suggestions not yet added
  const suggestions = TRENDING_TAGS.filter((t) => !tags.includes(t));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <AppScreenHeader title="Create" onBack={onBack} backgroundColor="#FAFAFA" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}>

        {/* ── Media preview ── */}
        <View style={styles.previewCard}>
          {assets.length === 1 ? (
            <>
              <Image source={{ uri: primary.uri }} style={styles.previewImage} resizeMode="contain" />
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>PREVIEW</Text>
              </View>
              {primary.mediaType === 'video' && (
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={28} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <FlatList
                ref={previewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={assets}
                keyExtractor={(a) => a.id}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / PREVIEW_SIZE);
                  setPreviewIndex(idx);
                }}
                renderItem={({ item }) => (
                  <View style={{ width: PREVIEW_SIZE }}>
                    <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="contain" />
                    {item.mediaType === 'video' && (
                      <View style={styles.playOverlay}>
                        <View style={styles.playCircle}>
                          <Ionicons name="play" size={28} color="#FFFFFF" />
                        </View>
                      </View>
                    )}
                  </View>
                )}
              />
              <View style={styles.dotsRow}>
                {assets.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => previewRef.current?.scrollToIndex({ index: idx, animated: true })}>
                    <View style={[styles.dot, idx === previewIndex && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>{previewIndex + 1}/{assets.length}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Caption ── */}
        <View style={styles.card}>
          <TextInput
            style={styles.captionInput}
            placeholder="What's on your mind?..."
            placeholderTextColor="#C4C5CC"
            multiline
            maxLength={MAX_CAPTION}
            value={caption}
            onChangeText={setCaption}
            textAlignVertical="top"
          />
          <View style={styles.captionBottom}>
            <View style={styles.captionIcons}>
              <TouchableOpacity hitSlop={10}>
                <Ionicons name="happy-outline" size={22} color="#7A0EED" />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10}>
                <Ionicons name="at-outline" size={22} color="#7A0EED" />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10}>
                <Ionicons name="location-outline" size={22} color="#7A0EED" />
              </TouchableOpacity>
            </View>
            <Text style={styles.captionCount}>{caption.length} / {MAX_CAPTION}</Text>
          </View>
        </View>

        {/* ── Tags ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag" size={16} color="#7A0EED" />
            <Text style={styles.sectionTitle}>Tags</Text>
          </View>

          {/* Added tags row */}
          {tags.length > 0 && (
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagAdded}
                  onPress={() => removeTag(tag)}
                  activeOpacity={0.8}>
                  <Text style={styles.tagAddedText}>{tag}</Text>
                  <Ionicons name="close-circle" size={14} color="#7A0EED" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Custom tag input field */}
          {showTagInput ? (
            <View style={styles.tagInputRow}>
              <View style={styles.tagInputBox}>
                <Text style={styles.tagHash}>#</Text>
                <TextInput
                  style={styles.tagInput}
                  placeholder="your tag"
                  placeholderTextColor="#C4C5CC"
                  value={customTagInput}
                  onChangeText={(v) => setCustomTagInput(v.replace(/\s/g, '').replace(/^#+/, ''))}
                  autoCapitalize="none"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addCustomTag}
                />
              </View>
              <TouchableOpacity style={styles.tagConfirmBtn} onPress={addCustomTag} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowTagInput(false); setCustomTagInput(''); }}
                hitSlop={10}>
                <Ionicons name="close" size={20} color="#ABADB2" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.tagAddBtn} onPress={() => setShowTagInput(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color="#7A0EED" />
              <Text style={styles.tagAddBtnText}>Add tag</Text>
            </TouchableOpacity>
          )}

          {/* Trending suggestions — always visible, tap to add */}
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionsLabel}>Trending</Text>
            <View style={styles.tagsWrap}>
              {suggestions.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagSuggestion}
                  onPress={() => addTag(tag)}
                  activeOpacity={0.8}>
                  <Text style={styles.tagSuggestionText}>{tag}</Text>
                </TouchableOpacity>
              ))}
              {suggestions.length === 0 && (
                <Text style={styles.allAddedText}>All trending tags added ✓</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Category ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid-outline" size={16} color="#7A0EED" />
            <Text style={styles.sectionTitle}>Category</Text>
          </View>
          <FlatList
            horizontal
            data={CATEGORIES}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const active = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(item.id)}
                  activeOpacity={0.8}
                  style={[styles.categoryCard, active && styles.categoryCardActive]}>
                  <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>
                    <Ionicons name={item.icon} size={22} color={active ? '#7A0EED' : '#ABADB2'} />
                  </View>
                  <Text
                    style={[styles.categoryLabel, active && styles.categoryLabelActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ── Settings ── */}
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="chatbubble-outline" size={18} color="#B50357" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Allow Comments</Text>
                <Text style={styles.settingDesc}>Allow for all followers</Text>
              </View>
            </View>
            <Switch
              value={allowComments}
              onValueChange={setAllowComments}
              trackColor={{ false: '#E0DFF5', true: '#7A0EED' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0DFF5"
            />
          </View>
        </View>

        {/* ── Publish button ── */}
        <TouchableOpacity
          style={styles.publishBtnWrap}
          onPress={handlePublish}
          disabled={publishing}
          activeOpacity={0.88}>
          <LinearGradient
            colors={['#7A0EED', '#B50357']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.publishBtn}>
            {publishing ? (
              <Text style={styles.publishBtnText}>Publishing…</Text>
            ) : (
              <>
                <Text style={styles.publishBtnText}>Publish Post</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Header gradient title styles (matches chat-rooms-header.tsx exactly) ──────
// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },

  // Header — identical layout/padding/bg/shadow to chat-rooms-header.tsx
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#4A0099',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 16 },

  // Shared card base
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#4A0099',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // Preview card
  previewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Reduced height ratio: 0.72 (down from 0.85) so the image is not too tall
  previewImage: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE * 0.72,
    backgroundColor: '#2A1A3E',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.2 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingLeft: 4,
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: '#1A1A2E',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 18, backgroundColor: '#7A0EED', borderRadius: 3 },

  // Caption
  captionInput: { minHeight: 72, fontSize: 15, color: '#1C1E22', lineHeight: 22 },
  captionBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0EFF5',
  },
  captionIcons: { flexDirection: 'row', gap: 16 },
  captionCount: { fontSize: 12, color: '#C4C5CC', fontWeight: '500' },

  // Section wrapper
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1E22' },

  // Tag chip rows
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Added / selected tags (purple, with × to remove)
  tagAdded: {
    height: 34, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: '#F3EBFF',
    borderWidth: 1, borderColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  tagAddedText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },

  // Custom input row
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagInputBox: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: '#F7F5FF', borderWidth: 1.5, borderColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4,
  },
  tagHash: { fontSize: 15, fontWeight: '800', color: '#7A0EED' },
  tagInput: { flex: 1, fontSize: 14, color: '#1C1E22', height: 42 },
  tagConfirmBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },

  // "Add tag" link button
  tagAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingVertical: 4,
  },
  tagAddBtnText: { fontSize: 13, fontWeight: '600', color: '#7A0EED' },

  // Trending suggestions block
  suggestionsWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#4A0099',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  suggestionsLabel: { fontSize: 11, fontWeight: '700', color: '#ABADB2', letterSpacing: 0.8 },
  tagSuggestion: {
    height: 32, paddingHorizontal: 13,
    borderRadius: 999, backgroundColor: '#F5F3FA',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E6F0',
  },
  tagSuggestionText: { fontSize: 13, fontWeight: '500', color: '#6B6E7A' },
  allAddedText: { fontSize: 13, color: '#ABADB2', fontStyle: 'italic' },

  // Categories
  categoryList: { gap: 10, paddingVertical: 4 },
  categoryCard: {
    width: 86, height: 90, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: 'transparent',
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  categoryCardActive: {
    borderColor: '#7A0EED', backgroundColor: '#FAFAFF',
    shadowColor: '#7A0EED', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  categoryIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#F2F0F8', alignItems: 'center', justifyContent: 'center',
  },
  categoryIconWrapActive: { backgroundColor: '#EEE6FF' },
  // Smaller font + adjustsFontSizeToFit handles long labels like ENTERTAINMENT
  categoryLabel: {
    fontSize: 9, fontWeight: '700', color: '#ABADB2',
    letterSpacing: 0.3, textAlign: 'center',
  },
  categoryLabelActive: { color: '#7A0EED' },

  // Settings
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 2,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFF0F5', alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontWeight: '700', color: '#1C1E22' },
  settingDesc: { fontSize: 12, color: '#ABADB2', marginTop: 1 },

  // Publish
  publishBtnWrap: {
    borderRadius: 999, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  publishBtn: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, borderRadius: 999,
  },
  publishBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
});