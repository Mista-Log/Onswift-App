

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


// Mock users for demo
// const MOCK_USERS: (User & { password: string })[] = [
//   {
//     id: '1',
//     name: 'Alex Creator',
//     email: 'creator@demo.com',
//     password: 'password123',
//     role: 'creator',
//     companyName: 'Creative Studios',
//   },
//   {
//     id: '2',
//     name: 'Sam Talent',
//     email: 'talent@demo.com',
//     password: 'password123',
//     role: 'talent',
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

  // ---------------- UPDATE PROFILE ----------------
  // const updateProfile = async (profileData: Partial<User>) => {
  //   try {
  //     const data = await apiRequest('api/v1/auth/profile/', {
  //       method: 'PATCH',
  //       body: JSON.stringify(profileData),
  //     });

  //     const updatedUser = {
  //       ...user,
  //       ...data.user,
  //       ...(data.profile || {}),
  //     };

  //     setUser(updatedUser);
  //     localStorage.setItem('onswift_user', JSON.stringify(updatedUser));

  //     return { success: true };
  //   } catch (error: any) {
  //     return { success: false, error: error.message };
  //   }
  // };


  const updateProfile = async (data: FormData | Partial<User>) => {
    try {
      const isFormData = data instanceof FormData;

      const response = await apiRequest("api/v1/account/profile/", {
        method: "PATCH",
        body: data,
        headers: isFormData ? {} : { "Content-Type": "application/json" },
      });

      /**
       * Expected backend response shape:
       * {
       *   user: {...},
       *   profile: {...}
       * }
       */

      const updatedUser: User = {
        ...user,
        ...response.user,
        ...response.profile, // creator-specific fields
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
