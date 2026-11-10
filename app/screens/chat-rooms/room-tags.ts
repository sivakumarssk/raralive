import type { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type RoomTag = { label: string; icon: IconName; color: string };

// Topic tags a room can have (the server accepts only these labels).
// Picked in the create sheet and shown with their icon in the room lists.
export const ROOM_TAGS: RoomTag[] = [
  { label: 'Music', icon: 'music', color: '#7A0EED' },
  { label: 'Gaming', icon: 'gamepad-variant', color: '#4F46E5' },
  { label: 'Talk', icon: 'chat-processing', color: '#3B82F6' },
  { label: 'Comedy', icon: 'emoticon-happy', color: '#F59E0B' },
  { label: 'Podcast', icon: 'microphone', color: '#6D28D9' },
  { label: 'EDM', icon: 'headphones', color: '#EC4899' },
  { label: 'Hip-Hop', icon: 'crown', color: '#F59E0B' },
  { label: 'Sports', icon: 'soccer', color: '#5B21B6' },
  { label: 'News', icon: 'newspaper-variant', color: '#2563EB' },
  { label: 'Tech', icon: 'chip', color: '#7C3AED' },
  { label: 'Chill', icon: 'leaf', color: '#16A34A' },
  { label: 'Study', icon: 'book-open-variant', color: '#2563EB' },
  { label: 'Fitness', icon: 'dumbbell', color: '#9333EA' },
  { label: 'Art', icon: 'palette', color: '#EC4899' },
  { label: 'Food', icon: 'silverware-fork-knife', color: '#DB2777' },
];

const BY_LABEL = new Map(ROOM_TAGS.map(t => [t.label, t]));

/** A room's saved tag labels → their icon/color, dropping unknown ones. */
export function roomTagsFor(labels: string[] | null | undefined): RoomTag[] {
  return (labels ?? []).flatMap(l => BY_LABEL.get(l) ?? []);
}
