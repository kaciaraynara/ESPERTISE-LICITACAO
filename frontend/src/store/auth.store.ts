import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

const TRIAL_WINDOW_DAYS = 15;
const TRIAL_WINDOW_MS = TRIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function computeUserTrialState(user: User): User {
  const now = Date.now();
  let trialActive = user.isTrialActive === true;
  let daysLeft = typeof user.daysLeftTrial === 'number' ? user.daysLeftTrial : 0;

  if (user.trialEndsAt) {
    const endsAtMs = new Date(user.trialEndsAt).getTime();
    if (!Number.isNaN(endsAtMs)) {
      trialActive = endsAtMs > now;
      daysLeft = trialActive
        ? Math.max(1, Math.ceil((endsAtMs - now) / (1000 * 60 * 60 * 24)))
        : 0;
    }
  } else {
    const rawCreatedAt =
      user.created_at || (user as User & { createdAt?: string }).createdAt;
    if (rawCreatedAt) {
      const createdAtMs = new Date(rawCreatedAt).getTime();
      if (!Number.isNaN(createdAtMs)) {
        const endsAtMs = createdAtMs + TRIAL_WINDOW_MS;
        trialActive = endsAtMs > now;
        daysLeft = trialActive
          ? Math.max(1, Math.ceil((endsAtMs - now) / (1000 * 60 * 60 * 24)))
          : 0;
      }
    } else if (user.isTrialActive !== false) {
      trialActive = true;
      daysLeft = TRIAL_WINDOW_DAYS;
    }
  }

  return {
    ...user,
    isTrialActive: trialActive,
    daysLeftTrial: daysLeft,
    plano: trialActive ? ('master' as User['plano']) : user.plano,
    planType: trialActive ? 'MASTER' : user.planType,
  };
}

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
        const normalizedUser = computeUserTrialState(user);
        if (typeof window !== 'undefined') {
          if (accessToken) {
            localStorage.setItem('token', accessToken);
          }
          const previousUserId = get().user?.id;
          const isDifferentUser = previousUserId !== normalizedUser.id;
          if (isDifferentUser) {
            localStorage.removeItem('@Expertise:selectedCompany');
          }
          const existingCompany = localStorage.getItem('@Expertise:selectedCompany');
          if (
            (!existingCompany || isDifferentUser) &&
            (normalizedUser?.company?.id || normalizedUser?.company_id)
          ) {
            const defaultCompany = normalizedUser.company ?? {
              id: String(normalizedUser.company_id),
              razaoSocial: 'Empresa Principal',
              razao_social: 'Empresa Principal',
              cnpj: '',
            };
            localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(defaultCompany));
          }
        }
        set((state) => ({
          user: normalizedUser,
          accessToken,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          isAuthenticated: true,
          isInitialized: true,
          ...(state.user?.id === normalizedUser.id
            ? {}
            : {
                planAccessLoaded: Boolean(normalizedUser.isTrialActive),
                activePlanId: normalizedUser.isTrialActive ? 'master' : 'free',
                activePlanFeatures: normalizedUser.permissoes ?? [],
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

        set((state) => {
          const currentUser = state.user ? computeUserTrialState(state.user) : null;
          const trialStillActive = Boolean(currentUser?.isTrialActive);
          const effectivePlanId =
            trialStillActive && (normalizedPlan === 'free' || normalizedPlan === 'none')
              ? 'master'
              : normalizedPlan;

          return {
            planAccessLoaded: true,
            activePlanId: effectivePlanId,
            activePlanFeatures: [...features],
            user: currentUser
              ? {
                  ...currentUser,
                  plano: effectivePlanId as User['plano'],
                  planType: trialStillActive ? 'MASTER' : planType,
                  permissoes: features.length > 0 ? [...features] : (currentUser.permissoes ?? []),
                }
              : null,
          };
        });
      },

      clearPlanAccess: () =>
        set((state) => {
          const currentUser = state.user ? computeUserTrialState(state.user) : null;
          const trialStillActive = Boolean(currentUser?.isTrialActive);
          return {
            planAccessLoaded: trialStillActive,
            activePlanId: trialStillActive ? 'master' : 'free',
            activePlanFeatures: trialStillActive ? (currentUser?.permissoes ?? []) : [],
          };
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
