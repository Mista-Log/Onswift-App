import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

import { GoogleOAuthProvider } from "@react-oauth/google";

// Initialize PostHog before rendering
initPostHog();

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);