"use client"

export const dynamic = 'force-dynamic'

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { History, Search, Filter, Calendar, User, Activity, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { PermissionGuard } from "@/components/permission-guard"
import { usePermissions } from "@/hooks/use-permissions"

interface ActivityLog {
  id: number
  module: string
  action: string
  entityId: string
  entityName: string
  description: string
  metadata: any
  createdAt: string
  employee: {
    firstName: string
    lastName: string
  }
}

export default function LogsPage() {
  const { data: session, status: authStatus } = useSession()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const { canView, isLoading: permissionsLoading } = usePermissions()
  const [selectedModule, setSelectedModule] = useState<string>("all")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")

  const fetchLogs = async (pageNum = 1, moduleFilter?: string) => {
    if (permissionsLoading || !canView("logs")) return
    setLoading(true)
    try {
      const mod = moduleFilter !== undefined ? moduleFilter : (selectedModule !== "all" ? selectedModule : "")
      const response = await apiClient.get(`/activity?page=${pageNum}&limit=50&module=${mod}`)
      setLogs(response.data)
      setTotalPages(response.pagination.totalPages)
      setPage(pageNum)
    } catch (err) {
      console.error("Failed to fetch logs:", err)
      toast.error("Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !permissionsLoading) {
       fetchLogs()
    }
  }, [authStatus, permissionsLoading, canView])

  // When module filter changes, re-fetch from API (backend supports module filter)
  const handleModuleChange = (value: string) => {
    setSelectedModule(value)
    setSelectedAction("all")
    setSelectedEmployee("all")
    fetchLogs(1, value !== "all" ? value : "")
  }

  // Compute unique employees from current logs for the employee filter
  const uniqueEmployees = useMemo(() => {
    return Array.from(new Set(logs.map(l => `${l.employee.firstName} ${l.employee.lastName}`)))
      .filter(name => name.trim() !== "undefined undefined")
      .sort()
  }, [logs])

  // Client-side filter: action type and employee (module is server-side)
  const filteredLogs = useMemo(() => {
    let filtered = logs
    if (selectedAction !== "all") {
      filtered = filtered.filter(l => l.action === selectedAction)
    }
    if (selectedEmployee !== "all") {
      filtered = filtered.filter(l => `${l.employee.firstName} ${l.employee.lastName}` === selectedEmployee)
    }
    return filtered
  }, [logs, selectedAction, selectedEmployee])

  const handleReset = () => {
    setSelectedModule("all")
    setSelectedAction("all")
    setSelectedEmployee("all")
    fetchLogs(1, "")
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-success/10 text-success border-success/20'
      case 'UPDATE': return 'bg-info/10 text-info border-info/20'
      case 'STATUS_CHANGE': return 'bg-warning/10 text-warning border-warning/20'
      case 'DELETE': return 'bg-destructive/10 text-destructive border-destructive/20'
      case 'ASSIGN': return 'bg-primary/10 text-primary border-primary/20'
      default: return 'bg-muted/10 text-muted-foreground border-border/20'
    }
  }

  return (
    <PermissionGuard module="reports">
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Audit</h1>
          <p className="text-muted-foreground text-sm font-medium">Traceable manifest of all interactions and system events.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-xl border border-border/40 shadow-xs">
        {/* Module Filter */}
        <div className="relative min-w-[140px]">
          <select
            value={selectedModule}
            onChange={(e) => handleModuleChange(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border/40 bg-card px-3 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer shadow-sm"
          >
            <option value="all">All Modules</option>
            <option value="leads">Leads / Sales</option>
            <option value="tasks">Tasks</option>
            <option value="projects">Projects</option>
            <option value="products">Products</option>
            <option value="attendance">Attendance</option>
            <option value="eod">EOD Reports</option>
            <option value="leaves">Leaves</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[8px]">▼</div>
        </div>

        {/* Action Type Filter */}
        <div className="relative min-w-[130px]">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border/40 bg-card px-3 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer shadow-sm"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="DELETE">Delete</option>
            <option value="ASSIGN">Assign</option>
            <option value="TASK_CREATE">Task Create</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[8px]">▼</div>
        </div>

        {/* Employee Filter */}
        {uniqueEmployees.length > 1 && (
          <div className="relative min-w-[160px]">
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border/40 bg-card px-3 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer shadow-sm"
            >
              <option value="all">All Users</option>
              {uniqueEmployees.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[8px]">▼</div>
          </div>
        )}

        {/* Active filter count + Reset */}
        <div className="flex items-center gap-2 ml-auto">
          {(selectedModule !== "all" || selectedAction !== "all" || selectedEmployee !== "all") && (
            <Badge variant="outline" className="text-[9px] font-bold px-2 py-1 rounded-md border-primary/30 bg-primary/5 text-primary">
              {[selectedModule !== "all", selectedAction !== "all", selectedEmployee !== "all"].filter(Boolean).length} filter{[selectedModule !== "all", selectedAction !== "all", selectedEmployee !== "all"].filter(Boolean).length > 1 ? "s" : ""} active
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 px-3 text-xs font-semibold text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="mr-1.5 h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <Card className="border-border/40 shadow-xl overflow-hidden">
         <CardContent className="p-0">
            {loading ? (
              <div className="py-24 text-center">
                 <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Synchronizing Audit Trail...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-xl m-6">
                 <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                 <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-[0.4em]">No Activity Found</p>
                 <p className="text-xs text-muted-foreground/60 mt-2">
                   {selectedModule !== "all" || selectedAction !== "all" || selectedEmployee !== "all"
                     ? "No logs match the selected filters. Try adjusting or resetting."
                     : "The audit trail is empty."}
                 </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/30">
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Timestamp</th>
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">User</th>
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Module</th>
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Action</th>
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Entity</th>
                      <th className="px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/70">
                            <Calendar className="h-3 w-3" />
                            <span className="tabular-nums">{new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {log.employee.firstName.charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-foreground">{log.employee.firstName} {log.employee.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border-primary/20 bg-primary/5 text-primary">
                            {log.module}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getActionColor(log.action)}`}>
                            {log.action.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground/80">{log.entityName}</span>
                            <span className="text-[10px] font-medium text-muted-foreground/50 tabular-nums">ID: {log.entityId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-medium text-muted-foreground/70 line-clamp-2 max-w-md">{log.description}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 bg-muted/10">
                   <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                     Showing {filteredLogs.length} of {logs.length} • Page {page} of {totalPages}
                   </p>
                   <div className="flex gap-2">
                    <Button 
                     variant="outline" 
                     size="sm" 
                     disabled={page === 1}
                     onClick={() => fetchLogs(page - 1)}
                     className="h-8 rounded-lg text-xs"
                    >Previous</Button>
                    <Button 
                     variant="outline" 
                     size="sm" 
                     disabled={page === totalPages}
                     onClick={() => fetchLogs(page + 1)}
                     className="h-8 rounded-lg text-xs"
                    >Next</Button>
                   </div>
                </div>
              </div>
            )}
         </CardContent>
      </Card>
    </div>
    </PermissionGuard>
  )
}
