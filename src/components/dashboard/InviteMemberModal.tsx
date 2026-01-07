import { useState } from "react";
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
import { Mail, Users, Copy, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToTalent: () => void;
}

type ModalStep = "choice" | "send-invite";

export function InviteMemberModal({
  open,
  onOpenChange,
  onNavigateToTalent,
}: InviteMemberModalProps) {
  const [step, setStep] = useState<ModalStep>("choice");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClose = () => {
    setStep("choice");
    setEmail("");
    setMessage("");
    setInviteLink("");
    onOpenChange(false);
  };

  const generateInviteLink = async () => {
    setIsGenerating(true);
    try {
      const response = await secureFetch("/api/v3/invites/generate/", {
        method: "POST",
        body: JSON.stringify({
          invited_email: email || undefined,
        }),
      });

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
    }
  };

  const handleCopyLink = async () => {
    let link = inviteLink;

    // Generate link if not already generated
    if (!link) {
      link = await generateInviteLink();
      if (!link) return;
    }

    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard!");
  };

  const handleSendEmail = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    // Generate invite link if not already generated
    let link = inviteLink;
    if (!link) {
      link = await generateInviteLink();
      if (!link) return;
    }

    // TODO: Implement actual email sending via backend
    toast.success(`Invite link generated! Copy and send to ${email}`);
    // For now, just show the link for manual sending
  };

  const handleHireFromMarketplace = () => {
    handleClose();
    onNavigateToTalent();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "choice" ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Choose how you'd like to add a new member to your team
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {/* Send Invite Link Option */}
              <button
                onClick={() => setStep("send-invite")}
                className={cn(
                  "w-full rounded-lg border border-border/50 p-4 text-left transition-all",
                  "hover:border-primary/50 hover:bg-secondary/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">Send Invite Link</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Invite someone you know via email or shareable link
                    </p>
                  </div>
                </div>
              </button>

              {/* Hire from Marketplace Option */}
              <button
                onClick={handleHireFromMarketplace}
                className={cn(
                  "w-full rounded-lg border border-border/50 p-4 text-left transition-all",
                  "hover:border-primary/50 hover:bg-secondary/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">Browse Talent Marketplace</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Find and hire talented professionals from our marketplace
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send Invite Link</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Personal Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal note to your invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleCopyLink}
                  disabled={isGenerating}
                >
                  <Copy className="h-4 w-4" />
                  {isGenerating ? "Generating..." : "Copy Link"}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSendEmail}
                  disabled={isGenerating}
                >
                  <Send className="h-4 w-4" />
                  {isGenerating ? "Generating..." : "Send Email"}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setStep("choice")}
                disabled={isGenerating}
              >
                Back
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
