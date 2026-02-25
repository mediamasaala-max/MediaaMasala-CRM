"use client"

import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { 
  Building, 
  Mail, 
  Phone, 
  User, 
  Clock, 
  MoreHorizontal,
  Plus,
  AlertTriangle,
  ArrowRight,
  Rocket,
  Activity,
  Calendar
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"

interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  source: string
  status: string
  lostReason?: string
  owner?: { firstName: string; lastName: string }
  department?: { name: string }
  leadNotes: Array<{ id: number; content: string; createdAt: string; author: { firstName: string; lastName: string }; isPrivate: boolean }>
  followUpLogs: Array<{ id: number; scheduledDate: string; outcome?: string; nextAction?: string; employee: { firstName: string; lastName: string } }>
  tasks: any[]
  project?: { id: number; name: string; status: string }
  createdAt: string
  activityLogs: Array<{
    id: number
    action: string
    description: string
    createdAt: string
    employee: { firstName: string; lastName: string }
    metadata: any
  }>
}

const LEAD_STATUSES = [
  'New', 'Not_Responded', 'Wrong_Contact', 'Follow_Up', 
  'Prospect', 'Hot_Prospect', 'Proposal_Sent', 'Closing', 'Won', 'Lost'
]

const getStatusVariant = (status: string) => {
    switch (status) {
      case 'New': return 'warning'
      case 'Not_Responded': return 'secondary'
      case 'Wrong_Contact': return 'destructive'
      case 'Follow_Up': return 'info'
      case 'Prospect': return 'default'
      case 'Hot_Prospect': return 'warning'
      case 'Proposal_Sent': return 'info'
      case 'Closing': return 'success'
      case 'Won': return 'success'
      case 'Lost': return 'destructive'
      default: return 'outline'
    }
}

import { PermissionGuard } from "@/components/permission-guard"

export default function LeadDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tasks' | 'timeline'>('overview')
  const { hasPermission, hasModule } = usePermissions()

  const canEdit = hasPermission("leads", "edit")
  const canDelete = hasPermission("leads", "delete")
  const canAssign = hasPermission("leads", "assign")
  const canViewTasks = hasModule("tasks")
  const canCreateTasks = hasPermission("tasks", "create")
  
  const [newNote, setNewNote] = useState("")
  const [isNotePrivate, setIsNotePrivate] = useState(false)
  
  // Follow-up state
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpAction, setFollowUpAction] = useState("")
  const [isLoggingFollowUp, setIsLoggingFollowUp] = useState(false)

  // Assignment state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedAssignee, setSelectedAssignee] = useState<number | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  // Lost reason state
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [tempLostStatus, setTempLostStatus] = useState("")
  const [lostReason, setLostReason] = useState("")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Won conversion state
  const [isWonModalOpen, setIsWonModalOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDesc, setProjectDesc] = useState("")
  const [isConverting, setIsConverting] = useState(false)

  const fetchLead = async () => {
    if (status !== "authenticated" || !session || !id) return
    
    try {
      const data = await apiClient.get(`/leads/${id}`)
      // Fetch activity logs separately for now, or assume backend includes them if we updated getLeadById
      // For this implementation, let's fetch them if they aren't in the lead object, or we can update the lead endpoint.
      // Assuming lead endpoint now returns activityLogs or we fetch them.
      // Let's add a separate fetch for logs to be safe and robust.
      const logs = await apiClient.get(`/activity?entityId=${id}&module=leads`)
      setLead({ ...data, activityLogs: logs.data })
    } catch (err) {
      console.error("API error:", err)
      router.push("/dashboard/leads")
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    if (status !== "authenticated" || !session || !canAssign) return
    try {
      const data = await apiClient.get(`/leads/employees`)
      setEmployees(data)
    } catch (err) {
      console.error("Error fetching employees:", err)
    }
  }

  useEffect(() => {
    fetchLead()
    fetchEmployees()
  }, [id, session, status, router])

  const handleUpdateStatus = async (newStatus: string) => {
    if (newStatus === 'Lost') {
      setTempLostStatus(newStatus)
      setIsLostModalOpen(true)
      return
    }

    if (newStatus === 'Won') {
      setIsWonModalOpen(true)
      return
    }

    try {
      await apiClient.patch(`/leads/${id}`, { status: newStatus })
      setLead(prev => prev ? { ...prev, status: newStatus } : null)
      fetchLead() // Refresh to get new log
    } catch (err) {
        console.error("Error updating status:", err)
    }
  }

  const handleConfirmWon = async () => {
    setIsConverting(true)
    try {
      // First update status to Won
      await apiClient.patch(`/leads/${id}`, { status: 'Won' })
      
      // Then convert to project
      await apiClient.post(`/leads/${id}/convert-to-project`, {
        projectName: projectName || `${lead?.company || lead?.name} - Implementation`,
        description: projectDesc
      })

      setLead(prev => prev ? { ...prev, status: 'Won' } : null)
      setIsWonModalOpen(false)
      fetchLead() // Refresh to get project data and logs
    } catch (err) {
      console.error("Error converting lead:", err)
    } finally {
      setIsConverting(false)
    }
  }

  const handleConfirmLost = async () => {
    if (!lostReason) return
    setIsUpdatingStatus(true)
    try {
      await apiClient.patch(`/leads/${id}`, { 
        status: tempLostStatus, 
        lostReason: lostReason 
      })
      setLead(prev => prev ? { ...prev, status: tempLostStatus, lostReason: lostReason } : null)
      setIsLostModalOpen(false)
      fetchLead() // Refresh to get logs
    } catch (err) {
      console.error("Error updating lost status:", err)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleAssignLead = async () => {
    if (!selectedAssignee) return
    setIsAssigning(true)
    try {
      const updatedLead = await apiClient.post(`/leads/${id}/assign`, { assigneeId: selectedAssignee })
      setLead(prev => prev ? { ...prev, owner: updatedLead.owner } : null)
      setIsAssignModalOpen(false)
      fetchLead() // Refresh logs
    } catch (err) {
      console.error("Assignment error:", err)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    
    try {
      const note = await apiClient.post(`/leads/${id}/notes`, { content: newNote, isPrivate: isNotePrivate })
      setLead(prev => prev ? { ...prev, leadNotes: [note, ...prev.leadNotes] } : null)
      setNewNote("")
      setIsNotePrivate(false)
      fetchLead() // Refresh logs
    } catch (err) {
      console.error("Error adding note:", err)
    }
  }

  const handleLogFollowUp = async () => {
    if (!followUpDate || !followUpAction.trim()) return
    setIsLoggingFollowUp(true)

    try {
        const followUp = await apiClient.post(`/leads/${id}/follow-ups`, { 
            scheduledDate: followUpDate,
            nextAction: followUpAction 
        })
        setLead(prev => prev ? { ...prev, followUpLogs: [followUp, ...prev.followUpLogs] } : null)
        setFollowUpDate("")
        setFollowUpAction("")
        setActiveTab('overview') // Shift to see the update
        fetchLead() // Refresh logs
    } catch (err) {
        console.error("Error logging follow-up:", err)
    } finally {
        setIsLoggingFollowUp(false)
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-success'
      case 'UPDATE': return 'text-info'
      case 'STATUS_CHANGE': return 'text-warning'
      case 'DELETE': return 'text-destructive'
      case 'ASSIGN': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  if (loading) return <div className="p-10 animate-pulse text-center text-gray-400 font-medium">Loading Lead Profile...</div>
  if (!lead) return <div className="p-10 text-center">Lead not found.</div>

  return (
    <PermissionGuard module="leads" action="view">
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
      {/* Header Breadcrumb & Actions - Modern SaaS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            <Link href="/dashboard/leads" className="text-muted-foreground/60">All Leads</Link>
            <span className="opacity-30">/</span>
            <span className="text-foreground/80">Lead Details</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lead.name}</h1>
          <p className="text-muted-foreground text-xs font-medium mt-1">
            {lead.company || "Person"} <span className="mx-2 opacity-30">•</span> Added on {new Date(lead.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <Badge variant={getStatusVariant(lead.status)} className="font-semibold text-[10px] uppercase tracking-wider py-1 px-3.5 rounded-md shadow-sm border-none">
                {lead.status.replace(/_/g, " ")}
           </Badge>
           <div className="h-6 w-[1px] bg-border/40 mx-1 hidden md:block" />
           {canAssign && (
             <Button variant="outline" className="rounded-lg font-semibold text-xs h-9 px-4 border-border/60" onClick={() => setIsAssignModalOpen(true)}>
               Assign To <ArrowRight className="ml-2 h-3.5 w-3.5" />
             </Button>
           )}
           {canEdit && (
             <Button className="rounded-lg font-semibold text-xs h-9 px-4 shadow-lg shadow-primary/10">
               Edit Record
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Sidebar */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="bg-card border-border/40 rounded-xl overflow-hidden shadow-xs">
             <CardHeader className="pb-3 border-b border-border/30 bg-muted/10">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Info</CardTitle>
             </CardHeader>
             <CardContent className="pt-5 space-y-5">
                <div className="space-y-1">
                   <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Email Address</p>
                   <p className="text-sm font-semibold text-foreground truncate">{lead.email}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Phone</p>
                   <p className="text-sm font-semibold text-foreground">{lead.phone || "Non-Disclosed"}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Assigned To</p>
                   <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shadow-xs">
                        {lead.owner ? lead.owner.firstName.charAt(0) : "!"}
                      </div>
                      <p className="text-xs font-semibold text-foreground/80">
                        {lead.owner ? `${lead.owner.firstName}` : "Unassigned"}
                      </p>
                   </div>
                </div>
                <div className="pt-4 border-t border-border/30">
                   <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Lead Status</p>
                   {canEdit && (
                      <div className="relative">
                        <select 
                            value={lead.status}
                            onChange={(e) => handleUpdateStatus(e.target.value)}
                            className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                        >
                            {LEAD_STATUSES.map(s => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                      </div>
                   )}
                </div>
             </CardContent>
           </Card>

           {lead.status === 'Lost' && lead.lostReason && (
              <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl animate-in zoom-in duration-500">
                 <div className="flex items-center gap-2 mb-2">
                    <span className="text-destructive text-xs">⚠️</span>
                    <span className="text-[9px] font-bold text-destructive uppercase tracking-widest">Lost Reason</span>
                 </div>
                 <p className="text-[11px] font-medium text-destructive leading-relaxed italic opacity-80">&quot;{lead.lostReason}&quot;</p>
              </div>
           )}

           {lead.project && (
               <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl animate-in zoom-in duration-500">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-primary text-xs">🚀</span>
                     <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Project Started</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-bold text-foreground truncate">{lead.project.name}</p>
                    <Badge variant="outline" className="w-fit text-[8px] font-black uppercase tracking-tighter border-primary/20 bg-primary/10 text-primary">
                      Status: {lead.project.status}
                    </Badge>
                  </div>
                  <Button variant="link" className="text-primary p-0 h-auto mt-3 font-bold text-[10px] uppercase tracking-widest hover:no-underline opacity-60 hover:opacity-100 transition-opacity" onClick={() => router.push(`/dashboard/portfolio?tab=projects`)}>
                    Go to Project →
                  </Button>
               </div>
            )}

           <div className="space-y-2.5 pt-2">
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest pl-2">Quick Contact</p>
              <Button variant="outline" className="w-full justify-start rounded-xl h-10 border-border/40 hover:bg-muted text-xs font-semibold group">
                <Mail className="mr-3 h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" /> Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl h-10 border-border/40 hover:bg-muted text-xs font-semibold group">
                <Phone className="mr-3 h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" /> Call Now
              </Button>
           </div>
        </div>

        {/* Main Intelligence View */}
        <div className="lg:col-span-3 space-y-6">
           {/* Tabbed Interface - Refined */}
           <div className="flex border-b border-border/40 gap-6">
            {(['overview', 'activity', 'tasks', 'timeline'] as const)
              .filter(tab => tab !== 'tasks' || canViewTasks)
              .map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-[11px] font-semibold uppercase tracking-wider relative ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground/40"
                }`}
              >
                {tab === 'overview' ? 'Details' : tab === 'activity' ? 'Follow-ups' : tab === 'timeline' ? 'Timeline' : tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in slide-in-from-bottom-2" />
                )}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Meta Matrix - Modern Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-card p-4 rounded-xl border border-border/40 shadow-xs">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">How they found us</p>
                      <p className="text-xs font-semibold text-foreground italic">{lead.source.replace(/_/g, " ")}</p>
                    </div>
                    <div className="bg-card p-4 rounded-xl border border-border/40 shadow-xs">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">Department</p>
                      <p className="text-xs font-semibold text-foreground uppercase tracking-tight">{lead.department?.name || "Global"}</p>
                    </div>
                    <div className="bg-card p-4 rounded-xl border border-border/40 shadow-xs">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">Added on</p>
                      <p className="text-xs font-semibold text-foreground">{new Date(lead.createdAt).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}</p>
                    </div>
                </div>

                {/* Internal Comms Thread */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h3 className="text-sm font-semibold tracking-tight text-foreground/80">Notes</h3>
                     <Badge variant="secondary" className="font-semibold text-[9px] uppercase tracking-wider opacity-60 border-none">{lead.leadNotes.length} Events</Badge>
                  </div>

                  <Card className="rounded-xl border-border/40 shadow-xs overflow-hidden bg-card">
                     <div className="p-4 space-y-3">
                        <textarea
                          placeholder="Write a note..."
                          className="w-full min-h-[100px] bg-muted/20 rounded-lg p-3.5 text-xs font-medium border-none focus:ring-1 focus:ring-primary/30 outline-none transition-all placeholder:text-muted-foreground/30 resize-none tabular-nums"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                        />
                        <div className="flex justify-between items-center bg-muted/5 p-1.5 rounded-lg border border-border/40">
                          <label className="flex items-center gap-2.5 px-2 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               checked={isNotePrivate} 
                               onChange={(e) => setIsNotePrivate(e.target.checked)}
                               className="w-3.5 h-3.5 rounded border-border/60 accent-primary" 
                              />
                             <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Private</span>
                          </label>
                          <Button 
                              onClick={handleAddNote} 
                              disabled={!newNote.trim()} 
                              className="h-8 px-5 rounded-md font-semibold text-[10px] shadow-sm transition-all"
                          >
                            Post Note
                          </Button>
                        </div>
                     </div>
                  </Card>

                  <div className="space-y-4">
                    {lead.leadNotes.map((note) => (
                      <div key={note.id} className="relative group">
                        <div className="bg-card p-5 rounded-xl border border-border/40 shadow-xs flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground/60 text-xs shadow-xs">
                              {note.author.firstName.charAt(0)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                               <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground/80">{note.author.firstName}</span>
                                  <span className="text-[10px] text-muted-foreground/30">•</span>
                                  <span className="text-[10px] text-muted-foreground/50 font-medium">{new Date(note.createdAt).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                               </div>
                               {note.isPrivate && <Badge variant="warning" className="text-[8px] h-3.5 uppercase font-bold tracking-wider px-1.5 leading-none border-none shadow-xs">Private</Badge>}
                            </div>
                            <p className="text-[11px] font-medium text-foreground/70 leading-relaxed whitespace-pre-wrap mt-1">{note.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {lead.leadNotes.length === 0 && (
                      <div className="py-16 text-center border-2 border-dashed border-border/30 rounded-xl opacity-20">
                        <p className="text-[10px] font-semibold uppercase tracking-widest italic">No notes yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                 <div className="md:col-span-3 space-y-4">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/80">Follow-up Schedule</h3>
                    <div className="space-y-3">
                        {lead.followUpLogs.map(log => (
                            <div key={log.id} className="bg-card p-4 rounded-xl border border-border/40 shadow-xs flex items-start gap-4">
                                 <div className="w-9 h-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center flex-shrink-0 border border-primary/10 shadow-xs">
                                    <Clock className="h-4 w-4" />
                                 </div>
                                 <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider tabular-nums">
                                          {new Date(log.scheduledDate).toLocaleDateString([], {month:'short', day:'numeric'})} 
                                          <span className="opacity-30 mx-2">@</span> 
                                          {new Date(log.scheduledDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                        <Badge className="bg-success/10 text-success border-none font-bold text-[8px] uppercase tracking-wider px-2 h-4 leading-none rounded-sm">Active</Badge>
                                    </div>
                                    <p className="text-[11px] font-semibold text-muted-foreground mt-1.5 leading-snug">&quot;{log.nextAction}&quot;</p>
                                    <div className="mt-3 flex items-center gap-2">
                                       <div className="h-4 w-4 rounded bg-muted flex items-center justify-center text-[7px] font-bold uppercase text-foreground/50 border border-border/40">
                                         {log.employee.firstName.charAt(0)}
                                       </div>
                                       <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Scheduled by {log.employee.firstName}</p>
                                    </div>
                                 </div>
                            </div>
                        ))}
                        {lead.followUpLogs.length === 0 && (
                             <div className="py-16 text-center border-2 border-dashed border-border/30 rounded-xl opacity-20">
                                <p className="text-[10px] font-semibold uppercase tracking-widest italic">No follow-ups planned</p>
                             </div>
                        )}
                    </div>
                 </div>

                 <Card className="md:col-span-2 bg-linear-to-b from-primary to-primary/90 text-primary-foreground rounded-xl border-none shadow-lg p-1 h-fit sticky top-24">
                   <CardHeader className="bg-white/10 rounded-lg p-5 mb-1.5">
                     <CardTitle className="text-[9px] font-bold uppercase tracking-widest opacity-60">Follow-up</CardTitle>
                     <p className="text-base font-semibold tracking-tight">Pick a date</p>
                   </CardHeader>
                   <CardContent className="p-5 space-y-5">
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold uppercase tracking-wider opacity-60 ml-0.5">When?</Label>
                          <Input 
                              type="datetime-local" 
                              className="bg-white/10 border-none rounded-lg h-9 font-semibold text-[10px] text-white focus:ring-1 focus:ring-white/30"
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                          />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold uppercase tracking-wider opacity-60 ml-0.5">What to do?</Label>
                          <textarea 
                            placeholder="What needs to be done..."
                            className="w-full min-h-[100px] bg-white/10 border-none rounded-lg p-3 text-[11px] font-medium text-white focus:ring-1 focus:ring-white/30 outline-none placeholder:text-white/20 resize-none"
                            value={followUpAction}
                            onChange={(e) => setFollowUpAction(e.target.value)}
                          />
                      </div>
                      <Button 
                        className="w-full bg-white text-primary hover:bg-white/95 font-bold h-9 rounded-lg uppercase tracking-wider text-[10px]"
                        disabled={isLoggingFollowUp || !followUpDate || !followUpAction.trim()}
                        onClick={handleLogFollowUp}
                      >
                        Save Follow-up
                      </Button>
                   </CardContent>
                 </Card>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-sm font-semibold tracking-tight text-foreground/80">Tasks</h3>
                   {canCreateTasks && (
                     <Button onClick={() => router.push(`/dashboard/tasks/new?leadId=${lead.id}`)} className="h-8 px-4 rounded-md font-semibold text-[10px] shadow-sm">
                       <Plus className="mr-2 h-3.5 w-3.5" /> Add Task
                     </Button>
                   )}
                </div>

                {lead.tasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lead.tasks.map(task => (
                      <div key={task.id} className="bg-card p-4 rounded-xl border border-border/40 shadow-xs group flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`h-1 w-1 rounded-full ${task.priority === 'High' ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-primary/40'}`} />
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-foreground/90 tracking-tight cursor-pointer truncate" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                                  {task.title}
                                </p>
                                <p className="text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-wider mt-0.5 tabular-nums">Due {new Date(task.dueDate).toLocaleDateString([], {month:'short', day:'numeric'})}</p>
                            </div>
                        </div>
                        <Badge variant="secondary" className="font-bold text-[8px] uppercase tracking-wider px-2 h-4 leading-none border-none opacity-60 tabular-nums">{task.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center border-2 border-dashed border-border/30 rounded-xl opacity-20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest italic">No tasks yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/80">Timeline</h3>
                    <Badge variant="secondary" className="font-semibold text-[9px] uppercase tracking-wider opacity-60 border-none">{lead.activityLogs?.length || 0} Events</Badge>
                 </div>
                 
                 <div className="relative border-l-2 border-border/40 ml-4 space-y-8 pb-4">
                    {lead.activityLogs?.map((log) => (
                      <div key={log.id} className="relative pl-8">
                         {/* Timeline Dot */}
                         <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${
                            log.action === 'CREATE' ? 'bg-success text-white' :
                            log.action === 'STATUS_CHANGE' ? 'bg-warning text-white' :
                            'bg-muted text-muted-foreground'
                         }`}>
                           <div className="h-1.5 w-1.5 rounded-full bg-current" />
                         </div>

                         <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                               <p className="text-xs font-bold text-foreground">
                                 {log.action.replace('_', ' ')}
                               </p>
                               <span className="text-[10px] text-muted-foreground/40 font-medium">
                                 {new Date(log.createdAt).toLocaleString()}
                               </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                               {log.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                               <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                  {log.employee.firstName.charAt(0)}
                               </div>
                               <p className="text-[10px] font-medium text-muted-foreground/60">{log.employee.firstName} {log.employee.lastName}</p>
                            </div>
                         </div>
                      </div>
                    ))}

                    {(!lead.activityLogs || lead.activityLogs.length === 0) && (
                         <div className="pl-8 py-8">
                            <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
                         </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lost Reason Modal Overlay */}
      {isLostModalOpen && (
        <div className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="max-w-sm w-full bg-card rounded-2xl border border-border/40 shadow-2xl p-8 space-y-6 relative overflow-hidden animate-in zoom-in duration-300">
              <div className="text-center">
                 <div className="h-14 w-14 rounded-xl bg-destructive/5 flex items-center justify-center mx-auto mb-4 border border-destructive/10 shadow-xs">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                 </div>
                 <h3 className="text-lg font-semibold tracking-tight text-foreground">Why did we lose it?</h3>
                 <p className="text-muted-foreground font-medium text-xs mt-1.5 opacity-80">Please explain why this sale was lost.</p>
              </div>
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Primary Reason</Label>
                 <div className="relative">
                    <select 
                      className="w-full h-10 rounded-lg bg-muted/30 border border-border/40 font-semibold uppercase tracking-wider text-[10px] px-4 outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-muted/50 transition-all"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                    >
                      <option value="">Select reason...</option>
                      <option value="Budget Constraints">Budget Constraints</option>
                      <option value="Timeline Misalignment">Timeline Misalignment</option>
                      <option value="Competition (Better Price)">Competition (Better Price)</option>
                      <option value="Competition (Better Features)">Competition (Better Features)</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="No Response">No Response</option>
                      <option value="Internal Change">Internal Change</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                 </div>
              </div>
              {lostReason === 'Other' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Description</Label>
                  <textarea 
                    className="w-full h-20 rounded-lg bg-muted/30 border border-border/40 font-medium text-xs p-3 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                    placeholder="Provide additional context..."
                    onChange={(e) => setLostReason('Other: ' + e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2.5 pt-2">
                 <Button variant="ghost" className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10" onClick={() => setIsLostModalOpen(false)}>Cancel</Button>
                 <Button 
                  className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10 shadow-lg shadow-primary/10" 
                  onClick={handleConfirmLost}
                  disabled={!lostReason || isUpdatingStatus}
                 >
                   {isUpdatingStatus ? "Updating..." : "Confirm Status"}
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* Won Conversion Modal Overlay */}
      {isWonModalOpen && (
        <div className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="max-w-sm w-full bg-card rounded-2xl border border-border/40 shadow-2xl p-8 space-y-6 relative overflow-hidden animate-in zoom-in duration-300">
              <div className="text-center">
                 <div className="h-14 w-14 rounded-xl bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10 shadow-xs">
                    <Rocket className="h-6 w-6 text-primary" />
                 </div>
                 <h3 className="text-lg font-semibold tracking-tight text-foreground">Lead Won!</h3>
                 <p className="text-muted-foreground font-medium text-xs mt-1.5 opacity-80">Start a new project for this win.</p>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Project Name</Label>
                    <Input 
                      className="h-10 bg-muted/30 border-border/40 font-semibold text-xs rounded-lg"
                      placeholder="Enter project name..."
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Initial Brief</Label>
                    <textarea 
                      className="w-full h-24 rounded-lg bg-muted/30 border border-border/40 font-medium text-xs p-3 outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed"
                      placeholder="Outline the primary deliverables..."
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                    />
                 </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                 <Button variant="ghost" className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10" onClick={() => setIsWonModalOpen(false)}>Later</Button>
                 <Button 
                  className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10 shadow-lg shadow-primary/10" 
                  onClick={handleConfirmWon}
                  disabled={isConverting}
                 >
                   {isConverting ? "Starting..." : "Start Project"}
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* Assignment Modal Overlay - Modern Glassmorphism */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="max-w-sm w-full bg-card rounded-2xl border border-border/40 shadow-2xl p-8 space-y-6 relative overflow-hidden animate-in zoom-in duration-300">
              <div className="text-center">
                 <div className="h-14 w-14 rounded-xl bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10 shadow-xs">
                    <User className="h-6 w-6 text-primary" />
                 </div>
                 <h3 className="text-lg font-semibold tracking-tight text-foreground">Assign to someone else</h3>
                 <p className="text-muted-foreground font-medium text-xs mt-1.5 opacity-80">Pick the person who will handle this now.</p>
              </div>
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest pl-1">Select person</Label>
                 <div className="relative">
                    <select 
                      className="w-full h-10 rounded-lg bg-muted/30 border border-border/40 font-semibold uppercase tracking-wider text-[10px] px-4 outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-muted/50 transition-all"
                      value={selectedAssignee || ""}
                      onChange={(e) => setSelectedAssignee(Number(e.target.value))}
                    >
                       <option value="">Select staff...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} — {emp.department?.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-[8px]">▼</div>
                 </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                 <Button variant="ghost" className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                 <Button 
                  className="flex-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider h-10 shadow-lg shadow-primary/10" 
                  onClick={handleAssignLead}
                  disabled={!selectedAssignee || isAssigning}
                 >
                   {isAssigning ? "Saving..." : "Save"}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  )
}
