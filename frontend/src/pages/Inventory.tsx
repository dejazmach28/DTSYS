import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Package, Upload } from 'lucide-react'
import { differenceInCalendarDays, format } from 'date-fns'
import { inventoryApi } from '../api/inventory'
import { devicesApi } from '../api/devices'

const FIELDS = ['serial_number', 'manufacturer', 'model_name', 'location', 'assigned_to', 'asset_tag'] as const

type FieldKey = (typeof FIELDS)[number]

export default function Inventory() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [assignedTo, setAssignedTo] = useState('')
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: FieldKey } | null>(null)
  const [draft, setDraft] = useState('')

  const { data: devices = [] } = useQuery({
    queryKey: ['inventory', assignedTo, expiringOnly],
    queryFn: () => inventoryApi.list({ assigned_to: assignedTo || undefined, warranty_expiring_days: expiringOnly ? 90 : undefined }),
  })

  const updateField = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: FieldKey; value: string }) => devicesApi.update(id, { [field]: value || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['device'] })
      setEditing(null)
      setDraft('')
    },
  })

  const locations = useMemo(() => Array.from(new Set(devices.map((device) => device.location).filter(Boolean))).sort(), [devices])
  const [location, setLocation] = useState('')

  const filtered = useMemo(
    () => devices.filter((device) => !location || device.location === location),
    [devices, location]
  )

  const exportCsv = async () => {
    const blob = await inventoryApi.exportCsv()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dtsys-inventory.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean)
    const headers = headerLine.split(',').map((entry) => entry.trim())
    for (const row of rows) {
      const columns = row.split(',')
      const record = Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? '']))
      const device = filtered.find((entry) => entry.hostname === record.hostname)
      if (!device) continue
      await devicesApi.update(device.id, {
        serial_number: record.serial || null,
        manufacturer: record.manufacturer || null,
        model_name: record.model || null,
        purchase_date: record.purchase_date || null,
        warranty_expires: record.warranty_expires || null,
        location: record.location || null,
        assigned_to: record.assigned_to || null,
        asset_tag: record.asset_tag || null,
      })
    }
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Track asset metadata, ownership, and warranty status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-gray-700 dark:text-gray-300"><Download size={14} />Export CSV</button>
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"><Upload size={14} />Import CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
          <option value="">All locations</option>
          {locations.map((entry) => <option key={entry} value={entry ?? ''}>{entry}</option>)}
        </select>
        <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Assigned to…" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={expiringOnly} onChange={(event) => setExpiringOnly(event.target.checked)} />
          Expiring warranty
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
            <tr>
              {['Hostname', 'Serial', 'Manufacturer', 'Model', 'Location', 'Assigned To', 'Asset Tag', 'Purchase Date', 'Warranty'].map((header) => (
                <th key={header} className="px-3 py-2">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((device) => {
              const daysLeft = device.warranty_expires ? differenceInCalendarDays(new Date(device.warranty_expires), new Date()) : null
              const tone = daysLeft == null ? '' : daysLeft < 30 ? 'bg-red-50 dark:bg-red-950/10' : daysLeft < 90 ? 'bg-amber-50 dark:bg-amber-950/10' : ''
              return (
                <tr key={device.id} className={`border-t border-slate-200 dark:border-gray-800 ${tone}`}>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-gray-100">
                    <div className="flex items-center gap-2"><Package size={14} className="text-slate-400 dark:text-gray-500" />{device.label ?? device.hostname}</div>
                  </td>
                  {FIELDS.map((field) => (
                    <EditableCell
                      key={field}
                      active={editing?.id === device.id && editing.field === field}
                      value={(device[field as keyof typeof device] as string | null) ?? ''}
                      onStart={() => {
                        setEditing({ id: device.id, field })
                        setDraft((device[field as keyof typeof device] as string | null) ?? '')
                      }}
                      onChange={setDraft}
                      onSave={() => updateField.mutate({ id: device.id, field, value: draft })}
                    />
                  ))}
                  <td className="px-3 py-2 text-slate-600 dark:text-gray-300">
                    {device.purchase_date ? format(new Date(device.purchase_date), 'PP') : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-gray-300">
                    {device.warranty_expires ? format(new Date(device.warranty_expires), 'PP') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EditableCell({
  value,
  active,
  onStart,
  onChange,
  onSave,
}: {
  value: string
  active: boolean
  onStart: () => void
  onChange: (value: string) => void
  onSave: () => void
}) {
  return (
    <td className="px-3 py-2 text-slate-600 dark:text-gray-300" onClick={!active ? onStart : undefined}>
      {active ? (
        <input
          autoFocus
          defaultValue={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onSave}
          onKeyDown={(event) => event.key === 'Enter' && onSave()}
          className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-sm dark:bg-gray-800"
        />
      ) : (
        value || '—'
      )}
    </td>
  )
}
