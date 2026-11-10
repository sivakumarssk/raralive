import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { RoomTag } from '../room-tags';

/**
 * A room's first tag in a list row, as a small icon + name chip. Never
 * shrinks — the city before it truncates instead.
 */
export function RoomTagChips({ tags }: { tags: RoomTag[] }) {
  const tag = tags[0];
  if (!tag) return null;
  return (
    <View style={[styles.chip, { backgroundColor: `${tag.color}18` }]}>
      <MaterialCommunityIcons name={tag.icon} size={10} color={tag.color} />
      <Text style={[styles.label, { color: tag.color }]} numberOfLines={1}>{tag.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 16, paddingHorizontal: 5, borderRadius: 8, flexShrink: 0 },
  label: { fontSize: 9, fontWeight: '700' },
});
