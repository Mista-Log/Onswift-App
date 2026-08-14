import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { DeliverablesPanel } from "@/components/team/DeliverablesPanel";
import { useAuth } from "@/contexts/AuthContext";

function Deliverables() {
  const { user } = useAuth();
  const location = useLocation();
  const [openUploadForTask, setOpenUploadForTask] = useState<string | undefined>(undefined);

  const isCreator = user?.role === "creator";

  // Auto-open upload modal when navigated here from a task card
  useEffect(() => {
    const state = location.state as { prefillTaskId?: string } | null;
    if (state?.prefillTaskId) {
      setOpenUploadForTask(state.prefillTaskId);
      // Clear state so back-navigation doesn't re-open the modal
      window.history.replaceState({}, "", location.pathname);
    }
  }, []);

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isCreator ? "Team Deliverables" : "My Deliverables"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isCreator ? "Review and manage work submissions from your team" : "Upload and track your work submissions"}
          </p>
        </div>

        <DeliverablesPanel
          openUploadForTask={openUploadForTask}
          onUploadOpened={() => setOpenUploadForTask(undefined)}
        />
      </div>
    </MainLayout>
  );
}

export default Deliverables;
