import { useAuth } from "@/contexts/AuthContext";
import DashboardCreator from "./DashboardCreator";
import DashboardTalent from "./DashboardTalent";

export default function Dashboard() {
  const { user } = useAuth();
  const isTalent = user?.role === 'talent';

  if (isTalent) {
    return <DashboardTalent />;
  }

  return <DashboardCreator />;
}
