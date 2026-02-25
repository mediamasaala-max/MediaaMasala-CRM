"use client"

export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { Briefcase, Package, ShoppingBag, ArrowRight, User } from "lucide-react"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"

const PRIORITIES = ["High", "Medium", "Low"]

type RelatedType = "lead" | "project" | "product" | "none"

function NewTaskContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialLeadId = searchParams?.get("leadId")
  const initialProjectId = searchParams?.get("projectId")
  
  const { hasModule, canView, isLoading: permissionsLoading } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [error, setError] = useState("")
  
  const [leads, setLeads] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [assignees, setAssignees] = useState<any[]>([])

  const [relatedType, setRelatedType] = useState<RelatedType>(
    initialLeadId ? "lead" : initialProjectId ? "project" : "none"
  )

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    relatedToLeadId: initialLeadId || "",
    projectId: initialProjectId || "",
    productId: "",
    assigneeId: "",
  })

  useEffect(() => {
    async function fetchData() {
      if (status !== "authenticated" || !session || permissionsLoading) return
      
      try {
        const promises = []
        
        if (canView("leads")) promises.push(apiClient.get("/leads").catch(() => []))
        else promises.push(Promise.resolve([]))
        
        if (canView("projects")) promises.push(apiClient.get("/projects").catch(() => []))
        else promises.push(Promise.resolve([]))
        
        if (canView("products")) promises.push(apiClient.get("/products").catch(() => []))
        else promises.push(Promise.resolve([]))

        const [leadsData, projectsData, productsData] = await Promise.all(promises)
        
        setLeads(leadsData.leads || leadsData || [])
        setProjects(projectsData.projects || projectsData || [])
        setProducts(productsData || [])

        // Separate fetch for employees as it might require specific permissions
        if (canView("tasks")) {
          try {
             setLoadingEmployees(true)
             const employeesData = await apiClient.get("/tasks/employees")
             setAssignees(employeesData.employees || employeesData || [])
          } catch (e) {
             console.log("Could not fetch employees (likely permission issue), defaulting to self-assign.")
          } finally {
             setLoadingEmployees(false)
          }
        } else {
          setLoadingEmployees(false)
        }

      } catch (err) {
        console.error("Error fetching relation data:", err)
      }
    }
    fetchData()
  }, [session, status, permissionsLoading, canView])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await apiClient.post("/tasks", {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        dueDate: new Date(formData.dueDate).toISOString(),
        leadId: relatedType === "lead" ? formData.relatedToLeadId : null,
        projectId: relatedType === "project" ? parseInt(formData.projectId as string) : null,
        productId: relatedType === "product" ? parseInt(formData.productId as string) : null,
        assigneeId: formData.assigneeId ? parseInt(formData.assigneeId) : undefined
      })
      router.push("/dashboard/tasks")
      toast.success("Task created successfully")
    } catch (err: any) {
      setError(err.message || "Failed to create task")
      toast.error(err.message || "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return <div className="p-10 animate-pulse text-center">Loading Environment...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
        <Link href="/dashboard/tasks" className="text-muted-foreground/40 text-primary hover:text-primary/100 transition-colors">Tasks</Link>
        <span className="opacity-40">/</span>
        <span className="text-foreground/80 tracking-tight">Create Task</span>
      </div>

      <Card className="rounded-2xl border border-border/40 shadow-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-8 pt-10 px-10 bg-linear-to-b from-muted/20 to-transparent">
          <CardTitle className="text-2xl font-semibold tracking-tight">Create New Task</CardTitle>
          <p className="text-[11px] font-medium text-muted-foreground/50 mt-1.5 leading-relaxed uppercase tracking-wider">Details for the new task</p>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="p-10 pt-8 space-y-8">
            {error && (
              <div className="bg-destructive/5 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-in shake">
                🚨 Error: {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title" className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Task Title *</Label>
              <Input 
                id="title"
                name="title" 
                placeholder="What needs to be done?"
                value={formData.title} 
                onChange={handleChange} 
                required 
                className="h-12 rounded-xl border-border/20 bg-muted/10 font-medium text-sm px-5 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Description</Label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="More details about the task..."
                className="flex w-full rounded-xl border border-border/20 bg-muted/10 px-5 py-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/20 resize-none transition-all shadow-inner leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Priority *</Label>
                <div className="relative">
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="flex h-12 w-full rounded-xl border border-border/20 bg-muted/10 px-5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer transition-all uppercase tracking-wider tabular-nums"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-[10px]">▼</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Due Date *</Label>
                <Input 
                  id="dueDate"
                  name="dueDate" 
                  type="date" 
                  value={formData.dueDate} 
                  onChange={handleChange} 
                  required 
                  className="h-12 rounded-xl border-border/20 bg-muted/10 font-semibold text-sm px-5 tabular-nums focus:ring-1 focus:ring-primary/30 transition-all uppercase"
                />
              </div>
            </div>

            {/* Assignee Field - Static with Loading state */}
            <div className="space-y-2">
                <Label htmlFor="assigneeId" className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Assign User</Label>
                <div className="relative">
                  <select
                    id="assigneeId"
                    name="assigneeId"
                    value={formData.assigneeId}
                    onChange={handleChange}
                    disabled={loadingEmployees}
                    className="flex h-12 w-full rounded-xl border border-border/20 bg-muted/10 px-5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer transition-all uppercase tracking-wider tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingEmployees ? (
                      <option value="">Loading users...</option>
                    ) : (
                      <>
                        <option value="">Assign to Me ({session?.user?.name || session?.user?.email?.split('@')[0] || 'Default'})</option>
                        {assignees.map((emp) => (
                           <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} — {emp.email?.split('@')[0]} ({emp.department?.name || 'N/A'})</option>
                        ))}
                      </>
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-[10px]">
                    {loadingEmployees ? <span className="animate-spin inline-block">◌</span> : "▼"}
                  </div>
                </div>
            </div>

            {/* Relation Selector */}
            <div className="space-y-4 pt-4">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground/40 tracking-widest pl-1">Link to</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   { id: "none", label: "None", icon: null },
                   { id: "lead", label: "Lead", icon: ShoppingBag },
                   { id: "project", label: "Project", icon: Briefcase },
                   { id: "product", label: "Product", icon: Package },
                 ].map((type) => (
                   <button
                    key={type.id}
                    type="button"
                    onClick={() => setRelatedType(type.id as RelatedType)}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border transition-all gap-2 group ${
                      relatedType === type.id 
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/40" 
                      : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20 hover:border-border/40"
                    }`}
                   >
                     {type.icon && <type.icon className={`h-4 w-4 ${relatedType === type.id ? "text-white" : "opacity-30 group-hover:opacity-60"} transition-all`} />}
                     <span className={`text-[10px] font-bold uppercase tracking-wider ${relatedType === type.id ? "text-white" : "text-muted-foreground/60"}`}>{type.label}</span>
                   </button>
                 ))}
              </div>

              <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                {relatedType === "lead" && (
                   <div className="relative">
                      <select
                        name="relatedToLeadId"
                        value={formData.relatedToLeadId}
                        onChange={handleChange}
                        className="flex h-12 w-full rounded-xl border border-border/40 bg-muted/5 px-5 text-xs font-bold uppercase tracking-widest focus:outline-none appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select Lead...</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>{lead.name} — {lead.company || lead.email}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-[10px]">▼</div>
                   </div>
                )}
                {relatedType === "project" && (
                   <div className="relative">
                      <select
                        name="projectId"
                        value={formData.projectId}
                        onChange={handleChange}
                        className="flex h-12 w-full rounded-xl border border-border/40 bg-muted/5 px-5 text-xs font-bold uppercase tracking-widest focus:outline-none appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select Project...</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.status}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-[10px]">▼</div>
                   </div>
                )}
                {relatedType === "product" && (
                   <div className="relative">
                      <select
                        name="productId"
                        value={formData.productId}
                        onChange={handleChange}
                        className="flex h-12 w-full rounded-xl border border-border/40 bg-muted/5 px-5 text-xs font-bold uppercase tracking-widest focus:outline-none appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select Product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.category}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-[10px]">▼</div>
                   </div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end items-center gap-6 bg-muted/30 p-10 px-10 border-t border-border/10">
              <Link href="/dashboard/tasks" className="text-[10px] font-bold text-muted-foreground/50 hover:text-foreground transition-colors uppercase tracking-widest">
                Cancel
              </Link>
              <Button 
                type="submit" 
                loading={loading}
                className="h-12 px-10 rounded-xl text-[11px] font-black shadow-2xl shadow-primary/20 uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Create Task
              </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="text-center">
         <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] italic">Task Management System</p>
      </div>
    </div>
  )
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center animate-pulse">Loading Mission Parameters...</div>}>
      <NewTaskContent />
    </Suspense>
  )
}
