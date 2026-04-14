import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Plus, Play, Trash2, ChevronDown, ChevronRight, AlertTriangle, Check } from 'lucide-react'
import api from '../api/client'

interface PolicyRule {
  type: string
  value: string | number
}

interface Policy {
  id: string
  name: string
  description: string | null
  is_active: boolean
  rules: PolicyRule[]
  created_at: string
  updated_at: string
}

interface ComplianceResult {
  id: string
  device_id: string
  hostname: string
  policy_id: string
  policy_name: string
  is_compliant: boolean
  violations: number
  details: Array<{ type: string; passed: boolean; detail: string }>
  evaluated_at: string
}

const RULE_TYPES = [
  { value: 'max_offline_hours', label: 'Max offline hours', placeholder: '24' },
  { value: 'disk_free_min_gb', label: 'Min free disk (GB)', placeholder: '10' },
  { value: 'max_disk_percent', label: 'Max disk usage (%)', placeholder: '90' },
  { value: 'required_software', label: 'Required software (name)', placeholder: 'antivirus' },
  { value: 'forbidden_software', label: 'Forbidden software (name)', placeholder: 'torrent' },
  { value: 'os_type', label: 'Required OS type', placeholder: 'linux' },
]

function PolicyCard({ policy, onDelete, onEvaluate }: {
  policy: Policy
  onDelete: (id: string) => void
  onEvaluate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: results = [] } = useQuery<ComplianceResult[]>({
    queryKey: ['compliance-results', policy.id],
    queryFn: () => api.get('/compliance/results', { params: { policy_id: policy.id } }).then((r) => r.data),
    enabled: expanded,
  })

  const compliantCount = results.filter((r) => r.is_compliant).length
  const total = results.length

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-gray-100">{policy.name}</span>
            {!policy.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-gray-800">inactive</span>
            )}
          </div>
          {policy.description && (
            <span className="text-xs text-slate-400 dark:text-gray-500">{policy.description}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {total > 0 && (
            <span className={`text-sm font-medium ${compliantCount === total ? 'text-green-600' : 'text-red-500'}`}>
              {compliantCount}/{total} compliant
            </span>
          )}
          <button
            onClick={() => onEvaluate(policy.id)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title="Run evaluation"
          >
            <Play size={11} />
            Evaluate
          </button>
          <button
            onClick={() => onDelete(policy.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
            title="Delete policy"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 dark:border-gray-800">
          {/* Rules */}
          <div className="mt-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-2">Rules</p>
            {policy.rules.length === 0 && <p className="text-sm text-slate-400">No rules defined.</p>}
            <div className="space-y-1">
              {policy.rules.map((rule, i) => {
                const rt = RULE_TYPES.find((r) => r.value === rule.type)
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono dark:bg-gray-800">{rt?.label ?? rule.type}</span>
                    <span className="text-slate-600 dark:text-gray-300">{String(rule.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Results table */}
          {results.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-2">Device Results</p>
              <div className="space-y-1">
                {results.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/40">
                    {r.is_compliant
                      ? <Check size={14} className="mt-0.5 shrink-0 text-green-500" />
                      : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                    <span className="w-44 truncate text-sm text-slate-700 dark:text-gray-200">{r.hostname}</span>
                    {!r.is_compliant && (
                      <div className="flex-1 space-y-0.5">
                        {r.details.filter((d) => !d.passed).map((d, i) => (
                          <p key={i} className="text-xs text-red-500">{d.detail}</p>
                        ))}
                      </div>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {r.evaluated_at ? new Date(r.evaluated_at).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {results.length === 0 && (
            <p className="text-sm text-slate-400">No evaluation results yet. Click Evaluate to run.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Compliance() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', rules: [] as PolicyRule[] })
  const [newRule, setNewRule] = useState<PolicyRule>({ type: RULE_TYPES[0].value, value: '' })

  const { data: policies = [], isLoading } = useQuery<Policy[]>({
    queryKey: ['compliance-policies'],
    queryFn: () => api.get('/compliance/policies').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: () => api.post('/compliance/policies', { name: form.name.trim(), description: form.description || null, rules: form.rules }),
    onSuccess: () => {
      setShowCreate(false)
      setForm({ name: '', description: '', rules: [] })
      queryClient.invalidateQueries({ queryKey: ['compliance-policies'] })
    },
  })

  const deletePolicy = useMutation({
    mutationFn: (id: string) => api.delete(`/compliance/policies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-policies'] }),
  })

  const evaluate = useMutation({
    mutationFn: (id: string) => api.post(`/compliance/evaluate/${id}`),
    onSuccess: (_data, id) => queryClient.invalidateQueries({ queryKey: ['compliance-results', id] }),
  })

  const addRule = () => {
    if (!newRule.value) return
    setForm((f) => ({ ...f, rules: [...f.rules, { ...newRule }] }))
    setNewRule({ type: RULE_TYPES[0].value, value: '' })
  }

  const removeRule = (i: number) => {
    setForm((f) => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }))
  }

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Loading compliance...</div>

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={20} className="text-blue-500" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Compliance</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          New Policy
        </button>
      </div>

      <div className="space-y-3">
        {policies.map((p) => (
          <PolicyCard
            key={p.id}
            policy={p}
            onDelete={(id) => deletePolicy.mutate(id)}
            onEvaluate={(id) => evaluate.mutate(id)}
          />
        ))}
        {policies.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <CheckSquare size={32} className="mx-auto mb-2 text-slate-300 dark:text-gray-600" />
            <p className="text-sm text-slate-500">No compliance policies yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Create policy modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-gray-100">New Compliance Policy</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Security Baseline"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Description (optional)</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Minimum security requirements for all devices"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-500">Rules</label>
                <div className="space-y-1 mb-2">
                  {form.rules.map((r, i) => {
                    const rt = RULE_TYPES.find((x) => x.value === r.type)
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-1.5 dark:border-gray-800">
                        <span className="flex-1 text-sm text-slate-700 dark:text-gray-200">{rt?.label ?? r.type}: <strong>{String(r.value)}</strong></span>
                        <button onClick={() => removeRule(i)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <select
                    value={newRule.type}
                    onChange={(e) => setNewRule((r) => ({ ...r, type: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {RULE_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                  <input
                    value={String(newRule.value)}
                    onChange={(e) => setNewRule((r) => ({ ...r, value: e.target.value }))}
                    placeholder={RULE_TYPES.find((r) => r.value === newRule.type)?.placeholder ?? ''}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    onClick={addRule}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setForm({ name: '', description: '', rules: [] }) }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={!form.name.trim() || create.isPending}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50 hover:bg-blue-700"
              >
                Create
              </button>
            </div>
            {create.isError && (
              <p className="mt-2 text-xs text-red-500">Failed to create policy.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
