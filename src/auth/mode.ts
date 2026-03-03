import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppAuthMode = 'authenticated' | 'guest';

export const AUTH_MODE_STORAGE_KEY = 'app_auth_mode';
export const LOCAL_GUEST_USER_ID = 'local-user';
export const GUEST_DISPLAY_NAME_STORAGE_KEY = 'guest_display_name';

export async function getStoredAuthMode(): Promise<AppAuthMode> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_MODE_STORAGE_KEY);
    return raw === 'guest' ? 'guest' : 'authenticated';
  } catch {
    return 'authenticated';
  }
}

export async function setStoredAuthMode(mode: AppAuthMode): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
  } catch {}
}

export async function getStoredGuestDisplayName(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_DISPLAY_NAME_STORAGE_KEY);
    return (raw ?? '').trim();
  } catch {
    return '';
  }
}

export async function setStoredGuestDisplayName(name: string): Promise<void> {
  try {
    const normalized = name.trim();
    await AsyncStorage.setItem(GUEST_DISPLAY_NAME_STORAGE_KEY, normalized);
  } catch {}
}
