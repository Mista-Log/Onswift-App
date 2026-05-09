import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { googleAuth } from "@/services/googleAuth";

interface Props {
  from?: string;
  role?: string;
}

export default function GoogleSignInButton({ from, role }: Props) {
  const navigate = useNavigate();

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

            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            localStorage.setItem(
              "user",
              JSON.stringify(data.user)
            );

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