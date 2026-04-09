export function formatUptime(secs: number): string {
  const totalMinutes = Math.max(0, Math.floor(secs / 60))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

export function lastBootTime(uptimeSecs: number): Date {
  return new Date(Date.now() - uptimeSecs * 1000)
}
