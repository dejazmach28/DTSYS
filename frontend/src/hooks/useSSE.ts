import { useEffect } from 'react'
import { useAlertStore } from '../store/alertStore'
import type { Alert } from '../types'

export function useSSE(enabled = true) {
  const addAlert = useAlertStore((state) => state.addAlert)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      return undefined
    }

    const controller = new AbortController()

    async function connect() {
      try {
        const response = await fetch('/api/v1/events/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (!response.body) {
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''

          for (const chunk of chunks) {
            const dataLine = chunk
              .split('\n')
              .find((line) => line.startsWith('data: '))

            if (!dataLine) {
              continue
            }

            const alert = JSON.parse(dataLine.slice(6)) as Alert
            addAlert(alert)

            if (Notification.permission === 'granted') {
              new Notification(`${alert.severity.toUpperCase()}: ${alert.alert_type.replace(/_/g, ' ')}`, {
                body: alert.message,
              })
            } else if (Notification.permission === 'default') {
              void Notification.requestPermission()
            }
          }
        }
      } catch {
        return
      }
    }

    void connect()
    return () => controller.abort()
  }, [addAlert, enabled])
}
