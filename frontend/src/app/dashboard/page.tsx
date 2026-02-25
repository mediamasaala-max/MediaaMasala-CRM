"use client"

export const dynamic = 'force-dynamic'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { 
  Users, 
  CheckSquare, 
  AlertTriangle, 
  Activity, 
  Plus, 
  TrendingUp,
  Clock,
  ChevronRight
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"

interface DashboardStats {
  global: {
    totalLeads: number
    tasksDueToday: number
    overdueTasks: number
  }
  personal: {
    myLeads: number
    myTasksDueToday: number
  }
}

interface ActivityItem {
  type: 'LEAD' | 'TASK'
  message: string
  user: string
  timestamp: string
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="flex justify-between border-b pb-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="col-span-2 h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { hasModule, hasPermission, getModuleScope, canView, isLoading: permissionsLoading } = usePermissions()

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", session?.user?.email],
    queryFn: () => apiClient.get("/dashboard/stats"),
    enabled: status === "authenticated" && !permissionsLoading && canView("dashboard"),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  })

  const { data: activities = [], isLoading: activityLoading, refetch: refetchActivity } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard-activity", session?.user?.email],
    queryFn: () => apiClient.get("/dashboard/activity"),
    enabled: status === "authenticated" && !permissionsLoading && canView("dashboard"),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  const canViewLeads = hasModule("leads")
  const canViewTasks = hasModule("tasks")
  const canCreateLeads = hasPermission("leads", "create")
  const canCreateTasks = hasPermission("tasks", "create")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  if (status === "loading" || statsLoading || activityLoading || permissionsLoading) {
    return <DashboardSkeleton />
  }

  const user = session?.user as any

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Utilitarian Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Hi, {user?.email?.split('@')[0]}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            System pulse: <span className="text-success font-bold uppercase">Online</span> • Updated in real-time
          </p>
        </div>
        <div className="flex gap-2">
           {canCreateLeads && (
             <Button size="sm" variant="outline" className="h-9 font-bold text-xs" onClick={() => router.push("/dashboard/leads/new")}>
               <Plus className="mr-1.5 h-3.5 w-3.5" /> Lead
             </Button>
           )}
           {canCreateTasks && (
             <Button size="sm" variant="outline" className="h-9 font-bold text-xs" onClick={() => router.push("/dashboard/tasks/new")}>
               <Plus className="mr-1.5 h-3.5 w-3.5" /> Task
             </Button>
           )}
        </div>
      </div>

      {/* Utilitarian KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewLeads && (
          <Card className="shadow-none border hover:border-primary/50 transition-none relative overflow-hidden group">
             <CardHeader className="pb-1">
                <div className="flex justify-between items-center pr-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Leads</p>
                  <span className="text-[8px] font-black uppercase tracking-tighter bg-primary/10 px-1.5 py-0.5 rounded text-primary opacity-60 group-hover:opacity-100 transition-opacity">
                    {getModuleScope("leads")}
                  </span>
                </div>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats?.global.totalLeads || 0}</div>
             </CardContent>
          </Card>
        )}

        {canViewTasks && (
          <Card className="shadow-none border hover:border-blue-500/50 transition-none relative overflow-hidden group">
             <CardHeader className="pb-1">
                <div className="flex justify-between items-center pr-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daily Tasks</p>
                  <span className="text-[8px] font-black uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">
                    {getModuleScope("tasks")}
                  </span>
                </div>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats?.global.tasksDueToday || 0}</div>
             </CardContent>
          </Card>
        )}

        {canViewTasks && (
          <Card className="shadow-none border border-destructive/20 hover:border-destructive/50 transition-none bg-destructive/5 relative overflow-hidden group">
             <CardHeader className="pb-1">
                <div className="flex justify-between items-center pr-1">
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Overdue</p>
                  <span className="text-[8px] font-black uppercase tracking-tighter bg-destructive/10 px-1.5 py-0.5 rounded text-destructive opacity-60 group-hover:opacity-100 transition-opacity">
                    {getModuleScope("tasks")}
                  </span>
                </div>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats?.global.overdueTasks || 0}</div>
             </CardContent>
          </Card>
        )}

        {canViewLeads && (
          <Card className="shadow-none border bg-primary text-primary-foreground">
             <CardHeader className="pb-1">
                <p className="text-[10px] font-bold text-primary-foreground/70 uppercase tracking-wider">My Pipeline</p>
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold">{stats?.personal.myLeads || 0}</div>
             </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-2 shadow-none border rounded-md bg-background">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
             <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity Stream</CardTitle>
             <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => refetchActivity()}>
               Refresh
             </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[400px]">
            <div className="divide-y">
              {activities.length > 0 ? activities.map((act, idx) => (
                <div key={idx} className="flex gap-3 p-4 hover:bg-muted/30 transition-none">
                  <div className={`mt-0.5 w-7 h-7 rounded flex items-center justify-center border ${
                    act.type === 'LEAD' ? 'bg-primary/5 text-primary' : 'bg-blue-500/5 text-blue-500'
                  }`}>
                    {act.type === 'LEAD' ? <Users className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug">{act.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                       <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{act.user}</span>
                       <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 uppercase">
                         <Clock className="h-2.5 w-2.5" />
                         {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-muted-foreground/30 font-bold uppercase text-[10px]">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Goals */}
        <div className="space-y-6">
           <Card className="shadow-none border rounded-md">
             <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="p-3 space-y-2">
                {canCreateLeads && (
                   <Button 
                     variant="outline"
                     className="w-full justify-between h-10 text-[11px] font-bold uppercase tracking-wider"
                     onClick={() => router.push("/dashboard/leads/new")}
                   >
                     <span>Add Lead</span>
                     <ChevronRight className="h-3.5 w-3.5" />
                   </Button>
                )}
                {canCreateTasks && (
                   <Button 
                     variant="outline"
                     className="w-full justify-between h-10 text-[11px] font-bold uppercase tracking-wider"
                     onClick={() => router.push("/dashboard/tasks/new")}
                   >
                     <span>Assign Task</span>
                     <ChevronRight className="h-3.5 w-3.5" />
                   </Button>
                )}
             </CardContent>
           </Card>

           <Card className="shadow-none border rounded-md p-4">
              <div className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex justify-between items-end">
                       <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Progress Goal</span>
                       <span className="text-xs font-bold">94.2%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full">
                       <div className="h-full bg-primary rounded-full" style={{ width: '94.2%' }}></div>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border rounded bg-muted/10">
                        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase mb-1">My Leads</p>
                        <p className="text-lg font-bold">{stats?.personal.myLeads || 0}</p>
                    </div>
                    <div className="p-3 border rounded bg-muted/10">
                        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase mb-1">Today</p>
                        <p className="text-lg font-bold text-blue-500">{stats?.personal.myTasksDueToday || 0}</p>
                    </div>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  )
}
