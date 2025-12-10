import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'creator' | 'talent';

export interface User {
  id: string;
  name: string;
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
  signup: (userData: Partial<User> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const MOCK_USERS: (User & { password: string })[] = [
  {
    id: '1',
    name: 'Alex Creator',
    email: 'creator@demo.com',
    password: 'password123',
    userType: 'creator',
    companyName: 'Creative Studios',
  },
  {
    id: '2',
    name: 'Sam Talent',
    email: 'talent@demo.com',
    password: 'password123',
    userType: 'talent',
    professionalTitle: 'UI/UX Designer',
    skills: ['UI/UX Design', 'Web Development', 'Graphic Design'],
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('onswift_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const foundUser = MOCK_USERS.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('onswift_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    }
    
    return { success: false, error: 'Invalid email or password' };
  };

  const signup = async (userData: Partial<User> & { password: string }) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if email exists
    if (MOCK_USERS.some(u => u.email === userData.email)) {
      return { success: false, error: 'Email already exists' };
    }
    
    const newUser: User = {
      id: Date.now().toString(),
      name: userData.name || '',
      email: userData.email || '',
      userType: userData.userType || 'creator',
      companyName: userData.companyName,
      professionalTitle: userData.professionalTitle,
      skills: userData.skills,
    };
    
    setUser(newUser);
    localStorage.setItem('onswift_user', JSON.stringify(newUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('onswift_user');
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('onswift_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
