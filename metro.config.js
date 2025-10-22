const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure packages that provide a "browser" export (e.g., supabase-js) resolve to the
// non-Node build in React Native, while keeping package exports enabled for modern libs
// like Reanimated v4. This avoids importing Node stdlib modules (e.g., `https` from `ws`).
config.resolver.unstable_conditionNames = [
	'react-native',
	'browser',
	'import',
	'require',
	'default',
];

module.exports = config; 