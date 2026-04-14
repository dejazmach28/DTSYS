import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import api from '../api/client'

type RouteParams = {
  DeviceDetail: { deviceId: string; hostname: string }
}

function Gauge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const color = value > 85 ? '#ef4444' : value > 70 ? '#f59e0b' : '#22c55e'
  return (
    <View style={styles.gauge}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${Math.min(value, 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.gaugeValue, { color }]}>{Math.round(value)}%</Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export default function DeviceDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'DeviceDetail'>>()
  const { deviceId } = route.params
  const queryClient = useQueryClient()

  const { data: device, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mobile-device', deviceId],
    queryFn: () => api.get(`/devices/${deviceId}`).then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: metric } = useQuery({
    queryKey: ['mobile-metric', deviceId],
    queryFn: () => api.get(`/metrics/${deviceId}/latest`).then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['mobile-alerts', deviceId],
    queryFn: () => api.get('/alerts', { params: { device_id: deviceId, resolved: false, limit: 20 } }).then((r) => r.data),
  })

  const { data: commands = [] } = useQuery({
    queryKey: ['mobile-commands', deviceId],
    queryFn: () => api.get('/commands', { params: { device_id: deviceId, limit: 10 } }).then((r) => r.data),
  })

  const dispatch = useMutation({
    mutationFn: (commandType: string) =>
      api.post('/commands', { device_id: deviceId, command_type: commandType, payload: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-commands', deviceId] }),
  })

  const confirmAction = (label: string, commandType: string) => {
    Alert.alert(`${label}`, `Send "${label}" to this device?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', style: 'destructive', onPress: () => dispatch.mutate(commandType) },
    ])
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#2563eb']} />}
    >
      <Section title="System">
        <Gauge label="CPU" value={metric?.cpu_percent ?? null} />
        <Gauge label="RAM" value={metric?.ram_percent ?? null} />
        <Gauge label="Disk" value={metric?.disk_percent ?? null} />
        <Text style={styles.meta}>Last seen: {device?.last_seen
          ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
          : '—'}</Text>
        {device?.agent_version && (
          <Text style={styles.meta}>Agent: v{device.agent_version}</Text>
        )}
      </Section>

      {alerts.length > 0 && (
        <Section title={`Alerts (${alerts.length})`}>
          {alerts.map((alert: any) => (
            <View key={alert.id} style={[styles.alertRow, alert.severity === 'critical' && styles.alertCritical]}>
              <Text style={styles.alertSeverity}>{alert.severity.toUpperCase()}</Text>
              <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
            </View>
          ))}
        </Section>
      )}

      {commands.length > 0 && (
        <Section title="Recent Commands">
          {commands.slice(0, 5).map((cmd: any) => (
            <View key={cmd.id} style={styles.commandRow}>
              <Text style={styles.commandType}>{cmd.command_type}</Text>
              <Text style={[styles.commandStatus, cmd.status === 'completed' ? styles.statusOk : styles.statusPending]}>
                {cmd.status}
              </Text>
            </View>
          ))}
        </Section>
      )}

      <Section title="Quick Actions">
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => dispatch.mutate('check_updates')}>
            <Text style={styles.actionBtnText}>Check Updates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => dispatch.mutate('sync_time')}>
            <Text style={styles.actionBtnText}>Sync Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => confirmAction('Reboot', 'reboot')}
          >
            <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Reboot</Text>
          </TouchableOpacity>
        </View>
      </Section>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontWeight: '700', fontSize: 14, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  gauge: { marginBottom: 10 },
  gaugeLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  gaugeTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 2 },
  gaugeFill: { height: 8, borderRadius: 4 },
  gaugeValue: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  alertCritical: { backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 8 },
  alertSeverity: { fontSize: 10, fontWeight: '700', color: '#ef4444', paddingTop: 1, minWidth: 60 },
  alertMessage: { flex: 1, fontSize: 13, color: '#374151' },
  commandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  commandType: { fontSize: 13, color: '#374151' },
  commandStatus: { fontSize: 12, fontWeight: '500' },
  statusOk: { color: '#22c55e' },
  statusPending: { color: '#f59e0b' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnDanger: { borderColor: '#fca5a5' },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
})
