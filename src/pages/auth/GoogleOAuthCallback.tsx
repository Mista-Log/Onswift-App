import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function GoogleOAuthCallback() {
  useEffect(() => {
    // Parse the hash fragment for implicit grant flow
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");
    const error = params.get("error");
    const state = params.get("state");

    // Also check query params for authorization code flow
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");
    const queryError = queryParams.get("error");
    const queryState = queryParams.get("state");

    if (error || queryError) {
      // Send error back to parent window
      window.opener?.postMessage(
        { type: "google-oauth-callback", error: error || queryError },
        window.location.origin
      );
      setTimeout(() => window.close(), 100);
      return;
    }

    if (accessToken && (state === "calendar_connect" || !state)) {
      // Implicit grant flow - we have the token directly
      window.opener?.postMessage(
        { 
          type: "google-oauth-callback", 
          access_token: accessToken,
          expires_in: expiresIn ? parseInt(expiresIn) : undefined
        },
        window.location.origin
      );
      setTimeout(() => window.close(), 100);
      return;
    }

    if (code && (queryState === "calendar_connect" || !queryState)) {
      // Authorization code flow - send code back
      window.opener?.postMessage(
        { type: "google-oauth-callback", code },
        window.location.origin
      );
      setTimeout(() => window.close(), 100);
      return;
    }

    // If we get here without tokens or code, something went wrong
    if (!accessToken && !code) {
      window.opener?.postMessage(
        { type: "google-oauth-callback", error: "No token received" },
        window.location.origin
      );
      setTimeout(() => window.close(), 2000);
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Connecting to Google Calendar...</p>
        <p className="text-xs text-muted-foreground mt-2">This window will close automatically</p>
      </div>
    </div>
  );
}
