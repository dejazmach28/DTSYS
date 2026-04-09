import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '../api/devices'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.list,
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
    mutationFn: (data: { label?: string; notes?: string }) => devicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device', id] })
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
