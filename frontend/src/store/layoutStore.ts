import { create } from 'zustand'

interface LayoutState {
  mobileSidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  mobileSidebarOpen: false,
  openSidebar: () => set({ mobileSidebarOpen: true }),
  closeSidebar: () => set({ mobileSidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
}))
