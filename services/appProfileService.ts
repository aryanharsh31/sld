import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';

const PROFILE_KEY = 'assistive_profile_v1';

export interface AssistiveProfile {
  firstName: string;
  lastName: string;
  email: string;
  classLevel?: number;
  preferredLanguage: string;
  speechFeedbackEnabled: boolean;
  simplificationEnabled: boolean;
  cloudSyncEnabled: boolean;
}

const DEFAULT_PROFILE: AssistiveProfile = {
  firstName: '',
  lastName: '',
  email: '',
  preferredLanguage: 'en',
  speechFeedbackEnabled: true,
  simplificationEnabled: true,
  cloudSyncEnabled: false,
};

class AppProfileService {
  async getProfile(): Promise<AssistiveProfile> {
    const authUser = await authService.getCurrentUser();
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    const stored = raw ? JSON.parse(raw) : {};

    const [firstName, ...restName] = (authUser?.name || '').trim().split(' ').filter(Boolean);

    return {
      ...DEFAULT_PROFILE,
      ...stored,
      firstName: stored.firstName || firstName || '',
      lastName: stored.lastName || restName.join(' '),
      email: stored.email || authUser?.email || '',
    };
  }

  async updateProfile(updates: Partial<AssistiveProfile>): Promise<AssistiveProfile> {
    const current = await this.getProfile();
    const next = {
      ...current,
      ...updates,
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  }

  async getDisplayName(): Promise<string> {
    const profile = await this.getProfile();
    return profile.firstName || profile.email.split('@')[0] || 'Student';
  }
}

export const appProfileService = new AppProfileService();
