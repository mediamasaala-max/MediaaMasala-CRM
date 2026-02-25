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

interface Department {
  id: number
  name: string
  code: string
  description: string
  isActive: boolean
  _count: { employees: number; leads: number }
}

export default function DepartmentsPage() {
  const { data: session, status: authStatus } = useSession()
  const { isAdmin, permissionsLoading } = usePermissions()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)

  const fetchDepartments = async () => {
    if (permissionsLoading || !isAdmin) return
    try {
      const data = await apiClient.get("/admin/departments")
      setDepartments(data)
    } catch (err) {
      console.error("Error fetching depts:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !permissionsLoading && isAdmin) fetchDepartments()
  }, [authStatus, permissionsLoading, isAdmin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingDept 
      ? `/admin/departments/${editingDept.id}`
      : "/admin/departments"
    
    try {
      if (editingDept) {
        await apiClient.patch(url, { name, code, description, isActive })
      } else {
        await apiClient.post(url, { name, code, description, isActive })
      }
      fetchDepartments()
      setIsModalOpen(false)
      resetForm()
    } catch (err: any) {
      console.error("Error saving dept:", err)
      alert(err.message || "Operation failed")
    }
  }

  const resetForm = () => {
    setName("")
    setCode("")
    setDescription("")
    setIsActive(true)
    setEditingDept(null)
  }

  const openEdit = (dept: Department) => {
    setEditingDept(dept)
    setName(dept.name)
    setCode(dept.code)
    setDescription(dept.description || "")
    setIsActive(dept.isActive)
    setIsModalOpen(true)
  }

  if (loading) return <div className="p-8 animate-pulse text-gray-400">Loading departments...</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organizational Units</h1>
          <p className="text-muted-foreground text-xs font-medium mt-1">Manage departments, divisions, and team structures.</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="rounded-lg font-semibold text-xs h-9 px-4 shadow-lg shadow-primary/10 uppercase tracking-wider"
        >
          Define Division
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {departments.map((dept) => (
          <Card key={dept.id} className="rounded-xl border-border/40 shadow-xs group overflow-hidden bg-card">
            <div className="flex flex-col md:flex-row items-center p-5 gap-6">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center font-bold text-sm border border-primary/10 shadow-xs">
                {dept.code.slice(0, 2)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-sm text-foreground/90 tracking-tight">{dept.name}</h3>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-muted/20 border-border/40 py-0.5 px-2 rounded-sm h-4">
                    {dept.code}
                  </Badge>
                  {!dept.isActive && <Badge variant="destructive" className="text-[8px] font-bold uppercase tracking-wider py-0.5 h-4">Decommissioned</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground/60 font-medium line-clamp-1">{dept.description || "Operational directive not specified."}</p>
              </div>
              <div className="flex items-center gap-10 px-8 border-l border-r border-border/40">
                <div className="text-center">
                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-0.5">Assets</p>
                  <p className="text-base font-semibold text-foreground/80 tabular-nums">{dept._count.employees}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-0.5">Ops</p>
                  <p className="text-base font-semibold text-foreground/80 tabular-nums">{dept._count.leads}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(dept)} className="font-bold text-[10px] text-primary opacity-80 uppercase tracking-wider">Configure</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="max-w-md w-full rounded-2xl shadow-2xl border border-border/40 overflow-hidden animate-in zoom-in duration-300">
            <CardHeader className="bg-muted/10 border-b border-border/30 pb-6 pt-8 px-10">
              <CardTitle className="text-xl font-semibold tracking-tight">{editingDept ? "Configure Division" : "Define New Division"}</CardTitle>
              <CardDescription className="text-xs font-medium mt-1.5 text-muted-foreground/60">Define organizational parameters and operational scope.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Division Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Strategic Marketing" required className="rounded-lg border-border/40 h-10 text-xs font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Callsign (Code)</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., SALES" required className="rounded-lg border-border/40 h-10 text-xs font-bold uppercase tracking-widest tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Operational Directive</Label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="w-full min-h-[90px] border border-border/40 rounded-lg p-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 bg-card resize-none"
                  placeholder="Define department scope and objectives..."
                />
              </div>
              <div className="flex items-center gap-3 h-10 px-4 border rounded-lg border-border/40 bg-muted/5">
                <input 
                  type="checkbox" 
                  checked={isActive} 
                  onChange={(e) => setIsActive(e.target.checked)}
                  id="dept-active"
                  className="w-3.5 h-3.5 rounded border-border/40 accent-primary cursor-pointer"
                />
                <Label htmlFor="dept-active" className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest cursor-pointer">Active Deployment</Label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-lg h-10 font-semibold text-xs uppercase tracking-wider">Abort</Button>
                <Button type="submit" className="flex-1 rounded-lg h-10 font-bold text-xs shadow-lg shadow-primary/10 uppercase tracking-wider">
                  {editingDept ? "Sync Matrix" : "Deploy Division"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
