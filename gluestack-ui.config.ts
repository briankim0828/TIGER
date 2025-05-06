import { createConfig } from '@gluestack-ui/themed';
import { config as defaultConfig } from '@gluestack-ui/config';

export const config = createConfig(defaultConfig);

// Get the type of Config
type ConfigType = typeof config;

// Extend the internal Config interface
declare module '@gluestack-ui/themed' {
  interface UIConfig extends ConfigType {}
} 