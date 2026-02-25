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
    staleTime: 5 * 60 * 1000, // 5 minutes (Permissions are stable)
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false, // Prevent redundant calls when switching tabs
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
    return perm?.scope || perm?.scopeType || null // null = no access, never default to 'own'
  }, [role, permissions])

  // Convenience helpers for UI gating (NOT for data filtering)
  const canView = useCallback((module: string) => hasPermission(module, 'view'), [hasPermission])
  const canCreate = useCallback((module: string) => hasPermission(module, 'create'), [hasPermission])
  const canEdit = useCallback((module: string) => hasPermission(module, 'edit'), [hasPermission])
  const canDelete = useCallback((module: string) => hasPermission(module, 'delete'), [hasPermission])
  const canAssign = useCallback((module: string) => hasPermission(module, 'assign'), [hasPermission])

  const hasModule = useCallback((module: string) => {
    if (role === 'ADMIN') return true
    if (role === 'UNASSIGNED') return false
    
    return permissions.some((p: any) => p.module === module)
  }, [role, permissions])

  return useMemo(() => ({
    hasPermission,
    hasModule,
    getModuleScope,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canAssign,
    role,
    user: data?.user || user,
    isAdmin: role === 'ADMIN',
    refreshPermissions: refetch,
    permissions,
    isLoading: status === "loading" || isLoading,
    permissionsLoading: status === "loading" || isLoading
  }), [hasPermission, hasModule, getModuleScope, canView, canCreate, canEdit, canDelete, canAssign, role, refetch, permissions, isLoading, status, data?.user, user])
}

