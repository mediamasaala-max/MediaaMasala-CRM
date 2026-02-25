"use client"

export const dynamic = 'force-dynamic'

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { apiClient } from "@/lib/api-client"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  CheckSquare, 
  Clock, 
  Calendar,
  ChevronRight,
  TrendingDown,
  LayoutGrid
} from "lucide-react"
import { ManagementFilters } from "@/components/dashboard/management-filters"
import { cn } from "@/lib/utils"

type ReportType = 'sales' | 'productivity' | 'attendance'

import { PermissionGuard } from "@/components/permission-guard"

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const { canView, isLoading: permissionsLoading } = usePermissions()
  const [activeTab, setActiveTab] = useState<ReportType>('sales')
  const [selectedDept, setSelectedDept] = useState("all")
  const [selectedEmp, setSelectedEmp] = useState("all")
  const [isRecursive, setIsRecursive] = useState(false)

  const commonParams = {
    ...(selectedDept !== 'all' && { departmentId: selectedDept }),
    ...(selectedEmp !== 'all' && { employeeId: selectedEmp }),
    recursive: String(isRecursive)
  }

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['report-sales', activeTab, commonParams],
    queryFn: () => apiClient.get('/reports/sales', { params: commonParams }),
    enabled: status === "authenticated" && !permissionsLoading && canView("reports") && activeTab === 'sales'
  })

  const { data: productivityData, isLoading: productivityLoading } = useQuery({
    queryKey: ['report-productivity', activeTab, commonParams],
    queryFn: () => apiClient.get('/reports/productivity', { params: commonParams }),
    enabled: status === "authenticated" && !permissionsLoading && canView("reports") && activeTab === 'productivity'
  })

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['report-attendance', activeTab, commonParams],
    queryFn: () => apiClient.get('/reports/attendance', { params: commonParams }),
    enabled: status === "authenticated" && !permissionsLoading && canView("reports") && activeTab === 'attendance'
  })

  const isLoading = salesLoading || productivityLoading || attendanceLoading

  return (
    <PermissionGuard module="reports" action="view">
      <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground font-inter">System Reports</h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">
                Comprehensive system reports and performance metrics.
              </p>
            </div>
            
            <ManagementFilters 
              module="reports"
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              selectedEmp={selectedEmp}
              setSelectedEmp={(id, recursive) => {
                setSelectedEmp(id);
                setIsRecursive(recursive);
              }}
              isRecursive={isRecursive}
            />
          </div>
          
          <div className="flex bg-muted/30 p-1.5 rounded-xl border border-border/40 shadow-sm backdrop-blur-sm self-start">
            {(['sales', 'productivity', 'attendance'] as ReportType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
                  activeTab === tab 
                    ? "bg-background text-primary shadow-sm border border-border/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Leads" value={salesData?.summary.totalLeads} icon={Users} loading={isLoading} />
              <StatCard title="Won Leads" value={salesData?.summary.wonLeads} icon={TrendingUp} loading={isLoading} />
              <StatCard title="Conversion Rate" value={`${salesData?.summary.conversionRate}%`} icon={BarChart3} loading={isLoading} />
              <StatCard title="Active Pipeline" value={salesData?.summary.activeLeads} icon={PieChart} loading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-border/40 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Employee Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {salesData?.employeeBreakdown.map((emp: any, i: number) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-bold">{emp.name}</span>
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                            {emp.won} Won / {emp.total} Total
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${(emp.won / emp.total) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-destructive/40" 
                            style={{ width: `${(emp.lost / emp.total) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-primary/10" 
                            style={{ width: `${((emp.total - emp.won - emp.lost) / emp.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Source Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {salesData?.sourceBreakdown.map((src: any, i: number) => (
                    <div key={i} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                        <span className="text-xs font-medium">{src.source}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] tabular-nums font-bold border-border/40">{src.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'productivity' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Tasks" value={productivityData?.summary.totalTasks} icon={CheckSquare} loading={isLoading} />
              <StatCard title="Completed" value={productivityData?.summary.totalCompleted} icon={CheckSquare} loading={isLoading} />
              <StatCard title="Avg Completion" value={`${productivityData?.summary.avgCompletion}%`} icon={TrendingUp} loading={isLoading} />
              <StatCard title="EOD Reports" value={productivityData?.summary.totalEods} icon={Calendar} loading={isLoading} />
            </div>

            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Team Work Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Member</th>
                        <th className="py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Tasks</th>
                        <th className="py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Done</th>
                        <th className="py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">EODs</th>
                        <th className="py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {productivityData?.employees.map((emp: any, i: number) => (
                        <tr key={i} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-4">
                            <div className="font-bold text-xs">{emp.name}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">{emp.department}</div>
                          </td>
                          <td className="py-4 text-right text-xs font-medium tabular-nums">{emp.totalTasks}</td>
                          <td className="py-4 text-right text-xs font-medium tabular-nums text-primary">{emp.completedTasks}</td>
                          <td className="py-4 text-right text-xs font-medium tabular-nums">{emp.eodReports}</td>
                          <td className="py-4 text-right">
                            <Badge 
                              variant={emp.completionRate > 75 ? "success" : emp.completionRate > 40 ? "secondary" : "destructive"}
                              className="text-[10px] font-bold py-0 h-5"
                            >
                              {emp.completionRate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Records" value={attendanceData?.summary.totalRecords} icon={Calendar} loading={isLoading} />
              <StatCard title="Attendance Rate" value={`${attendanceData?.summary.attendanceRate}%`} icon={TrendingUp} loading={isLoading} />
              <StatCard title="Late Check-ins" value={attendanceData?.summary.lateCount} icon={Clock} loading={isLoading} />
              <StatCard title="Absent Alerts" value={attendanceData?.summary.absentCount} icon={CheckSquare} loading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-border/40 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Staff Attendance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="space-y-6">
                     {attendanceData?.employeeBreakdown.map((emp: any, i: number) => (
                       <div key={i} className="flex items-center gap-6">
                         <div className="w-32 shrink-0">
                           <div className="text-xs font-bold truncate">{emp.name}</div>
                           <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Rate: {Math.round((emp.present / emp.total) * 100)}%</div>
                         </div>
                         <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex shadow-inner">
                           <div className="h-full bg-primary" style={{ width: `${(emp.present / emp.total) * 100}%` }}></div>
                           <div className="h-full bg-warning" style={{ width: `${(emp.late / emp.total) * 100}%` }}></div>
                           <div className="h-full bg-destructive" style={{ width: `${(emp.absent / emp.total) * 100}%` }}></div>
                         </div>
                       </div>
                     ))}
                   </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50">
                 <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Main Strength</p>
                      <p className="text-xs font-medium text-foreground mt-1">Sales conversion is leading team performance this week.</p>
                   </div>
                   <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Attention Needed</p>
                      <p className="text-xs font-medium text-foreground mt-1">Average task completion time has increased by 12%.</p>
                   </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

function StatCard({ title, value, icon: Icon, loading, color = "text-foreground" }: any) {
  return (
    <Card className="border-border/40 bg-card/50 shadow-xs rounded-[10px] overflow-hidden relative group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
        <CardDescription className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
      </CardHeader>
      <CardContent className="relative z-10">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={`text-2xl font-black tracking-tighter tabular-nums ${color}`}>
            {value ?? 0}
          </div>
        )}
      </CardContent>
      <div className="absolute right-0 bottom-0 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none p-2">
        <Icon className="h-16 w-16" />
      </div>
    </Card>
  )
}
