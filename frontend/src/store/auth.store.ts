import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User } from '@/types';

const TRIAL_WINDOW_DAYS = 10;
const TRIAL_WINDOW_MS = TRIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const KEEP_LOGGED_IN_KEY = '@Expertise:keepLoggedIn';

function isKeepLoggedInPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEEP_LOGGED_IN_KEY) === '1';
}

const safeAuthStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return {
    getItem: (name: string) => {
      const fromSession = window.sessionStorage.getItem(name);
      if (fromSession) return fromSession;
      if (isKeepLoggedInPreference()) {
        return window.localStorage.getItem(name);
      }
      if (window.localStorage.getItem(name)) {
        window.localStorage.removeItem(name);
      }
      if (window.localStorage.getItem('token')) {
        window.localStorage.removeItem('token');
      }
      return null;
    },
    setItem: (name: string, value: string) => {
      window.sessionStorage.setItem(name, value);
      if (isKeepLoggedInPreference()) {
        window.localStorage.setItem(name, value);
      } else {
        window.localStorage.removeItem(name);
      }
    },
    removeItem: (name: string) => {
      window.sessionStorage.removeItem(name);
      window.localStorage.removeItem(name);
    },
  };
});

function computeUserTrialState(user: User): User {
  const now = Date.now();
  let trialActive = user.isTrialActive === true;
  let daysLeft = typeof user.daysLeftTrial === 'number' ? Math.min(TRIAL_WINDOW_DAYS, user.daysLeftTrial) : 0;

  if (user.trialEndsAt) {
    const endsAtMs = new Date(user.trialEndsAt).getTime();
    if (!Number.isNaN(endsAtMs)) {
      trialActive = endsAtMs > now;
      daysLeft = trialActive
        ? Math.min(TRIAL_WINDOW_DAYS, Math.max(1, Math.ceil((endsAtMs - now) / (1000 * 60 * 60 * 24))))
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
          ? Math.min(TRIAL_WINDOW_DAYS, Math.max(1, Math.ceil((endsAtMs - now) / (1000 * 60 * 60 * 24))))
          : 0;
      }
    } else if (user.isTrialActive !== false) {
      trialActive = true;
      daysLeft = TRIAL_WINDOW_DAYS;
    }
  }

  const normalizedPlanLevel =
    user.planLevel && /trial\s*enterprise/i.test(user.planLevel)
      ? 'Teste Gratuito'
      : trialActive && !user.planLevel
        ? 'Teste Gratuito'
        : user.planLevel;

  return {
    ...user,
    planLevel: normalizedPlanLevel,
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
  keepLoggedIn: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  planAccessLoaded: boolean;
  activePlanId: string;
  activePlanFeatures: string[];

  setAuth: (user: User, accessToken: string, refreshToken?: string, keepLoggedIn?: boolean) => void;
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
      keepLoggedIn: false,
      isAuthenticated: false,
      isInitialized: true,
      planAccessLoaded: false,
      activePlanId: 'free',
      activePlanFeatures: [],

      setAuth: (user, accessToken, refreshToken, keepLoggedIn) => {
        const normalizedUser = computeUserTrialState(user);
        const persistLongLived =
          keepLoggedIn !== undefined
            ? Boolean(keepLoggedIn)
            : (get().keepLoggedIn || isKeepLoggedInPreference());

        if (typeof window !== 'undefined') {
          if (persistLongLived) {
            window.localStorage.setItem(KEEP_LOGGED_IN_KEY, '1');
            if (accessToken) {
              window.localStorage.setItem('token', accessToken);
              window.sessionStorage.setItem('token', accessToken);
            }
          } else {
            window.localStorage.removeItem(KEEP_LOGGED_IN_KEY);
            window.localStorage.removeItem('token');
            window.localStorage.removeItem('expertise-auth-v1');
            if (accessToken) {
              window.sessionStorage.setItem('token', accessToken);
            } else {
              window.sessionStorage.removeItem('token');
            }
          }
          const previousUserId = get().user?.id;
          const isDifferentUser = previousUserId !== normalizedUser.id;
          if (isDifferentUser) {
            window.localStorage.removeItem('@Expertise:selectedCompany');
          }
          const existingCompany = window.localStorage.getItem('@Expertise:selectedCompany');
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
            window.localStorage.setItem('@Expertise:selectedCompany', JSON.stringify(defaultCompany));
          }
        }
        set((state) => ({
          user: normalizedUser,
          accessToken,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          keepLoggedIn: persistLongLived,
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
            window.sessionStorage.setItem('token', accessToken);
            if (isKeepLoggedInPreference()) {
              window.localStorage.setItem('token', accessToken);
            } else {
              window.localStorage.removeItem('token');
            }
          } else {
            window.sessionStorage.removeItem('token');
            window.localStorage.removeItem('token');
          }
        }
        set({ accessToken });
      },

      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== 'undefined' && accessToken) {
          window.sessionStorage.setItem('token', accessToken);
          if (isKeepLoggedInPreference()) {
            window.localStorage.setItem('token', accessToken);
          } else {
            window.localStorage.removeItem('token');
          }
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
          window.localStorage.removeItem('@Expertise:selectedCompany');
          window.localStorage.removeItem('@Expertise:keepLoggedIn');
          window.localStorage.removeItem('token');
          window.localStorage.removeItem('expertise-auth-v1');
          window.sessionStorage.removeItem('@Expertise:selectedCompany');
          window.sessionStorage.removeItem('token');
          window.sessionStorage.removeItem('expertise-auth-v1');
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          keepLoggedIn: false,
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
      storage: safeAuthStorage,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        keepLoggedIn: state.keepLoggedIn,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
