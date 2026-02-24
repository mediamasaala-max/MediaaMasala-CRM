"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { apiClient } from "@/lib/api-client"

export function usePermissions() {
  const { data: session, status } = useSession()
  const user = session?.user as any
  const accessToken = user?.accessToken

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["permissions", accessToken],
    queryFn: async () => {
      return await apiClient.get('/auth/me');
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: user?.permissions ? { permissions: user.permissions, user: user } : undefined,
  })

  const permissions = data?.permissions || user?.permissions || []
  const role = data?.user?.role || user?.role

  const hasPermission = useCallback((module: string, action: string, scope?: string) => {
    if (role === 'ADMIN') return true
    if (role === 'UNASSIGNED') return false
    
    return permissions.some(
      (p: any) => p.module === module && p.action === action && (!scope || p.scopeType === scope)
    )
  }, [role, permissions])

  const getModuleScope = useCallback((module: string) => {
    if (role === 'ADMIN') return 'all'
    const perm = permissions.find((p: any) => p.module === module && p.action === 'view')
    return perm?.scopeType || 'own'
  }, [role, permissions])

  const hasModule = useCallback((module: string) => {
    if (role === 'ADMIN') return true
    if (role === 'UNASSIGNED') return false
    
    return permissions.some((p: any) => p.module === module)
  }, [role, permissions])

  return useMemo(() => ({
    hasPermission,
    hasModule,
    getModuleScope,
    role,
    user: data?.user || user,
    isAdmin: role === 'ADMIN',
    refreshPermissions: refetch,
    permissions,
    isLoading: status === "loading" || isLoading
  }), [hasPermission, hasModule, role, refetch, permissions, isLoading, status, data?.user, user])
}

