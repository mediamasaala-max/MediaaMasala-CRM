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
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { 
  Plus, 
  Search, 
  Mail, 
  Building, 
  MoreHorizontal, 
  Filter,
  Loader2,
  RefreshCcw 
} from "lucide-react"
import { ViewToggle, ViewType } from "@/components/dashboard/view-toggle"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/permission-guard"
import { ManagementFilters } from "@/components/dashboard/management-filters"
import { PageSkeleton } from "@/components/dashboard/page-skeleton"

interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  source: string
  status: string
  owner?: { firstName: string; lastName: string }
  createdAt: string
}

const getStatusVariant = (status: string): any => {
  switch (status) {
    case 'New': return 'warning'
    case 'Not_Responded': return 'secondary'
    case 'Wrong_Contact': return 'destructive'
    case 'Follow_Up': return 'info'
    case 'Prospect': return 'outline'
    case 'Hot_Prospect': return 'hot'
    case 'Proposal_Sent': return 'info'
    case 'Closing': return 'info'
    case 'Won': return 'won'
    case 'Lost': return 'destructive'
    default: return 'outline'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Won': return 'border-l-emerald-500'
    case 'Lost': return 'border-l-destructive'
    case 'Hot_Prospect': return 'border-l-rose-500'
    case 'New': return 'border-l-amber-500'
    default: return 'border-l-transparent'
  }
}


export default function LeadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [localLeads, setLocalLeads] = useState<Lead[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [view, setView] = useState<ViewType>("list")
  const { hasPermission, canView, isLoading: permissionsLoading } = usePermissions()
  
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [isRecursive, setIsRecursive] = useState<boolean>(false)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  const { data: leads = [], isLoading, isFetching, error: queryError } = useQuery<Lead[]>({
    queryKey: ["leads", session?.user?.email, selectedDeptId, selectedEmployeeId, isRecursive],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...(selectedDeptId !== 'all' && { departmentId: selectedDeptId }),
        ...(selectedEmployeeId !== 'all' && { ownerId: selectedEmployeeId }),
        recursive: String(isRecursive)
      }
      const data = await apiClient.get("/leads", { params })
      return Array.isArray(data) ? data : (data.leads || [])
    },
    enabled: status === "authenticated" && !permissionsLoading && canView("leads"),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (leads) setLocalLeads(leads)
  }, [leads])

  const canCreate = hasPermission("leads", "create")
  const canDelete = hasPermission("leads", "delete")

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingLead, setDeletingLead] = useState<{id: string, name: string} | null>(null)

  const handleDelete = async () => {
    if (!deletingLead) return
    const { id, name } = deletingLead
    const originalLeads = [...localLeads]
    setLocalLeads(prev => prev.filter(l => l.id !== id))
    setDeletingId(id)
    setDeletingLead(null)

    try {
      await apiClient.delete(`/leads/${id}`)
      toast.success(`Lead "${name}" deleted`)
    } catch (err: any) {
      setLocalLeads(originalLeads)
      toast.error(err.message || "Deletion failed")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredLeads = useMemo(() => {
    let filtered = localLeads;
    if (selectedStatus !== "all") {
        filtered = filtered.filter(l => l.status === selectedStatus)
    }
    const q = searchTerm.toLowerCase();
    return filtered.filter(lead => 
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.company?.toLowerCase().includes(q)
    )
  }, [localLeads, searchTerm, selectedStatus])

  if (status === "loading" || isLoading || permissionsLoading) {
    return <PageSkeleton />
  }

  if (status === "unauthenticated") {
    router.push("/auth/login")
    return null
  }

  return (
    <PermissionGuard module="leads" action="view">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-bold text-foreground">Leads</h1>
            <p className="text-xs text-muted-foreground mt-1">Manage prospects and track sales progress.</p>
          </div>
          {canCreate && (
            <Button onClick={() => router.push("/dashboard/leads/new")} size="sm" className="h-9 font-bold">
              <Plus className="mr-2 h-4 w-4" /> Create Lead
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
              <Input 
                placeholder="Search leads..." 
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Status: All</option>
                <option value="New">New</option>
                <option value="Not_Responded">Not Responded</option>
                <option value="Wrong_Contact">Wrong Contact</option>
                <option value="Follow_Up">Follow Up</option>
                <option value="Prospect">Prospect</option>
                <option value="Hot_Prospect">Hot Prospect</option>
                <option value="Proposal_Sent">Proposal Sent</option>
                <option value="Closing">Closing</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <ManagementFilters 
              module="leads"
              selectedDept={selectedDeptId}
              setSelectedDept={setSelectedDeptId}
              selectedEmp={selectedEmployeeId}
              setSelectedEmp={(id, recursive) => {
                  setSelectedEmployeeId(id);
                  setIsRecursive(recursive);
              }}
              isRecursive={isRecursive}
            />
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle view={view} onViewChange={setView} />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-xs font-semibold" 
              onClick={() => {
                setSearchTerm(""); 
                setSelectedEmployeeId("all"); 
                setSelectedDeptId("all");
                setIsRecursive(false); 
                setSelectedStatus("all")
              }}
            >
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        <div className="h-0.5 w-full bg-muted overflow-hidden">
          {isFetching && <div className="h-full bg-primary animate-pulse w-full" />}
        </div>

        {queryError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-sm font-bold" role="alert">
            Error: {(queryError as any).message || "Failed to fetch leads"}
          </div>
        )}

        <div className={isFetching ? 'opacity-60' : ''}>
          {filteredLeads.length > 0 ? (
            view === "list" ? (
              <div className="border rounded-md overflow-hidden bg-background">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Lead</th>
                      <th className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Company</th>
                      <th className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className={cn("hover:bg-muted/30 transition-none border-l-4", getStatusColor(lead.status))}>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span 
                              className="font-bold text-sm text-foreground hover:underline cursor-pointer" 
                              onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                            >
                              {lead.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{lead.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {lead.company || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getStatusVariant(lead.status)} className="text-[10px] font-bold uppercase rounded-sm border-none">
                            {lead.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold" onClick={() => router.push(`/dashboard/leads/${lead.id}`)}>
                              View
                            </Button>
                            {canDelete && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[11px] font-bold text-destructive hover:bg-destructive/5"
                                onClick={() => setDeletingLead({id: lead.id, name: lead.name})}
                                disabled={deletingId === lead.id}
                              >
                                {deletingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className={cn("shadow-none border hover:border-primary/50 transition-none border-l-4", getStatusColor(lead.status))}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-bold">{lead.name}</CardTitle>
                          <Badge variant={getStatusVariant(lead.status)} className="text-[9px] font-bold uppercase rounded-sm">
                            {lead.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/leads/${lead.id}`)}>Details</DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingLead({id: lead.id, name: lead.name})}>Delete</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Building className="h-3 w-3" /> {lead.company || "Private"}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Owner: {lead.owner ? lead.owner.firstName : 'Unassigned'}</span>
                        <Button variant="link" className="text-primary text-[11px] p-0 h-auto font-bold" onClick={() => router.push(`/dashboard/leads/${lead.id}`)}>
                          Manage →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <div className="border border-dashed rounded-md py-20 text-center bg-muted/5">
              <Filter className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="text-base font-bold">No leads match.</h3>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search term.</p>
              <Button variant="link" onClick={() => setSearchTerm("")} className="text-xs font-bold mt-2">Clear Search</Button>
            </div>
          )}
        </div>

        <AlertDialog open={!!deletingLead} onOpenChange={(open) => !open && setDeletingLead(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-bold text-foreground">"{deletingLead?.name}"</span>? 
                This action is irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
      </div>
    </PermissionGuard>
  )
}
