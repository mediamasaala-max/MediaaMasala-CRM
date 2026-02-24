"use client"

import { getSession } from "next-auth/react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"

let cachedToken: string | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function getAuthHeaders() {
  const now = Date.now();
  
  if (cachedToken && (now - lastFetchTime < CACHE_DURATION)) {
    return {
      "Authorization": `Bearer ${cachedToken}`,
      "Content-Type": "application/json",
    };
  }

  const session = await getSession();
  
  // If the session is flagged as expired, clear cache and return empty auth.
  // The SessionGuard / LayoutShell will handle the signOut() call.
  if ((session as any)?.error === "TokenExpired") {
    cachedToken = null;
    lastFetchTime = 0;
    return { "Authorization": "", "Content-Type": "application/json" };
  }

  cachedToken = (session?.user as any)?.accessToken || null;
  lastFetchTime = now;
  
  return {
    "Authorization": cachedToken ? `Bearer ${cachedToken}` : "",
    "Content-Type": "application/json",
  };
}

export const apiClient = {
  async get(endpoint: string, options: RequestInit & { params?: Record<string, string> } = {}) {
    const headers = await getAuthHeaders()
    let url = `${API_BASE_URL}${endpoint}`
    
    if (options.params) {
      const searchParams = new URLSearchParams(options.params)
      url += `?${searchParams.toString()}`
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    })
    return handleResponse(response, "GET")
  },

  async post(endpoint: string, data: any, options: RequestInit = {}) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      ...options,
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "POST")
  },

  async put(endpoint: string, data: any, options: RequestInit = {}) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      ...options,
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "PUT")
  },

  async patch(endpoint: string, data: any, options: RequestInit = {}) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PATCH",
      ...options,
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "PATCH")
  },

  async delete(endpoint: string, options: RequestInit = {}) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      ...options,
      headers: { ...headers, ...options.headers },
    })
    return handleResponse(response, "DELETE")
  }
}

import { toast } from "sonner"

let isSigningOut = false;

async function handleResponse(response: Response, method?: string) {
  const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '');
  
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Clear stale token cache immediately so no further requests use it
      cachedToken = null;
      lastFetchTime = 0;

      // Prevent multiple concurrent signOut calls
      if (!isSigningOut) {
        isSigningOut = true;
        const { signOut } = await import("next-auth/react");
        signOut({ 
          callbackUrl: "/auth/login?error=SessionExpired",
          redirect: true 
        });
      }
      // Throw a silent error to stop the calling code in its tracks
      throw new Error("Session expired");
    }
    
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.message || `API Error: ${response.status}`
    
    toast.error(errorMessage, {
      description: response.status === 403 ? "You don't have permission to perform this action." : undefined
    })
    
    throw new Error(errorMessage)
  }

  const data = await response.json()

  if (isWriteRequest) {
    toast.success(data.message || "Operation successful")
  }

  return data
}
