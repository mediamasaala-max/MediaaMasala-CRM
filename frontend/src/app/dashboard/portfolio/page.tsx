"use client"

export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Search, Box, Briefcase,
  ExternalLink,
  MoreHorizontal, Pencil, Trash2, ListTodo, Calendar, User, CheckCircle2, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { usePermissions } from "@/hooks/use-permissions"
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
import { cn } from "@/lib/utils"

// Types
interface Product {
  id: number
  name: string
  description?: string
  category?: string
  createdAt: string
  // 'price' exists in DB but is hidden in this 'Software' context
}

interface Project {
  id: number
  name: string
  description?: string
  status: string
  leadId?: string
  createdAt: string
  lead?: {
      id: string
      name: string
      company?: string
  }
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string
  assignee?: { firstName: string }
  product?: { id: number }
  project?: { id: number }
}

function PortfolioContent() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as 'products' | 'projects' | null
  const [activeTab, setActiveTab] = useState<'products' | 'projects'>(initialTab || 'products')

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Product | Project | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Task Context State
  const [taskContextItem, setTaskContextItem] = useState<{ type: 'product' | 'project', item: Product | Project } | null>(null)
  const [contextTasks, setContextTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  const { hasModule, isLoading: permissionsLoading } = usePermissions()

  // Data Fetching
  const fetchData = async () => {
    if (permissionsLoading) return
    setLoading(true)
    try {
      const productsPromise = hasModule("products") 
        ? apiClient.get("/products").catch(() => []) 
        : Promise.resolve([])
        
      const projectsPromise = hasModule("projects") 
        ? apiClient.get("/projects").catch(() => []) 
        : Promise.resolve([])

      const [productsData, projectsData] = await Promise.all([productsPromise, projectsPromise])
      setProducts(productsData || [])
      setProjects(projectsData || [])
    } catch (err) {
      console.error("Failed to load portfolio data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permissionsLoading) {
      fetchData()
    }
  }, [permissionsLoading])

  // Fetch Tasks for Context
  useEffect(() => {
    if (!taskContextItem || permissionsLoading) return

    const fetchContextTasks = async () => {
      if (!hasModule("tasks")) {
        setContextTasks([])
        return
      }
      
      setLoadingTasks(true)
      try {
        const allTasks = await apiClient.get("/tasks")
        const tasks = Array.isArray(allTasks) ? allTasks : allTasks.tasks || []
        
        const filtered = tasks.filter((t: Task) => 
          taskContextItem.type === 'product' 
            ? t.product?.id === taskContextItem.item.id
            : t.project?.id === taskContextItem.item.id
        )
        setContextTasks(filtered)
      } catch (err) {
        console.error("Failed to fetch tasks:", err)
      } finally {
        setLoadingTasks(false)
      }
    }

    fetchContextTasks()
  }, [taskContextItem, permissionsLoading, hasModule])


  // Handlers
  const handleProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
        name: formData.get("name"),
        description: formData.get("description"),
        category: formData.get("category"),
        price: 0 // Default to 0 for software products
    }

    try {
        if (editingItem && 'price' in editingItem) { // Check if it's a product
             await apiClient.patch(`/products/${editingItem.id}`, payload)
             toast.success("Software product updated")
        } else {
             await apiClient.post("/products", payload)
             toast.success("Software product created")
        }
        setIsProductModalOpen(false)
        setEditingItem(null)
        fetchData()
    } catch (err: any) {
        toast.error(err.message || "Failed to save product")
    } finally {
        setSubmitting(false)
    }
  }

  const handleProjectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
        name: formData.get("name"),
        description: formData.get("description"),
        status: formData.get("status") || "Active"
    }

    try {
        if (editingItem && !('price' in editingItem)) { // Check if it's a project
             await apiClient.patch(`/projects/${editingItem.id}`, payload)
             toast.success("Project updated")
        } else {
             await apiClient.post("/projects", payload)
             toast.success("Project created")
        }
        setIsProjectModalOpen(false)
        setEditingItem(null)
        fetchData()
    } catch (err: any) {
        toast.error(err.message || "Failed to save project")
    } finally {
        setSubmitting(false)
    }
  }

  const handleDelete = async (type: 'product' | 'project', id: number) => {
      if (!confirm(`Are you sure you want to remove this ${type}?`)) return
      setDeletingId(id)
      try {
          await apiClient.delete(`/${type}s/${id}`)
          toast.success(`${type === 'product' ? 'Product' : 'Project'} removed`)
          fetchData()
      } catch (err: any) {
          toast.error("Failed to delete item")
      } finally {
          setDeletingId(null)
      }
  }

  // Filtering
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-sm font-medium">Manage products and projects.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search portfolio..." 
                className="pl-10 w-64 bg-muted/40 border-border/40 rounded-xl h-11 text-xs focus:ring-1 focus:ring-primary transition-all shadow-inner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
        </div>
      </div>

      {/* Tabs / View Switcher */}
      <div className="space-y-6">
        <div className="flex p-1 bg-muted/40 rounded-xl w-fit">
            <button
                onClick={() => setActiveTab('products')}
                className={cn(
                    "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    activeTab === 'products' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                Software Products
            </button>
            <button
                onClick={() => setActiveTab('projects')}
                className={cn(
                    "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    activeTab === 'projects' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                Projects
            </button>
        </div>

        {/* PRODUCTS VIEW */}
        {activeTab === 'products' && (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                <div className="flex justify-end">
                    <Dialog open={isProductModalOpen} onOpenChange={(open) => { setIsProductModalOpen(open); if(!open) setEditingItem(null); }}>
                        <DialogTrigger asChild>
                            <Button className="shadow-lg shadow-primary/10 rounded-xl h-10 font-bold text-[11px] uppercase tracking-widest px-6" disabled={loading}>
                                <Plus className="mr-2 h-4 w-4" /> New Software
                            </Button>
                        </DialogTrigger>
                        {/* ... DialogContent stays same ... */}
                        <DialogContent>
                            <form onSubmit={handleProductSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editingItem ? 'Edit Software' : 'New Software Product'}</DialogTitle>
                                    <DialogDescription>Define the software product details.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="prod-name">Name</Label>
                                        <Input id="prod-name" name="name" defaultValue={editingItem?.name} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="prod-cat">Category / Tech Stack</Label>
                                        <Input id="prod-cat" name="category" defaultValue={(editingItem as Product)?.category} placeholder="e.g. CRM, ERP, mobile App" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="prod-desc">Description</Label>
                                        <Input id="prod-desc" name="description" defaultValue={editingItem?.description} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : 'Save Software'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} className="border-border/40 shadow-none">
                                <CardHeader className="pb-3">
                                    <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                                    <Skeleton className="h-5 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-full" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-4 w-1/2 mb-4" />
                                    <Skeleton className="h-8 w-full rounded-md" />
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredProducts.map(product => (
                        <Card key={product.id} className="group hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col">
                            {/* ... Product Card Content ... */}
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <Box className="w-5 h-5" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setEditingItem(product); setIsProductModalOpen(true); }}>
                                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete('product', product.id)} disabled={deletingId === product.id}>
                                                {deletingId === product.id ? (
                                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                )}
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CardTitle className="mt-3 text-base">{product.name}</CardTitle>
                                {product.description ? (
                                    <div 
                                        className="line-clamp-2 text-[11px] leading-relaxed mt-1 text-muted-foreground prose prose-xs max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_li]:m-0 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs h-8 overflow-hidden" 
                                        dangerouslySetInnerHTML={{ __html: product.description }} 
                                    />
                                ) : (
                                    <CardDescription className="line-clamp-2 text-xs mt-1 h-8">No description provided.</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="mt-auto pt-0">
                                <div className="flex flex-wrap gap-2 mt-2 mb-4">
                                    {product.category && (
                                        <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                                    )}
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs h-8 border-dashed"
                                    onClick={() => setTaskContextItem({ type: 'product', item: product })}
                                >
                                    <ListTodo className="mr-2 h-3.5 w-3.5" /> View Tasks
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        {/* PROJECTS VIEW */}
        {activeTab === 'projects' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                 <div className="flex justify-end">
                    <Dialog open={isProjectModalOpen} onOpenChange={(open) => { setIsProjectModalOpen(open); if(!open) setEditingItem(null); }}>
                        <DialogTrigger asChild>
                            <Button className="shadow-lg shadow-primary/10 rounded-xl h-10 font-bold text-[11px] uppercase tracking-widest px-6" variant="default" disabled={loading}>
                                <Plus className="mr-2 h-4 w-4" /> New Project
                            </Button>
                        </DialogTrigger>
                        {/* ... DialogContent ... */}
                        <DialogContent>
                            <form onSubmit={handleProjectSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editingItem ? 'Edit Project' : 'New Client Project'}</DialogTitle>
                                    <DialogDescription>Define the project details.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="proj-name">Project Name</Label>
                                        <Input id="proj-name" name="name" defaultValue={editingItem?.name} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="proj-status">Status</Label>
                                        <Input id="proj-status" name="status" defaultValue={(editingItem as Project)?.status || "Active"} placeholder="Active, Completed..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="proj-desc">Description</Label>
                                        <Input id="proj-desc" name="description" defaultValue={editingItem?.description} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : 'Save Project'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="border-border/40 shadow-none">
                                <CardHeader className="pb-3">
                                    <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                                    <Skeleton className="h-5 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-1/4" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-4 w-full mb-4" />
                                    <Skeleton className="h-8 w-full rounded-md" />
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredProjects.map(project => (
                        <Card key={project.id} className="group hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col">
                            {/* ... Project Card Content ... */}
                            <CardHeader className="pb-3">
                                 <div className="flex justify-between items-start">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setEditingItem(project); setIsProjectModalOpen(true); }}>
                                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete('project', project.id)} disabled={deletingId === project.id}>
                                                {deletingId === project.id ? (
                                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                )}
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="mt-3">
                                    <CardTitle className="text-base">{project.name}</CardTitle>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{project.status}</Badge>
                                        {project.lead?.id ? (
                                            <div onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/leads/${project.lead?.id}`); }} className="text-xs text-muted-foreground hover:text-primary cursor-pointer flex items-center gap-1 transition-colors">
                                                <span>{project.lead.company || "Internal"}</span>
                                                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">{project.lead?.company || "Internal"}</span>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="mt-auto pt-0">
                                {project.description ? (
                                    <div 
                                        className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed mb-4 prose prose-xs max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_li]:m-0 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs h-8 overflow-hidden"
                                        dangerouslySetInnerHTML={{ __html: project.description }}
                                    />
                                ) : (
                                    <p className="text-xs text-muted-foreground line-clamp-2 h-8 mb-4">No project details.</p>
                                )}
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs h-8 border-dashed"
                                    onClick={() => setTaskContextItem({ type: 'project', item: project })}
                                >
                                    <ListTodo className="mr-2 h-3.5 w-3.5" /> View Tasks
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* TASK CONTEXT DIALOG */}
      <Dialog open={!!taskContextItem} onOpenChange={(open) => !open && setTaskContextItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-primary" /> 
                    Tasks for {taskContextItem?.item.name}
                </DialogTitle>
                <DialogDescription>
                    {contextTasks.length} tasks associated with this {taskContextItem?.type}.
                </DialogDescription>
                <div className="flex justify-end">
                    <Button 
                        size="sm" 
                        className="h-8 text-[10px] font-bold uppercase tracking-widest"
                        onClick={() => {
                            const param = taskContextItem?.type === 'project' ? 'projectId' : 'productId'
                            const id = taskContextItem?.item.id
                            router.push(`/dashboard/tasks/new?${param}=${id}`)
                        }}
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" /> Add Task
                    </Button>
                </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto py-4 pr-2">
                {loadingTasks ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                ) : contextTasks.length > 0 ? (
                    <div className="space-y-3">
                        {contextTasks.map(task => (
                            <div key={task.id} className="flex items-start justify-between p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{task.title}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                                        <Badge variant="outline" className="text-[9px] h-5 px-1.5">{task.status}</Badge>
                                        <span>•</span>
                                        <span className={new Date(task.dueDate) < new Date() ? "text-destructive" : ""}>
                                            Due: {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1 justification-end">
                                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                          {task.assignee?.firstName?.[0] || "?"}
                                      </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center flex flex-col items-center gap-3">
                        <CheckCircle2 className="w-10 h-10 text-muted-foreground/20" />
                        <p className="text-muted-foreground text-sm">No tasks found for this context.</p>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>
      
    </div>
  )
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center animate-pulse">Loading Portfolio...</div>}>
      <PortfolioContent />
    </Suspense>
  )
}
