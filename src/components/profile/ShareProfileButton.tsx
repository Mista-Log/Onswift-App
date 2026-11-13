import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, ExternalLink, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";

interface ShareState {
  handle: string | null;
  suggested_handle: string;
  is_public: boolean;
}

/** The site's address without "https://", as people would say it: "onswift.org". */
const siteHost = () => window.location.host.replace(/^www\./, "");
export const publicProfileUrl = (handle: string) => `${window.location.origin}/${handle}`;

/**
 * "Share" on your own profile. Creators get their public link (onswift.org/your.name) to rename, switch on
 * or off, and copy. Talents get a friendly note that public links come with a creator account.
 */
export function ShareProfileButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user || (user.role !== "creator" && user.role !== "talent")) return null;

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" aria-label="Share profile" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {user.role === "creator" ? <CreatorShare /> : <TalentNudge onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreatorShare() {
  const [saved, setSaved] = useState<ShareState | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch("/api/v1/auth/share/");
        if (cancelled) return;
        if (!res.ok) return setFailed(true);
        const data: ShareState = await res.json();
        setSaved(data);
        setHandle(data.handle || data.suggested_handle);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (body: { handle?: string; is_public?: boolean }, done: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await secureFetch("/api/v1/auth/share/", { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(data);
        setHandle(data.handle || "");
        toast.success(done);
      } else {
        setError(data?.handle?.[0] || data?.detail || "That didn't save. Try again.");
      }
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl(saved!.handle!));
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const header = (
    <DialogHeader>
      <DialogTitle>Share your profile</DialogTitle>
      <DialogDescription>A public page anyone can open, no account needed.</DialogDescription>
    </DialogHeader>
  );

  if (failed) {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground">Your link couldn't be loaded. Close this and try again.</p>
      </>
    );
  }
  if (!saved) {
    return (
      <>
        {header}
        <div className="flex justify-center py-6" role="status" aria-label="Loading your link">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  const typed = handle.trim().toLowerCase();
  const changed = typed !== (saved.handle || "");
  const live = saved.is_public && !!saved.handle;

  return (
    <>
      {header}
      <div className="space-y-4">
        <div>
          <label htmlFor="share-handle" className="mb-1.5 block text-sm font-medium text-foreground">
            Your link
          </label>
          <div className="flex min-w-0 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="shrink-0 select-none pl-3 text-sm text-muted-foreground">{siteHost()}/</span>
            <input
              id="share-handle"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setError("");
              }}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="your.name"
              aria-invalid={!!error}
              aria-describedby="share-handle-help"
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>
          <p id="share-handle-help" className={error ? "mt-1.5 text-xs text-destructive" : "mt-1.5 text-xs text-muted-foreground"}>
            {error || "Letters and numbers, with dots, dashes or underscores in between."}
          </p>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Public link</span>
            <span className="block text-xs text-muted-foreground">
              {live
                ? "On. Anyone with the link can see your profile."
                : "Off. Only the people you work with can see your profile."}
            </span>
          </span>
          <Switch
            checked={saved.is_public}
            disabled={busy}
            aria-label="Public link"
            onCheckedChange={(next) =>
              save({ handle: typed, is_public: next }, next ? "Your profile is public" : "Public link switched off")
            }
          />
        </label>

        {live && changed && (
          <Button className="w-full" disabled={busy} onClick={() => save({ handle: typed }, "Link updated")}>
            Save new link
          </Button>
        )}
        {live && !changed && (
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy link
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href={publicProfileUrl(saved.handle!)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
          </div>
        )}
        {live && changed && (
          <p className="text-xs text-muted-foreground">Changing your link breaks the old one wherever you've shared it.</p>
        )}

        <p className="text-xs text-muted-foreground">
          The page shows your banner, photo, bio, links and featured work. Your email is never shown.
        </p>
      </div>
    </>
  );
}

function TalentNudge({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const switchToCreator = () => {
    logout();
    navigate("/signup/creator");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Public links come with a creator account</DialogTitle>
        <DialogDescription>
          Creators get a link like {siteHost()}/your.name to show their work to anyone, no sign-in needed.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your profile here is already visible to the creators you work with. To share one with the world, set up a
          creator account. It's free, and it needs a different email from this one.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button className="flex-1" onClick={switchToCreator}>
            Sign out and create one
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </>
  );
}
