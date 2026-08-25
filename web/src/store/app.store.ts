import { create } from 'zustand';
import { api } from '@api/client';

export interface AppUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  /** Null until the onboarding wizard has been through — or skipped past. */
  onboarded_at: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  activity_level: string | null;
  goal: string | null;
  goal_weight_kg: string | number | null;
  rate_kg_per_week: string | number | null;
}

export interface HealthScore {
  /** Null on a day with nothing logged: unscored, rather than scored badly. */
  overall_score: number | null;
  sleep_score: number | null;
  activity_score: number | null;
  nutrition_score: number | null;
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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoading: true,
  healthScore: null,
  healthScoreLoading: false,

  fetchUser: async () => {
    if (!api.isAuthenticated()) {
      set({ user: null, authLoading: false });
      return;
    }
    const res = await api.getMe();
    set({ user: res.success ? (res.data as AppUser) : null, authLoading: false });
  },

  // Both of these read the profile back rather than trusting the auth
  // response, which carries only the account row. `user` is checked for
  // profile fields like onboarded_at, so it has to mean the same thing however
  // the session began — otherwise signing in bounces you into the wizard you
  // already finished.
  signin: async (email, password) => {
    set({ authLoading: true });
    const res = await api.signin(email, password);
    if (res.success && res.data) {
      await get().fetchUser();
      return true;
    }
    set({ authLoading: false });
    return false;
  },

  signup: async (email, password, firstName, lastName) => {
    set({ authLoading: true });
    const res = await api.signup(email, password, firstName, lastName);
    if (res.success && res.data) {
      await get().fetchUser();
      return true;
    }
    set({ authLoading: false });
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
