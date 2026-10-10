import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (user?.email_verified === false) {
    return <Navigate to="/verify-email" replace />;
  }

  if (user?.onboarding_completed === false) {
    return (
      <Navigate
        to="/signup"
        state={{ fromSignup: true, prefilledEmail: user.email, prefilledName: user.full_name }}
        replace
      />
    );
  }

  return <>{children}</>;
}
