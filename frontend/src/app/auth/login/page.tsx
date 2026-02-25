"use client"

import React, { useState, useEffect, Suspense } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

function LoginForm() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get("error") === "SessionExpired"

  useEffect(() => {
    // If we are arriving at login because of an error (like SessionExpired),
    // force a clean sign out from NextAuth to clear the stale/invalid token
    // before allowing the user to sign in again.
    if ((sessionExpired || (session as any)?.error === "TokenExpired") && status !== "unauthenticated") {
      signOut({ redirect: false })
      return
    }

    // SECURITY: Only auto-redirect if session is valid AND has no underlying errors
    if (status === "authenticated" && session && !(session as any).error) {
      router.replace("/dashboard")
    }
  }, [session, status, router, sessionExpired])

  // Only show the loading spinner if the session is truly valid and has no errors.
  // If there's an error (like TokenExpired), we WANT to show the login form.
  if (status === "loading" || (status === "authenticated" && session && !(session as any).error)) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        {sessionExpired && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span>Your session has expired. Please sign in again to continue.</span>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="superadmin@media-masala.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-background"
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button 
          type="submit" 
          className="w-full font-semibold" 
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-bold text-primary underline-offset-4">
            Sign Up
          </Link>
        </p>
      </CardFooter>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-md border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription>
            Enter your credentials to access the Media-masala CRM
          </CardDescription>
        </CardHeader>
        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  )
}
