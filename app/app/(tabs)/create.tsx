import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CreateScreen, MediaAsset } from '@/screens/create/create-screen';
import { PostScreen } from '@/screens/create/post-screen';

type Step = 'pick' | 'compose';

export default function CreateTab() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<MediaAsset[]>([]);

  if (step === 'compose' && selected.length > 0) {
    return (
      <PostScreen
        assets={selected}
        onBack={() => setStep('pick')}
        onPublish={() => {
          setSelected([]);
          setStep('pick');
        }}
      />
    );
  }

  return (
    <CreateScreen
      onNext={(assets) => {
        setSelected(assets);
        setStep('compose');
      }}
      onClose={() => router.back()}
    />
  );
}