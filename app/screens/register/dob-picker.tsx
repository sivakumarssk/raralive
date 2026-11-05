import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Drum-roll date picker ─────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ITEM_H = 48;
const VISIBLE = 5; // odd number — centre item is selected
const PICKER_H = ITEM_H * VISIBLE;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** YYYY-MM-DD, the format the profile API expects. */
export function formatDob(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function displayDob(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

type DrumColProps = {
  items: string[];
  selectedIndex: number;
  onChange: (idx: number) => void;
};

function DrumCol({ items, selectedIndex, onChange }: DrumColProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);

  // Pad top/bottom so first/last items can reach centre
  const pad = Math.floor(VISIBLE / 2);
  const padded = [...Array(pad).fill(''), ...items, ...Array(pad).fill('')];

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
    isDragging.current = false;
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isDragging.current) return;
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
  };

  return (
    <View style={drum.col}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onScrollEnd}
        scrollEventThrottle={16}
        style={{ height: PICKER_H }}
        contentContainerStyle={{ paddingVertical: 0 }}>
        {padded.map((label, i) => {
          const actualIdx = i - pad;
          const isSelected = actualIdx === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={label ? 0.7 : 1}
              onPress={() => {
                if (!label) return;
                onChange(actualIdx);
                scrollRef.current?.scrollTo({ y: actualIdx * ITEM_H, animated: true });
              }}
              style={[drum.item, isSelected && drum.itemSelected]}>
              <Text style={[drum.itemText, isSelected && drum.itemTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

type DatePickerProps = {
  visible: boolean;
  initialDate?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

export function DatePickerModal({ visible, initialDate, onConfirm, onClose }: DatePickerProps) {
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  const minYear = today.getFullYear() - 100;

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));

  const [monthIdx, setMonthIdx] = useState(initialDate?.getMonth() ?? today.getMonth());
  const [yearIdx, setYearIdx] = useState(
    initialDate ? years.indexOf(String(initialDate.getFullYear())) : 0
  );

  const currentYear = Number(years[yearIdx] ?? maxYear);
  const totalDays = daysInMonth(monthIdx, currentYear);
  const dayItems = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const [dayIdx, setDayIdx] = useState(
    Math.min(initialDate ? initialDate.getDate() - 1 : 0, totalDays - 1)
  );

  // Clamp day when month/year changes
  useEffect(() => {
    const max = daysInMonth(monthIdx, currentYear) - 1;
    if (dayIdx > max) setDayIdx(max);
  }, [monthIdx, yearIdx]);

  const handleConfirm = () => {
    const day = dayIdx + 1;
    const date = new Date(currentYear, monthIdx, day);
    onConfirm(date);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={drum.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={drum.sheet}>
          <Text style={drum.title}>Date of Birth</Text>
          <Text style={drum.hint}>Must be 18 or older</Text>

          <View style={drum.pickerWrap}>
            {/* Selection highlight bar */}
            <View pointerEvents="none" style={drum.selectionBar} />

            {/* Day */}
            <DrumCol items={dayItems} selectedIndex={dayIdx} onChange={setDayIdx} />

            {/* Month */}
            <DrumCol items={MONTHS_SHORT} selectedIndex={monthIdx} onChange={setMonthIdx} />

            {/* Year */}
            <DrumCol items={years} selectedIndex={yearIdx} onChange={setYearIdx} />
          </View>

          <View style={drum.actions}>
            <TouchableOpacity onPress={onClose} style={drum.cancelBtn}>
              <Text style={drum.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={drum.confirmBtn}>
              <Text style={drum.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Drum-roll picker styles ───────────────────────────────────────────────────
const drum = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1C1E22', textAlign: 'center', letterSpacing: -0.2 },
  hint: { fontSize: 12, color: '#ABADB2', textAlign: 'center', marginTop: 2, marginBottom: 12 },
  pickerWrap: {
    flexDirection: 'row', height: PICKER_H,
    borderRadius: 16, overflow: 'hidden',
    position: 'relative',
  },
  selectionBar: {
    position: 'absolute',
    left: 0, right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    backgroundColor: '#F0EAFF',
    borderRadius: 10,
    zIndex: 0,
  },
  col: {
    flex: 1, overflow: 'hidden',
  },
  item: {
    height: ITEM_H,
    alignItems: 'center', justifyContent: 'center',
  },
  itemSelected: {},
  itemText: { fontSize: 18, fontWeight: '500', color: '#ABADB2' },
  itemTextSelected: { fontSize: 20, fontWeight: '800', color: '#7A0EED' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E0DFF5',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#60626A' },
  confirmBtn: {
    flex: 2, height: 48, borderRadius: 14, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
