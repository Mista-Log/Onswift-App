import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProfileView, type ProfileData } from "./ProfileView";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

/**
 * On a form the creator chose to show their profile on: a small "who is asking" pill that opens the
 * creator's profile without leaving the form (so nothing typed is lost).
 */
export function CreatorProfileCard({ profile }: { profile: ProfileData }) {
  const [open, setOpen] = useState(false);
  const firstName = profile.full_name.split(" ")[0] || "the creator";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm font-medium text-slate-700 transition-colors hover:border-[#6B5CE7] hover:text-[#6B5CE7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B5CE7]"
      >
        {/* Decorative here: the label already names the person, so screen readers skip the initials. */}
        <Avatar className="h-7 w-7 shrink-0" aria-hidden>
          <AvatarImage src={profile.avatar || undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-[#6B5CE7]/15 text-xs text-[#6B5CE7]">{initials(profile.full_name) || "?"}</AvatarFallback>
        </Avatar>
        <span className="truncate">View {firstName}'s profile</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="block max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-y-auto p-0">
          <DialogTitle className="sr-only">{profile.full_name}'s profile</DialogTitle>
          <DialogDescription className="sr-only">Close this to go back to the form. Your answers are kept.</DialogDescription>
          <ProfileView
            profile={profile}
            className="overflow-hidden rounded-lg"
            actions={
              profile.handle && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={`/${profile.handle}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open full profile
                  </a>
                </Button>
              )
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
