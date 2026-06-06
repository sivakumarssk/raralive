import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

type AppScreenHeaderProps = {
  /** Title text rendered with purple→pink gradient */
  title: string;
  /** Optional Ionicons icon shown before the title */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Back chevron on the left */
  onBack?: () => void;
  /** Cross (×) icon on the right — navigates back/close */
  onClose?: () => void;
  /** Any other right-side element (overrides onClose) */
  right?: ReactNode;
  /** Match the screen background colour — defaults to white */
  backgroundColor?: string;
  /** Hide the bottom drop-shadow gradient (e.g. on home screen where bg blends in) */
  noBottomShadow?: boolean;
};

export function AppScreenHeader({ title, icon, onBack, onClose, right, backgroundColor = '#FFFFFF', noBottomShadow }: AppScreenHeaderProps) {
  const rightEl = right ?? (onClose ? (
    <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={12} activeOpacity={0.7}>
      <Ionicons name="close" size={24} color="#1C1E22" />
    </TouchableOpacity>
  ) : null);

  return (
    <View style={[s.wrapper, { backgroundColor }]}>
      <View style={s.container}>
        {/* Left: back button */}
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color="#1C1E22" />
          </TouchableOpacity>
        )}

        {/* Title + icon — left-aligned, takes all remaining space */}
        <View style={s.titleRow}>
          {icon && <Ionicons name={icon} size={20} color="#7A0EED" />}
          <MaskedView
            style={{ height: 34, width: title.length * 14 + 8 }}
            maskElement={
              <View style={s.maskContent}>
                <Text style={s.maskText}>{title}</Text>
              </View>
            }>
            <LinearGradient
              colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </MaskedView>
        </View>

        {/* Right */}
        {rightEl && <View style={s.right}>{rightEl}</View>}
      </View>

      {!noBottomShadow && (
        <LinearGradient
          colors={['rgba(122,14,237,0.05)', 'rgba(122,14,237,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.shadow}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {},
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  maskContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  maskText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  shadow: {
    height: 8,
    marginTop: -1,
  },
});
