"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Users,
  CalendarDays,
  Hash,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  UserCircle
} from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
  const { data: session } = useSession()

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => apiClient.get("/auth/profile"),
    enabled: !!session,
    staleTime: 60 * 1000,
  })

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.patch("/auth/change-password", data),
    onSuccess: () => {
      toast.success("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowPasswordForm(false)
    },
    onError: (error: any) => {
      // Error toast is handled by apiClient
    },
  })

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    changePasswordMutation.mutate({ currentPassword, newPassword })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const emp = profile?.employee
  const initials = emp ? `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() : "U"

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your personal and organizational details. Only your password can be changed here.
        </p>
      </div>

      {/* Profile Hero */}
      <Card className="border-t-4 border-t-primary overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl shadow-inner">
              {initials}
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-bold tracking-tight">
                {emp?.firstName} {emp?.lastName}
              </h2>
              <p className="text-muted-foreground text-sm">{profile?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs font-semibold">
                  <Shield className="h-3 w-3 mr-1" />
                  {emp?.role?.name || "—"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {emp?.department?.name || "—"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {emp?.empId}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <UserCircle className="h-4 w-4" /> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={emp?.email || "—"} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={emp?.phone || "Not set"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Joined" value={emp?.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Account Created" value={profile?.accountCreated ? new Date(profile.accountCreated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Department" value={emp?.department?.name || "—"} />
            <InfoRow icon={<Shield className="h-4 w-4" />} label="Role" value={emp?.role?.name || "—"} />
            <InfoRow icon={<User className="h-4 w-4" />} label="Reporting To" value={emp?.manager ? `${emp.manager.firstName} ${emp.manager.lastName} (${emp.manager.empId})` : "No Manager (Top-Level)"} />
            <InfoRow icon={<Users className="h-4 w-4" />} label="Team Size" value={`${emp?.teamSize ?? 0} direct report${(emp?.teamSize ?? 0) !== 1 ? "s" : ""}`} />
          </CardContent>
        </Card>

        {/* Team Members */}
        {emp?.reportees && emp.reportees.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> My Team ({emp.reportees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {emp.reportees.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-muted/30"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                      {r.firstName?.[0]}{r.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{r.empId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Password Section */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" /> Security
              </CardTitle>
              {!showPasswordForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordForm(true)}
                  className="text-xs"
                >
                  Change Password
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
            <CardDescription>
              {showPasswordForm
                ? "Enter your current password and choose a new one."
                : "You can update your login password here."}
            </CardDescription>
          </CardHeader>
          {showPasswordForm && (
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCurrent(!showCurrent)}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    size="sm"
                  >
                    {changePasswordMutation.isPending ? "Saving..." : "Update Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setCurrentPassword("")
                      setNewPassword("")
                      setConfirmPassword("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
