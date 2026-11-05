import { useMemo, useRef } from 'react';
import { Animated, useWindowDimensions } from 'react-native';

// Avatar size once the cover has scrolled away, as a fraction of its full size.
const AVATAR_MIN_SCALE = 0.8;
const COVER_MAX_DIM = 0.35;
// How far a short profile can still scroll, as a fraction of the cover height.
const MIN_SCROLL = 0.6;

/**
 * Scroll effect shared by the profile pages: the cover drifts at half speed so
 * the profile slides up over it, the avatar shrinks a little and the cover
 * dims. Pulling down past the top (iOS bounce) stretches the cover instead.
 * Runs on the native driver, so the page must use Animated.ScrollView.
 */
export function useProfileScroll(coverHeight: number) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();

  return useMemo(() => ({
    /** Page content's minimum height — keeps the effect working on a short profile. */
    contentMinHeight: height + Math.round(coverHeight * MIN_SCROLL),
    onScroll: Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true },
    ),
    coverStyle: {
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [-coverHeight, 0, coverHeight],
            outputRange: [-coverHeight / 2, 0, coverHeight / 2],
            extrapolateRight: 'clamp',
          }),
        },
        {
          scale: scrollY.interpolate({
            inputRange: [-coverHeight, 0],
            outputRange: [2, 1],
            extrapolateRight: 'clamp',
          }),
        },
      ],
    },
    coverDimStyle: {
      opacity: scrollY.interpolate({
        inputRange: [0, coverHeight],
        outputRange: [0, COVER_MAX_DIM],
        extrapolate: 'clamp',
      }),
    },
    avatarStyle: {
      transform: [{
        scale: scrollY.interpolate({
          inputRange: [0, coverHeight],
          outputRange: [1, AVATAR_MIN_SCALE],
          extrapolate: 'clamp',
        }),
      }],
    },
  }), [scrollY, coverHeight, height]);
}
