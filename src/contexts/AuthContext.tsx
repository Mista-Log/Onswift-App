

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/api';

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
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


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
    if (!token) return { success: false, error: "Access token missing" };

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/profile/`, {
        method: "PATCH",
        headers: data instanceof FormData
          ? { Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: data instanceof FormData ? data : JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.detail || "Profile update failed");

      const updatedUser: User = {
        ...user,
        ...result.user,
        ...(result.profile ?? {}),
        avatarUrl: result.profile?.avatar ?? user.avatarUrl,
      };

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
