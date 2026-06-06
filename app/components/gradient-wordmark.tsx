import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type GradientWordmarkProps = {
  text?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: TextStyle['fontWeight'];
  letterSpacing?: number;
  includeFontPadding?: boolean;
};

const DEFAULT_COLORS = ['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76'] as const;

export function GradientWordmark({
  text = 'Rara Live',
  containerStyle,
  textStyle,
  fontSize = 46,
  lineHeight = 52,
  fontWeight = '900',
  letterSpacing = -0.8,
  includeFontPadding = false,
}: GradientWordmarkProps) {
  const wordmarkDynamicStyle: TextStyle = {
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    includeFontPadding,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <MaskedView
        style={styles.maskedContainer}
        maskElement={
          <View style={styles.maskContent}>
            <Text numberOfLines={1} style={[styles.wordmarkText, wordmarkDynamicStyle, textStyle]}>
              {text}
            </Text>
          </View>
        }>
        <LinearGradient
          colors={DEFAULT_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientFill}
        />
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 64,
    overflow: 'hidden',
  },
  maskedContainer: {
    flex: 1,
  },
  maskContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkText: {
    fontWeight: '900',
  },
  gradientFill: {
    flex: 1,
  },
});
