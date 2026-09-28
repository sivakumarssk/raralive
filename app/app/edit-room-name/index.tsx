import { useLocalSearchParams } from 'expo-router';
import { EditRoomNameScreen } from '@/screens/edit-room-name/edit-room-name-screen';

export default function EditRoomNamePage() {
  const { roomId, currentName } = useLocalSearchParams<{ roomId?: string; currentName?: string }>();
  return <EditRoomNameScreen roomId={roomId ?? ''} currentName={currentName ?? ''} />;
}
