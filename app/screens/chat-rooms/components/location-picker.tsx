import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiLocationCities, apiLocationStates } from '@/services/api';
import { authStore } from '@/store/auth-store';

// Two-step state → city picker for chatroom creation. Rendered as a
// full-screen overlay inside the Create Room sheet's own Modal (a nested
// Modal is unreliable on Android). Lists come from our backend, which proxies
// the free CountriesNow India API (see backend/routes/location.routes.js).

export type PickedLocation = { state: string; city: string };

type Props = {
  initial?: PickedLocation | null;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
};

// States rarely change — keep them for the app session
let statesCache: string[] | null = null;
const citiesCache = new Map<string, string[]>();

export function LocationPicker({ initial, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'state' | 'city'>(initial?.state ? 'city' : 'state');
  const [state, setState] = useState(initial?.state ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    setError('');
    if (step === 'state') {
      if (statesCache) { setOptions(statesCache); return; }
      setLoading(true);
      const r = await apiLocationStates(token);
      setLoading(false);
      if (r.ok) { statesCache = r.data; setOptions(r.data); } else setError(r.message);
    } else {
      const hit = citiesCache.get(state);
      if (hit) { setOptions(hit); return; }
      setLoading(true);
      const r = await apiLocationCities(state, token);
      setLoading(false);
      if (r.ok) { citiesCache.set(state, r.data); setOptions(r.data); } else setError(r.message);
    }
  }, [step, state]);

  useEffect(() => { setOptions([]); setQuery(''); load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const pickState = (s: string) => {
    if (s !== state) setCity('');
    setState(s);
    setStep('city');
  };

  const isStateStep = step === 'state';

  return (
    // On Android the Create Room sheet's Modal already starts below the status
    // bar, so adding insets.top there doubled the gap above the header. iOS
    // Modals cover the status bar and still need it.
    <View style={[s.overlay, { paddingTop: (Platform.OS === 'ios' ? insets.top : 0) + 8, paddingBottom: insets.bottom + 12 }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={isStateStep ? onClose : () => setStep('state')}
          style={s.headerBtn}
          hitSlop={8}>
          <Ionicons name={isStateStep ? 'close' : 'chevron-back'} size={18} color="#60626A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{isStateStep ? 'Select Your State' : 'Select Your City'}</Text>
          {!isStateStep && <Text style={s.subtitle}>{state}</Text>}
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color="#ABADB2" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isStateStep ? 'Search state' : 'Search city'}
          placeholderTextColor="#ABADB2"
          style={s.searchInput}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#B5AFC7" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips */}
      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={36} color="#D8D3EC" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={s.retryBtn}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <Text style={s.empty}>No matches</Text>
          ) : filtered.map(o => {
            const selected = isStateStep ? o === state : o === city;
            return (
              <TouchableOpacity
                key={o}
                activeOpacity={0.8}
                onPress={() => (isStateStep ? pickState(o) : setCity(o))}
                style={[s.chip, selected && s.chipSelected]}>
                {selected && <Ionicons name="checkmark" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />}
                <Text style={[s.chipText, selected && s.chipTextSelected]}>{o}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* OK — only once a city is picked */}
      {!isStateStep && !!city && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onConfirm({ state, city })} style={s.okBtn}>
          <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.okGradient}>
            <Ionicons name="location" size={16} color="#FFFFFF" />
            <Text style={s.okText}>OK · {city}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Matches the Create Room sheet: 20 side padding, 18 title, 50/44 inputs,
// the same small tag chips (purple when picked) and the same gradient button.
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', paddingHorizontal: 20, zIndex: 50, elevation: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  headerBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  subtitle: { fontSize: 12, fontWeight: '600', color: '#7A0EED', marginTop: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F7F5FF', borderRadius: 12, paddingHorizontal: 14, height: 44, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1E22', padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F4F5F8', borderWidth: 1, borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#7A0EED', borderColor: '#7A0EED' },
  chipText: { fontSize: 13, color: '#60626A', fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  center: { alignItems: 'center', gap: 10, marginTop: 48 },
  errorText: { fontSize: 13, color: '#60626A', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#F4EEFF' },
  retryText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },
  empty: { fontSize: 13, color: '#ABADB2', marginTop: 24, width: '100%', textAlign: 'center' },
  okBtn: { borderRadius: 48, overflow: 'hidden', marginTop: 8 },
  okGradient: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  okText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
