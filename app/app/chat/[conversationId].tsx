import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ChatConversationScreen } from '@/screens/chat/chat-conversation-screen';
import { apiChatConversation, type ChatConversation } from '@/services/api';
import { authStore } from '@/store/auth-store';

export default function ChatConversationPage() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;
    const token = authStore.getToken();
    if (!token) { router.back(); return; }
    apiChatConversation(conversationId, token).then((res) => {
      if (res.ok) setConversation(res.data);
      else router.back();
      setLoading(false);
    });
  }, [conversationId]);

  if (loading || !conversationId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7A0EED" />
      </View>
    );
  }

  return <ChatConversationScreen conversationId={conversationId} conversation={conversation ?? undefined} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
