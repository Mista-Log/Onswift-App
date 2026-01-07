import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { MessagingProvider, useMessaging } from "@/contexts/MessagingContext";
import { GroupList } from "@/components/messaging/GroupList";
import { GroupChat } from "@/components/messaging/GroupChat";
import { GroupInfoModal } from "@/components/messaging/GroupInfoModal";
import { toast } from "sonner";

function TeamContent() {
  const { getActiveConversation } = useMessaging();
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const activeConversation = getActiveConversation();

  const handleShowGroupInfo = () => {
    if (activeConversation) {
      setShowGroupInfo(true);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Team Chats</h1>
        <p className="mt-1 text-muted-foreground">
          Create groups, manage your team, and communicate in real-time
        </p>
      </div>

      {/* Chat Interface */}
      <div className="glass-card flex h-[calc(100vh-16rem)] overflow-hidden">
        <GroupList />
        <GroupChat onShowGroupInfo={handleShowGroupInfo} />
      </div>

      {/* Group Info Modal */}
      <GroupInfoModal
        group={activeConversation || null}
        open={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
      />
    </div>
  );
}

export default function Team() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect talent users to dashboard
  useEffect(() => {
    if (user?.role === 'talent') {
      toast.error("This page is only accessible to creators");
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <MainLayout>
      <MessagingProvider>
        <TeamContent />
      </MessagingProvider>
    </MainLayout>
  );
}
