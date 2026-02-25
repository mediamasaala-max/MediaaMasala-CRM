"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"
import { PermissionGuard } from "@/components/permission-guard"
import { 
  FileText, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  MessageSquare,
  Clock,
  History
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"

interface EodReport {
  id: number
  date: string
  content: string
  leadsCount: number
  tasksCount: number
  employee: {
    firstName: string
    lastName: string
    department: { name: string }
  }
}

import { useQuery } from "@tanstack/react-query"
import { ManagementFilters } from "@/components/dashboard/management-filters"

export default function EodPage() {
  const { data: session, status } = useSession()
  const { canView, isLoading: permissionsLoading } = usePermissions()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form State
  const [content, setContent] = useState("")
  const [leadsCount, setLeadsCount] = useState(0)
  const [tasksCount, setTasksCount] = useState(0)
  
  // Filter State
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [isRecursive, setIsRecursive] = useState<boolean>(false)
  const [selectedDate, setSelectedDate] = useState<string>("")

  const { data: reports = [], isLoading, isFetching, refetch } = useQuery<EodReport[]>({
    queryKey: ["eod-reports", session?.user?.email, selectedDeptId, selectedEmployeeId, isRecursive],
    queryFn: async () => {
      let endpoint = "/eod?"
      if (selectedDeptId !== 'all') endpoint += `departmentId=${selectedDeptId}&`
      if (selectedEmployeeId !== 'all') {
        endpoint += `employeeId=${selectedEmployeeId}&`
        if (isRecursive) endpoint += `recursive=true&`
      }
      
      return await apiClient.get(endpoint)
    },
    enabled: status === "authenticated" && !permissionsLoading && canView("eod"),
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setIsSubmitting(true)

    try {
      await apiClient.post("/eod", {
        content,
        leadsCount,
        tasksCount
      })
      setShowForm(false)
      setContent("")
      setLeadsCount(0)
      setTasksCount(0)
      refetch()
    } catch (err) {
      console.error("Error submitting EOD:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Client-side date filter (server-side date filtering can be added later if needed)
  const filteredReports = reports.filter(r => {
    return !selectedDate || r.date.startsWith(selectedDate)
  })

  if (isLoading) return <div className="p-10 text-center animate-pulse text-muted-foreground font-medium">Loading Reports...</div>

  return (
    <PermissionGuard module="eod">
      <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
        {/* Premium Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Daily Work Reports</h1>
            <p className="text-muted-foreground text-xs font-medium mt-1">Write your progress for today.</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Filter */}
            {!showForm && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex h-10 rounded-lg border border-border/40 bg-card px-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/40 shadow-sm cursor-pointer"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate("")}
                    className="h-10 px-3 rounded-lg border border-border/40 bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors shadow-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

             {/* Dynamic Management Filters - Not in form mode */}
            {!showForm && (
               <ManagementFilters 
                  module="eod"
                  selectedDept={selectedDeptId}
                  setSelectedDept={setSelectedDeptId}
                  selectedEmp={selectedEmployeeId}
                  setSelectedEmp={(id, recursive) => {
                      setSelectedEmployeeId(id);
                      setIsRecursive(recursive);
                  }}
                  isRecursive={isRecursive}
               />
            )}

            <Button 
                onClick={() => setShowForm(!showForm)} 
                className="shadow-lg shadow-primary/10 rounded-lg h-10 px-6 font-semibold text-xs"
            >
                {showForm ? "View History" : <><Plus className="mr-2 h-4 w-4" /> New Report</>}
            </Button>
          </div>
        </div>

        {showForm ? (
          <Card className="max-w-2xl mx-auto border-border/40 shadow-xl bg-card overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/30 border-b border-border/30 pb-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Submit Daily Report</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Leads Handled</Label>
                    <Input 
                      type="number" 
                      value={leadsCount} 
                      onChange={(e) => setLeadsCount(parseInt(e.target.value) || 0)}
                      className="h-11 bg-muted/20 border-border/40 font-semibold tabular-nums"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Tasks Completed</Label>
                    <Input 
                      type="number" 
                      value={tasksCount} 
                      onChange={(e) => setTasksCount(parseInt(e.target.value) || 0)}
                      className="h-11 bg-muted/20 border-border/40 font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Work Summary</Label>
                  <textarea 
                    className="w-full h-48 rounded-xl bg-muted/20 border border-border/40 font-medium text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 leading-relaxed"
                    placeholder="Describe your achievements, challenges, and plan for tomorrow..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="flex-1 h-11 rounded-xl font-bold uppercase tracking-widest text-[10px]"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    loading={isSubmitting}
                    className="flex-2 h-11 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                  >
                    Submit Daily Report
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className={`space-y-6 transition-opacity duration-300 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none relative' : ''}`}>
             
             {isFetching && !isLoading && (
                <div className="absolute inset-0 z-50 flex items-start justify-center pt-24">
                   <div className="bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-primary/20 flex items-center gap-2">
                     <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Updating...</span>
                   </div>
                </div>
              )}

            {filteredReports.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                 <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                 <p className="text-muted-foreground font-medium text-sm">
                    {selectedEmployeeId !== "all" 
                        ? `No reports found for ${selectedEmployeeId}.` 
                        : "No past reports found."}
                 </p>
                 {selectedEmployeeId === "all" && (
                    <Button variant="link" className="text-primary font-bold text-xs mt-2" onClick={() => setShowForm(true)}>Submit your first report →</Button>
                 )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map((report) => (
                  <Card key={report.id} className="group border-border/40 hover:border-primary/30 transition-all duration-300 shadow-xs bg-card overflow-hidden flex flex-col">
                    <CardHeader className="p-5 border-b border-border/30 bg-muted/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest tabular-nums">
                          <Calendar className="h-3 w-3" /> {new Date(report.date).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-primary/20 bg-primary/5 text-primary">Logged</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                              {report.employee.firstName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                              <p className="text-[11px] font-bold text-foreground truncate">{report.employee.firstName} {report.employee.lastName}</p>
                              <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">{report.employee.department.name}</p>
                          </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 flex-1 flex flex-col gap-6">
                      <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-2.5 opacity-40">
                              <MessageSquare className="h-3 w-3" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Report Details</span>
                          </div>
                          <p className="text-xs font-medium text-foreground/70 leading-relaxed italic line-clamp-4">
                              &quot;{report.content}&quot;
                          </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/20">
                          <div className="bg-muted/30 p-2.5 rounded-xl border border-border/20 text-center">
                              <p className="text-lg font-black text-foreground tabular-nums tracking-tighter">{report.leadsCount}</p>
                              <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5">Leads</p>
                          </div>
                          <div className="bg-muted/30 p-2.5 rounded-xl border border-border/20 text-center">
                              <p className="text-lg font-black text-foreground tabular-nums tracking-tighter">{report.tasksCount}</p>
                              <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5">Tasks</p>
                          </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
