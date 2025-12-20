// src/api/apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const secureFetch = async (endpoint: string, options: RequestInit = {}) => {
  let token = localStorage.getItem("onswift_access");

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
        // Full session expiry
        localStorage.clear(); 
        window.location.href = '/login';
      }
    }
  }
  return response;
};



