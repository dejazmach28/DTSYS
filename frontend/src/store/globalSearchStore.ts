import { create } from 'zustand'

interface GlobalSearchState {
  open: boolean
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
}

export const useGlobalSearchStore = create<GlobalSearchState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
  toggleSearch: () => set((state) => ({ open: !state.open })),
}))
