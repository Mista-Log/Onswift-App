import { useEffect, useState } from "react";
import { ArrowLeft, Eye, MessageSquare } from "lucide-react";
import { secureFetch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProfileView, type ProfileData } from "./ProfileView";

type PreviewBase = Pick<ProfileData, "stats" | "member_since">;

/**
 * The numbers on your own profile (projects, tasks...) come from the server, since they aren't form
 * fields. Loaded once; the "Featured" count follows what you've added so far.
 */
export function useOwnPreviewBase(userId: string | undefined, featuredCount: number): PreviewBase {
  const [base, setBase] = useState<PreviewBase | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch(`/api/v1/profiles/${userId}/`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBase({ stats: data.stats, member_since: data.member_since });
        }
      } catch {
        /* the preview just shows zeros */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const stats = (base?.stats ?? [{ label: "Projects", value: 0 }, { label: "Tasks done", value: 0 }, { label: "Featured", value: 0 }])
    .map((s) => (s.label === "Featured" ? { ...s, value: featuredCount } : s));
  return { stats, member_since: base?.member_since ?? null };
}

interface PreviewProps {
  profile: ProfileData;
  /** Who is looking, for the caption: "your creators", "your team". */
  audience: string;
}

/**
 * The eye button. It opens a full-screen mirror of the page the other side sees (the same layout as
 * the real profile page, Message button and all), built from the form as it is right now, saved or not.
 */
export function ProfilePreviewButton({ profile, audience }: PreviewProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="gap-2" aria-label="Preview profile" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">Preview</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Full-screen on every device (dynamic viewport height, so phone browser bars don't cut it). */}
        <DialogContent className="block h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 overflow-y-auto rounded-none border-0 p-0 sm:rounded-none">
          <div className="sticky top-0 z-10 flex h-12 items-center gap-1 border-b border-border/60 bg-background/95 pl-1 pr-12 backdrop-blur">
            <Button type="button" variant="ghost" size="icon" aria-label="Back to editing" title="Back to editing" onClick={() => setOpen(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="truncate text-sm font-medium">Preview: what {audience} see</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Your profile exactly as {audience} see it.</DialogDescription>
          <div className="mx-auto w-full max-w-6xl p-4 pb-10 sm:p-6">
            <ProfileView
              profile={profile}
              layout="wide"
              className="overflow-hidden rounded-xl lg:overflow-visible"
              actions={
                // What they would see. It does nothing here: you can't message yourself.
                <Button className="gap-2" disabled title="Shown to the people viewing your profile">
                  {/* <MessageSquare className="h-4 w-4" /> */}
                  Message
                </Button>
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
