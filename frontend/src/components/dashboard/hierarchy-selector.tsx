"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { 
  ChevronRight, 
  ChevronDown, 
  Users, 
  User, 
  Check,
  Search,
  LayoutGrid,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/use-permissions"

interface EmployeeNode {
  id: number
  firstName: string
  lastName: string
  role: { name: string; code: string }
  department: { name: string; code: string }
  children: EmployeeNode[]
}

interface HierarchySelectorProps {
  selectedId: string
  onSelect: (id: string, isRecursive: boolean) => void
  isRecursive: boolean
}

export function HierarchySelector({ 
  selectedId, 
  onSelect, 
  isRecursive 
}: HierarchySelectorProps) {
  const { data: session } = useSession()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [search, setSearch] = useState("")

  const { data: hierarchy = [], isLoading } = useQuery<EmployeeNode[]>({
    queryKey: ["employee-hierarchy"],
    queryFn: () => apiClient.get("/admin/hierarchy-tree"),
    enabled: hasPermission("employees", "view") && !permissionsLoading
  })

  // Auto-expand the selected path or first level
  useEffect(() => {
    if (hierarchy.length > 0 && Object.keys(expanded).length === 0) {
      setExpanded({ [hierarchy[0].id]: true })
    }
  }, [hierarchy, expanded])

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const findEmployee = (nodes: EmployeeNode[], id: number): EmployeeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      const child = findEmployee(node.children, id)
      if (child) return child
    }
    return null
  }

  const selectedEmployee = selectedId === 'all' ? null : findEmployee(hierarchy, Number(selectedId))

  const renderNode = (node: EmployeeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded[node.id]
    const isSelected = selectedId === String(node.id)

    const matchesSearch = 
      node.firstName.toLowerCase().includes(search.toLowerCase()) ||
      node.lastName.toLowerCase().includes(search.toLowerCase()) ||
      node.role.name.toLowerCase().includes(search.toLowerCase())

    const childMatches = (nodes: EmployeeNode[]): boolean => {
      return nodes.some(n => 
        n.firstName.toLowerCase().includes(search.toLowerCase()) ||
        n.lastName.toLowerCase().includes(search.toLowerCase()) ||
        n.role.name.toLowerCase().includes(search.toLowerCase()) ||
        childMatches(n.children)
      )
    }

    if (search && !matchesSearch && !childMatches(node.children)) return null

    return (
      <div key={node.id} className="space-y-0.5">
        <div 
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all group relative",
            isSelected ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
          style={{ marginLeft: `${depth * 1.5}rem` }}
          onClick={() => {
            onSelect(String(node.id), isRecursive)
            setOpen(false)
          }}
        >
          {depth > 0 && (
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-border/40 group-hover:bg-primary/30" />
          )}

          <div 
            onClick={(e) => {
              if (hasChildren) toggleExpand(node.id, e)
            }}
            className={cn(
                "h-5 w-5 rounded-md flex items-center justify-center transition-colors hover:bg-muted-foreground/10",
                !hasChildren && "invisible"
            )}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </div>
          
          <div className="flex items-center gap-2 min-w-0">
             <div className={cn(
               "w-7 h-7 rounded-lg border flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm",
               isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border group-hover:border-primary/30"
             )}>
               {node.firstName.charAt(0)}
             </div>
             <div className="min-w-0">
                <p className="text-[11px] font-bold truncate tracking-tight leading-none mb-0.5">
                    {node.firstName} {node.lastName}
                </p>
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-black leading-none">
                    {node.role.name}
                </p>
             </div>
          </div>

          {isSelected && <Check className="ml-auto h-3 w-3" />}
        </div>

        {hasChildren && isExpanded && (
          <div className="relative">
            <div className="absolute left-[1.125rem] top-0 bottom-1 w-[1px] bg-border/20 group-hover:bg-primary/20 transition-colors" />
            <div className="space-y-0.5">
                {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          className="h-9 min-w-[200px] justify-between px-3 bg-card border-border/40 rounded-lg shadow-sm hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
            <div className="flex flex-col items-start leading-none gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Viewer</span>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[120px]">
                    {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Personal View"}
                </span>
            </div>
          </div>
          <ChevronDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px] p-0 rounded-xl shadow-2xl border-border/40 bg-card overflow-hidden" align="start">
        <div className="p-3 space-y-3 bg-muted/5 border-b border-border/10">
            {/* Quick Actions Bar */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-lg">
                <button
                    onClick={() => {
                        onSelect('all', isRecursive)
                        setOpen(false)
                    }}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                        selectedId === 'all' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <LayoutGrid className="h-3 w-3" />
                    Global
                </button>
                <button
                    onClick={() => {
                        if (session?.user?.employeeId) {
                            onSelect(String(session.user.employeeId), true)
                            setOpen(false)
                        }
                    }}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                        (selectedId === String(session?.user?.employeeId) && isRecursive) 
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
                          : "text-muted-foreground hover:text-foreground group/team hover:bg-primary/5"
                    )}
                >
                    <Zap className={cn("h-3 w-3", (selectedId === String(session?.user?.employeeId) && isRecursive) ? "text-primary" : "text-amber-500")} />
                    My Team
                </button>
            </div>

            <div className="relative group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Find team member..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 text-[11px] bg-background border-border/20 rounded-lg focus-visible:ring-primary/20"
                />
            </div>
        </div>
        
        <div className="max-h-[350px] overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center space-y-2">
                <div className="h-3 w-24 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded mx-auto" />
            </div>
          ) : (
            hierarchy.map(node => renderNode(node))
          )}
        </div>

        {/* Recursive Toggle */}
        <div className="p-2 border-t border-border/10 bg-muted/10">
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Recursive View</span>
                    <span className="text-[9px] text-muted-foreground/60 font-medium">Show team's entire downline data</span>
                </div>
                <div 
                    role="switch"
                    aria-checked={isRecursive}
                    className={cn(
                        "relative h-5 w-10 min-w-10 rounded-full transition-colors outline-none",
                        isRecursive ? "bg-primary" : "bg-muted"
                    )}
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect(selectedId, !isRecursive)
                    }}
                >
                    <div className={cn(
                        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-all duration-200",
                        isRecursive ? "translate-x-5" : "translate-x-1",
                        "mt-0.5"
                    )} />
                </div>
            </label>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
