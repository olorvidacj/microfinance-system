const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The app imports rules and types shared with the server and the web portal
// from ../shared (see src/shared/). That folder has no dependencies of its own;
// anything it might import resolves from this app's node_modules.
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
