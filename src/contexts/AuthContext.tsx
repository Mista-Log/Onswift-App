

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'creator' | 'talent';


export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  company_name?: string;
  professional_title?: string;
  skills?: string[];
  avatarUrl?: string;
  bio?: string;
  portfolioLink?: string;
  hourlyRate?: number;
  availability?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    [key: string]: string | undefined;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    [key: string]: any;
  }) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: FormData | Partial<User>) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getUser: () => Promise<void>; // fetches the current user from backend
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("onswift_refresh");
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Refresh token expired");
  }

  const data = await response.json();
  localStorage.setItem("onswift_access", data.access);
  // If your backend sends a new refresh token (rotation), save it too:
  if (data.refresh) localStorage.setItem("onswift_refresh", data.refresh);
  
  return data.access;
};




export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const storedUser = localStorage.getItem('onswift_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);


  const secureFetch = async (url: string, options: RequestInit = {}) => {
    let token = localStorage.getItem("onswift_access");

    // Helper to set headers
    const setHeaders = (t: string | null) => {
      const headers = new Headers(options.headers);
      if (t) headers.set("Authorization", `Bearer ${t}`);
      return headers;
    };

    options.headers = setHeaders(token);
    let response = await fetch(url, options);

    // HANDSHAKE LOGIC: If 401, try to refresh once
    if (response.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        options.headers = setHeaders(newToken);
        response = await fetch(url, options); // Retry the request
      } catch (error) {
        // If refresh fails, log them out
        logout();
        throw new Error("Session expired. Please login again.");
      }
    }

    return response;
  };


  // ---------------- GET USER ----------------
  const getUser = async () => {
    const token = localStorage.getItem("onswift_access");
    if (!token) return;

    try {
      // Note: using secureFetch instead of fetch
      const response = await secureFetch(`${API_BASE_URL}/api/v1/auth/user/`);

      if (!response.ok) throw new Error("Failed to fetch user");

      const data = await response.json();

      const fetchedUser: User = {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        ...data.profile,
        avatarUrl: data.profile?.avatar
          ? `${API_BASE_URL}${data.profile.avatar}` // <-- prepend backend
          : "",
        social_links: data.profile?.social_links ?? {},
      };

      setUser(fetchedUser);
      localStorage.setItem("onswift_user", JSON.stringify(fetchedUser));
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };




  // ---------------- LOGIN ----------------
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Login failed");

      localStorage.setItem("onswift_access", data.access);
      localStorage.setItem("onswift_refresh", data.refresh);
      localStorage.setItem("onswift_user", JSON.stringify(data.user));

      await getUser(); // <- fetch user after login

      setUser(data.user);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };


  // ---------------- SIGNUP ----------------
  const signup = async (formData: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    [key: string]: any;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Signup failed");

      localStorage.setItem("onswift_access", data.access);
      localStorage.setItem("onswift_refresh", data.refresh);
      localStorage.setItem("onswift_user", JSON.stringify(data.user));

      await getUser(); // <- fetch user after login

      setUser(data.user);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };



  // // ---------------- LOGOUT ----------------
  const logout = () => {
    setUser(null);
    localStorage.removeItem("onswift_user");
    localStorage.removeItem("onswift_access");
    localStorage.removeItem("onswift_refresh");
  };

  // ---------------- UPDATE PROFILE ----------------
  const updateProfile = async (data: FormData | Partial<User>) => {
    if (!user) return { success: false, error: "Not authenticated" };

    const token = localStorage.getItem("onswift_access");
    if (!user) return { success: false, error: "Not authenticated" };

      try {
        const response = await secureFetch(`${API_BASE_URL}/api/v1/auth/profile//`, {
          method: "PATCH",
          headers: data instanceof FormData ? {} : { "Content-Type": "application/json" },
          body: data instanceof FormData ? data : JSON.stringify(data),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result?.detail || "Profile update failed");

        const updatedUser: User = {
          ...user,
          ...result.user,
          ...(result.profile ?? {}),
          avatarUrl: result.profile?.avatar ?? user.avatarUrl,
          social_links: result.profile?.social_links ?? user.social_links, // <- add this
        };

        await getUser(); // <- fetch fresh user data after update

        setUser(updatedUser);
        localStorage.setItem("onswift_user", JSON.stringify(updatedUser));

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
  };



  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
        getUser, // optional if you want to call manually elsewhere
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
