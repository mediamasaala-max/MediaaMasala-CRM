import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })

  // If no token and not on auth page, redirect to login
  if (!token) {
    const loginUrl = new URL("/auth/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If token is flagged as expired, redirect to login with specific error
  if ((token as any).error === "TokenExpired") {
    const loginUrl = new URL("/auth/login?error=SessionExpired", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protect ALL routes except auth pages, API routes, and static files
    "/((?!auth|api|_next/static|_next/image|favicon.ico).*)",
  ],
}
