import { create } from 'zustand'
import type { Alert } from '../types'

interface AlertState {
  unresolved: Alert[]
  setUnresolved: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  resolve: (id: string) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  unresolved: [],
  setUnresolved: (alerts) => set({ unresolved: alerts }),
  addAlert: (alert) =>
    set((state) => ({
      unresolved: [alert, ...state.unresolved.filter((existing) => existing.id !== alert.id)],
    })),
  resolve: (id) =>
    set((state) => ({
      unresolved: state.unresolved.filter((a) => a.id !== id),
    })),
}))
