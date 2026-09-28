import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, resolveImageUrl } from '@/services/api';
import { authStore } from '@/store/auth-store';

type AgencyProfile = {
  id: string;
  agency_name: string;
  agent_code: string;
  email: string;
  phone: string;
  person_name: string;
  status: 'active' | 'suspended' | 'pending';
  service_access?: string[];
  created_at: string;
  app_user_id: string | null;
  // From the agency's own app account profile; null = not set (use defaults)
  avatar_url: string | null;
  cover_url: string | null;
};

// Labels for agencies.service_access values (managed in the admin panel)
const SERVICE_LABELS: Record<string, string> = {
  chatroom: 'Chat Room',
  friend_zone: 'Friend Zone',
  live: 'Live',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOGO_SIZE = 116;
// Header height below the status bar; the white card overlaps its bottom by CARD_OVERLAP
const HEADER_H = 160;
const CARD_OVERLAP = 50;

function formatJoined(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "+91 98765 43210" for 10-digit Indian numbers; anything else shown as stored
function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10) return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  return phone;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const STATUS_STYLE: Record<AgencyProfile['status'], { label: string; bg: string; fg: string }> = {
  active:    { label: 'Active',    bg: '#E6F7EC', fg: '#1E9E4A' },
  pending:   { label: 'Pending',   bg: '#FFF4E0', fg: '#D98A00' },
  suspended: { label: 'Suspended', bg: '#FDECEC', fg: '#E14C57' },
};

export function AgencyProfileScreen({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [agency, setAgency] = useState<AgencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    const token = authStore.getToken();
    fetch(`${BASE_URL}/agency/public/${agencyId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) setAgency(j.data);
        else setError(j.message ?? 'Could not load agency.');
      })
      .catch(() => setError('Could not load agency.'))
      .finally(() => setLoading(false));
  }, [agencyId]);

  // Opens (or creates) a chat with the agency's own app account
  const handleMessage = async () => {
    const token = authStore.getToken();
    if (!agency?.app_user_id || !token || messaging) return;
    setMessaging(true);
    try {
      const res = await fetch(`${BASE_URL}/chat/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: agency.app_user_id }),
      });
      const json = await res.json();
      if (json.success && json.data?.id) router.push(`/chat/${json.data.id}` as any);
    } catch {}
    setMessaging(false);
  };

  const status = STATUS_STYLE[agency?.status ?? 'active'] ?? STATUS_STYLE.active;
  const isMe = !!agency?.app_user_id && agency.app_user_id === authStore.getUserId();
  const canMessage = !!agency?.app_user_id && !isMe;
  // The agency's own profile photo / banner if set, else the default logo + colors
  const avatarUri = resolveImageUrl(agency?.avatar_url);
  const coverUri = resolveImageUrl(agency?.cover_url);
  const services = (agency?.service_access?.length ? agency.service_access : ['chatroom'])
    .filter(k => SERVICE_LABELS[k])
    .map(k => ({ text: SERVICE_LABELS[k], bg: '#EFE6FF', fg: '#7A0EED' }));

  return (
    <View style={s.root}>
      {/* Header: the agency's own banner if set, else purple gradient with bokeh circles */}
      <LinearGradient
        colors={['#7A0EED', '#9B4DF5', '#B57BFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { height: insets.top + HEADER_H, paddingTop: insets.top + 8 }]}>
        {coverUri ? (
          <>
            <ExpoImage source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {/* Darkens the top so the back arrow stays visible on light banners */}
            <LinearGradient
              colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
              style={[StyleSheet.absoluteFill, { bottom: undefined, height: insets.top + 70 }]}
            />
          </>
        ) : (
          <>
            <View style={[s.bubble, { width: 90, height: 90, top: 30, left: -20 }]} />
            <View style={[s.bubble, { width: 60, height: 60, top: 90, left: 70 }]} />
            <View style={[s.bubble, { width: 110, height: 110, top: 10, right: -30 }]} />
          </>
        )}
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#7A0EED" /></View>
      ) : error || !agency ? (
        <View style={s.center}>
          <Ionicons name="business-outline" size={40} color="#ABADB2" />
          <Text style={s.errorText}>{error ?? 'Agency not found.'}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={s.card}
            contentContainerStyle={s.cardContent}
            showsVerticalScrollIndicator={false}>
            <Text style={s.name} numberOfLines={2}>
              {agency.agency_name}{' '}
              {agency.status === 'active' && <Ionicons name="checkmark-circle" size={22} color="#7A0EED" />}
            </Text>
            <View style={[s.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[s.statusText, { color: status.fg }]}>{status.label}</Text>
            </View>

            <View style={s.infoCard}>
              <InfoRow icon="id-card-outline" label="Agency Code" value={agency.agent_code} />
              <InfoRow icon="mail-outline" label="Email" value={agency.email} small />
              <InfoRow icon="call-outline" label="Phone Number" value={formatPhone(agency.phone)} />
              <InfoRow icon="person-outline" label="Manager Name" value={agency.person_name} />
              <InfoRow icon="shield-checkmark-outline" label="Service Access" badges={services} />
              <InfoRow icon="calendar-outline" label="Joined Date" value={formatJoined(agency.created_at)} />
              <InfoRow
                icon="ribbon-outline"
                label="Status"
                badges={[{ text: status.label, bg: status.bg, fg: status.fg }]}
                last
              />
            </View>
          </ScrollView>

          {canMessage && (
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity onPress={handleMessage} activeOpacity={0.9} disabled={messaging}>
                <LinearGradient
                  colors={['#E0508F', '#9B4DF5', '#4F6BF0']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={s.messageBtn}>
                  {messaging ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
                      <Text style={s.messageText}>Message</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Logo circle overlapping the header and the white card */}
      {!loading && agency && (
        <View style={[s.logoWrap, { top: insets.top + HEADER_H - CARD_OVERLAP - LOGO_SIZE / 2 }]} pointerEvents="none">
          <View style={s.logo}>
            {avatarUri ? (
              <ExpoImage source={{ uri: avatarUri }} style={s.logoImg} contentFit="cover" />
            ) : (
              <>
                <Text style={s.logoText}>{initials(agency.agency_name)}</Text>
                <Text style={s.logoSub} numberOfLines={1}>{agency.agency_name.toUpperCase()}</Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, badges, small, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  badges?: { text: string; bg: string; fg: string }[];
  small?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[s.row, !last && s.rowSpacing]}>
      <Ionicons name={icon} size={20} color="#3A3C42" />
      <Text style={s.rowLabel}>{label}</Text>
      {badges ? (
        <View style={s.badgeList}>
          {badges.map(b => (
            <View key={b.text} style={[s.badge, { backgroundColor: b.bg }]}>
              <Text style={[s.badgeText, { color: b.fg }]}>{b.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[s.rowValue, small && s.rowValueSmall]} numberOfLines={1} ellipsizeMode="middle">
          {value || '—'}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerBar: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorText: { fontSize: 14, color: '#60626A' },

  card: {
    flex: 1,
    marginTop: -CARD_OVERLAP,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  cardContent: {
    paddingTop: LOGO_SIZE / 2 + 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    alignItems: 'center',
  },

  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#111111',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: 'hidden',
  },
  logoImg: { ...StyleSheet.absoluteFillObject },
  logoText: { fontSize: 40, fontWeight: '700', color: '#D4AF37', letterSpacing: 1 },
  logoSub: { fontSize: 8, fontWeight: '700', color: '#D4AF37', letterSpacing: 0.5, marginTop: 2 },

  name: { fontSize: 24, fontWeight: '800', color: '#1C1E22', textAlign: 'center' },
  statusPill: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 13, fontWeight: '600' },

  infoCard: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#ECECF1',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowSpacing: { marginBottom: 20 },
  rowLabel: { marginLeft: 14, fontSize: 14, color: '#3A3C42', flexShrink: 0 },
  rowValue: { flex: 1, marginLeft: 12, textAlign: 'right', fontSize: 14.5, fontWeight: '500', color: '#1C1E22' },
  rowValueSmall: { fontSize: 13 },
  badgeList: { flex: 1, marginLeft: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  badgeText: { fontSize: 13.5, fontWeight: '600' },

  footer: { paddingHorizontal: 18, paddingTop: 8 },
  messageBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  messageText: { fontSize: 19, fontWeight: '600', color: '#FFFFFF' },
});
