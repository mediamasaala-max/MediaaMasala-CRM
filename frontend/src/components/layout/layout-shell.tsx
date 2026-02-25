"use client"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useState, useEffect } from "react"
import { 
  LayoutDashboard, 
  Users, 
  User,
  CheckSquare, 
  Settings, 
  LogOut,
  ChevronRight,
  FileText,
  Briefcase,
  ShoppingBag,
  Calendar,
  Activity,
  Layers,
  Menu,
  X
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Providers } from "@/components/providers"

interface LayoutShellProps {
  children: ReactNode
}

function SidebarContent({ pathname, filteredNav, canSeeSettings, isAdmin, handleLogout, user, role }: any) {
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border relative">
      {/* Sidebar Header / Branding */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="bg-primary text-primary-foreground h-8 w-8 rounded-lg flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform duration-300">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight leading-none">Media Masala</span>
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">CRM System</span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-6 space-y-8 overflow-y-auto custom-scrollbar font-sans">
        {/* Main Section */}
        <div className="space-y-1">
          <div className="px-2 mb-2">
             <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Navigation</p>
          </div>
          {filteredNav.map((item: any) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-border/10"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] transition-colors duration-200 ${isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-sidebar-accent-foreground"}`} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-primary rounded-r-full" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Admin Section */}
        {canSeeSettings && (
          <div className="space-y-1 pt-4 border-t border-sidebar-border/50">
            <div className="px-2 mb-2">
               <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{isAdmin ? "Admin" : "Management"}</p>
            </div>
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                pathname.startsWith("/dashboard/settings")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-border/10"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Settings className={`h-[18px] w-[18px] ${pathname.startsWith("/dashboard/settings") ? "text-primary" : "text-muted-foreground/60 group-hover:text-sidebar-accent-foreground"}`} />
              <span>Settings</span>
            </Link>
          </div>
        )}

        {/* Account Section - visible to all users */}
        <div className="space-y-1 pt-4 border-t border-sidebar-border/50">
          <div className="px-2 mb-2">
             <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Account</p>
          </div>
          <Link
            href="/dashboard/profile"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              pathname === "/dashboard/profile"
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-border/10"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <User className={`h-[18px] w-[18px] ${pathname === "/dashboard/profile" ? "text-primary" : "text-muted-foreground/60 group-hover:text-sidebar-accent-foreground"}`} />
            <span>My Profile</span>
          </Link>
        </div>
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-3 bg-sidebar border-t border-sidebar-border">
         <Link href="/dashboard/profile" className="block bg-sidebar-accent/50 rounded-lg p-2.5 mb-2 border border-sidebar-border/40 hover:bg-sidebar-accent transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] border border-primary/20 group-hover:scale-105 transition-transform">
                {user?.email?.[0].toUpperCase() || "U"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate leading-tight">
                  {user?.email?.split('@')[0]}
                </span>
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                  {role || "Member"}
                </span>
              </div>
            </div>
         </Link>
         
         <button 
           onClick={handleLogout}
           className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10 transition-all duration-200 group"
         >
           <div className="flex items-center gap-2.5">
             <LogOut className="h-[16px] w-[16px] transition-transform group-hover:-translate-x-0.5" />
             <span>Sign Out</span>
           </div>
           <ChevronRight className="h-3 w-3 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
         </button>
      </div>
    </div>
  )
}

export function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { isAdmin, hasModule, role } = usePermissions()
  const user = session?.user as any

  // Auto-logout when the backend JWT expires
  useEffect(() => {
    // SECURITY: If the token is expired, sign out.
    // ADDED GUARD: Do NOT trigger sign out if we are already on the auth pages,
    // to prevent infinite redirect loops between dashboard and login.
    if ((session as any)?.error === "TokenExpired" && !pathname.startsWith("/auth")) {
      // Use redirect: true to ensure the page actually refreshes and clears state
      signOut({ 
        callbackUrl: "/auth/login?error=SessionExpired",
        redirect: true 
      });
    }
  }, [session, pathname])

  if (pathname.startsWith("/auth")) {
    return <>{children}</>
  }
  
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
    { href: "/dashboard/projects", label: "Projects", icon: Layers, module: "projects" },
    { href: "/dashboard/products", label: "Products", icon: ShoppingBag, module: "products" },
    { href: "/dashboard/leads", label: "Leads", icon: Users, module: "leads" },
    { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
    { href: "/dashboard/eod", label: "Daily Reports", icon: FileText, module: "eod" },
    { href: "/dashboard/attendance", label: "Attendance", icon: CheckSquare, module: "attendance" },
    { href: "/dashboard/attendance/leaves", label: "Leaves", icon: Calendar, module: "attendance" },
    { href: "/dashboard/reports", label: "Reports", icon: FileText, module: "reports" },
    { href: "/dashboard/logs", label: "System Logs", icon: Activity, module: "_admin_only" },
  ]

  const filteredNav = navItems.filter(item => {
    if (item.href === "/dashboard") return true
    if (item.module === "_admin_only") return isAdmin
    return hasModule(item.module)
  })

  const canSeeSettings = isAdmin || hasModule("settings")

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    signOut({ callbackUrl: "/auth/login" })
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-sidebar-border hidden lg:flex flex-col z-30 shadow-xl shadow-slate-200/50">
        <SidebarContent 
          pathname={pathname} 
          filteredNav={filteredNav} 
          canSeeSettings={canSeeSettings} 
          isAdmin={isAdmin} 
          handleLogout={handleLogout}
          user={user}
          role={role}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6">
           <div className="flex items-center gap-3">
             <Sheet>
               <SheetTrigger asChild>
                 <div className="lg:hidden">
                   <Button variant="ghost" size="icon" className="h-9 w-9 border border-border bg-background shadow-sm hover:bg-muted active:scale-95 rounded-lg flex items-center justify-center">
                     <Menu className="h-5 w-5 text-foreground" />
                     <span className="sr-only">Toggle Menu</span>
                   </Button>
                 </div>
               </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[260px] border-r border-border bg-sidebar ring-0 outline-none">
                  <SidebarContent 
                    pathname={pathname} 
                    filteredNav={filteredNav} 
                    canSeeSettings={canSeeSettings} 
                    isAdmin={isAdmin} 
                    handleLogout={handleLogout}
                    user={user}
                    role={role}
                  />
                </SheetContent>
             </Sheet>

             <div className="lg:hidden flex items-center gap-2 ml-1">
               <div className="bg-primary text-primary-foreground h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm">
                 M
               </div>
               <span className="font-semibold text-sm tracking-tight text-foreground">Media Masala</span>
             </div>

             <div className="hidden sm:flex items-center gap-2 ml-2">
               <div className="text-muted-foreground/50 font-medium text-[10px] uppercase tracking-wider">App</div>
               <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
               <span className="text-foreground font-medium text-[13px] capitalize tracking-tight">
                 {pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
               </span>
             </div>
           </div>

           <div className="flex items-center gap-3">
              <Link href="/dashboard/profile" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/50 bg-muted/40 shadow-sm cursor-pointer hover:bg-muted/60 transition-colors">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] border border-primary/20">
                  {user?.email?.[0].toUpperCase() || "U"}
                </div>
                <div className="flex flex-col max-w-[100px]">
                  <span className="text-[10px] font-semibold leading-tight truncate text-foreground">{user?.email?.split('@')[0]}</span>
                  <span className="text-[8px] text-muted-foreground/70 font-bold uppercase tracking-tighter">{role || user?.role}</span>
                </div>
              </Link>
           </div>
        </header>

        <main className="p-4 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in slide-in-from-bottom-2 duration-700">
          {children}
        </main>
      </div>
    </div>
  )
}


export default function RootLayoutClient({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <LayoutShell>{children}</LayoutShell>
    </Providers>
  )
}
