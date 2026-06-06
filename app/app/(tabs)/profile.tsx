import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

type UserProfile = {
  id: string;
  phone: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  is_phone_verified: boolean;
  created_at: string;
};

function resolveAvatar(url: string | null): string | null {
  if (!url) return null;
  // Always extract just the path in case old records stored a full URL
  try {
    const path = new URL(url).pathname;
    return `${MEDIA_BASE}${path}`;
  } catch {
    return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
  }
}

function AvatarCircle({ profile }: { profile: UserProfile }) {
  const label = (profile.full_name || profile.username || profile.phone).trim();
  const initials = label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatarUri = resolveAvatar(profile.avatar_url);

  if (avatarUri) {
    return (
      <Image
        source={{ uri: avatarUri }}
        style={styles.avatar}
        contentFit="cover"
      />
    );
  }

  const colors = [
    ['#7A0EED', '#B50357'],
    ['#E040FB', '#7B1FA2'],
    ['#FF6F00', '#F57C00'],
    ['#00897B', '#00695C'],
    ['#1E88E5', '#1565C0'],
  ];
  const seed = profile.phone.charCodeAt(profile.phone.length - 1) % colors.length;
  const [c1, c2] = colors[seed];

  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      {/* simple gradient-ish via overlapping views */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c1, borderRadius: 60 }]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c2, borderRadius: 60, opacity: 0.55 }]} />
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color="#7A0EED" />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) {
      router.replace('/login' as never);
      return;
    }
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) setProfile(json.data);
        else setError(json.message || 'Failed to load profile.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    authStore.clear();
    router.replace('/login' as never);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const formatGender = (g: string | null) => {
    if (!g) return null;
    return g.charAt(0).toUpperCase() + g.slice(1);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7A0EED" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#ABADB2" />
          <Text style={styles.errorText}>{error || 'Profile not found.'}</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Avatar + name block */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <AvatarCircle profile={profile} />
            {profile.is_phone_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
            )}
          </View>

          <Text style={styles.heroName}>
            {profile.full_name || <Text style={styles.heroNameMuted}>No name set</Text>}
          </Text>
          {profile.username && (
            <Text style={styles.heroUsername}>@{profile.username}</Text>
          )}

          {profile.is_phone_verified && (
            <View style={styles.verifiedChip}>
              <Ionicons name="shield-checkmark" size={12} color="#059669" />
              <Text style={styles.verifiedChipText}>Verified Account</Text>
            </View>
          )}
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>

          <View style={styles.card}>
            <InfoRow icon="call-outline" label="Phone" value={profile.phone} />
            {profile.email && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="mail-outline" label="Email" value={profile.email} />
              </>
            )}
            {profile.gender && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="person-outline" label="Gender" value={formatGender(profile.gender)!} />
              </>
            )}
            {profile.date_of_birth && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="calendar-outline"
                  label="Date of Birth"
                  value={new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                />
              </>
            )}
            <View style={styles.divider} />
            <InfoRow icon="time-outline" label="Member Since" value={formatDate(profile.created_at)} />
          </View>
        </View>

        {/* Log out */}
        <View style={styles.section}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutCard} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#E14C57" />
            <Text style={styles.logoutCardText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: '#ABADB2', textAlign: 'center', paddingHorizontal: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.5,
  },

  // Hero card
  heroCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.3,
  },
  heroNameMuted: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ABADB2',
    fontStyle: 'italic',
  },
  heroUsername: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '500',
    color: '#7A0EED',
  },
  verifiedChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verifiedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },

  // Sections
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ABADB2',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F4EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#ABADB2', fontWeight: '600', letterSpacing: 0.3 },
  infoValue: { fontSize: 14, color: '#1C1E22', fontWeight: '600', marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F4', marginLeft: 48 },

  // Logout
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FFE4E4',
  },
  logoutCardText: { fontSize: 15, fontWeight: '700', color: '#E14C57' },

  logoutBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
  },
  logoutBtnText: { fontSize: 14, fontWeight: '700', color: '#E14C57' },
});
