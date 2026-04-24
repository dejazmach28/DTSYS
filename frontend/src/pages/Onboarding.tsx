import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, Link } from 'react-router-dom'
import { CheckCircle2, Copy, Laptop, Monitor, ShieldCheck, Terminal } from 'lucide-react'
import api from '../api/client'
import { devicesApi } from '../api/devices'
import { useAuthStore } from '../store/authStore'

type PlatformTab = 'linux' | 'windows' | 'macos'

const steps = [
  'Welcome',
  'Enrollment Token',
  'First Device',
  'Ready',
]

export default function Onboarding() {
  const { role } = useAuthStore()
  const [step, setStep] = useState(0)
  const [platform, setPlatform] = useState<PlatformTab>('linux')
  const [copied, setCopied] = useState<string | null>(null)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', 'onboarding'],
    queryFn: () => devicesApi.list(),
    refetchInterval: step >= 2 ? 5000 : false,
    enabled: role === 'admin',
  })

  const tokenMutation = useMutation({
    mutationFn: () => api.post('/admin/enrollment-tokens').then((response) => response.data as { enrollment_token: string }),
    onSuccess: () => setStep(1),
  })

  const firstDevice = devices[0]
  const token = tokenMutation.data?.enrollment_token ?? ''
  const apiBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'

  const snippets = useMemo(
    () => ({
      linux: `curl -fsSL "${apiBase}/api/v1/agent/download?platform=linux&arch=amd64" -o /tmp/dtsys-agent && chmod +x /tmp/dtsys-agent && mkdir -p /etc/dtsys && cat > /tmp/dtsys-agent.toml <<'EOF'
[server]
url = "${apiBase}"
enrollment_token = "${token}"

[agent]
device_id = ""
api_key = ""

[update]
auto_update = false
EOF
/tmp/dtsys-agent --config /tmp/dtsys-agent.toml`,
      windows: `powershell -ExecutionPolicy Bypass -File .\\install.ps1 -ServerURL "${apiBase}" -EnrollmentToken "${token}"`,
      macos: `curl -fsSL "${apiBase}/api/v1/agent/download?platform=darwin&arch=arm64" -o /tmp/dtsys-agent && chmod +x /tmp/dtsys-agent && mkdir -p /etc/dtsys && cat > /tmp/dtsys-agent.toml <<'EOF'
[server]
url = "${apiBase}"
enrollment_token = "${token}"

[agent]
device_id = ""
api_key = ""

[update]
auto_update = false
EOF
/tmp/dtsys-agent --config /tmp/dtsys-agent.toml`,
    }),
    [apiBase, token],
  )

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (!isLoading && devices.length > 0 && step < 2) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <ShieldCheck size={14} />
            First Run Wizard
          </div>
          <h1 className="mt-4 text-3xl font-bold">Welcome to DTSYS</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-500">
            Get your first device enrolled, connected, and visible in under five minutes.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                index === step
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                  : index < step
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500'
              }`}
            >
              <div className="text-xs uppercase tracking-wide">Step {index + 1}</div>
              <div className="mt-1 font-semibold">{label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {step === 0 && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">What happens next</h2>
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  DTSYS monitors health, alerts, software, commands, events, processes, and network state from a single dashboard.
                  The first step is generating a one-time enrollment token and installing one agent.
                </p>
                <button
                  onClick={() => tokenMutation.mutate()}
                  disabled={tokenMutation.isPending}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  Get Started
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <IntroCard icon={Monitor} title="Device Visibility" text="See online status, health metrics, software, and network inventory." />
                <IntroCard icon={Terminal} title="Remote Actions" text="Run commands, collect diagnostics, request screenshots, and sync time." />
                <IntroCard icon={Laptop} title="Operational History" text="Track alerts, crashes, events, and audit activity in one place." />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Generate Enrollment Token</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                  This token is single-use and expires automatically. Install the agent on the target device using one of the snippets below.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-950/20">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="flex-1 overflow-auto text-lg font-semibold text-blue-800 dark:text-blue-200">{token}</code>
                  <button
                    onClick={() => copyText(token, 'token')}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    <Copy size={14} />
                    {copied === 'token' ? 'Copied' : 'Copy Token'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['linux', 'windows', 'macos'] as PlatformTab[]).map((value) => (
                  <button
                    key={value}
                    onClick={() => setPlatform(value)}
                    className={`rounded-lg px-4 py-2 text-sm capitalize ${
                      platform === value
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{platform} install</span>
                  <button
                    onClick={() => copyText(snippets[platform], platform)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"
                  >
                    <Copy size={12} />
                    {copied === platform ? 'Copied' : 'Copy Snippet'}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm text-slate-100">
                  {snippets[platform]}
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-950/20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-900 dark:border-t-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Waiting for first device</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                  The dashboard is polling every 5 seconds for the first enrolled agent.
                </p>
              </div>
              {firstDevice ? (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={18} />
                    <span className="font-semibold">Device connected: {firstDevice.label ?? firstDevice.hostname}</span>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-gray-500">Waiting for agent to connect...</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">You're ready</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                  DTSYS is ready to monitor devices, collect events, visualize software state, and dispatch remote actions.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryLink to="/" title="Dashboard" text="See health, availability, and live device activity." />
                <SummaryLink to="/alerts" title="Alerts" text="Review unresolved incidents and resolve them quickly." />
                <SummaryLink to="/settings" title="Settings" text="Create users, manage notifications, and review audit logs." />
              </div>
              <div className="flex justify-end">
                <Link
                  to="/"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IntroCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Monitor
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <Icon size={18} className="text-blue-500" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{text}</p>
    </div>
  )
}

function SummaryLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-blue-500/30 dark:hover:bg-blue-950/20"
    >
      <h3 className="font-semibold text-slate-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{text}</p>
    </Link>
  )
}
