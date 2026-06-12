import { useAuth } from "@/contexts/AuthContext";
import DashboardCreator from "./DashboardCreator";
import DashboardTalent from "./DashboardTalent";
import ClientProjects from "./client/ClientProjects";

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'talent') return <DashboardTalent />;
  if (user?.role === 'client') return <ClientProjects />;
  return <DashboardCreator />;
}
