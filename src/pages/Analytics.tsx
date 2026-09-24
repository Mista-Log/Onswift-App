import { Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnalyticsSection } from "@/components/dashboard/analytics/AnalyticsSection";
import { useAuth } from "@/contexts/AuthContext";

export default function Analytics() {
  const { user } = useAuth();

  if (user && user.role !== "creator") return <Navigate to="/dashboard" replace />;

  return (
    <MainLayout>
      <div className="w-full">
        <AnalyticsSection />
      </div>
    </MainLayout>
  );
}
