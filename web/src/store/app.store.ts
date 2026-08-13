import { create } from 'zustand';
import { api } from '@api/client';

export interface AppUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface HealthScore {
  overall_score: number;
  sleep_score: number;
  activity_score: number;
  nutrition_score: number;
  trend: 'up' | 'down' | 'flat';
}

interface AppState {
  user: AppUser | null;
  authLoading: boolean;
  healthScore: HealthScore | null;
  healthScoreLoading: boolean;

  fetchUser: () => Promise<void>;
  signin: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchHealthScore: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authLoading: false,
  healthScore: null,
  healthScoreLoading: false,

  fetchUser: async () => {
    if (!api.isAuthenticated()) {
      set({ user: null });
      return;
    }
    set({ authLoading: true });
    const res = await api.getMe();
    set({ user: res.success ? (res.data as AppUser) : null, authLoading: false });
  },

  signin: async (email, password) => {
    set({ authLoading: true });
    const res = await api.signin(email, password);
    set({ authLoading: false });
    if (res.success && res.data) {
      set({ user: (res.data as { user: AppUser }).user });
      return true;
    }
    return false;
  },

  signup: async (email, password, firstName, lastName) => {
    set({ authLoading: true });
    const res = await api.signup(email, password, firstName, lastName);
    set({ authLoading: false });
    if (res.success && res.data) {
      set({ user: (res.data as { user: AppUser }).user });
      return true;
    }
    return false;
  },

  logout: async () => {
    await api.logout();
    set({ user: null, healthScore: null });
  },

  fetchHealthScore: async () => {
    set({ healthScoreLoading: true });
    const res = await api.getHealthScore();
    set({
      healthScore: res.success ? (res.data as HealthScore) : null,
      healthScoreLoading: false,
    });
  },
}));
