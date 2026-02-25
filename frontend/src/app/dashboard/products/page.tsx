"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Search, Box, MoreHorizontal, Pencil, Trash2, ListTodo, Loader2, Users, RefreshCcw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/permission-guard"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

interface ManagerInfo {
  id: number
  firstName: string
  lastName: string
  empId: string
  role?: { name: string }
  department?: { name: string }
}

interface Product {
  id: number
  name: string
  description?: string
  category?: string
  status?: string
  createdAt: string
  productManagerId?: number | null
  productManager?: ManagerInfo | null
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  empId: string
  role?: { name: string }
  department?: { name: string }
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string
  assignee?: { firstName: string }
  product?: { id: number }
}

const getProductStatusVariant = (status: string): any => {
  switch (status) {
    case 'Active': return 'info'
    case 'Development': return 'warning'
    case 'Archived': return 'secondary'
    case 'Hot': return 'hot'
    default: return 'outline'
  }
}

const getProductStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'border-l-blue-500'
    case 'Hot': return 'border-l-rose-500'
    case 'Development': return 'border-l-amber-500'
    default: return 'border-l-transparent'
  }
}

export default function ProductsPage() {
  const { data: session, status } = useSession()
  const { hasPermission, canView, isLoading: permissionsLoading } = usePermissions()
  const router = useRouter()
  
  const { data: products = [], isLoading, isFetching, refetch: fetchProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiClient.get("/products"),
    enabled: status === "authenticated" && !permissionsLoading && canView("products"),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Local state for employees remains as it's a one-time setup typically
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  const [formProdMgrId, setFormProdMgrId] = useState<string>("")
  const [formDescription, setFormDescription] = useState<string>("")
  const [formStatus, setFormStatus] = useState<string>("Active")

  const [viewTasksProduct, setViewTasksProduct] = useState<Product | null>(null)

  // Associated Tasks (Optimized via server-side filtering)
  const { data: contextTasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ["product-tasks", viewTasksProduct?.id],
    queryFn: () => apiClient.get(`/tasks?productId=${viewTasksProduct?.id}`),
    enabled: !!viewTasksProduct,
    staleTime: 30 * 1000,
  })


  const fetchEmployees = async () => {
    if (!canView("products")) return
    try {
      const data = await apiClient.get("/products/employees")
      setEmployees(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load employees:", err)
    }
  }

  useEffect(() => {
    if (status === "authenticated" && !permissionsLoading) {
      fetchEmployees()
    }
  }, [status, permissionsLoading, canView])

  useEffect(() => {
    if (editingProduct) {
      setFormProdMgrId(editingProduct.productManagerId?.toString() || "")
      setFormDescription(editingProduct.description || "")
      setFormStatus(editingProduct.status || "Active")
    } else {
      setFormProdMgrId("")
      setFormDescription("")
      setFormStatus("Active")
    }
  }, [editingProduct])


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
      name: formData.get("name"),
      category: formData.get("category"),
      description: formDescription,
      status: formStatus || "Active",
      price: 0,
      productManagerId: (formProdMgrId && formProdMgrId !== "none") ? formProdMgrId : null,
    }

    try {
      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, payload)
        toast.success("Product updated")
      } else {
        await apiClient.post("/products", payload)
        toast.success("Product created")
      }
      setIsModalOpen(false)
      setEditingProduct(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || "Failed to save product")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!productToDelete) return
    const id = productToDelete.id
    setDeletingId(id)
    try {
      await apiClient.delete(`/products/${id}`)
      toast.success("Product deleted")
      fetchProducts()
    } catch (err: any) {
      toast.error("Failed to delete product")
    } finally {
      setDeletingId(null)
      setProductToDelete(null)
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    )
  }, [products, searchTerm])

  if (status === "unauthenticated") {
    router.push("/auth/login")
    return null
  }

  return (
    <PermissionGuard module="products" action="view">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-bold text-foreground">Software Products</h1>
            <p className="text-xs text-muted-foreground mt-1">Manage digital assets and assigned managers.</p>
          </div>
          {hasPermission("products", "create") && (
            <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) setEditingProduct(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 font-bold">
                  <Plus className="mr-2 h-4 w-4" /> Create Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? 'Edit Product' : 'New Product'}</DialogTitle>
                    <DialogDescription>Enter product specification details.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs font-bold uppercase">Product Name</Label>
                        <Input id="name" name="name" defaultValue={editingProduct?.name} required placeholder="e.g. CRM System" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="category" className="text-xs font-bold uppercase">Tech Stack / Category</Label>
                        <Input id="category" name="category" defaultValue={editingProduct?.category} placeholder="e.g. Next.js, FastAPI" className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase">Product Manager</Label>
                      <Select value={formProdMgrId} onValueChange={setFormProdMgrId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Assign a manager..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {employees
                            .filter((emp: any) => {
                                const userPerms = session?.user as any;
                                const scope = userPerms?.permissions?.find((p: any) => p.module === 'products' && (p.action === 'create' || p.action === 'edit'))?.scope;
                                if (scope === 'all' || !scope) return true;
                                if (scope === 'department') return emp.departmentId === userPerms?.departmentId;
                                if (scope === 'own') return emp.id === userPerms?.employeeId;
                                return true;
                            })
                            .map(emp => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.firstName} {emp.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase">Description</Label>
                      <RichTextEditor value={formDescription} onChange={setFormDescription} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting} className="font-bold text-xs h-9">
                      {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {editingProduct ? 'Update Product' : 'Create Product'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
            <Input 
              placeholder="Search products by name or tech stack..." 
              className="pl-9 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-semibold" onClick={() => fetchProducts()}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="h-0.5 w-full bg-muted overflow-hidden">
          {(isLoading || isFetching) && <div className="h-full bg-primary animate-pulse w-full" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-none border border-border/40">
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <Card key={product.id} className={cn("shadow-none border hover:border-primary/50 transition-none flex flex-col bg-background border-l-4", getProductStatusColor(product.status || ""))}>
                <CardHeader className="pb-3 border-b bg-muted/5">
                  <div className="flex justify-between items-start">
                    <div className="p-2 rounded-md bg-muted border">
                      <Box className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {hasPermission("products", "edit") && (
                          <DropdownMenuItem onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="cursor-pointer">
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit details
                          </DropdownMenuItem>
                        )}
                        {hasPermission("products", "delete") && (
                          <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => setProductToDelete(product)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete product
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="mt-4 text-sm font-bold tracking-tight">{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col pt-4">
                  <div className="space-y-3 mb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {product.category && (
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase rounded-sm bg-muted border-none">
                          {product.category}
                        </Badge>
                      )}
                      <Badge variant={getProductStatusVariant(product.status || "")} className="text-[10px] font-bold uppercase rounded-sm border-none">
                        {product.status || "Active"}
                      </Badge>
                    </div>
                    {product.productManager && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold uppercase">
                        <Users className="h-3.5 w-3.5" />
                        {product.productManager.firstName} {product.productManager.lastName}
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs font-bold h-9 mt-auto" 
                    onClick={() => setViewTasksProduct(product)}
                  >
                    <ListTodo className="mr-2 h-4 w-4" /> View Associated Tasks
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-md bg-muted/5">
              <p className="text-sm font-bold text-muted-foreground uppercase">No products found</p>
              <Button variant="link" onClick={() => setSearchTerm("")} className="text-xs font-bold mt-1">Clear Search</Button>
            </div>
          )}
        </div>

        <Dialog open={!!viewTasksProduct} onOpenChange={(open) => !open && setViewTasksProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tasks: {viewTasksProduct?.name}</DialogTitle>
              <DialogDescription>Development and management tracking.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 py-4 px-1">
              {loadingTasks ? (
                <Skeleton className="h-20 w-full" />
              ) : contextTasks.length > 0 ? (
                contextTasks.map(task => (
                  <div key={task.id} className="p-3 border rounded-md flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{task.title}</p>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{task.status}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">{task.priority}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-sm text-muted-foreground">No tasks assigned to this product.</p>
              )}
            </div>
            <DialogFooter>
               {hasPermission("tasks", "create") && (
                 <Button size="sm" className="font-bold text-xs" onClick={() => router.push(`/dashboard/tasks/new?productId=${viewTasksProduct?.id}`)}>
                   Add Task
                 </Button>
               )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product?</AlertDialogTitle>
              <AlertDialogDescription>
                Confirm deletion of <span className="font-bold text-foreground">"{productToDelete?.name}"</span>. 
                Data cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  )
}
