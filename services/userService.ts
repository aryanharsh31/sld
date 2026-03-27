import { appProfileService } from './appProfileService';

export interface UserClass {
  class?: number;
}

export const userService = {
  async getUserClass(): Promise<number | null> {
    try {
      const profile = await appProfileService.getProfile();
      return profile.classLevel || null;
    } catch (error) {
      console.error('Error getting user class:', error);
      return null;
    }
  },

  async updateUserClass(classNumber: number): Promise<boolean> {
    try {
      await appProfileService.updateProfile({ classLevel: classNumber });
      return true;
    } catch (error) {
      console.error('Error updating user class:', error);
      return false;
    }
  }
};
