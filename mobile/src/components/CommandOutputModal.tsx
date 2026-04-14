import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { commandsApi, type Command } from '../api/commands'

interface Props {
  commandId: string | null
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  sent: '#3b82f6',
  running: '#8b5cf6',
  completed: '#22c55e',
  failed: '#ef4444',
  timeout: '#94a3b8',
}

export default function CommandOutputModal({ commandId, onClose }: Props) {
  const { data: cmd, isLoading } = useQuery<Command>({
    queryKey: ['mobile-command-detail', commandId],
    queryFn: () => commandsApi.get(commandId!),
    enabled: commandId !== null,
    // Poll while running
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'sent' || status === 'running' ? 2000 : false
    },
  })

  return (
    <Modal visible={commandId !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{cmd?.command_type ?? 'Command Output'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        {cmd && (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[cmd.status] ?? '#94a3b8' }]} />
            <Text style={styles.statusText}>{cmd.status.toUpperCase()}</Text>
            {cmd.exit_code !== null && (
              <Text style={styles.exitCode}>exit {cmd.exit_code}</Text>
            )}
          </View>
        )}

        <ScrollView style={styles.outputArea} contentContainerStyle={styles.outputContent}>
          {isLoading && <Text style={styles.placeholder}>Loading...</Text>}
          {!isLoading && !cmd?.output && <Text style={styles.placeholder}>No output yet.</Text>}
          {cmd?.output ? (
            <Text style={styles.outputText} selectable>{cmd.output}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#f8fafc' },
  closeBtn: { fontSize: 16, color: '#3b82f6', fontWeight: '500' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  exitCode: { fontSize: 12, color: '#64748b', marginLeft: 'auto' },
  outputArea: { flex: 1 },
  outputContent: { padding: 20, paddingBottom: 40 },
  placeholder: { color: '#475569', fontFamily: 'monospace', fontSize: 13 },
  outputText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, lineHeight: 20 },
})
