import { create } from 'zustand'
import type { Alert } from '../types'

interface AlertState {
  unresolved: Alert[]
  setUnresolved: (alerts: Alert[]) => void
  resolve: (id: string) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  unresolved: [],
  setUnresolved: (alerts) => set({ unresolved: alerts }),
  resolve: (id) =>
    set((state) => ({
      unresolved: state.unresolved.filter((a) => a.id !== id),
    })),
}))
