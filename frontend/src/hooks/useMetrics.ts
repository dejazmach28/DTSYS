import { useQuery } from '@tanstack/react-query'
import { metricsApi } from '../api/metrics'

export function useMetrics(deviceId: string, hours = 24) {
  return useQuery({
    queryKey: ['metrics', deviceId, hours],
    queryFn: () => metricsApi.list(deviceId, hours),
    refetchInterval: 60_000,
    enabled: !!deviceId,
  })
}

export function useLatestMetric(deviceId: string) {
  return useQuery({
    queryKey: ['metrics', deviceId, 'latest'],
    queryFn: () => metricsApi.latest(deviceId),
    refetchInterval: 30_000,
    enabled: !!deviceId,
  })
}
