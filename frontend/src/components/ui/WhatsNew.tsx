import { useState } from 'react'
import { APP_VERSION } from '../../version'

const highlights = [
  '🖥️ Multi-platform agent (Windows, Linux, macOS)',
  '📊 Real-time hardware monitoring',
  '🔔 Smart alert engine',
  '💻 Remote command execution',
  '📦 Software inventory & update tracking',
  '🗓️ Scheduled commands',
  '📸 Device screenshots',
  '🌐 Network topology map',
  '📧 Email & webhook notifications',
  'And more...',
]

export default function WhatsNew() {
  const [open, setOpen] = useState(() => localStorage.getItem('dtsys-last-seen-version') !== APP_VERSION)

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">What&apos;s New in v{APP_VERSION}</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-gray-300">
          {highlights.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/40">
              {item}
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            localStorage.setItem('dtsys-last-seen-version', APP_VERSION)
            setOpen(false)
          }}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
