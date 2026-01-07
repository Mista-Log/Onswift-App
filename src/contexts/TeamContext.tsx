import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { secureFetch } from "../api/apiClient";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  skills?: string[];
  created_at: string;
}

interface TeamContextType {
  teamMembers: TeamMember[];
  isLoading: boolean;
  fetchTeam: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch team members
  const fetchTeam = async () => {
    try {
      setIsLoading(true);
      const response = await secureFetch("/api/v3/team/");

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      } else {
        console.error("Failed to fetch team members");
      }
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchTeam();
  }, []);

  return (
    <TeamContext.Provider
      value={{
        teamMembers,
        isLoading,
        fetchTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used within TeamProvider");
  }
  return context;
}
