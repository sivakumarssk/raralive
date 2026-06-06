import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ChatTab = 'live' | 'friend-zone' | 'chat-rooms';

type TabSwitcherProps = {
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
};

const TABS: { key: ChatTab; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'friend-zone', label: 'Friend Zone' },
  { key: 'chat-rooms', label: 'Chat Rooms' },
];

export function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    // Outer wrapper provides the visual separation from the header above
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.75}
              style={styles.tabButton}>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Gray background block separates it from the white header
  wrapper: {
    backgroundColor: '#F2EEF9',
    paddingTop: 2,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEAF6',
    paddingHorizontal: 20,
  },
  tabButton: {
    paddingVertical: 14,
    marginRight: 28,
    position: 'relative',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ABADB2',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#7A0EED',
    fontWeight: '700',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#7A0EED',
  },
});
