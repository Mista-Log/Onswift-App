import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicFetch, secureFetch } from '@/api/apiClient'; // Import both

export type UserRole = 'creator' | 'talent';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  company_name?: string;
  professional_title?: string;
  skills?: string[];
  profilePicture?: string;
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
  updateCreatorProfile: (data: FormData | Partial<User>) => Promise<{ success: boolean; error?: string }>;
  updateTalentProfile: (data: FormData | Partial<User>) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getUser: () => Promise<void>;

  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (uid: string, token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const storedUser = localStorage.getItem("onswift_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("onswift_user");
      }
    }
    setIsLoading(false);
  }, []);

  const requestPasswordReset = async (email: string) => {
    const response = await publicFetch("/api/v1/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    // Backend should always return 200 for security
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error || "Failed to send reset email");
    }
  };

  const confirmPasswordReset = async (uid: string, token: string, password: string) => {
    const response = await publicFetch("/api/v1/password-reset-confirm/", {
      method: "POST",
      body: JSON.stringify({ uid, token, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error || "Password reset failed");
    }
  };


  // GET USER (requires auth)
  const getUser = async () => {
    const token = localStorage.getItem("onswift_access");
    if (!token) return;

    try {
      const response = await secureFetch('/api/v1/auth/user/');
      if (!response.ok) throw new Error("Failed to fetch user");

      const data = await response.json();

      const fetchedUser: User = {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        ...data.profile,
        profilePicture: data.profile?.profile_picture || "",
        social_links: data.profile?.social_links ?? {},
      };

      setUser(fetchedUser);
      localStorage.setItem("onswift_user", JSON.stringify(fetchedUser));
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  // LOGIN (public - no auth needed)
  const login = async (email: string, password: string) => {
    try {
      const response = await publicFetch('/api/v1/auth/login/', {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Unable to connect your account. Please try again.");

      localStorage.setItem("onswift_access", data.access);
      localStorage.setItem("onswift_refresh", data.refresh);
      localStorage.setItem("onswift_user", JSON.stringify(data.user));

      await getUser();
      return { success: true };

      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // SIGNUP (public - no auth needed)
  const signup = async (formData: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    [key: string]: any;
  }) => {
    try {
      const response = await publicFetch('/api/v1/auth/signup/', {
        method: "POST",
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Signup failed");

      localStorage.setItem("onswift_access", data.access);
      localStorage.setItem("onswift_refresh", data.refresh);
      localStorage.setItem("onswift_user", JSON.stringify(data.user));

      await getUser();
      return { success: true };

      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // LOGOUT
  const logout = () => {
    setUser(null);
    localStorage.removeItem("onswift_user");
    localStorage.removeItem("onswift_access");
    localStorage.removeItem("onswift_refresh");
  };

  // UPDATE CREATOR PROFILE (requires auth)
  const updateCreatorProfile = async (data: FormData | Partial<User>) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const response = await secureFetch('/api/v1/auth/profile/', {
        method: "PATCH",
        headers: data instanceof FormData ? {} : { "Content-Type": "application/json" },
        body: data instanceof FormData ? data : JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.detail || "Profile update failed");

      await getUser();
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // UPDATE TALENT PROFILE (requires auth)
  const updateTalentProfile = async (data: FormData | Partial<User>) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const response = await secureFetch('/api/v1/auth/profile/', {
        method: "PATCH",
        headers: data instanceof FormData ? {} : { "Content-Type": "application/json" },
        body: data instanceof FormData ? data : JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.detail || "Profile update failed");

      await getUser();
      
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
        updateTalentProfile,
        updateCreatorProfile,
        getUser,
        requestPasswordReset,
        confirmPasswordReset,
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