"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { usePermissions } from "@/hooks/use-permissions"
import { Users, LayoutGrid, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

import { HierarchySelector } from "@/components/dashboard/hierarchy-selector"

interface ManagementFiltersProps {
  selectedDept: string
  setSelectedDept: (id: string) => void
  selectedEmp: string
  setSelectedEmp: (id: string, recursive: boolean) => void
  isRecursive: boolean
  module: string
}

export function ManagementFilters({ 
  selectedDept, 
  setSelectedDept, 
  selectedEmp, 
  setSelectedEmp,
  isRecursive,
  module
}: ManagementFiltersProps) {
  const { role, permissions, user } = usePermissions()
  
  // Find current module scope
  const modulePerm = permissions.find((p: any) => p.module === module && (p.action === 'view' || p.action === 'read'))
  const scope = role === 'ADMIN' ? 'all' : (modulePerm?.scopeType || 'own')

  const isAdmin = role === 'ADMIN'
  const isManager = scope === 'department' || scope === 'team' || isAdmin

  // Fetch departments - Only for Admin
  const { data: departments = [] } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => apiClient.get("/admin/departments"),
    enabled: isAdmin
  })

  if (!isManager) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isAdmin ? (
        <div className="relative group">
          <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 h-3.5 w-3.5 group-hover:text-primary/60 transition-colors" />
          <select
            value={selectedDept}
            onChange={(e) => { 
                setSelectedDept(e.target.value); 
                setSelectedEmp("all", false); 
            }}
            className="h-9 min-w-[160px] pl-9 pr-8 bg-card border border-border/40 rounded-lg text-[10px] font-black uppercase tracking-widest text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm transition-all hover:border-primary/30"
          >
            <option value="all">All Departments</option>
            {Array.isArray(departments) && departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30 pointer-events-none group-hover:opacity-100 transition-opacity" />
        </div>
      ) : (scope === 'department' && user?.department) && (
        <div className="flex items-center gap-2 h-9 px-3 bg-muted/30 border border-border/10 rounded-lg">
             <LayoutGrid className="h-3.5 w-3.5 text-primary/40" />
             <div className="flex flex-col leading-none">
                <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground opacity-60">Department</span>
                <span className="text-[10px] font-bold text-foreground">{user.department.name}</span>
             </div>
        </div>
      )}

      <HierarchySelector 
        selectedId={selectedEmp}
        onSelect={setSelectedEmp}
        isRecursive={isRecursive}
      />
    </div>
  )
}
