import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** True while the creator hasn't seen the "is your profile ready?" prompt yet (asked once per account). */
export async function profilePromptPending(): Promise<boolean> {
  try {
    const res = await secureFetch("/api/v1/settings/");
    if (!res.ok) return false;
    const settings = await res.json();
    return !settings.profile_prompt_seen_at;
  } catch {
    return false;
  }
}

interface ProfileReadinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown the first time a creator generates a client onboarding link: clients will see who they're
 * working with, so check the profile, and choose whether clients see it as a portfolio.
 */
export function ProfileReadinessDialog({ open, onOpenChange }: ProfileReadinessDialogProps) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    secureFetch("/api/v1/settings/")
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => s && setShowProfile(!!s.show_profile_to_clients))
      .catch(() => {});
  }, [open]);

  // Saves the choice and records that the prompt was seen, however the dialog is closed.
  const finish = async (thenEditProfile: boolean) => {
    setSaving(true);
    try {
      const res = await secureFetch("/api/v1/settings/", {
        method: "PATCH",
        body: JSON.stringify({
          show_profile_to_clients: showProfile,
          profile_prompt_seen_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Couldn't save your choice. You can change it later in Settings.");
    } finally {
      setSaving(false);
      onOpenChange(false);
      if (thenEditProfile) navigate("/profile/creator/edit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && finish(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserRoundCheck className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Is your profile ready for clients?</DialogTitle>
          <DialogDescription>
            Clients will see who they're working with. Make sure your profile is up to date: your photo, bio
            and best work. It doubles as your portfolio, so clients can see what else you can do for them.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 cursor-pointer">
          <span className="text-sm">
            <span className="font-medium">Show my profile to clients</span>
            <span className="block text-xs text-muted-foreground">
              Adds a Portfolio tab to your clients' project page. You can change this in Settings.
            </span>
          </span>
          <Switch checked={showProfile} onCheckedChange={setShowProfile} aria-label="Show my profile to clients" />
        </label>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => finish(true)} disabled={saving}>
            Review my profile
          </Button>
          <Button onClick={() => finish(false)} disabled={saving}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
