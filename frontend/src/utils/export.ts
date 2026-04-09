function escapeCSV(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function exportToCSV(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.map(escapeCSV).join(','), ...rows.map((row) => row.map((cell) => escapeCSV(cell)).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportToJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
