import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiChatMarkRead, apiChatMessages, apiChatSendMedia, resolveImageUrl,
  type ChatConversation, type DirectMessage,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { AttachMenu } from './components/attach-menu';
import { MessageBubble } from './components/message-bubble';
import { MessageInputBar } from './components/message-input-bar';
import { StickerPicker } from './components/sticker-picker';

type ChatConversationScreenProps = {
  conversationId: string;
  conversation?: ChatConversation;
};

export function ChatConversationScreen({ conversationId, conversation }: ChatConversationScreenProps) {
  const router = useRouter();
  const myUserId = authStore.getUserId();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerReadAt, setPeerReadAt] = useState<number>(0);
  const listRef = useRef<FlatList>(null);

  const peerName = conversation?.peer_name || conversation?.peer_username || 'User';
  const peerAvatar = resolveImageUrl(conversation?.peer_avatar_url);

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    const res = await apiChatMessages(conversationId, token);
    if (res.ok) {
      setMessages(res.data);
      const latestReadAt = res.data
        .filter(m => m.sender_id === myUserId && m.read_at)
        .reduce((max, m) => Math.max(max, new Date(m.read_at as string).getTime()), 0);
      if (latestReadAt) setPeerReadAt(latestReadAt);
    }
    await apiChatMarkRead(conversationId, token);
  }, [conversationId, myUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    chatSocketStore.connect();
    const unsub = subscribeChatEvents((event) => {
      if (event.type === 'message' && event.conversationId === conversationId) {
        setMessages(prev => (prev.some(m => m.id === event.message.id) ? prev : [...prev, event.message]));
        setPeerTyping(false);
        const token = authStore.getToken();
        if (token && event.message.sender_id !== myUserId) apiChatMarkRead(conversationId, token);
      } else if (event.type === 'typing' && event.conversationId === conversationId && event.userId !== myUserId) {
        setPeerTyping(event.isTyping);
      } else if (event.type === 'read' && event.conversationId === conversationId && event.readBy !== myUserId) {
        setPeerReadAt(Date.now());
      }
    });
    return unsub;
  }, [conversationId, myUserId]);

  const sendText = (text: string) => {
    chatSocketStore.sendMessage(conversationId, text);
  };

  const sendSticker = (stickerId: string) => {
    chatSocketStore.sendSticker(conversationId, stickerId);
  };

  const sendMedia = async (uri: string, name: string, mimeType: string, type: 'image' | 'audio' | 'video' | 'file', durationMs?: number) => {
    const token = authStore.getToken();
    if (!token) return;
    const res = await apiChatSendMedia(conversationId, { uri, name, mimeType, type, durationMs }, token);
    if (res.ok) setMessages(prev => (prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'photo.jpg';
      await sendMedia(asset.uri, name, asset.mimeType ?? 'image/jpeg', 'image');
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'video.mp4';
      await sendMedia(asset.uri, name, asset.mimeType ?? 'video/mp4', 'video');
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await sendMedia(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', 'file');
    }
  };

  const handleRecorded = async (uri: string, durationMs: number) => {
    const name = uri.split('/').pop() ?? 'voice.m4a';
    await sendMedia(uri, name, 'audio/m4a', 'audio', durationMs);
  };

  const handleTyping = (isTyping: boolean) => {
    chatSocketStore.setTyping(conversationId, isTyping);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1A1730" />
        </TouchableOpacity>
        {peerAvatar ? (
          <Image source={{ uri: peerAvatar }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarFallback}>
            <Text style={styles.headerAvatarInitial}>{peerName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>{peerName}</Text>
          {peerTyping && <Text style={styles.typingText}>typing…</Text>}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === myUserId;
            const isLastMine = isMine && !messages.slice(index + 1).some(m => m.sender_id === myUserId);
            const isRead = isLastMine && peerReadAt > 0 && new Date(item.created_at).getTime() <= peerReadAt;
            return (
              <MessageBubble
                message={item}
                isMine={isMine}
                showReceipt={isLastMine}
                isRead={isRead}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <MessageInputBar
          onSendText={sendText}
          onAttach={() => setShowAttach(true)}
          onSticker={() => setShowStickers(true)}
          onRecorded={handleRecorded}
          onTyping={handleTyping}
        />
      </KeyboardAvoidingView>

      <AttachMenu
        visible={showAttach}
        onClose={() => setShowAttach(false)}
        onPickImage={pickImage}
        onPickVideo={pickVideo}
        onPickFile={pickFile}
      />
      <StickerPicker visible={showStickers} onClose={() => setShowStickers(false)} onSelect={sendSticker} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F4F0FF',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarInitial: { fontSize: 15, fontWeight: '700', color: '#7A0EED' },
  headerBody: { flex: 1 },
  headerName: { fontSize: 15.5, fontWeight: '800', color: '#1A1730' },
  typingText: { fontSize: 11.5, color: '#7A0EED', fontWeight: '600' },
  listContent: { paddingVertical: 12, flexGrow: 1 },
});
