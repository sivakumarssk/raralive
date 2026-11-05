import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiChatAcceptConversation, apiChatBlock, apiChatMarkRead, apiChatMessages, apiChatRejectConversation,
  apiChatSendMedia, apiChatUnblock, isIncomingChatRequest, resolveImageUrl,
  type ChatConversation, type DirectMessage,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { AttachMenu } from './components/attach-menu';
import { formatLastSeen } from './chat.data';
import { MessageBubble } from './components/message-bubble';
import { MessageInputBar } from './components/message-input-bar';
import { StickerPicker } from './components/sticker-picker';
import { avatarSource } from '@/utils/default-avatar';

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
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeenAt, setPeerLastSeenAt] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Incoming request → Accept / Remove / Block panel replaces the input bar
  // until the user decides; a blocked peer gets an Unblock bar instead.
  const [status, setStatus] = useState(conversation?.status ?? 'accepted');
  const [blockedByMe, setBlockedByMe] = useState(!!conversation?.blocked_by_me);
  // The other person blocked me — no input, just a "can't send" bar
  const [blockedByPeer, setBlockedByPeer] = useState(!!conversation?.blocked_by_peer);
  const [actionBusy, setActionBusy] = useState<'accept' | 'remove' | 'block' | 'unblock' | null>(null);
  const isRequest = !!conversation && isIncomingChatRequest({ ...conversation, status }, myUserId);

  const peerName = conversation?.peer_name || conversation?.peer_username || 'User';
  const peerAvatar = resolveImageUrl(conversation?.peer_avatar_url);
  const peerId = conversation?.peer_id;

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
      } else if (event.type === 'online_status' && peerId && event.userId === peerId) {
        setPeerOnline(event.isOnline);
        if (event.lastSeenAt) setPeerLastSeenAt(event.lastSeenAt);
      } else if (event.type === 'block_status' && event.conversationId === conversationId) {
        setBlockedByPeer(event.blocked);
      } else if (event.type === 'error' && event.conversationId === conversationId) {
        // Blocked while the screen was open — switch to the "can't send" bar
        if (/can't message this user/i.test(event.message)) setBlockedByPeer(true);
        else Alert.alert('Message not sent', event.message);
      }
    });
    return unsub;
  }, [conversationId, myUserId, peerId]);

  // One-off check on open — live updates after this come from the presence
  // broadcast every chat-socket connection already receives (see the listener above).
  useEffect(() => {
    if (!peerId) return;
    chatSocketStore.checkOnline(peerId);
  }, [peerId]);

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
    else if (/can't message this user/i.test(res.message)) setBlockedByPeer(true);
    else Alert.alert('Message not sent', res.message);
  };

  const handleAccept = async () => {
    const token = authStore.getToken();
    if (!token) return;
    setActionBusy('accept');
    const res = await apiChatAcceptConversation(conversationId, token);
    setActionBusy(null);
    if (res.ok) setStatus('accepted');
    else Alert.alert('Could not accept', res.message);
  };

  const handleRemove = () => {
    Alert.alert('Remove request?', 'This chat and its messages will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const token = authStore.getToken();
          if (!token) return;
          setActionBusy('remove');
          const res = await apiChatRejectConversation(conversationId, token);
          setActionBusy(null);
          if (res.ok) router.back();
          else Alert.alert('Could not remove', res.message);
        },
      },
    ]);
  };

  const handleBlock = () => {
    Alert.alert(`Block ${peerName}?`, "They won't be able to message you, and this chat will be removed from your list.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive', onPress: async () => {
          const token = authStore.getToken();
          if (!token) return;
          setActionBusy('block');
          const res = await apiChatBlock(conversationId, token);
          setActionBusy(null);
          if (res.ok) router.back();
          else Alert.alert('Could not block', res.message);
        },
      },
    ]);
  };

  const handleUnblock = async () => {
    const token = authStore.getToken();
    if (!token) return;
    setActionBusy('unblock');
    const res = await apiChatUnblock(conversationId, token);
    setActionBusy(null);
    if (res.ok) setBlockedByMe(false);
    else Alert.alert('Could not unblock', res.message);
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
        <TouchableOpacity
          style={styles.headerProfileTouch}
          activeOpacity={0.7}
          disabled={!peerId}
          onPress={() => peerId && router.push(`/user/${peerId}` as any)}>
          <View style={styles.headerAvatarWrap}>
            <Image source={avatarSource(peerAvatar)} style={styles.headerAvatar} />
            {peerOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.headerName} numberOfLines={1}>{peerName}</Text>
            {peerTyping ? (
              <Text style={styles.typingText}>typing…</Text>
            ) : peerOnline ? (
              <Text style={styles.onlineText}>Online</Text>
            ) : peerLastSeenAt ? (
              <Text style={styles.lastSeenText}>{formatLastSeen(peerLastSeenAt)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
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

        {blockedByMe ? (
          <View style={styles.blockedBar}>
            <Text style={styles.blockedText}>You blocked {peerName}.</Text>
            <TouchableOpacity onPress={handleUnblock} disabled={!!actionBusy} activeOpacity={0.8} style={styles.unblockBtn}>
              {actionBusy === 'unblock'
                ? <ActivityIndicator size="small" color="#7A0EED" />
                : <Text style={styles.unblockText}>Unblock</Text>}
            </TouchableOpacity>
          </View>
        ) : blockedByPeer ? (
          <View style={styles.cantSendBar}>
            <Ionicons name="lock-closed" size={15} color="#9A94AE" />
            <Text style={styles.cantSendText}>You can&apos;t send messages to this user</Text>
          </View>
        ) : isRequest ? (
          <View style={styles.requestPanel}>
            <View style={styles.requestHandle} />
            <Text style={styles.requestTitle}>{peerName} wants to send you a message</Text>
            <Text style={styles.requestSubtitle}>Accept to reply. If you block them, they can&apos;t message you.</Text>
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.requestBtn, styles.requestBtnBlock]}
                onPress={handleBlock} disabled={!!actionBusy} activeOpacity={0.8}>
                {actionBusy === 'block'
                  ? <ActivityIndicator size="small" color="#E14C57" />
                  : <Text style={[styles.requestBtnText, styles.requestBtnTextBlock]}>Block</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.requestBtn, styles.requestBtnRemove]}
                onPress={handleRemove} disabled={!!actionBusy} activeOpacity={0.8}>
                {actionBusy === 'remove'
                  ? <ActivityIndicator size="small" color="#60626A" />
                  : <Text style={[styles.requestBtnText, styles.requestBtnTextRemove]}>Remove</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.requestBtn, styles.requestBtnAccept]}
                onPress={handleAccept} disabled={!!actionBusy} activeOpacity={0.8}>
                {actionBusy === 'accept'
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={[styles.requestBtnText, styles.requestBtnTextAccept]}>Accept</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <MessageInputBar
            onSendText={sendText}
            onAttach={() => setShowAttach(true)}
            onSticker={() => setShowStickers(true)}
            onRecorded={handleRecorded}
            onTyping={handleTyping}
          />
        )}
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
  headerProfileTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarInitial: { fontSize: 15, fontWeight: '700', color: '#7A0EED' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: '#3ED598', borderWidth: 2, borderColor: '#FFFFFF',
  },
  headerBody: { flex: 1 },
  headerName: { fontSize: 15.5, fontWeight: '800', color: '#1A1730' },
  typingText: { fontSize: 11.5, color: '#7A0EED', fontWeight: '600' },
  onlineText: { fontSize: 11.5, color: '#3ED598', fontWeight: '600' },
  lastSeenText: { fontSize: 11.5, color: '#9A94AE', fontWeight: '500' },
  listContent: { paddingVertical: 12, flexGrow: 1 },
  requestPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  requestHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 6 },
  requestTitle: { fontSize: 15.5, fontWeight: '800', color: '#1A1730', textAlign: 'center' },
  requestSubtitle: { fontSize: 12.5, color: '#9A94AE', textAlign: 'center', lineHeight: 17 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  requestBtn: {
    flex: 1, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  requestBtnBlock: { borderWidth: 1.5, borderColor: '#F5C2C6', backgroundColor: '#FFF5F6' },
  requestBtnRemove: { borderWidth: 1.5, borderColor: '#E6E3EE', backgroundColor: '#FFFFFF' },
  requestBtnAccept: { backgroundColor: '#7A0EED' },
  requestBtnText: { fontSize: 14.5, fontWeight: '700' },
  requestBtnTextBlock: { color: '#E14C57' },
  requestBtnTextRemove: { color: '#60626A' },
  requestBtnTextAccept: { color: '#FFFFFF' },
  blockedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#F4F0FF',
  },
  blockedText: { flex: 1, fontSize: 13.5, color: '#60626A', fontWeight: '600' },
  unblockBtn: {
    minWidth: 92, height: 38, borderRadius: 19, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  unblockText: { fontSize: 13.5, fontWeight: '700', color: '#7A0EED' },
  cantSendBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#F4F0FF', backgroundColor: '#FAF9FD',
  },
  cantSendText: { fontSize: 13.5, fontWeight: '600', color: '#7A7488' },
});
