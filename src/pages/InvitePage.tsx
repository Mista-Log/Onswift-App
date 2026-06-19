import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();


  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    validateInvite();
  }, []);

  const validateInvite = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v3/invites/validate/${token}/`
      );

      const data = await response.json();

      if (!response.ok) {
        navigate("/invalid-invite");
        return;
      }

      setInvite(data);
    } catch (error) {
      navigate("/invalid-invite");
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 text-center animate-fade-in">
          
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground">
            You're invited
          </h1>

          {/* Subtitle */}
          <p className="mt-2 text-muted-foreground text-sm">
            <span className="font-medium text-foreground">
              {invite.creator_name}
            </span>
            {invite.creator_company && (
              <> from <span className="font-medium text-foreground">{invite.creator_company}</span></>
            )}{" "}
            invited you to join their team.
          </p>

          {/* Divider */}
          <div className="my-6 h-px bg-border" />

          {/* CTA */}
          <div className="flex flex-col gap-3">
            {user ? (
              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate(`/login?invite=${token}`)}
              >
                Sign in & accept invite
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  navigate(`/signup/talent?invite=${token}`)
                }
              >
                Create account & accept invite
              </Button>
            )}

            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          This invite was sent securely. If you weren’t expecting this, you can ignore it.
        </p>
      </div>
    </div>
  );
}