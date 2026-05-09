import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function YourComponent() {
  const navigate = useNavigate();
  const { getUser } = useAuth();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type !== "google-oauth-callback") return;

      if (event.data.error) {
        console.error(event.data.error);
        return;
      }

      const { access, refresh } = event.data;

      if (access && refresh) {
        localStorage.setItem("onswift_access", access);
        localStorage.setItem("onswift_refresh", refresh);

        await getUser();

        navigate("/dashboard", { replace: true });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [getUser, navigate]);

  return <div>Loading...</div>;
}