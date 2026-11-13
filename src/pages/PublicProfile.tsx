import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { publicFetch } from "@/api/apiClient";
import { ProfileView, type ProfileData } from "@/components/profile/ProfileView";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import NotFound from "./NotFound";

/**
 * onswift.org/<handle>: a creator's profile for people outside the app. No sign-in needed. Visitors who
 * aren't signed in are invited to make their own account. A link that is switched off, or was never
 * taken, shows the normal "page not found".
 */
export default function PublicProfile() {
  const { handle = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await publicFetch(`/api/v1/public/profiles/${encodeURIComponent(handle)}/`);
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
  }, [handle]);

  useEffect(() => {
    if (state !== "ready" || !profile) return;
    const before = document.title;
    document.title = `${profile.full_name} on OnSwift`;
    return () => {
      document.title = before;
    };
  }, [state, profile]);

  if (state === "missing") return <NotFound />;

  const firstName = profile?.full_name.split(" ")[0] || "them";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="OnSwift home" className="shrink-0">
            <img src="/onswift-logo-white.png" alt="OnSwift" className="h-6 w-auto brightness-0 dark:brightness-100" />
          </Link>
          {isAuthenticated ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/home">Open OnSwift</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/get-started">Sign up free</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-4 pb-12 sm:p-6">
        {state === "loading" && (
          <div className="flex justify-center py-24" role="status" aria-label="Loading profile">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "ready" && profile && (
          <>
            <ProfileView
              profile={profile}
              layout="wide"
              className="overflow-hidden rounded-xl lg:overflow-visible"
              actions={
                !isAuthenticated && (
                  <Button asChild>
                    <Link to="/get-started">Join OnSwift</Link>
                  </Button>
                )
              }
            />

            {!isAuthenticated && (
              <section
                aria-label="Join OnSwift"
                className="mt-8 flex flex-col items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Like how {firstName} shows their work?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a free OnSwift account to build your own profile, share your link, and run projects with
                    your team and clients in one place.
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link to="/get-started">Create your account</Link>
                </Button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
