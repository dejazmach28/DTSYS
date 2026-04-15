import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BrandingState {
  companyName: string
  logoUrl: string        // data-URL or empty string
  accentColor: string    // hex e.g. '#3b82f6'
  sidebarLabel: string   // text shown under logo in sidebar (e.g. 'IT Management')
  faviconUrl: string     // data-URL or empty string
  setCompanyName: (v: string) => void
  setLogoUrl: (v: string) => void
  setAccentColor: (v: string) => void
  setSidebarLabel: (v: string) => void
  setFaviconUrl: (v: string) => void
  reset: () => void
}

const DEFAULTS = {
  companyName: 'DTSYS',
  logoUrl: '',
  accentColor: '#3b82f6',
  sidebarLabel: 'IT Management',
  faviconUrl: '',
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setCompanyName: (companyName) => set({ companyName }),
      setLogoUrl: (logoUrl) => set({ logoUrl }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setSidebarLabel: (sidebarLabel) => set({ sidebarLabel }),
      setFaviconUrl: (faviconUrl) => set({ faviconUrl }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'dtsys-branding' }
  )
)
