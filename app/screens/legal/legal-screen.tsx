import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { GradientButton } from '@/components/ui/gradient-button';
import { authStore } from '@/store/auth-store';
import { COMPANY, LEGAL_DOCS, LEGAL_UPDATED, type LegalBlock, type LegalDocId } from './legal-content';

/** Renders text with **bold** parts. */
function Rich({ text, style }: { text: string; style: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((part, i) => part.startsWith('**') && part.endsWith('**')
        ? <Text key={i} style={s.bold}>{part.slice(2, -2)}</Text>
        : <Fragment key={i}>{part}</Fragment>)}
    </Text>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if ('h2' in block) return <Text style={s.h2}>{block.h2}</Text>;
  if ('h3' in block) return <Text style={s.h3}>{block.h3}</Text>;
  if ('p' in block) return <Rich text={block.p} style={s.p} />;
  if ('ul' in block || 'ol' in block) {
    const items = 'ul' in block ? block.ul : block.ol;
    return (
      <View style={s.list}>
        {items.map((item, i) => (
          <View key={i} style={s.listItem}>
            <Text style={s.bullet}>{'ol' in block ? `${i + 1}.` : '•'}</Text>
            <Rich text={item} style={[s.p, s.listText]} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={s.table}>
      <View style={[s.tableRow, s.tableHead]}>
        <Text style={[s.tableCell, s.tableKey, s.bold]}>{block.table.head[0]}</Text>
        <Text style={[s.tableCell, s.bold]}>{block.table.head[1]}</Text>
      </View>
      {block.table.rows.map(([key, value]) => (
        <View key={key} style={s.tableRow}>
          <Text style={[s.tableCell, s.tableKey]}>{key}</Text>
          <Text style={s.tableCell}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Opens the user's mail app with the deletion request filled in. */
function emailDeletionRequest() {
  const user = authStore.getUser();
  const subject = encodeURIComponent('Rara Live – Account deletion request');
  const body = encodeURIComponent(
    'Please delete my Rara Live account and associated data.\n\n' +
    `Registered phone number: ${user?.phone ?? ''}\n` +
    `Username: ${user?.username ?? ''}\n\n` +
    'I understand that deletion is permanent and any remaining coins, gems and earnings will be lost.',
  );
  Linking.openURL(`mailto:${COMPANY.email}?subject=${subject}&body=${body}`).catch(() => {});
}

/** Privacy Policy, Terms of Service or Delete Account, shown inside the app. */
export function LegalScreen({ docId }: { docId: LegalDocId }) {
  const router = useRouter();
  const doc = LEGAL_DOCS[docId];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <AppScreenHeader title={doc.title} onBack={() => router.back()} />
      {/* A list, not a ScrollView: only the first screenful is built before the
          page slides in, so opening it is instant even for the long policies */}
      <FlatList
        data={doc.blocks}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Block block={item} />}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Text style={s.updated}>Last updated: {LEGAL_UPDATED}</Text>
            <View style={s.intro}>
              <Rich text={doc.intro} style={s.introText} />
            </View>
          </>
        }
        ListFooterComponent={
          <>
            {docId === 'delete-account' && (
              <View style={s.actions}>
                <GradientButton label="Email a deletion request" iconName="mail" onPress={emailDeletionRequest} height={48} fontSize={15} />
                <Text style={s.actionHint}>Your registered phone number and username are filled in for you.</Text>
              </View>
            )}

            {/* The other two documents, also in-app */}
            <View style={s.related}>
              {(['privacy-policy', 'terms', 'delete-account'] as const).filter(id => id !== docId).map(id => (
                <TouchableOpacity key={id} style={s.relatedRow} activeOpacity={0.7} onPress={() => router.replace(`/legal/${id}` as never)}>
                  <Text style={s.relatedText}>{LEGAL_DOCS[id].title}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ABADB2" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  updated: { fontSize: 12, color: '#8A8C93', marginTop: 4, marginBottom: 12 },
  intro: {
    backgroundColor: '#F7F2FF', borderRadius: 12, padding: 14, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: '#7A0EED',
  },
  introText: { fontSize: 14, lineHeight: 21, color: '#3A3C42' },
  h2: { fontSize: 16, fontWeight: '800', color: '#1C1E22', marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 14, fontWeight: '700', color: '#3A3C42', marginTop: 12, marginBottom: 6 },
  p: { fontSize: 14, lineHeight: 21, color: '#4A4C52', marginBottom: 8 },
  bold: { fontWeight: '700', color: '#1C1E22' },
  list: { gap: 6, marginBottom: 8 },
  listItem: { flexDirection: 'row', gap: 8 },
  bullet: { width: 16, fontSize: 14, lineHeight: 21, color: '#7A0EED', fontWeight: '700' },
  listText: { flex: 1, marginBottom: 0 },
  table: { borderWidth: 1, borderColor: '#EEEAF6', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEEAF6' },
  tableHead: { backgroundColor: '#F7F2FF', borderTopWidth: 0 },
  tableCell: { flex: 1, padding: 10, fontSize: 13, lineHeight: 19, color: '#4A4C52' },
  tableKey: { flex: 0.6, color: '#1C1E22', fontWeight: '600' },
  actions: { marginTop: 16, gap: 8 },
  actionHint: { fontSize: 12, color: '#8A8C93', textAlign: 'center' },
  related: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#F0EDF8' },
  relatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0EDF8' },
  relatedText: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
});
