const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'bin',    // Whisper GGML model files
      'onnx',   // sherpa-onnx model files
      'txt',    // sherpa vocab/tokens
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
