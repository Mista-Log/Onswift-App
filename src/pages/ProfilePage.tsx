import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProfileView, type ProfileData } from "@/components/profile/ProfileView";
import { ShareProfileButton } from "@/components/profile/ShareProfileButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/** Someone's profile, as the people they work with see it. Reached from a team card's "View Profile". */
export default function ProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await secureFetch(`/api/v1/profiles/${userId}/`);
        if (cancelled) return;
        if (res.ok) {
          setProfile(await res.json());
          setState("ready");
        } else {
          setState("missing");
        }
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const message = async () => {
    try {
      const res = await secureFetch("/api/v2/conversations/start/", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) navigate("/messages");
      else toast.error("Failed to start conversation");
    } catch {
      toast.error("Failed to start conversation");
    }
  };

  const isMe = !!user && user.id === userId;
  const editPath = user?.role === "creator" ? "/profile/creator/edit" : "/profile/edit";

  return (
    <MainLayout>
      <div className="animate-fade-in mx-auto max-w-6xl">
        <Button variant="ghost" size="icon" aria-label="Back" className="mb-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {state === "loading" && (
          <div className="flex justify-center py-24" role="status" aria-label="Loading profile">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "missing" && (
          <div className="glass-card mx-auto mt-4 max-w-xl px-6 py-16 text-center">
            <h1 className="text-lg font-semibold text-foreground">This profile isn't available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You can open the profile of people you work with. If this is someone on your team, try again in a moment.
            </p>
          </div>
        )}

        {state === "ready" && profile && (
          <ProfileView
            profile={profile}
            layout="wide"
            className="overflow-hidden rounded-xl lg:overflow-visible"
            actions={
              isMe ? (
                <>
                  <Button asChild variant="outline" className="gap-2">
                    <Link to={editPath}>
                      <Pencil className="h-4 w-4" />
                      Edit profile
                    </Link>
                  </Button>
                  <ShareProfileButton />
                </>
              ) : (
                <Button className="gap-2" onClick={message}>
                  {/* <MessageSquare className="h-4 w-4" /> */}
                  Message
                </Button>
              )
            }
          />
        )}
      </div>
    </MainLayout>
  );
}
