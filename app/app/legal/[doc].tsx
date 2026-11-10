import { Redirect, useLocalSearchParams } from 'expo-router';

import { LEGAL_DOCS, type LegalDocId } from '@/screens/legal/legal-content';
import { LegalScreen } from '@/screens/legal/legal-screen';

export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!doc || !(doc in LEGAL_DOCS)) return <Redirect href="/" />;
  return <LegalScreen docId={doc as LegalDocId} />;
}
