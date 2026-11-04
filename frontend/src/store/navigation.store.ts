import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface StrategicHubState {
  isCollapsed: boolean;
  expandedHubs: Record<string, boolean>;
  activeHubId: string | null;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleHub: (hubId: string) => void;
  expandHub: (hubId: string) => void;
  collapseHub: (hubId: string) => void;
  setActiveHubId: (hubId: string | null) => void;
}

export const useNavigationStore = create<StrategicHubState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      expandedHubs: {
        'radar': true,
        'disputas': false,
        'contencioso': false,
        'pos_vitoria': false,
      },
      activeHubId: 'radar',

      toggleSidebar: () =>
        set((state) => ({
          isCollapsed: !state.isCollapsed,
        })),

      setCollapsed: (collapsed) =>
        set(() => ({
          isCollapsed: collapsed,
        })),

      toggleHub: (hubId) =>
        set((state) => ({
          expandedHubs: {
            ...state.expandedHubs,
            [hubId]: !state.expandedHubs[hubId],
          },
          activeHubId: hubId,
        })),

      expandHub: (hubId) =>
        set((state) => ({
          expandedHubs: {
            ...state.expandedHubs,
            [hubId]: true,
          },
          activeHubId: hubId,
        })),

      collapseHub: (hubId) =>
        set((state) => ({
          expandedHubs: {
            ...state.expandedHubs,
            [hubId]: false,
          },
        })),

      setActiveHubId: (hubId) =>
        set(() => ({
          activeHubId: hubId,
        })),
    }),
    {
      name: '@expertise:sidebar_state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isCollapsed: state.isCollapsed,
        expandedHubs: state.expandedHubs,
        activeHubId: state.activeHubId,
      }),
    }
  )
);

