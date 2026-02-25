"use client"

export const dynamic = 'force-dynamic'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MoreHorizontal, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Briefcase,
  Package,
  ShoppingBag,
  ChevronRight
} from "lucide-react"
import { ViewToggle, ViewType } from "@/components/dashboard/view-toggle"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/permission-guard"

interface Task {
  id: string
  title: string
  description?: string
  priority: 'High' | 'Medium' | 'Low'
  status: string
  dueDate: string
  assignee?: { firstName: string; lastName: string }
  lead?: { name: string; id: string }
  project?: { name: string; id: number }
  product?: { name: string; id: number }
  createdAt: string
}

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'High': return 'destructive'
    case 'Medium': return 'warning'
    case 'Low': return 'success'
    default: return 'outline'
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Completed': return 'success'
    case 'In Progress': return 'info'
    case 'Pending': return 'warning'
    case 'Cancelled': return 'secondary'
    default: return 'outline'
  }
}

function TasksSkeleton({ view }: { view: ViewType }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-1.5 rounded-lg border border-border/40 shadow-xs">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-9 flex-1 max-w-md" />
        <Skeleton className="h-9 w-32" />
      </div>

      {view === "list" ? (
        <div className="bg-card rounded-lg border border-border/40 shadow-xs overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-border/10">
              <div className="space-y-2">
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border/40 rounded-lg overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/30 bg-muted/10">
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { ManagementFilters } from "@/components/dashboard/management-filters"

export default function TasksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('all')
  const [view, setView] = useState<ViewType>("list")
  const { hasPermission, canView, isLoading: permissionsLoading } = usePermissions()
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [isRecursive, setIsRecursive] = useState<boolean>(false)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedPriority, setSelectedPriority] = useState<string>("all")

  const { data: tasks = [], isLoading, isFetching, error: queryError } = useQuery<Task[]>({
    queryKey: ["tasks", activeTab, session?.user?.email, selectedDeptId, selectedEmployeeId, isRecursive],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...(activeTab === 'my' && { filter: 'my' }),
        ...(selectedDeptId !== 'all' && { departmentId: selectedDeptId }),
        ...(selectedEmployeeId !== 'all' && { assigneeId: selectedEmployeeId }),
        recursive: String(isRecursive)
      }
      
      const data = await apiClient.get("/tasks", { params })
      return Array.isArray(data) ? data : (data.tasks || [])
    },
    enabled: status === "authenticated" && !permissionsLoading && canView("tasks"),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  })

  const canCreate = hasPermission("tasks", "create")
  const canDelete = hasPermission("tasks", "delete")
  const canEdit = hasPermission("tasks", "edit")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete task: ${title}?`)) return
    
    try {
      await apiClient.delete(`/tasks/${id}`)
      router.refresh()
    } catch (err: any) {
      alert(err.message || "Deletion failed")
    }
  }

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Client-side filters for status and priority
    if (selectedStatus !== "all") {
        filtered = filtered.filter(t => t.status === selectedStatus)
    }

    if (selectedPriority !== "all") {
        filtered = filtered.filter(t => t.priority === selectedPriority)
    }

    return filtered.filter(task => 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.lead?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [tasks, searchQuery, selectedStatus, selectedPriority])

  if (status === "loading" || isLoading || permissionsLoading) return (
    <PermissionGuard module="tasks" action="view">
      <div className="max-w-7xl mx-auto">
        <TasksSkeleton view={view} />
      </div>
    </PermissionGuard>
  )

  return (
    <PermissionGuard module="tasks" action="view">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-7xl mx-auto">
        {/* Minimalist Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
            <p className="text-muted-foreground text-[13px] font-medium leading-relaxed">Coordinate and monitor active tasks and project milestones.</p>
          </div>
          
          <div className="flex items-center gap-3">
             {canCreate && (
               <Button onClick={() => router.push("/dashboard/tasks/new")} className="rounded-lg h-9 font-semibold text-xs px-4 shadow-sm border border-primary/20">
                <Plus className="mr-2 h-3.5 w-3.5" /> Create Task
               </Button>
             )}
          </div>
        </div>

        {/* Minimalist Controller Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
            <div className="flex bg-muted/40 p-1 rounded-lg border border-border/40 h-9">
                <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 h-full rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/5' : 'text-muted-foreground/60 hover:text-foreground'}`}
                >
                Global
                </button>
                <button 
                onClick={() => setActiveTab('my')}
                className={`px-4 h-full rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'my' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/5' : 'text-muted-foreground/60 hover:text-foreground'}`}
                >
                My Stack
                </button>
            </div>
          
            {/* Dynamic Management Filters */}
            <ManagementFilters 
                module="tasks"
                selectedDept={selectedDeptId}
                setSelectedDept={setSelectedDeptId}
                selectedEmp={selectedEmployeeId}
                setSelectedEmp={(id, recursive) => {
                    setSelectedEmployeeId(id);
                    setIsRecursive(recursive);
                }}
                isRecursive={isRecursive}
            />

            {/* Status Filter */}
            <div className="relative min-w-[130px]">
                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-border/40 bg-background pl-3 pr-8 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer shadow-sm hover:border-primary/30 transition-all font-sans"
                >
                    <option value="all">Any Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[9px]">▼</div>
            </div>

            {/* Priority Filter */}
            <div className="relative min-w-[130px]">
                <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-border/40 bg-background pl-3 pr-8 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer shadow-sm hover:border-primary/30 transition-all font-sans"
                >
                    <option value="all">Any Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[9px]">▼</div>
            </div>

            <div className="relative flex-1 group min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 h-3.5 w-3.5 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Filter tasks..." 
                  className="pl-9 h-9 bg-background border border-border/40 focus:ring-primary/40 rounded-lg text-xs font-medium placeholder:text-muted-foreground/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onViewChange={setView} />
            <div className="h-4 w-px bg-border/40 mx-1" />
            <Button variant="ghost" size="sm" className="h-9 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => {setSearchQuery(""); setSelectedEmployeeId("all"); setIsRecursive(false); setSelectedStatus("all"); setSelectedPriority("all")}}>
              Reset
            </Button>
          </div>
        </div>

        {queryError && (
          <div className="bg-destructive/5 border border-destructive/20 text-destructive text-center py-3 rounded-lg font-semibold text-[11px]" role="alert">
            Error: {(queryError as any).message || "Failed to fetch tasks"}
          </div>
        )}

        {/* Loading Overlay */}
        <div className={`transition-opacity duration-300 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none relative' : ''}`}>
          {isFetching && !isLoading && (
            <div className="absolute inset-0 z-50 flex items-start justify-center pt-24">
               <div className="bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-primary/20 flex items-center gap-2">
                 <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Updating...</span>
               </div>
            </div>
          )}

        {/* Main Content Area */}
        {filteredTasks.length > 0 ? (
          view === "list" ? (
            <div className="bg-background rounded-lg border border-border/40 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                      <th className="px-6 py-4">Context</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Deadline</th>
                      <th className="px-6 py-4">Assignee</th>
                      <th className="px-6 py-4 text-right">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {filteredTasks.map((task) => {
                      const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Completed'
                      return (
                        <tr key={task.id} className="group hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-[13px] text-foreground tracking-tight hover:text-primary cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                {task.lead && (
                                  <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={() => router.push(`/dashboard/leads/${task.lead?.id}`)}>
                                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{task.lead.name}</span>
                                  </div>
                                )}
                                {task.project && (
                                  <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => router.push(`/dashboard/portfolio?tab=projects`)}>
                                    <div className="h-1.5 w-1.5 rounded-full bg-border" />
                                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{task.project.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={getPriorityVariant(task.priority)} className="font-bold text-[9px] uppercase tracking-[0.15em] py-0.5 px-3 rounded-full border-none shadow-none">
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={getStatusVariant(task.status)} className="font-bold text-[9px] uppercase tracking-[0.15em] py-0.5 px-3 rounded-full border-none shadow-none">
                              {task.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[11px] font-bold tabular-nums tracking-tight ${isOverdue ? "text-destructive" : "text-muted-foreground/80"}`}>
                              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                               <div className="w-6 h-6 rounded bg-muted border border-border/40 flex items-center justify-center text-[9px] font-bold text-foreground/50">
                                 {task.assignee ? task.assignee.firstName.charAt(0) : "!"}
                               </div>
                               <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                 {task.assignee ? task.assignee.firstName : "Unassigned"}
                               </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                              >
                                Access
                              </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 @container/tasks">
              {filteredTasks.map((task) => {
                const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Completed'
                return (
                  <Card key={task.id} className="shadow-sm bg-background group border-border/40 rounded-lg overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="pb-4 pt-5 px-5 border-b border-border/10">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-sm font-semibold tracking-tight text-foreground line-clamp-1">{task.title}</CardTitle>
                          <div className="flex gap-1.5">
                            <Badge variant={getPriorityVariant(task.priority)} className="text-[8px] font-bold uppercase tracking-widest px-2 py-0 rounded-full border-none">
                              {task.priority}
                            </Badge>
                            <Badge variant={getStatusVariant(task.status)} className="text-[8px] font-bold uppercase tracking-widest px-2 py-0 rounded-full border-none">
                              {task.status}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/20 hover:text-foreground" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-5 px-5">
                      {task.description && (
                        <p className="text-[11px] font-medium text-muted-foreground/70 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                      <div className="space-y-3">
                        <div className={`flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest tabular-nums ${isOverdue ? "text-destructive" : "text-muted-foreground/60"}`}>
                          <Clock className="h-3 w-3 opacity-40" />
                          <span>Deadline // {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {task.lead && (
                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/5 px-2.5 py-1 rounded border border-primary/10">
                              {task.lead.name}
                            </div>
                          )}
                          {task.project && (
                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/20 px-2.5 py-1 rounded border border-border/40">
                              {task.project.name}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-border/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-6 w-6 rounded bg-muted border border-border/40 flex items-center justify-center text-[9px] font-bold text-foreground/40 shadow-none">
                            {task.assignee ? task.assignee.firstName.charAt(0) : "!"}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            {task.assignee ? task.assignee.firstName : "Unassigned"}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-0 text-primary font-bold text-[10px] uppercase tracking-widest hover:bg-transparent"
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                        >
                          Details →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        ) : (
          <div className="bg-background rounded-lg border border-border/40 border-dashed py-24 text-center mt-4">
            <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-6 border border-border/40">
               <CheckCircle2 className="h-5 w-5 text-muted-foreground/10" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/60">All Done</h3>
            <p className="text-muted-foreground/40 font-medium max-w-xs mx-auto mt-3 text-[11px] leading-relaxed uppercase tracking-widest">
              {searchQuery ? "No matching records in the list." : "All tasks have been finished."}
            </p>
          </div>
        )}

        {/* Registry Manifest Footer */}
        {!isLoading && filteredTasks.length > 0 && (
          <div className="flex items-center justify-between py-6 border-t border-border/40 mt-8">
             <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest opacity-50">
              Task List: <span className="text-foreground/70 font-bold tabular-nums">{filteredTasks.length} Items</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 px-3 font-semibold text-[9px] rounded-lg border-border/50" disabled>Previous</Button>
              <Button variant="outline" size="sm" className="h-9 px-3 font-semibold text-[9px] rounded-lg border-border/50" disabled>Next</Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </PermissionGuard>
  )
}
