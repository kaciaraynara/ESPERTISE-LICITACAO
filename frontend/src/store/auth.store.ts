import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  planAccessLoaded: boolean;
  activePlanId: string;
  activePlanFeatures: string[];

  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  setPlanAccess: (planId: string, features: string[]) => void;
  clearPlanAccess: () => void;
  setAccessToken: (token: string | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (updates: Partial<User>) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: true,
      planAccessLoaded: false,
      activePlanId: 'free',
      activePlanFeatures: [],

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          if (accessToken) {
            localStorage.setItem('token', accessToken);
          }
          const previousUserId = get().user?.id;
          const isDifferentUser = previousUserId !== user.id;
          if (isDifferentUser) {
            localStorage.removeItem('@Expertise:selectedCompany');
          }
          const existingCompany = localStorage.getItem('@Expertise:selectedCompany');
          if (
            (!existingCompany || isDifferentUser) &&
            (user?.company?.id || user?.company_id)
          ) {
            const defaultCompany = user.company ?? {
              id: String(user.company_id),
              razaoSocial: 'Empresa Principal',
              razao_social: 'Empresa Principal',
              cnpj: '',
            };
            localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(defaultCompany));
          }
        }
        set((state) => ({
          user,
          accessToken,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          isAuthenticated: true,
          isInitialized: true,
          ...(state.user?.id === user.id
            ? {}
            : {
                planAccessLoaded: false,
                activePlanId: 'free',
                activePlanFeatures: [],
              }),
        }));
      },

      setPlanAccess: (planId, features) => {
        const normalizedPlan = planId.toLowerCase();
        const planType = normalizedPlan === 'master'
          ? 'MASTER'
          : normalizedPlan === 'pro' || normalizedPlan === 'avancado'
            ? 'MEDIUM'
            : normalizedPlan === 'basic' || normalizedPlan === 'basico'
              ? 'BASIC'
              : null;

        set((state) => ({
          planAccessLoaded: true,
          activePlanId: normalizedPlan,
          activePlanFeatures: [...features],
          user: state.user
            ? {
                ...state.user,
                plano: normalizedPlan as User['plano'],
                planType,
                permissoes: [...features],
              }
            : null,
        }));
      },

      clearPlanAccess: () =>
        set({
          planAccessLoaded: false,
          activePlanId: 'free',
          activePlanFeatures: [],
        }),

      setAccessToken: (accessToken) => {
        if (typeof window !== 'undefined') {
          if (accessToken) {
            localStorage.setItem('token', accessToken);
          } else {
            localStorage.removeItem('token');
          }
        }
        set({ accessToken });
      },

      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== 'undefined' && accessToken) {
          localStorage.setItem('token', accessToken);
        }
        set({ accessToken, refreshToken });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setInitialized: (isInitialized) => set({ isInitialized }),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('@Expertise:selectedCompany');
          localStorage.removeItem('token');
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isInitialized: true,
          planAccessLoaded: false,
          activePlanId: 'free',
          activePlanFeatures: [],
        });
      },
    }),
    {
      name: 'expertise-auth-v1',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
