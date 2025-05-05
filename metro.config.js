const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Workaround for Supabase + Expo SDK 53 issue
// See: https://github.com/supabase/supabase-js/issues/1400
config.resolver.unstable_conditionNames = ['browser', 'require']; // Add 'browser'
config.resolver.unstable_enablePackageExports = false; // Disable package exports

module.exports = config; 