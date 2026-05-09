import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { googleAuth } from "@/services/googleAuth";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  from?: string;
  role?: string;
}

export default function GoogleSignInButton({ from, role }: Props) {
  const navigate = useNavigate();
  const { getUser } = useAuth();

  return (
    <div className="w-full">
      <GoogleLogin
        theme="outline"
        size="large"
        width="100%"
        text="signin_with"
        shape="rectangular"
        onSuccess={async (credentialResponse) => {
          try {
            if (!credentialResponse.credential) return;

            const data = await googleAuth(
              credentialResponse.credential,
              role
            );

            // store tokens
            localStorage.setItem("onswift_access", data.access);
            localStorage.setItem("onswift_refresh", data.refresh);

            localStorage.setItem(
              "onswift_user",
              JSON.stringify(data.user)
            );

            // fetch authenticated user
            await getUser();

            // redirect AFTER auth state updates
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
  );
}