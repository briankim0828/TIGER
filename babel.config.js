const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: path.resolve(__dirname, '.env'),
        },
      ],
      // Reanimated plugin must be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
  