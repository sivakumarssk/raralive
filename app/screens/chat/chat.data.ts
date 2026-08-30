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
