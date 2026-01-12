// src/api/apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ===== PUBLIC FETCH (No authentication) =====
// Use this for: login, signup, password reset, public data
export const publicFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  
  // Only set JSON content type if it's not FormData
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  options.headers = headers;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  return response;
};

// ===== SECURE FETCH (Requires authentication) =====
// Use this for: protected routes, user data, dashboard, etc.
export const secureFetch = async (endpoint: string, options: RequestInit = {}) => {
  let token = localStorage.getItem("onswift_access");

  // Check if we have a token
  if (!token) {
    console.warn("No access token found");
    
    // Don't redirect if on public pages
    const publicPaths = ['/login', '/signup', '/signup/talent', '/signup/creator', '/forgot-password', '/reset-password'];
    const currentPath = window.location.pathname;
    const isPublicPage = publicPaths.some(path => currentPath.includes(path));
    
    if (!isPublicPage) {
      localStorage.clear();
      window.location.href = '/login';
    }
    
    throw new Error("No access token");
  }

  const setHeaders = (t: string | null) => {
    const headers = new Headers(options.headers);
    if (t) headers.set("Authorization", `Bearer ${t}`);
    // Only set JSON content type if it's not FormData
    if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  options.headers = setHeaders(token);
  let response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  // 401 Handshake Logic
  if (response.status === 401) {
    const refreshToken = localStorage.getItem("onswift_refresh");

    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem("onswift_access", data.access);

          // Retry with new token
          options.headers = setHeaders(data.access);
          response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        } else {
          // Refresh failed - full session expiry
          console.warn("Token refresh failed, redirecting to login");
          localStorage.clear();
          
          // Don't redirect if on public pages
          const publicPaths = ['/login', '/signup', '/signup/talent', '/signup/creator'];
          const currentPath = window.location.pathname;
          const isPublicPage = publicPaths.some(path => currentPath.includes(path));
          
          if (!isPublicPage) {
            window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error("Token refresh error:", refreshError);
        localStorage.clear();
        
        // Don't redirect if on public pages
        const publicPaths = ['/login', '/signup', '/signup/talent', '/signup/creator'];
        const currentPath = window.location.pathname;
        const isPublicPage = publicPaths.some(path => currentPath.includes(path));
        
        if (!isPublicPage) {
          window.location.href = '/login';
        }
      }
    } else {
      // No refresh token available
      console.warn("No refresh token found, redirecting to login");
      localStorage.clear();
      
      // Don't redirect if on public pages
      const publicPaths = ['/login', '/signup', '/signup/talent', '/signup/creator'];
      const currentPath = window.location.pathname;
      const isPublicPage = publicPaths.some(path => currentPath.includes(path));
      
      if (!isPublicPage) {
        window.location.href = '/login';
      }
    }
  }
  
  return response;
};