const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Only mock Agora in Expo Go (detected by EXPO_PUBLIC_USE_AGORA_MOCK=true)
// Dev builds and production builds use the real native module
const USE_AGORA_MOCK = process.env.EXPO_PUBLIC_USE_AGORA_MOCK === 'true';

if (USE_AGORA_MOCK) {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-agora') {
      return {
        filePath: path.resolve(__dirname, 'mocks/react-native-agora.js'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
