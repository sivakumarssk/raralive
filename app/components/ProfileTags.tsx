import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useUserLevel } from '@/components/UserLevel';

const COIN_IMG = require('@/assets/tabs/coin.png');

type Tag = {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: ReactNode;
  /** Shown after the label. */
  trailing?: ReactNode;
};

type GenderLook = { color: string; bg: string; icon: 'male' | 'female' | 'person' };
const GENDER_LOOKS: Record<string, GenderLook> = {
  male: { color: '#1D6FE0', bg: '#E3EEFC', icon: 'male' },
  female: { color: '#D62D82', bg: '#FDE4F0', icon: 'female' },
};
const OTHER_GENDER: GenderLook = { color: '#7A0EED', bg: '#F1E4FB', icon: 'person' };

/**
 * Status tags on your own profile, above Edit Profile, in this order: gender,
 * ID level, then agency badges. Each tag is one entry in `tags` — add new ones
 * here. Nothing renders when none apply.
 */
export function ProfileTags({ isAgency, gender }: { isAgency: boolean; gender?: string | null }) {
  const { level } = useUserLevel();

  const tags: Tag[] = [];

  if (gender) {
    const g = gender.toLowerCase();
    const look = GENDER_LOOKS[g] ?? OTHER_GENDER;
    tags.push({
      key: 'gender',
      label: g.charAt(0).toUpperCase() + g.slice(1),
      color: look.color,
      bg: look.bg,
      icon: <Ionicons name={look.icon} size={14} color={look.color} />,
    });
  }

  if (level >= 1) {
    tags.push({
      key: 'id-level',
      label: `ID Level ${level}`,
      color: '#3D1FC4',
      bg: '#E5E3FB',
      icon: <Ionicons name="star" size={16} color="#4A2BEA" />,
    });
  }

  if (isAgency) {
    tags.push({
      key: 'verified-agency',
      label: 'Verified Agency',
      color: '#7A0EED',
      bg: '#F1E4FB',
      icon: (
        <View style={styles.mailBadge}>
          <Ionicons name="mail" size={11} color="#FFFFFF" />
        </View>
      ),
      trailing: <MaterialCommunityIcons name="check-decagram" size={16} color="#1D6FE0" />,
    });
    tags.push({
      key: 'coins-seller',
      label: 'Coins Seller',
      color: '#B4530A',
      bg: '#FEEFDC',
      icon: <Image source={COIN_IMG} style={styles.coin} resizeMode="contain" />,
    });
  }

  if (tags.length === 0) return null;

  return (
    <View style={styles.row}>
      {tags.map(tag => (
        <View key={tag.key} style={[styles.tag, { backgroundColor: tag.bg }]}>
          {tag.icon}
          <Text style={[styles.label, { color: tag.color }]} numberOfLines={1}>{tag.label}</Text>
          {tag.trailing}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 9, borderRadius: 14 },
  label: { fontSize: 12, fontWeight: '700' },
  mailBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#B517C9', alignItems: 'center', justifyContent: 'center' },
  coin: { width: 18, height: 18 },
});
