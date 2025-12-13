

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/api';

export type UserRole = 'creator' | 'talent';

export interface User {
  id: string;
  full_name: string;
  email: string;
  userType: UserRole;
  companyName?: string;
  professionalTitle?: string;
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
  logout: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);


// Mock users for demo
// const MOCK_USERS: (User & { password: string })[] = [
//   {
//     id: '1',
//     name: 'Alex Creator',
//     email: 'creator@demo.com',
//     password: 'password123',
//     userType: 'creator',
//     companyName: 'Creative Studios',
//   },
//   {
//     id: '2',
//     name: 'Sam Talent',
//     email: 'talent@demo.com',
//     password: 'password123',
//     userType: 'talent',
//     professionalTitle: 'UI/UX Designer',
//     skills: ['UI/UX Design', 'Web Development', 'Graphic Design'],
//   },
// ];

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
      const data = await apiRequest('api/v1/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('onswift_token', data.token);
      localStorage.setItem('onswift_user', JSON.stringify(data.user));

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
      const data = await apiRequest('api/v1/auth/signup/', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      localStorage.setItem('onswift_token', data.token);
      localStorage.setItem('onswift_user', JSON.stringify(data.user));

      setUser(data.user);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // ---------------- LOGOUT ----------------
  const logout = () => {
    setUser(null);
    localStorage.removeItem('onswift_user');
    localStorage.removeItem('onswift_token');
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
