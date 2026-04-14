import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import { orgsApi, type Org, type OrgMember } from '../api/organizations'
import { useAuthStore } from '../store/authStore'

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    member: 'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-300',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? colors.member}`}>
      {role}
    </span>
  )
}

function MembersPanel({ org, currentUserId }: { org: Org; currentUserId?: string }) {
  const queryClient = useQueryClient()
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', org.id],
    queryFn: () => orgsApi.listMembers(org.id),
  })

  const invite = useMutation({
    mutationFn: () => orgsApi.inviteMember(org.id, { username: inviteUsername.trim(), role: inviteRole }),
    onSuccess: () => {
      setInviteUsername('')
      queryClient.invalidateQueries({ queryKey: ['org-members', org.id] })
    },
  })

  const remove = useMutation({
    mutationFn: (userId: string) => orgsApi.removeMember(org.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members', org.id] }),
  })

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      orgsApi.updateMember(org.id, userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members', org.id] }),
  })

  const canManage = org.role === 'owner' || org.role === 'admin'

  if (isLoading) return <p className="text-sm text-slate-400 py-2">Loading members...</p>

  return (
    <div className="mt-3 space-y-2">
      <div className="space-y-1">
        {members.map((m: OrgMember) => (
          <div
            key={m.user_id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/50"
          >
            <span className="flex-1 text-sm text-slate-800 dark:text-gray-200">{m.username}</span>
            {canManage && m.user_id !== currentUserId && m.role !== 'owner' ? (
              <select
                value={m.role}
                onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value })}
                className="rounded border border-slate-200 bg-transparent px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
            ) : (
              roleBadge(m.role)
            )}
            {canManage && m.user_id !== currentUserId && m.role !== 'owner' && (
              <button
                onClick={() => remove.mutate(m.user_id)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                title="Remove member"
              >
                <UserMinus size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex gap-2 pt-1">
          <input
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="Username to invite"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={() => invite.mutate()}
            disabled={!inviteUsername.trim() || invite.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      )}
    </div>
  )
}

export default function Organizations() {
  const { orgId: currentOrgId } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: orgsApi.list,
  })

  const create = useMutation({
    mutationFn: () => orgsApi.create({ name: createForm.name.trim(), slug: createForm.slug.trim().toLowerCase() }),
    onSuccess: () => {
      setShowCreate(false)
      setCreateForm({ name: '', slug: '' })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })

  const deleteOrg = useMutation({
    mutationFn: (orgId: string) => orgsApi.delete(orgId),
    onSuccess: () => {
      setDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })

  // Auto-fill slug from name
  const handleNameChange = (name: string) => {
    setCreateForm({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64),
    })
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading organizations...</div>
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-blue-500" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Organizations</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          Create Organization
        </button>
      </div>

      <div className="space-y-3">
        {orgs.map((org: Org) => (
          <div
            key={org.id}
            className={`rounded-xl border bg-white shadow-sm dark:bg-gray-900 ${
              org.id === currentOrgId
                ? 'border-blue-300 dark:border-blue-700'
                : 'border-slate-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Building2 size={16} className="shrink-0 text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-gray-100">{org.name}</span>
                  {roleBadge(org.role)}
                  {org.id === currentOrgId && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      current
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-gray-500">{org.slug}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Users size={12} />
                  Members
                </button>
                {org.role === 'owner' && (
                  <button
                    onClick={() => setDeleteConfirm(org.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                    title="Delete organization"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {expandedOrg === org.id && (
              <div className="border-t border-slate-100 px-4 pb-3 dark:border-gray-800">
                <MembersPanel org={org} currentUserId={undefined} />
              </div>
            )}
          </div>
        ))}

        {orgs.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <Building2 size={32} className="mx-auto mb-2 text-slate-300 dark:text-gray-600" />
            <p className="text-sm text-slate-500">No organizations yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-gray-100">Create Organization</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Name</label>
                <input
                  value={createForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Organization"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Slug</label>
                <input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="my-organization"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={!createForm.name.trim() || !createForm.slug.trim() || create.isPending}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50 hover:bg-blue-700"
              >
                Create
              </button>
            </div>
            {create.isError && (
              <p className="mt-2 text-xs text-red-500">Failed to create. Slug may already be taken.</p>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-2 font-semibold text-red-600">Delete Organization</h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-gray-300">
              This will permanently delete the organization and all its devices. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOrg.mutate(deleteConfirm)}
                disabled={deleteOrg.isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
