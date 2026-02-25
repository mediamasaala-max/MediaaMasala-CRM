"use client"

export const dynamic = 'force-dynamic'

import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { usePermissions } from "@/hooks/use-permissions"
import { Clock, Calendar, Building, CheckCircle2, ShoppingBag, Briefcase, Package } from "lucide-react"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  dueDate: string
  assignee?: { firstName: string; lastName: string }
  creator?: { firstName: string; lastName: string }
  lead?: { id: string; name: string; email: string }
  project?: { id: number; name: string; status: string }
  product?: { id: number; name: string; category: string }
  completionNote?: string
  completedAt?: string
  createdAt: string
}

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'High': return 'destructive'
    case 'Medium': return 'warning'
    case 'Low': return 'success'
    default: return 'secondary'
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

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Cancelled"]

import { PermissionGuard } from "@/components/permission-guard"

export default function TaskDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission, canView, isLoading: permissionsLoading } = usePermissions()

  const canEdit = hasPermission("tasks", "edit")
  const canDelete = hasPermission("tasks", "delete")

  // Completion modal state
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [completionNote, setCompletionNote] = useState("")
  const [tempStatus, setTempStatus] = useState("")

  const fetchTask = async () => {
    if (status !== "authenticated" || !session || !id || permissionsLoading || !canView("tasks")) return
    
    try {
      const data = await apiClient.get(`/tasks/${id}`)
      setTask(data)
    } catch (err) {
      console.error("API error:", err)
      router.push("/dashboard/tasks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
  }, [id, session, status])

  const handleUpdateStatus = async (newStatus: string) => {
    if (newStatus === 'Completed') {
      setTempStatus(newStatus)
      setIsCompleteModalOpen(true)
      return
    }

    setUpdating(true)
    try {
      await apiClient.patch(`/tasks/${id}`, { status: newStatus })
      setTask(prev => prev ? { ...prev, status: newStatus } : null)
      toast.success(`Task marked as ${newStatus}`)
    } catch (err) {
      console.error("Error updating status:", err)
      toast.error("Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmCompletion = async () => {
    if (!completionNote.trim()) return
    setUpdating(true)
    try {
      await apiClient.patch(`/tasks/${id}`, { 
        status: tempStatus, 
        completionNote: completionNote 
      })
      setTask(prev => prev ? { 
        ...prev, 
        status: tempStatus, 
        completionNote: completionNote, 
        completedAt: new Date().toISOString() 
      } : null)
      setIsCompleteModalOpen(false)
    } catch (err) {
      console.error("Error finalizing task:", err)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return
    
    setDeleting(true)
    try {
      await apiClient.delete(`/tasks/${id}`)
      toast.success("Task deleted successfully")
      router.push("/dashboard/tasks")
    } catch (err) {
      console.error("Error deleting task:", err)
      toast.error("Failed to delete task")
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-10 animate-pulse text-center text-gray-400 font-medium">Loading Task Details...</div>
  if (!task) return <div className="p-10 text-center">Task not found.</div>

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Completed'

  return (
    <PermissionGuard module="tasks" action="view">
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
      {/* Header Breadcrumb & Actions - Modern SaaS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            <Link href="/dashboard/tasks" className="text-muted-foreground/60">All Tasks</Link>
            <span className="opacity-30">/</span>
            <span className="text-foreground/80">Task Details</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{task.title}</h1>
          <p className="text-muted-foreground text-xs font-medium mt-1">
            Created by {task.creator?.firstName || "System"} <span className="mx-2 opacity-30">•</span> {new Date(task.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <Badge variant={getPriorityVariant(task.priority)} className="font-semibold text-[10px] uppercase tracking-wider py-1 px-3.5 rounded-md shadow-sm border-none">
                {task.priority} Priority
           </Badge>
           <div className="h-6 w-[1px] bg-border/40 mx-1 hidden md:block" />
           {canEdit && (
             <Button variant="outline" className="rounded-lg font-semibold text-xs h-9 px-4 border-border/60">
               Edit Task
             </Button>
           )}
            {canDelete && (
              <Button 
                variant="ghost" 
                className="rounded-lg font-semibold text-xs h-9 px-4 text-destructive hover:bg-destructive/10" 
                onClick={handleDeleteTask}
                loading={deleting}
              >
                Delete Task
              </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:col-span-4 gap-6">
        {/* Main Briefing */}
        <div className="lg:col-span-3 space-y-6">
           <Card className="bg-card border-border/40 rounded-xl shadow-xs overflow-hidden">
             <CardHeader className="pb-3 border-b border-border/30 bg-muted/10">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Task Info</CardTitle>
             </CardHeader>
             <CardContent className="pt-6 pb-8 space-y-6">
                <div className="space-y-3">
                   <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">What to do</p>
                   <div className="bg-muted/30 p-6 rounded-xl border border-border/30 min-h-[160px]">
                      <p className="text-[13px] font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {task.description || "No description given."}
                      </p>
                   </div>
                </div>

                {task.status === 'Completed' && (
                  <div className="bg-success/5 border border-success/20 p-6 rounded-xl animate-in zoom-in duration-500">
                     <div className="flex items-center gap-2 mb-3">
                        <span className="text-success text-xs">✅</span>
                        <span className="text-[9px] font-bold text-success uppercase tracking-widest">Completion notes</span>
                     </div>
                     <p className="text-xs font-semibold text-success/80 italic leading-relaxed mb-4">&quot;{task.completionNote}&quot;</p>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-success/40 uppercase tracking-widest tabular-nums">
                        <Clock className="h-3 w-3" /> Completed on {new Date(task.completedAt!).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                     </div>
                  </div>
                )}
             </CardContent>
           </Card>

           <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/40 px-6">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Status:</span>
                 <Badge variant={getStatusVariant(task.status)} className="font-semibold text-[10px] uppercase tracking-wider py-1 px-3 rounded-md shadow-sm border-none">
                    {task.status}
                 </Badge>
              </div>
              <div className="flex gap-2.5">
                 {task.status !== 'Completed' && canEdit && (
                   <Button 
                     className="bg-foreground text-background hover:bg-foreground/90 rounded-lg font-bold uppercase tracking-wider text-[10px] h-9 px-6 shadow-md transition-all"
                     onClick={() => handleUpdateStatus('Completed')}
                     disabled={updating}
                   >
                     Finish Task
                   </Button>
                 )}
                 {canEdit && (
                    <div className="relative">
                        <select 
                            className="bg-card border border-border/40 rounded-lg px-4 h-9 text-[10px] font-bold uppercase tracking-wider focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                            value={task.status}
                            onChange={(e) => handleUpdateStatus(e.target.value)}
                            disabled={updating}
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-1 space-y-6">
           {/* Deadline Tracker */}
           <Card className={`rounded-xl shadow-xs p-6 border-2 ${isOverdue ? 'border-destructive/20 bg-destructive/5' : 'border-border/40 bg-card'}`}>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Due Date</p>
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOverdue ? 'bg-destructive/10' : 'bg-primary/5'}`}>
                        <Calendar className={`h-5 w-5 ${isOverdue ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                    </div>
                    <p className={`text-xl font-semibold tracking-tight tabular-nums ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                      {new Date(task.dueDate).toLocaleDateString([], {month:'short', day:'numeric'})}
                    </p>
                 </div>
                 {isOverdue && (
                    <div className="flex items-center gap-1.5 mt-2 ml-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping" />
                        <p className="text-[9px] font-bold text-destructive uppercase tracking-widest italic">LATE</p>
                    </div>
                 )}
              </div>
           </Card>

           {/* Linked Entities */}
           {task.lead && (
              <Card className="rounded-xl border-border/40 bg-card p-6 shadow-xs group cursor-pointer hover:border-primary/40 transition-all" onClick={() => router.push(`/dashboard/leads/${task.lead?.id}`)}>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShoppingBag className="h-3 w-3 opacity-50" />
                  Related Lead
                </p>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold text-sm border border-primary/10 shadow-xs">
                     L
                   </div>
                   <div className="min-w-0">
                     <p className="text-xs font-semibold text-foreground tracking-tight underline-offset-4 decoration-primary/20 truncate">{task.lead.name}</p>
                     <p className="text-[10px] text-muted-foreground/50 font-medium truncate mt-0.5">{task.lead.email}</p>
                   </div>
                </div>
              </Card>
           )}

           {task.project && (
              <Card className="rounded-xl border-border/40 bg-card p-6 shadow-xs group cursor-pointer hover:border-primary/40 transition-all" onClick={() => router.push(`/dashboard/portfolio?tab=projects`)}>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Briefcase className="h-3 w-3 opacity-50" />
                  Related Project
                </p>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-500 font-bold text-sm border border-indigo-500/10 shadow-xs">
                     P
                   </div>
                   <div className="min-w-0">
                     <p className="text-xs font-semibold text-foreground tracking-tight truncate">{task.project.name}</p>
                     <p className="text-[10px] text-muted-foreground/50 font-medium truncate mt-0.5">{task.project.status}</p>
                   </div>
                </div>
              </Card>
           )}

           {task.product && (
              <Card className="rounded-xl border-border/40 bg-card p-6 shadow-xs group cursor-pointer hover:border-primary/40 transition-all" onClick={() => router.push(`/dashboard/portfolio?tab=products`)}>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package className="h-3 w-3 opacity-50" />
                  Related Product
                </p>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-lg bg-amber-500/5 flex items-center justify-center text-amber-500 font-bold text-sm border border-amber-500/10 shadow-xs">
                     K
                   </div>
                   <div className="min-w-0">
                     <p className="text-xs font-semibold text-foreground tracking-tight truncate">{task.product.name}</p>
                     <p className="text-[10px] text-muted-foreground/50 font-medium truncate mt-0.5">{task.product.category}</p>
                   </div>
                </div>
              </Card>
           )}

           {!task.lead && !task.project && !task.product && (
              <Card className="rounded-xl border-dashed border-2 border-border/30 p-8 text-center flex flex-col items-center justify-center opacity-40 bg-muted/5">
                 <Building className="h-6 w-6 text-muted-foreground/40 mb-3" />
                 <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Standalone Task</p>
              </Card>
           )}

           {/* Responsible Agent */}
           <Card className="rounded-xl bg-card border border-border/40 p-6 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Assigned To</p>
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border/40 flex items-center justify-center text-muted-foreground font-bold text-sm shadow-xs">
                   {task.assignee ? task.assignee.firstName.charAt(0) : "!"}
                 </div>
                 <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/80 tracking-tight truncate">
                      {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : "Unassigned"}
                    </p>
                    <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest mt-0.5">Person working on this</p>
                 </div>
              </div>
           </Card>

           <div className="pt-4 px-2">
              <p className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.4em] text-center italic">Task Management System</p>
           </div>
        </div>
      </div>
      {/* Completion Note Modal Overlay */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="max-w-sm w-full bg-card rounded-2xl border border-border/40 shadow-2xl p-8 space-y-6 relative overflow-hidden animate-in zoom-in duration-300">
              <div className="text-center">
                 <div className="h-14 w-14 rounded-xl bg-success/5 flex items-center justify-center mx-auto mb-4 border border-success/10 shadow-xs">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                 </div>
                 <h3 className="text-lg font-semibold tracking-tight text-foreground">Task Finished!</h3>
                 <p className="text-muted-foreground font-medium text-xs mt-1.5 opacity-80">Submit your final report for this task.</p>
              </div>
              <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Completion notes</Label>
                 <textarea 
                    className="w-full h-32 rounded-lg bg-muted/30 border border-border/40 font-medium text-xs p-3.5 outline-none focus:ring-1 focus:ring-primary/40 resize-none tabular-nums"
                    placeholder="Provide a summary of the outcome..."
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                 />
              </div>
              <div className="flex gap-2.5 pt-2">
                 <Button variant="ghost" className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10" onClick={() => setIsCompleteModalOpen(false)}>Cancel</Button>
                 <Button 
                  className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10 shadow-lg shadow-primary/10" 
                  onClick={handleConfirmCompletion}
                  disabled={!completionNote.trim() || updating}
                 >
                   {updating ? "Updating..." : "Complete"}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  )
}
