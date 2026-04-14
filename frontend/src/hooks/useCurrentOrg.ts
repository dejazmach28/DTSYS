import { useAuthStore } from '../store/authStore'

export function useCurrentOrg() {
  const orgId = useAuthStore((state) => state.orgId)
  const orgName = useAuthStore((state) => state.orgName)
  return { orgId, orgName }
}
