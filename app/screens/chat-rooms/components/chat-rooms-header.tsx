import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

const COIN_IMG = require('@/assets/tabs/coin.png');
const LEADERBOARD_IMG = require('@/assets/tabs/leaderboard.png');
const LEVEL_IMG = require('@/assets/tabs/profilelevel.png');

type ChatRoomsHeaderProps = {
  avatarUri?: string;
  onAvatarPress?: () => void;
  onStatsPress?: () => void;
  onMicPress?: () => void;
};

export function ChatRoomsHeader({
  onAvatarPress,
  onStatsPress,
  onMicPress,
}: ChatRoomsHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Brand wordmark */}
      <MaskedView
        style={styles.maskedContainer}
        maskElement={
          <View style={styles.maskContent}>
            <Text style={styles.brandText}>Rara Live</Text>
          </View>
        }>
        <LinearGradient
          colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientFill}
        />
      </MaskedView>

      {/* Right icons */}
      <View style={styles.rightIcons}>
        {/* Coin icon */}
        <TouchableOpacity onPress={onStatsPress} style={styles.iconButton} activeOpacity={0.75}>
          <Image source={COIN_IMG} style={styles.coinImg} resizeMode="contain" />
        </TouchableOpacity>

        {/* Leaderboard icon */}
        <TouchableOpacity onPress={onStatsPress} style={styles.iconButton} activeOpacity={0.75}>
          <Image source={LEADERBOARD_IMG} style={styles.leaderboardImg} resizeMode="contain" />
        </TouchableOpacity>

        {/* Level icon */}
        <TouchableOpacity onPress={onMicPress} style={styles.iconButton} activeOpacity={0.85}>
          <Image source={LEVEL_IMG} style={styles.levelImg} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  maskedContainer: {
    width: 130,
    height: 36,
  },
  maskContent: {
    flex: 1,
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  gradientFill: {
    flex: 1,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    borderRadius: 24,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7A0EED',
  },
  gemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F0FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  gemsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A855F7',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0FF',
  },
  coinImg: {
    width: 24,
    height: 24,
  },
  leaderboardImg: {
    width: 24,
    height: 24,
  },
  levelImg: {
    width: 24,
    height: 24,
  },
});
