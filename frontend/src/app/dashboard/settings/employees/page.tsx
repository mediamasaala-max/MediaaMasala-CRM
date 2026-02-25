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

interface Employee {
  id: number
  empId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: number
  roleId: number
  managerId: number | null
  department: { name: string }
  role: { name: string }
  manager?: { id: number; firstName: string; lastName: string }
  user: { isActive: boolean }
}

export default function EmployeesPage() {
  const { data: session, status: authStatus } = useSession()
  const { isAdmin, permissionsLoading } = usePermissions()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    empId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    roleId: "",
    managerId: "",
    password: "",
    isActive: true
  })

  const fetchData = async () => {
    if (permissionsLoading || !isAdmin) return
    try {
      const [empData, pendingData, deptData, roleData] = await Promise.all([
        apiClient.get("/admin/employees"),
        apiClient.get("/admin/pending-users"),
        apiClient.get("/admin/departments"),
        apiClient.get("/admin/roles")
      ])

      setEmployees(empData)
      setPendingUsers(pendingData)
      setDepartments(deptData)
      setRoles(roleData)
    } catch (err) {
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !permissionsLoading && isAdmin) fetchData()
  }, [authStatus, permissionsLoading, isAdmin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingEmp 
      ? `/admin/employees/${editingEmp.id}`
      : "/admin/employees"
    
    try {
      if (editingEmp) {
        await apiClient.patch(url, formData)
      } else {
        await apiClient.post(url, formData)
      }
      fetchData()
      setIsModalOpen(false)
      resetForm()
    } catch (err: any) {
      console.error("Error saving employee:", err)
      alert(err.message || "Operation failed")
    }
  }

  const resetForm = () => {
    setFormData({
      empId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      departmentId: "",
      roleId: "",
      managerId: "",
      password: "",
      isActive: true
    })
    setEditingEmp(null)
    setIsPromoting(false)
  }

  const openEdit = (emp: Employee) => {
    setIsPromoting(false)
    setEditingEmp(emp)
    setFormData({
      empId: emp.empId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || "",
      departmentId: String(emp.departmentId),
      roleId: String(emp.roleId),
      managerId: emp.managerId ? String(emp.managerId) : "",
      password: "", // Don't show password on edit
      isActive: emp.user.isActive
    })
    setIsModalOpen(true)
  }

  const openPromote = (user: any) => {
    resetForm()
    setIsPromoting(true)
    setFormData(prev => ({ ...prev, email: user.email }))
    setIsModalOpen(true)
  }

  if (loading) return <div className="p-8 animate-pulse text-gray-400">Loading Employees...</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Staff List</h1>
          <p className="text-muted-foreground text-xs font-medium mt-1">View and manage your staff and departments here.</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="rounded-lg font-semibold text-xs h-9 px-4 shadow-lg shadow-primary/10"
        >
          Add Staff
        </Button>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border border-primary/20 bg-primary/5 rounded-xl overflow-hidden shadow-xs">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-[10px] font-bold text-primary uppercase tracking-widest">New Users</CardTitle>
            <p className="text-[11px] text-primary/60 font-medium">{pendingUsers.length} users waiting to be added</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 px-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingUsers.map(user => (
                <div key={user.id} className="bg-card p-3 rounded-lg flex justify-between items-center shadow-xs border border-primary/10 group">
                  <div className="truncate pr-3">
                    <p className="text-xs font-semibold truncate text-foreground/80">{user.email}</p>
                    <p className="text-[9px] text-muted-foreground/50 font-medium">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2.5 text-primary font-bold text-[10px] shrink-0 rounded-md"
                    onClick={() => openPromote(user)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-card rounded-xl border border-border/40 shadow-xs overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              <th className="p-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Employee</th>
              <th className="p-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">ID & Department</th>
              <th className="p-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Role</th>
              <th className="p-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Reporting To</th>
              <th className="p-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Status</th>
              <th className="p-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {employees.map((emp) => (
              <tr key={emp.id} className="group border-b border-border/10">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/5 text-primary rounded-lg flex items-center justify-center font-bold text-xs border border-primary/10 shadow-xs">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-[13px] text-foreground/90 leading-tight">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[10px] text-muted-foreground/50 font-medium mt-0.5">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge variant="outline" className="text-[9px] font-bold tracking-tight bg-muted/20 border-border/40 mb-1 rounded-sm px-1.5 h-4 tabular-nums">
                    {emp.empId}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground/60 font-medium">{emp.department.name}</p>
                </td>
                <td className="p-4">
                  <span className="text-[11px] text-foreground/80 font-semibold">{emp.role.name}</span>
                </td>
                <td className="p-4 text-[11px] text-muted-foreground/40 font-medium">
                  {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "—"}
                </td>
                <td className="p-4">
                  {emp.user.isActive ? (
                    <Badge className="bg-success text-success-foreground border-none text-[8px] font-bold uppercase tracking-wider py-0.5 h-4">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[8px] font-bold uppercase tracking-wider py-0.5 h-4">Suspended</Badge>
                  )}
                </td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} className="h-7 px-3 text-[10px] font-bold opacity-60">Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="max-w-2xl w-full rounded-2xl shadow-2xl border border-border/40 overflow-hidden animate-in zoom-in duration-300">
            <CardHeader className="bg-muted/10 border-b border-border/30 pb-6 pt-8 px-10">
              <CardTitle className="text-xl font-semibold tracking-tight">
                {editingEmp ? "Edit Staff Info" : isPromoting ? "Add to Dept" : "New Staff"}
              </CardTitle>
              <CardDescription className="text-xs font-medium mt-1.5">
                {isPromoting 
                  ? `Setting up ${formData.email}.` 
                  : "Fill in the details below to add someone to the system."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {(editingEmp) && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Employee ID</Label>
                    <Input 
                      value={formData.empId} 
                      className="rounded-lg border-border/40 h-10 bg-muted/20 text-xs font-semibold tabular-nums" 
                      readOnly
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Work Email</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    placeholder="name@agency.com" 
                    required 
                    className="rounded-lg border-border/40 h-10 text-xs font-medium"
                    readOnly={!!editingEmp || isPromoting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">First Name</Label>
                  <Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="First Name" required className="rounded-lg border-border/40 h-10 text-xs font-medium" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Last Name</Label>
                  <Input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="Last Name" required className="rounded-lg border-border/40 h-10 text-xs font-medium" />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Department</Label>
                  <div className="relative">
                    <select 
                      value={formData.departmentId} 
                      onChange={(e) => setFormData({...formData, departmentId: e.target.value, roleId: ""})}
                      className="w-full h-10 rounded-lg border border-border/40 px-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 bg-card appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((d: any) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Job Role</Label>
                  <div className="relative">
                    <select 
                      value={formData.roleId} 
                      onChange={(e) => setFormData({...formData, roleId: e.target.value})}
                      className="w-full h-10 rounded-lg border border-border/40 px-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 bg-card appearance-none cursor-pointer"
                      required
                      disabled={!formData.departmentId}
                    >
                      <option value="">{formData.departmentId ? "Select Job Role" : "Select Department First"}</option>
                      {roles
                        .filter((r: any) => !r.departmentId || r.departmentId === parseInt(formData.departmentId))
                        .map((r: any) => (
                          <option key={r.id} value={String(r.id)}>{r.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Reporting To</Label>
                  <div className="relative">
                    <select 
                      value={formData.managerId} 
                      onChange={(e) => setFormData({...formData, managerId: e.target.value})}
                      className="w-full h-10 rounded-lg border border-border/40 px-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 bg-card appearance-none cursor-pointer"
                    >
                      <option value="">No Manager</option>
                      {employees
                        .filter(e => e.id !== editingEmp?.id)
                        .filter(e => !formData.departmentId || e.departmentId === parseInt(formData.departmentId))
                        .map((e: any) => (
                          <option key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">App Access</Label>
                  <div className="flex items-center gap-3 h-10 px-4 border rounded-lg border-border/40 bg-muted/5">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 rounded border-border/40 accent-primary cursor-pointer" 
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    <span className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">Active Status</span>
                  </div>
                </div>

                {!editingEmp && !isPromoting && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider pl-1">Password *</Label>
                    <Input 
                      type="password" 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      placeholder="Create a password..." 
                      className="rounded-lg border-border/40 h-10 text-xs font-medium" 
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-lg h-10 font-semibold text-xs uppercase tracking-wider">Cancel</Button>
                <Button type="submit" className="flex-1 rounded-lg h-10 font-bold text-xs shadow-lg shadow-primary/10 uppercase tracking-wider">
                  {editingEmp ? "Save Changes" : isPromoting ? "Add to Dept" : "Add Staff"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
