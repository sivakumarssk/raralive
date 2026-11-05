import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// A <Modal> is its own window on Android. With `navigationBarTranslucent` it
// draws behind the system navigation bar, but the screen's useSafeAreaInsets()
// describes the *screen's* window — with edge-to-edge off that's 0 even when a
// 3-button bar (< ○ ≡) is showing, so a sheet padded with it slides under the
// bar. These helpers measure insets inside the modal's own window instead:
// the real nav-bar height when there is one, 0 when there isn't.

/** Wrap a translucent Modal's content so insets are measured for the modal window. */
export function ModalSafeArea({ children }: { children: ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

/**
 * Bottom-anchored sheet body; adds the modal window's bottom inset to its
 * padding. Must be rendered inside <ModalSafeArea>.
 */
export function ModalBottomSheet({ style, minPadding = 8, extraPadding = 0, children }: {
  style?: StyleProp<ViewStyle>;
  /** Bottom padding used when the device has no bottom inset. */
  minPadding?: number;
  /** Added on top of the inset/minimum. */
  extraPadding?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[style, { paddingBottom: Math.max(insets.bottom, minPadding) + extraPadding }]}>
      {children}
    </View>
  );
}
