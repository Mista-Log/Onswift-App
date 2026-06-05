import { useState } from "react";
import { addDays, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Users, Copy, Send, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import { FIXED_PROCESSING_MESSAGE, runWithFixedProcessingDelay } from "@/lib/loadingGate";

const DURATION_OPTIONS = [
  { label: "24 hrs",  days: 1  },
  { label: "3 days",  days: 3  },
  { label: "7 days",  days: 7  },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToTalent: () => void;
  onInviteSent?: () => void;
}

type ModalStep = "choice" | "send-invite";

export function InviteMemberModal({
  open,
  onOpenChange,
  onNavigateToTalent,
  onInviteSent,
}: InviteMemberModalProps) {
  const [step, setStep] = useState<ModalStep>("choice");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);

  const handleClose = () => {
    setStep("choice");
    setEmail("");
    setMessage("");
    setInviteLink("");
    setExpiresInDays(7);
    onOpenChange(false);
  };

  const generateInviteLink = async () => {
    if (isGenerating) return null;

    setIsGenerating(true);
    setGeneratingMessage(FIXED_PROCESSING_MESSAGE);
    try {
      const response = await runWithFixedProcessingDelay(
        secureFetch("/api/v3/invites/generate/", {
          method: "POST",
          body: JSON.stringify({
            invited_email: email || undefined,
            expires_in_days: expiresInDays,
          }),
        })
      );

      if (response.ok) {
        const data = await response.json();
        setInviteLink(data.invite_url);
        return data.invite_url;
      } else {
        toast.error("Failed to generate invite link");
        return null;
      }
    } catch (error) {
      console.error("Error generating invite:", error);
      toast.error("Failed to generate invite link");
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingMessage("");
    }
  };

  const handleCopyLink = async () => {
    let link = inviteLink;

    if (!link) {
      link = await generateInviteLink();
      if (!link) return;
    }

    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard!");
    onInviteSent?.();
  };

  const handleSendEmail = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    const link = await generateInviteLink();
    if (!link) return;

    toast.success(`Invite sent to ${email}!`);
    onInviteSent?.();
  };

  const handleHireFromMarketplace = () => {
    handleClose();
    onNavigateToTalent();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {step === "choice" ? (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl">Invite Team Member</DialogTitle>
              <DialogDescription className="text-sm">
                Choose how you'd like to add a new member to your team
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              {/* Send Invite Link Option */}
              <button
                onClick={() => setStep("send-invite")}
                className={cn(
                  "w-full rounded-xl border border-border/50 p-5 text-left transition-all",
                  "hover:border-primary/50 hover:bg-secondary/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="font-semibold text-foreground">Send Invite Link</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Invite someone you know via email or a shareable link
                    </p>
                  </div>
                </div>
              </button>

              {/* Hire from Marketplace Option */}
              <button
                onClick={handleHireFromMarketplace}
                className={cn(
                  "w-full rounded-xl border border-border/50 p-5 text-left transition-all",
                  "hover:border-primary/50 hover:bg-secondary/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="font-semibold text-foreground">Browse Talent Marketplace</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Find and hire talented professionals from our marketplace
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl">Send Invite Link</DialogTitle>
              <DialogDescription className="text-sm">
                Send an invitation to join your team
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Link duration */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-sm font-medium">Link expires in</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setExpiresInDays(opt.days)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                        expiresInDays === opt.days
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires on{" "}
                  <span className="font-medium text-foreground">
                    {format(addDays(new Date(), expiresInDays), "MMM d, yyyy")}
                  </span>
                </p>
              </div>

              {/* Personal message */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Personal Message{" "}
                  <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal note to your invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 gap-2"
                  onClick={handleCopyLink}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  {isGenerating ? "Generating…" : "Copy Link"}
                </Button>
                <Button
                  className="flex-1 h-10 gap-2"
                  onClick={handleSendEmail}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isGenerating ? "Generating…" : "Send Email"}
                </Button>
              </div>
              {isGenerating && (
                <p className="text-xs text-muted-foreground text-center">{generatingMessage}</p>
              )}
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => { setStep("choice"); setInviteLink(""); setExpiresInDays(7); }}
                disabled={isGenerating}
              >
                ← Back
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
