import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Where each role lands after signing in. Creators start in the Agent; everyone else keeps the dashboard. */
export function homePathFor(role: string | undefined): string {
  return role === "creator" ? "/chat" : "/dashboard";
}

/**
 * The single "default landing" route. Sign-in and sign-up flows send people here when they have no
 * specific page to return to; deep links are left alone. Rendered inside ProtectedRoute, so the user is loaded.
 */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={homePathFor(user.role)} replace />;
}
