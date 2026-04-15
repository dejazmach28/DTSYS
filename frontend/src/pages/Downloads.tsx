import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Monitor, Apple, Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/client'

interface AgentVersionResponse {
  version: string
  download_url: string
  required: boolean
}

const PLATFORMS = [
  {
    key: 'linux',
    label: 'Linux',
    icon: Terminal,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-200 dark:border-orange-900',
    archs: ['amd64', 'arm64'],
    archLabels: { amd64: 'x86-64 (Intel/AMD)', arm64: 'ARM64 (Raspberry Pi, AWS Graviton)' },
    installTitle: 'One-liner install (Linux)',
    installCmd: (token: string, server: string) =>
      `curl -fsSL ${server}/api/v1/installer/linux | sudo bash -s -- --token ${token}`,
    serviceTitle: 'Manage the service',
    serviceSnippets: [
      'sudo systemctl status dtsys-agent',
      'sudo systemctl restart dtsys-agent',
      'sudo journalctl -u dtsys-agent -f',
    ],
    notes: [
      'Installs to /usr/local/bin/dtsys-agent',
      'Config at /etc/dtsys/agent.toml',
      'Runs as dtsys-agent system user via systemd',
      'Screenshot requires X11 display + scrot on desktop machines',
    ],
  },
  {
    key: 'darwin',
    label: 'macOS',
    icon: Apple,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-900',
    archs: ['arm64', 'amd64'],
    archLabels: { arm64: 'Apple Silicon (M1/M2/M3)', amd64: 'Intel' },
    installTitle: 'One-liner install (macOS)',
    installCmd: (token: string, server: string) =>
      `curl -fsSL ${server}/api/v1/installer/macos | sudo bash -s -- --token ${token}`,
    serviceTitle: 'Manage the service',
    serviceSnippets: [
      'sudo launchctl list | grep dtsys',
      'sudo launchctl unload /Library/LaunchDaemons/com.dtsys.agent.plist',
      'sudo launchctl load /Library/LaunchDaemons/com.dtsys.agent.plist',
    ],
    notes: [
      'Installs to /usr/local/bin/dtsys-agent',
      'Config at /etc/dtsys/agent.toml',
      'Runs as root via launchd, starts at boot',
      'Screenshot works via screencapture, including RDP sessions',
    ],
  },
  {
    key: 'windows',
    label: 'Windows',
    icon: Monitor,
    color: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-950/20',
    border: 'border-sky-200 dark:border-sky-900',
    archs: ['amd64'],
    archLabels: { amd64: 'x86-64 (Intel/AMD)' },
    installTitle: 'PowerShell installer (run as Administrator)',
    installCmd: (token: string, server: string) =>
      `irm ${server}/api/v1/installer/windows | iex\n# Or with parameters:\n.\\install-agent.ps1 -Token "${token}" -Server "${server}"`,
    serviceTitle: 'Manage the service',
    serviceSnippets: [
      'Get-Service DTSYSAgent',
      'Restart-Service DTSYSAgent',
      'Get-EventLog -LogName Application -Source DTSYSAgent -Newest 50',
    ],
    notes: [
      'Installs to C:\\Program Files\\DTSYS\\dtsys-agent.exe',
      'Config at C:\\Program Files\\DTSYS\\agent.toml',
      'Registered as Windows Service DTSYSAgent (auto-start)',
      'MSI available for Group Policy / Intune / SCCM deployment',
      'Software inventory reads from Add/Remove Programs registry',
      'Screenshot works on desktop and RDP sessions via PowerShell GDI+',
    ],
    msiNote: true,
  },
] as const

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto bg-slate-950 dark:bg-gray-950 px-4 py-3 text-xs text-green-400 leading-relaxed">
        <code>{code}</code>
      </pre>
      {!label && (
        <div className="flex justify-end border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-1">
          <CopyButton text={code} />
        </div>
      )}
    </div>
  )
}

export default function Downloads() {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>('linux')
  const serverBase = window.location.origin

  const { data: versionData } = useQuery<AgentVersionResponse>({
    queryKey: ['agent-version'],
    queryFn: () => api.get('/agent/version').then((r) => r.data),
    staleTime: 60_000,
  })

  const agentVersion = versionData?.version ?? '—'

  const handleDownload = (platform: string, arch: string) => {
    window.open(`/api/v1/agent/download?platform=${platform}&arch=${arch}`, '_blank')
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-gray-800">
        <Download size={20} className="text-blue-500" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Agent Downloads</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Current version: <span className="font-mono font-medium text-blue-600 dark:text-blue-400">v{agentVersion}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4 max-w-4xl">
        {/* Intro */}
        <p className="text-sm text-slate-600 dark:text-gray-400">
          The DTSYS agent is a single static binary with no runtime dependencies.
          Install it on any machine to start monitoring. Choose your platform below to download the binary or use the one-liner installer.
        </p>

        {/* Platform cards */}
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon
          const isOpen = expandedPlatform === platform.key

          return (
            <div
              key={platform.key}
              className={`rounded-xl border ${platform.border} overflow-hidden`}
            >
              {/* Card header — always visible */}
              <button
                onClick={() => setExpandedPlatform(isOpen ? null : platform.key)}
                className={`w-full flex items-center gap-4 px-5 py-4 ${platform.bg} transition-colors hover:brightness-95`}
              >
                <Icon size={24} className={platform.color} />
                <div className="flex-1 text-left">
                  <div className="font-semibold text-slate-900 dark:text-gray-100">{platform.label}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    {platform.archs.map((a) => (platform.archLabels as Record<string, string>)[a]).join(' · ')}
                  </div>
                </div>
                {/* Download buttons — always visible */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {platform.archs.map((arch) => (
                    <button
                      key={arch}
                      onClick={() => handleDownload(platform.key, arch)}
                      className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 shadow-sm transition-colors"
                    >
                      <Download size={12} />
                      {arch}
                    </button>
                  ))}
                </div>
                {isOpen ? (
                  <ChevronUp size={16} className="text-slate-400 dark:text-gray-500 ml-1" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400 dark:text-gray-500 ml-1" />
                )}
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-5 py-4 space-y-5 bg-white dark:bg-gray-900">
                  {/* Install command */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-gray-300">
                      {platform.installTitle}
                    </h3>
                    <CodeBlock
                      code={platform.installCmd('[YOUR_ENROLLMENT_TOKEN]', serverBase)}
                      label="shell"
                    />
                    <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
                      Generate an enrollment token in{' '}
                      <a href="/settings" className="text-blue-500 hover:underline">Settings → Enrollment Tokens</a>.
                    </p>
                  </div>

                  {/* Service management */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-gray-300">
                      {platform.serviceTitle}
                    </h3>
                    <div className="rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
                      <pre className="overflow-x-auto bg-slate-950 dark:bg-gray-950 px-4 py-3 text-xs text-green-400 leading-relaxed">
                        <code>{platform.serviceSnippets.join('\n')}</code>
                      </pre>
                    </div>
                  </div>

                  {/* MSI note for Windows */}
                  {'msiNote' in platform && platform.msiNote && (
                    <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/20 px-4 py-3">
                      <p className="text-sm font-medium text-sky-800 dark:text-sky-300 mb-1">MSI Installer — Group Policy / Intune / SCCM</p>
                      <CodeBlock
                        code={`msiexec /i DTSYSAgent.msi /quiet ^\n  DTSYS_SERVER="${serverBase}" ^\n  DTSYS_TOKEN="[YOUR_ENROLLMENT_TOKEN]"`}
                        label="PowerShell (silent install)"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-gray-300">Notes</h3>
                    <ul className="space-y-1">
                      {platform.notes.map((note) => (
                        <li key={note} className="flex items-start gap-2 text-xs text-slate-500 dark:text-gray-400">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-gray-600 shrink-0" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Manual binary install */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-gray-300">Manual binary download</h3>
                    <div className="flex flex-wrap gap-2">
                      {platform.archs.map((arch) => (
                        <button
                          key={arch}
                          onClick={() => handleDownload(platform.key, arch)}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Download size={14} />
                          dtsys-agent-{platform.key}-{arch}{platform.key === 'windows' ? '.exe' : ''}
                          <span className="text-xs text-slate-400 dark:text-gray-500">v{agentVersion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Config file reference */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-gray-800 px-5 py-3 border-b border-slate-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">Agent Config File</span>
            <span className="text-xs text-slate-400 dark:text-gray-500 font-mono">/etc/dtsys/agent.toml</span>
          </div>
          <div className="px-5 py-4 bg-white dark:bg-gray-900 space-y-3">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              The installer creates this automatically. You can edit it manually to customise collection intervals.
            </p>
            <CodeBlock
              label="agent.toml"
              code={`[server]
url = "${serverBase}"
enrollment_token = ""   # cleared after first run; device_id is stored here instead

[collect]
telemetry_interval_secs = 30
software_scan_interval_m = 60
event_poll_interval_secs = 60`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
