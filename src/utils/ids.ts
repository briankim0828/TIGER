// UUID helpers consolidated here so we only have one source of truth.
// Ensure cryptographically secure random values are available in React Native.
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Create UUID that works reliably in React Native + Expo
export const newUuid = (): string => {
  try {
    return uuidv4();
  } catch (error) {
    console.error('UUID generation error:', error);
    // Fallback for environments without secure RNG (should be rare with the polyfill)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

export const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(val); 