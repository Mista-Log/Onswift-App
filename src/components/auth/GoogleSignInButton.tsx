import { GoogleLogin } from "@react-oauth/google";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { googleAuth } from "@/services/googleAuth";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  from?: string;
  role?: string;
}

export default function GoogleSignInButton({
  from,
  role,
}: Props) {
  const navigate = useNavigate();
  const { getUser } = useAuth();

  return (
    <div className="w-full relative">
      {/* Invisible Google Button Overlay */}
      <div className="absolute inset-0 z-10 opacity-0 cursor-pointer">
        <GoogleLogin
          width="100%"
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

              navigate(from || "/dashboard", {
                replace: true,
              });

            } catch (error) {
              console.error("Google login failed:", error);
            }
          }}
          onError={() => {
            console.log("Google Login Failed");
          }}
        />
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