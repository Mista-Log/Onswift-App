import { GoogleLogin } from "@react-oauth/google";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import { googleAuth } from "@/services/googleAuth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface Props {
  role?: string;
  mode?: "login" | "signup";
}

export default function GoogleSignInButton({ role, mode }: Props) {
  const navigate = useNavigate();
  const { getUser } = useAuth();

  return (
  <div className="w-full google-auth-wrapper">
    <GoogleLogin
      onSuccess={async (credentialResponse) => {
        try {
          if (!credentialResponse.credential) return;

          const data = await googleAuth(
            credentialResponse.credential,
            role
          );

          localStorage.setItem("onswift_access", data.access);
          localStorage.setItem("onswift_refresh", data.refresh);
          localStorage.setItem("onswift_user", JSON.stringify(data.user));

          await getUser();

          if (mode === "login") {
            navigate("/dashboard", { replace: true });
            return;
          }

          navigate("/signup", {
            state: {
              fromSignup: true,
              prefilledEmail: data.user.email,
              prefilledName: data.user.full_name,
            },
            replace: true,
          });
        } catch (error) {
          console.error("Google login failed:", error);
        }
      }}
      onError={() => console.log("Google Login Failed")}
      theme="outline"
      size="large"
      shape="rectangular"
      width="100%"
    />
  </div>
  );
}