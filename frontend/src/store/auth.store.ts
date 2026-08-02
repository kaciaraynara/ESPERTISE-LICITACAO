import { create } from 'zustand';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string | null) => void;
  updateUser: (updates: Partial<User>) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isInitialized: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isInitialized: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setInitialized: (isInitialized) => set({ isInitialized }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false, isInitialized: true }),
    }));
