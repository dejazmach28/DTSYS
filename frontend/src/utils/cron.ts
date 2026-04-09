function parseField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index)
  }

  if (field.startsWith('*/')) {
    const step = Number(field.slice(2))
    return Array.from({ length: max - min + 1 }, (_, index) => min + index).filter((value) => (value - min) % step === 0)
  }

  return field.split(',').flatMap((part) => {
    if (part.includes('/')) {
      const [rangePart, stepPart] = part.split('/')
      const step = Number(stepPart)
      const [rangeStart, rangeEnd] = rangePart === '*'
        ? [min, max]
        : rangePart.split('-').map(Number)
      return Array.from({ length: rangeEnd - rangeStart + 1 }, (_, index) => rangeStart + index).filter((value) => (value - rangeStart) % step === 0)
    }
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      return Array.from({ length: end - start + 1 }, (_, index) => start + index)
    }
    return [Number(part)]
  })
}

function matches(expr: string, date: Date) {
  const [minute, hour, day, month, weekday] = expr.trim().split(/\s+/)
  if (!weekday) {
    return false
  }

  const minuteMatches = parseField(minute, 0, 59).includes(date.getMinutes())
  const hourMatches = parseField(hour, 0, 23).includes(date.getHours())
  const dayMatches = parseField(day, 1, 31).includes(date.getDate())
  const monthMatches = parseField(month, 1, 12).includes(date.getMonth() + 1)
  const weekdayMatches = parseField(weekday, 0, 6).includes(date.getDay())

  return minuteMatches && hourMatches && dayMatches && monthMatches && weekdayMatches
}

export function parseCron(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    return 'Invalid cron expression'
  }

  const [minute, hour, day, month, weekday] = parts
  if (expr === '0 3 * * *') {
    return 'Every day at 03:00'
  }
  if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return `Every ${minute.slice(2)} minutes`
  }
  if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every hour'
  }
  if (day === '*' && month === '*' && weekday === '*') {
    return `Every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }
  return `Runs on cron schedule: ${expr}`
}

export function nextRuns(expr: string, count: number): Date[] {
  const runs: Date[] = []
  const cursor = new Date()
  cursor.setSeconds(0, 0)
  let attempts = 0

  while (runs.length < count && attempts < 100000) {
    attempts += 1
    cursor.setMinutes(cursor.getMinutes() + 1)
    if (matches(expr, cursor)) {
      runs.push(new Date(cursor))
    }
  }

  return runs
}
