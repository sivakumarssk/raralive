import { useLocalSearchParams } from 'expo-router';

import { PostScreen } from '@/screens/post/post-screen';

export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostScreen postId={id} />;
}
