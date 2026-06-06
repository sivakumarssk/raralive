import { StatusBar } from 'expo-status-bar';
import { BattleLiveScreen } from '@/screens/battle/battle-live-screen';

export default function BattleLivePage() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <BattleLiveScreen />
    </>
  );
}
