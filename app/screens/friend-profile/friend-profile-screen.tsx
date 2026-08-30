import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoCarousel } from '@/components/photo-carousel';
import type { Friend } from '@/screens/chat-rooms/components/friend-zone-screen';

const SCREEN_W = Dimensions.get('window').width;
const HERO_H = SCREEN_W * 0.75;

type FriendProfileScreenProps = {
  friend: Friend;
  onBack: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onFollow?: () => void;
};

export function FriendProfileScreen({
  friend, onBack, onAudioCall, onVideoCall, onFollow,
}: FriendProfileScreenProps) {
  const [isFollowing, setIsFollowing] = useState(false);

  const heroPhotos = friend.photos && friend.photos.length > 0
    ? friend.photos
    : friend.avatarUri
      ? [friend.avatarUri]
      : [];

  const galleryPhotos = friend.photos ?? [];
  const extraCount = Math.max(0, galleryPhotos.length - 3);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero photo carousel */}
        <View style={s.hero}>
          {heroPhotos.length > 0 ? (
            <PhotoCarousel photos={heroPhotos} width={SCREEN_W} height={HERO_H} dotsStyle="light" />
          ) : (
            <View style={[s.heroImage, s.heroFallback]}>
              <Text style={s.heroFallbackInitial}>{friend.name[0]?.toUpperCase()}</Text>
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.25)']}
            locations={[0, 0.25, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top bar */}
          <SafeAreaView edges={['top']} style={s.topBar}>
            <TouchableOpacity onPress={onBack} style={s.topBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={s.topRightRow}>
              <TouchableOpacity
                style={[s.followBtn, isFollowing && s.followBtnActive]}
                onPress={() => { setIsFollowing(v => !v); onFollow?.(); }}
                activeOpacity={0.85}>
                <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={14} color={isFollowing ? '#7A0EED' : '#FFFFFF'} />
                <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.topBtn} hitSlop={8}>
                <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Online badge */}
          <View style={s.badgeCol}>
            {friend.isOnline && (
              <View style={s.onlineBadge}>
                <View style={s.onlineBadgeDot} />
                <Text style={s.onlineBadgeText}>Online</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info card */}
        <View style={s.infoCard}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{friend.name}</Text>
            {friend.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color="#7A0EED" style={{ marginLeft: 6 }} />
            )}
          </View>

          <Text style={s.metaLine}>
            {friend.age} Years{friend.location ? `  •  ${friend.location}` : ''}
          </Text>

          {/* Attribute chips */}
          <View style={s.chipRow}>
            {!!friend.gender && (
              <View style={s.chip}>
                <Ionicons name={friend.gender === 'Female' ? 'female' : 'male'} size={13} color="#7A0EED" />
                <Text style={s.chipText}>{friend.gender}</Text>
              </View>
            )}
            {!!friend.height && (
              <View style={s.chip}>
                <Ionicons name="resize-outline" size={13} color="#7A0EED" />
                <Text style={s.chipText}>{friend.height}</Text>
              </View>
            )}
            {!!friend.languages?.length && (
              <View style={s.chip}>
                <Ionicons name="language-outline" size={13} color="#7A0EED" />
                <Text style={s.chipText} numberOfLines={1}>{friend.languages.join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Photo gallery strip */}
          {galleryPhotos.length > 0 && (
            <View style={s.galleryRow}>
              {galleryPhotos.slice(0, 3).map((uri, i) => {
                const isLast = i === 2 && extraCount > 0;
                return (
                  <View key={i} style={s.galleryItem}>
                    <Image source={{ uri }} style={s.galleryImg} resizeMode="contain" />
                    {isLast && (
                      <View style={s.galleryOverlay}>
                        <Text style={s.galleryOverlayText}>+{extraCount}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* About me */}
          {!!friend.aboutMe && (
            <View style={s.aboutCard}>
              <View style={s.aboutHeader}>
                <Ionicons name="musical-notes-outline" size={14} color="#7A0EED" />
                <Text style={s.aboutTitle}>About Me</Text>
              </View>
              <Text style={s.aboutText}>{friend.aboutMe}</Text>
            </View>
          )}

          <View style={{ height: 160 }} />
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={s.bottomBar}>
        <View style={s.callRow}>
          <TouchableOpacity style={[s.callBtn, s.audioBtn]} onPress={onAudioCall} activeOpacity={0.88}>
            <Ionicons name="call" size={17} color="#FFFFFF" />
            <Text style={s.callBtnText}>Audio Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.callBtn} onPress={onVideoCall} activeOpacity={0.88}>
            <LinearGradient
              colors={['#7A0EED', '#B50357']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.videoBtnGrad}>
              <Ionicons name="videocam" size={17} color="#FFFFFF" />
              <Text style={s.callBtnText}>Video Call</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: { width: SCREEN_W, height: HERO_H, position: 'relative', backgroundColor: '#FFFFFF' },
  heroImage: { width: SCREEN_W, height: HERO_H },
  heroFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDE8F7' },
  heroFallbackInitial: { fontSize: 64, fontWeight: '800', color: '#7A0EED' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4,
  },
  topBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center', justifyContent: 'center',
  },
  topRightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingHorizontal: 14,
  },
  followBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  followBtnText: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
  },
  followBtnTextActive: {
    color: '#7A0EED',
  },
  badgeCol: {
    position: 'absolute', left: 16, bottom: 44,
    gap: 8,
  },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  onlineBadgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' },
  onlineBadgeText: { fontSize: 12, fontWeight: '700', color: '#1C1E22' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20, paddingTop: 20,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 22, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.4 },
  metaLine: { fontSize: 14, color: '#60626A', fontWeight: '500', marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F4EEFF', borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#5B3B99' },

  galleryRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  galleryItem: { flex: 1, aspectRatio: 1, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDF8' },
  galleryImg: { width: '100%', height: '100%' },
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  galleryOverlayText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  aboutCard: {
    marginTop: 18,
    backgroundColor: '#F7F5FF',
    borderRadius: 16,
    padding: 14,
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aboutTitle: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },
  aboutText: { fontSize: 13, color: '#3C3F4A', lineHeight: 20, fontWeight: '500' },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8,
    gap: 10,
  },
  callRow: { flexDirection: 'row', gap: 10 },
  callBtn: {
    flex: 1, height: 50, borderRadius: 25, overflow: 'hidden',
  },
  audioBtn: {
    backgroundColor: '#22C55E',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  videoBtnGrad: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  callBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
