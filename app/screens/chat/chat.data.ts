import type { ChatConversation, DirectMessage } from '@/services/api';

export type { ChatConversation, DirectMessage };

export const STICKERS: { id: string; emoji: string }[] = [
  { id: 'heart', emoji: '❤️' },
  { id: 'fire', emoji: '🔥' },
  { id: 'laugh', emoji: '😂' },
  { id: 'wow', emoji: '😮' },
  { id: 'sad', emoji: '😢' },
  { id: 'angry', emoji: '😡' },
  { id: 'thumbsup', emoji: '👍' },
  { id: 'clap', emoji: '👏' },
  { id: 'party', emoji: '🎉' },
  { id: 'rose', emoji: '🌹' },
  { id: 'star', emoji: '⭐' },
  { id: 'kiss', emoji: '😘' },
];

export function stickerEmoji(stickerId: string | null | undefined): string {
  return STICKERS.find(s => s.id === stickerId)?.emoji ?? '🎉';
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatConversationTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Offline';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Last seen ${diffHr}h ago`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return `Last seen ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `Last seen ${diffDay}d ago`;
  return `Last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
