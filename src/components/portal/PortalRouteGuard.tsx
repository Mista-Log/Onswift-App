/**
 * PortalRouteGuard — Ensures only authenticated client-role users
 * can access portal pages. Redirects others appropriately.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface PortalRouteGuardProps {
  children: React.ReactNode;
}

export function PortalRouteGuard({ children }: PortalRouteGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
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

  if (user?.role !== "client") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
