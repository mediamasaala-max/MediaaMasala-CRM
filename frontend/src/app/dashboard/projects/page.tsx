"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Briefcase, Calendar, User, Plus, MoreHorizontal, Pencil, Trash2, ListTodo, Loader2, CheckCircle2, ExternalLink, UserCheck, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGuard } from "@/components/permission-guard"
import { useQuery } from "@tanstack/react-query"
import { ManagementFilters } from "@/components/dashboard/management-filters"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePermissions } from "@/hooks/use-permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

interface Project {
  id: number
  name: string
  description: string
  status: string
  leadId?: string
  lead?: {
    id: string
    name: string
    company?: string
  }
  projectManager?: {
    id: number
    firstName: string
    lastName: string
    role?: { name: string }
    department?: { name: string }
  }
  relationshipManager?: {
    id: number
    firstName: string
    lastName: string
    role?: { name: string }
    department?: { name: string }
  }
  projectManagerId?: number
  relationshipManagerId?: number
  createdAt: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string
  assignee?: { firstName: string }
  project?: { id: number }
}

export default function ProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { hasPermission, canView, isLoading: permissionsLoading } = usePermissions()
  
  // Filter State
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [isRecursive, setIsRecursive] = useState<boolean>(false)

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Task Context (Managed by useQuery now)
  const [viewTasksProject, setViewTasksProject] = useState<Project | null>(null)

  // Employee list for PM/RM selector
  const [employees, setEmployees] = useState<any[]>([])
  const [formPMId, setFormPMId] = useState<string>("none")
  const [formRMId, setFormRMId] = useState<string>("none")
  const [formName, setFormName] = useState<string>("")
  const [formDescription, setFormDescription] = useState<string>("")
  const [formStatus, setFormStatus] = useState<string>("Active")

  const { data: projects = [], isLoading, isFetching, refetch } = useQuery<Project[]>({
    queryKey: ["projects", session?.user?.email, selectedDeptId, selectedEmployeeId, isRecursive],
    queryFn: async () => {
      let endpoint = "/projects?"
      if (selectedDeptId !== 'all') endpoint += `departmentId=${selectedDeptId}&`
      if (selectedEmployeeId !== 'all') {
          endpoint += `employeeId=${selectedEmployeeId}&`
          if (isRecursive) endpoint += `recursive=true&`
      }
      return await apiClient.get(endpoint)
    },
    enabled: status === "authenticated" && !permissionsLoading && canView("projects"),
  })

  // Fetch Tasks for Context (Optimized with server-side filtering)
  const { data: contextTasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ["project-tasks", viewTasksProject?.id],
    queryFn: () => apiClient.get(`/tasks?projectId=${viewTasksProject?.id}`),
    enabled: !!viewTasksProject,
    staleTime: 30 * 1000,
  })

  // Fetch employees for PM selector
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!canView("projects")) return
      try {
        const data = await apiClient.get("/projects/employees")
        setEmployees(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("Failed to fetch employees:", err)
      }
    }
    if (session && !permissionsLoading) fetchEmployees()
  }, [session, permissionsLoading, canView])
  
  // Sync form states when editingProject changes
  useEffect(() => {
    if (isModalOpen) {
      if (editingProject) {
        setFormName(editingProject.name || "")
        setFormStatus(editingProject.status || "Active")
        setFormDescription(editingProject.description || "")
        
        // Use flat IDs if available, otherwise use object IDs
        const pmId = editingProject.projectManagerId || editingProject.projectManager?.id
        const rmId = editingProject.relationshipManagerId || editingProject.relationshipManager?.id
        
        setFormPMId(pmId ? String(pmId) : "none")
        setFormRMId(rmId ? String(rmId) : "none")
      } else {
        // Reset for new project
        setFormName("")
        setFormStatus("Active")
        setFormDescription("")
        setFormPMId("none")
        setFormRMId("none")
      }
    }
  }, [isModalOpen, editingProject])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
      name: formName,
      status: formStatus || "Active",
      description: formDescription,
      projectManagerId: (formPMId && formPMId !== "none") ? formPMId : null,
      relationshipManagerId: (formRMId && formRMId !== "none") ? formRMId : null,
    }

    try {
      if (editingProject) {
        await apiClient.patch(`/projects/${editingProject.id}`, payload)
        toast.success("Project updated")
      } else {
        await apiClient.post("/projects", payload)
        toast.success("Project created")
      }
      setIsModalOpen(false)
      setEditingProject(null)
      setFormName("")
      setFormPMId("none")
      setFormRMId("none")
      setFormDescription("")
      setFormStatus("Active")
      refetch()
    } catch (err: any) {
      toast.error(err.message || "Failed to save project")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this project?")) return
    setDeletingId(id)
    try {
      await apiClient.delete(`/projects/${id}`)
      toast.success("Project deleted")
      refetch()
    } catch (err: any) {
      toast.error("Failed to delete project")
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="projects" action="view">
      <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">Manage client implementations and deployments.</p>
          </div>

          <div className="flex items-center gap-3">
             <ManagementFilters 
                module="projects"
                selectedDept={selectedDeptId}
                setSelectedDept={setSelectedDeptId}
                selectedEmp={selectedEmployeeId}
                setSelectedEmp={(id, recursive) => {
                    setSelectedEmployeeId(id);
                    setIsRecursive(recursive);
                }}
                isRecursive={isRecursive}
             />
             
             {hasPermission("projects", "create") && (
                <Dialog 
                  open={isModalOpen} 
                  onOpenChange={(open) => { 
                    setIsModalOpen(open); 
                    if(!open) setEditingProject(null);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="shadow-lg shadow-primary/10 rounded-xl h-11 font-bold text-[11px] uppercase tracking-widest px-6 whitespace-nowrap">
                      <Plus className="mr-2 h-4 w-4" /> New Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                   <form onSubmit={handleSubmit}>
                     <DialogHeader>
                       <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
                       <DialogDescription>Add or update client project details here.</DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-6">
                       <div className="space-y-2">
                         <Label htmlFor="name">Project Name</Label>
                         <Input 
                            id="name" 
                            name="name" 
                            value={formName} 
                            onChange={(e) => setFormName(e.target.value)}
                            required 
                            placeholder="e.g. Media Masala Design System" 
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="status">Status</Label>
                         <Select value={formStatus} onValueChange={setFormStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Planning">Planning</SelectItem>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="On_Hold">On Hold</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <RichTextEditor
                            value={formDescription}
                            onChange={setFormDescription}
                            placeholder="Describe the project scope, objectives, and deliverables..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Relationship Manager</Label>
                            <Select value={formRMId || "none"} onValueChange={setFormRMId}>
                              <SelectTrigger><SelectValue placeholder="Select RM" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {employees
                                  .filter((emp: any) => {
                                      const userPerms = session?.user as any;
                                      const scope = userPerms?.permissions?.find((p: any) => p.module === 'projects' && (p.action === 'create' || p.action === 'edit'))?.scope;
                                      if (scope === 'all' || !scope) return true;
                                      if (scope === 'department') return emp.departmentId === userPerms?.departmentId;
                                      if (scope === 'own') return emp.id === userPerms?.employeeId;
                                      return true;
                                  })
                                  .map((emp: any) => (
                                  <SelectItem key={emp.id} value={String(emp.id)}>
                                    {emp.firstName} {emp.lastName} — {emp.role?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Project Manager</Label>
                            <Select value={formPMId || "none"} onValueChange={setFormPMId}>
                              <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {employees
                                  .filter((emp: any) => {
                                      const userPerms = session?.user as any;
                                      const scope = userPerms?.permissions?.find((p: any) => p.module === 'projects' && (p.action === 'create' || p.action === 'edit'))?.scope;
                                      if (scope === 'all' || !scope) return true;
                                      if (scope === 'department') return emp.departmentId === userPerms?.departmentId;
                                      if (scope === 'own') return emp.id === userPerms?.employeeId;
                                      return true;
                                  })
                                  .map((emp: any) => (
                                  <SelectItem key={emp.id} value={String(emp.id)}>
                                    {emp.firstName} {emp.lastName} — {emp.role?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                     </div>
                     <DialogFooter>
                       <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-11 px-8 font-bold text-[11px] uppercase tracking-widest">
                         {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                         {editingProject ? 'Update Project' : 'Create Project'}
                       </Button>
                     </DialogFooter>
                   </form>
                 </DialogContent>
               </Dialog>
             )}
          </div>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed py-20 bg-card/10">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                <Briefcase className="h-8 w-8 text-primary opacity-60" />
              </div>
              <h3 className="text-base font-bold text-foreground">No projects found</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
                {selectedEmployeeId !== "all" 
                    ? "The selected user doesn't have any active projects currently." 
                    : "Start managing your business by creating your first client project."}
              </p>
              {hasPermission("projects", "create") && (
                <Button variant="outline" onClick={() => setIsModalOpen(true)} className="mt-6 rounded-xl text-[10px] uppercase font-bold tracking-widest px-6 border-primary/20 hover:bg-primary/5">
                   Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none relative' : ''}`}>
             
             {isFetching && !isLoading && (
                <div className="absolute inset-0 z-50 flex items-start justify-center pt-24">
                   <div className="bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-primary/20 flex items-center gap-2">
                     <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Updating...</span>
                   </div>
                </div>
              )}

            {projects.map((project) => (
              <Card key={project.id} className="group hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm relative flex flex-col" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-start justify-between gap-2">
                     <div className="space-y-1.5 flex-1">
                        <p className="text-[10px] uppercase font-bold text-primary tracking-widest flex items-center gap-2">
                           Client Project
                           <span className="h-1 w-1 rounded-full bg-primary/40" />
                        </p>
                        <CardTitle className="text-base font-bold line-clamp-1">{project.name}</CardTitle>
                     </div>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                         <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted/50 rounded-lg">
                           <MoreHorizontal className="w-4 h-4" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="w-40 rounded-xl" onClick={(e) => e.stopPropagation()}>
      {hasPermission("projects", "edit") ? (
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingProject(project); setIsModalOpen(true); }} className="cursor-pointer">
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit project
        </DropdownMenuItem>
      ) : null}
      {hasPermission("projects", "delete") ? (
        <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} disabled={deletingId === project.id}>
          {deletingId === project.id ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-3.5 w-3.5" />
          )}
          Delete project
        </DropdownMenuItem>
      ) : null}

                       </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                     <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-tighter px-2 border-none ${project.status === "Active" ? "bg-green-500/10 text-green-600" : project.status === "Completed" ? "bg-blue-500/10 text-blue-600" : project.status === "On_Hold" ? "bg-amber-500/10 text-amber-600" : project.status === "Planning" ? "bg-purple-500/10 text-purple-600" : project.status === "Cancelled" ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary"}`}>
                        {project.status === "On_Hold" ? "On Hold" : project.status}
                     </Badge>
                     {project.lead?.id && (
                        <Badge variant="secondary" className="text-[9px] font-bold px-2 bg-muted/50 border-none flex items-center gap-1 group/badge" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/leads/${project.lead?.id}`); }}>
                           {project.lead.company || project.lead.name}
                           <ExternalLink className="h-2 w-2 opacity-30 group-hover/badge:opacity-100 transition-opacity" />
                        </Badge>
                     )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-3 space-y-4 flex flex-col flex-1">
                  {project.description ? (
                    <div 
                      className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed min-h-[2.75rem] prose-content"
                      dangerouslySetInnerHTML={{ __html: project.description }}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed min-h-[2.75rem]">
                      No specific project objectives or technical requirements notes found.
                    </p>
                  )}
                  
                  <div className="mt-auto pt-4 border-t border-border/20 space-y-3">
                     <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-[10px] h-9 font-bold uppercase tracking-widest border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all rounded-xl"
                        onClick={(e) => { e.stopPropagation(); setViewTasksProject(project); }}
                     >
                        <ListTodo className="mr-2 h-3.5 w-3.5 opacity-60" /> View Tasks
                     </Button>

                     <div className="flex flex-col gap-1.5 text-muted-foreground/40 px-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                             <Calendar className="h-3 w-3" />
                             <span className="text-[9px] font-bold uppercase">{new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {project.relationshipManager && (
                            <Badge variant="outline" className="text-[8px] font-bold px-2 py-0.5 border-blue-500/20 bg-blue-500/10 text-blue-600 flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              RM: {project.relationshipManager.firstName} {project.relationshipManager.lastName}
                            </Badge>
                          )}
                          {project.projectManager && (
                            <Badge variant="outline" className="text-[8px] font-bold px-2 py-0.5 border-green-500/20 bg-green-500/10 text-green-600 flex items-center gap-1">
                              <UserCheck className="h-2.5 w-2.5" />
                              PM: {project.projectManager.firstName} {project.projectManager.lastName}
                            </Badge>
                          )}
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Project Tasks Dialog */}
        <Dialog open={!!viewTasksProject} onOpenChange={(open) => !open && setViewTasksProject(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
            <div className="p-6 border-b border-border/40 bg-muted/10">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  Tasks for {viewTasksProject?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Showing {contextTasks.length} tasks associated with this project.
                </DialogDescription>
              </DialogHeader>
              {hasPermission("tasks", "create") && (
                <div className="flex justify-end mt-4">
                  <Button 
                    size="sm" 
                    className="h-9 text-[10px] font-bold uppercase tracking-widest rounded-xl px-4"
                    onClick={() => {
                      router.push(`/dashboard/tasks/new?projectId=${viewTasksProject?.id}`)
                    }}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add Task
                  </Button>
                </div>
              )}

            </div>
            
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
              {loadingTasks ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) : contextTasks.length > 0 ? (
                <div className="space-y-3">
                  {contextTasks.map(task => (
                    <div key={task.id} className="flex items-start justify-between p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-muted/30 transition-all group cursor-pointer" onClick={() => router.push(`/dashboard/tasks`)}>
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{task.title}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          <Badge variant="outline" className="text-[8px] h-5 px-1.5 border-primary/20 bg-primary/5 text-primary">
                            {task.status}
                          </Badge>
                          <span className="opacity-30">•</span>
                          <span className={new Date(task.dueDate) < new Date() ? "text-destructive" : "text-muted-foreground/70"}>
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/10 shadow-inner">
                        {task.assignee?.firstName?.[0] || "?"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center flex flex-col items-center gap-4 text-muted-foreground">
                  <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">No tasks found for this project.</p>
                  <p className="text-[11px] opacity-60 max-w-[240px]">This project is currently on track with no pending task items.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}

