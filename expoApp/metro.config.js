const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*\/nativeEngine\/target\/.*/,
  /.*\/target\/.*/,
  /.*\/buildArtifacts\/.*/
];

module.exports = config;
