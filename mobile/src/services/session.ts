import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSession } from '../types';

const SESSION_KEY = 'HOSCOMCO.session.v1';

export async function saveSession(session: UserSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('[Session] save failed:', err);
  }
}

export async function loadSession(): Promise<UserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user) return parsed as UserSession;
    return null;
  } catch (err) {
    console.warn('[Session] load failed:', err);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn('[Session] clear failed:', err);
  }
}

const REMEMBER_KEY = 'HOSCOMCO.remember.v1';

export async function saveRememberme(identifier: string, remember: boolean): Promise<void> {
  try {
    if (remember) {
      await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify({ identifier }));
    } else {
      await AsyncStorage.removeItem(REMEMBER_KEY);
    }
  } catch {}
}

export async function loadRememberme(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(REMEMBER_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.identifier || '';
  } catch {
    return '';
  }
}

export async function clearRememberme(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REMEMBER_KEY);
  } catch {}
}