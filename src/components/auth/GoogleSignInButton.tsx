import { GoogleLogin } from "@react-oauth/google";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { googleAuth } from "@/services/googleAuth";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch } from "@/api/apiClient";
import { useToast } from "@/hooks/use-toast";


interface Props {
  from?: string;
  role?: string;
  mode?: "login" | "signup";
}

export default function GoogleSignInButton({
  from,
  role,
  mode
}: Props) {
  const navigate = useNavigate();
  const { getUser } = useAuth();
  const { toast } = useToast();

  return (
    <div className="w-full relative">
      {/* Invisible Google Button Overlay */}
      {/* FIX: Force-scaled the internal container to 150% width/height and centered it.
        This forces the clickable area of Google's iframe to overflow past the edges of 
        your custom button, and 'overflow-hidden' clips the invisible excess cleanly.
      */}
      <div className="absolute inset-0 z-10 opacity-0 cursor-pointer w-full h-full overflow-hidden flex items-center justify-center">
        <div className="scale-[2.5] transform min-w-[400px] flex justify-center items-center">
          <GoogleLogin
            width="400px" // Using an explicit fixed width here gives Google a standard canvas, which we then magnify to fill your entire button layout
            onSuccess={async (credentialResponse) => {
              try {
                if (!credentialResponse.credential) return;

                const data = await googleAuth(
                  credentialResponse.credential,
                  role
                );

                localStorage.setItem(
                  "onswift_access",
                  data.access
                );

                localStorage.setItem(
                  "onswift_refresh",
                  data.refresh
                );

                localStorage.setItem(
                  "onswift_user",
                  JSON.stringify(data.user)
                );

                await getUser();

                // Same invite acceptance the email/password login and signup forms do.
                // Google sign-in used to skip this entirely, leaving an invited talent
                // signed in but never added to the creator's team, with no way back.
                const inviteToken = localStorage.getItem("invite_token");
                if (inviteToken) {
                  try {
                    const res = await secureFetch(`/api/v3/invites/accept/${inviteToken}/`, {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      toast({
                        title: "Couldn't join the team",
                        description: body?.error || "That invite link is no longer valid.",
                        variant: "destructive",
                      });
                    }
                  } finally {
                    localStorage.removeItem("invite_token");
                  }
                }

                // The account already exists with its role by this point (this is what
                // creates it, for signup) — go straight to the dashboard either way.
                navigate("/dashboard", { replace: true });
              } catch (error) {
                console.error("Google login failed:", error);
              }
            }}
            onError={() => {
              console.log("Google Login Failed");
            }}
          />
        </div>
      </div>

      {/* Custom Button UI */}
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-neutral-300 hover:bg-neutral-100"
      >
        <FcGoogle className="h-5 w-5" />
        Continue with Google
      </Button>
    </div>
  );
}