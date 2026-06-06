export type RoomSeat = {
  id: string;
  isEmpty: boolean;
  user?: {
    name: string;
    avatarUri: string;
    level: number;
    isHost?: boolean;
    hasMic?: boolean;
  };
};

export type ChatMessage = {
  id: string;
  type: 'join' | 'message' | 'gift';
  user?: { name: string; avatarUri: string; level: number; levelColor?: string };
  text?: string;
  // gift event
  giftName?: string;
  giftTo?: string;
  giftImageUrl?: string | null;
  giftBgColor?: string;
  giftCoins?: number;
  giftQty?: number;
  giftRecipientId?: string;
};

export type GiftItem = {
  id: string;
  name: string;
  image_url: string | null;
  coins: number;
  bg_color: string;
};

export const MOCK_SEATS: RoomSeat[] = [
  {
    id: 's0',
    isEmpty: false,
    user: {
      name: 'Kosame',
      avatarUri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      level: 42,
      isHost: true,
      hasMic: true,
    },
  },
  { id: 's1', isEmpty: false, user: { name: 'REQUEST', avatarUri: '', level: 0 } },
  { id: 's2', isEmpty: true },
  { id: 's3', isEmpty: true },
  { id: 's4', isEmpty: true },
  { id: 's5', isEmpty: true },
  { id: 's6', isEmpty: true },
  { id: 's7', isEmpty: true },
];

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: 'm0', type: 'join', user: { name: 'Marco', avatarUri: '', level: 0 } },
  {
    id: 'm1',
    type: 'message',
    user: {
      name: 'Liam88',
      avatarUri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
      level: 12,
      levelColor: '#7A0EED',
    },
    text: 'Hey Kosame! Love the vibe today. Keep it up! 🎸',
  },
  { id: 'm2', type: 'gift', user: { name: 'Alex', avatarUri: '', level: 0 }, giftName: 'Royal Crown', giftTo: 'Kosame' },
  {
    id: 'm3',
    type: 'message',
    user: {
      name: 'Alex',
      avatarUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      level: 35,
      levelColor: '#E8944A',
    },
    text: 'The queen deserves it!\n✨👑✨',
  },
  {
    id: 'm4',
    type: 'message',
    user: {
      name: 'Sara_V',
      avatarUri: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
      level: 5,
      levelColor: '#E8944A',
    },
    text: 'Whoa! BIG',
  },
];

