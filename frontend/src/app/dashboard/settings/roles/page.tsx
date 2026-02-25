"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/permission-guard"

interface Role {
  id: number
  name: string
  code: string
  description: string
  isActive: boolean
  departmentId: number | null
  department?: { name: string }
  _count: { employees: number }
}

interface Department {
  id: number
  name: string
  code: string
}

export default function RolesPage() {
  const { data: session, status: authStatus } = useSession()
  const { hasPermission, permissionsLoading } = usePermissions()
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [departmentId, setDepartmentId] = useState<string>("")
  const [isActive, setIsActive] = useState(true)

  const fetchData = async () => {
    if (permissionsLoading || !hasPermission("roles", "view")) return
    try {
      const [rolesData, deptsData] = await Promise.all([
        apiClient.get("/admin/roles"),
        apiClient.get("/admin/departments")
      ])
      setRoles(rolesData)
      setDepartments(deptsData)
    } catch (err) {
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !permissionsLoading && hasPermission("roles", "view")) fetchData()
  }, [authStatus, permissionsLoading, hasPermission])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingRole 
      ? `/admin/roles/${editingRole.id}`
      : "/admin/roles"
    
    const payload = { 
      name, 
      code, 
      description, 
      isActive,
      departmentId: departmentId ? parseInt(departmentId) : null
    }

    try {
      if (editingRole) {
        await apiClient.patch(url, payload)
      } else {
        await apiClient.post(url, payload)
      }
      fetchData()
      setIsModalOpen(false)
      resetForm()
    } catch (err: any) {
      console.error("Error saving role:", err)
      alert(err.message || "Operation failed")
    }
  }

  const resetForm = () => {
    setName("")
    setCode("")
    setDescription("")
    setDepartmentId("")
    setIsActive(true)
    setEditingRole(null)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setName(role.name)
    setCode(role.code)
    setDescription(role.description || "")
    setDepartmentId(role.departmentId?.toString() || "")
    setIsActive(role.isActive)
    setIsModalOpen(true)
  }

  if (loading) return <div className="p-8 animate-pulse text-gray-400">Loading roles...</div>

  return (
    <PermissionGuard module="roles" action="view">
      <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Strategic Roles</h1>
            <p className="text-muted-foreground text-xs font-medium mt-1">Define administrative authority and operational designations.</p>
          </div>
          {hasPermission("roles", "create") && (
            <Button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="rounded-lg font-semibold text-xs h-9 px-4 shadow-lg shadow-primary/10 uppercase tracking-wider"
            >
              Define Role
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card key={role.id} className="rounded-xl border-border/40 shadow-xs group overflow-hidden bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center font-bold text-sm border border-primary/10 shadow-xs">
                    🛡️
                  </div>
                  <div className="text-right">
                    <Badge variant={role.isActive ? "success" : "destructive"} className="text-[8px] font-bold uppercase tracking-widest py-0.5 h-4 border-none px-2">
                      {role.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1.5 tabular-nums">
                      {role.code}
                    </p>
                  </div>
                </div>
                <div className="min-h-[4.5rem]">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-sm tracking-tight ${role.isActive ? "text-foreground/90" : "text-muted-foreground/40"}`}>{role.name}</h3>
                    {role.department && (
                      <Badge variant="outline" className="text-[7px] font-black uppercase tracking-tighter h-3.5 border-primary/20 text-primary/60">
                        {role.department.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 font-medium mt-1.5 line-clamp-2 leading-relaxed">{role.description || "Operational parameters not defined."}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/20">
                  <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">
                    <span className="text-foreground/80 font-bold tabular-nums">{role._count.employees}</span> Assigned Personnel
                  </p>
                  <div className="flex gap-1">
                    {hasPermission("roles", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(role)} className="h-7 px-3 text-[10px] font-bold text-primary opacity-80 uppercase tracking-wider">Configure</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <Card className="max-w-md w-full rounded-2xl shadow-2xl border border-border/40 overflow-hidden animate-in zoom-in duration-300">
              <CardHeader className="bg-muted/10 border-b border-border/30 pb-6 pt-8 px-10">
                <CardTitle className="text-xl font-semibold tracking-tight">{editingRole ? "Configure Authority" : "Define Authority"}</CardTitle>
                <CardDescription className="text-xs font-medium mt-1.5 text-muted-foreground/60">Define administrative scope and operational authority.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Designation Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Strategic Ops Lead" required className="rounded-lg border-border/40 h-10 text-xs font-medium" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Callsign (Code)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., OPS_LEAD" required className="rounded-lg border-border/40 h-10 text-xs font-bold uppercase tracking-widest tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Department</Label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border/40 bg-card px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none"
                  >
                    <option value="">Global / No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Authority Scope</Label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    className="w-full min-h-[90px] border border-border/40 rounded-lg p-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 bg-card resize-none"
                    placeholder="Define the scope and permissions for this designation..."
                  />
                </div>
                <div className="flex items-center gap-3 h-10 px-4 border rounded-lg border-border/40 bg-muted/5">
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={(e) => setIsActive(e.target.checked)}
                    id="role-active"
                    className="w-3.5 h-3.5 rounded border-border/40 accent-primary cursor-pointer"
                  />
                  <Label htmlFor="role-active" className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest cursor-pointer">Active Designation</Label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-lg h-10 font-semibold text-xs uppercase tracking-wider">Abort</Button>
                  <Button type="submit" className="flex-1 rounded-lg h-10 font-bold text-xs shadow-lg shadow-primary/10 uppercase tracking-wider">
                    {editingRole ? "Sync Matrix" : "Deploy Role"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
