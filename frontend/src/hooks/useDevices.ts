import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '../api/devices'
import type { Device } from '../types'

export function useDevices(tag?: string) {
  return useQuery({
    queryKey: ['devices', tag ?? 'all'],
    queryFn: () => devicesApi.list(tag),
    refetchInterval: 30_000,
  })
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => devicesApi.get(id),
    refetchInterval: 15_000,
  })
}

export function useUpdateDevice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Device>) => devicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device', id] })
      qc.invalidateQueries({ queryKey: ['devices'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
