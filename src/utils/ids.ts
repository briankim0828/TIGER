import { generateUUID } from './uuid';

// Create UUID that works in React Native environment
export const newUuid = () => {
  try {
    return generateUUID();
  } catch (error) {
    console.error('UUID generation error:', error);
    // Fallback for React Native environments without crypto.getRandomValues()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

export const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(val); 