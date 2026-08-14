import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import type { TeamMember } from "@/contexts/TeamContext";
import type { Contact, Conversation } from "@/pages/Messages";

interface Recipient {
  user_id: string;
  name: string;
  avatar?: string | null;
}

interface ForwardMessageModalProps {
  open: boolean;
  onClose: () => void;
  messageCount: number;
  isCreator: boolean;
  teamMembers: TeamMember[];
  myCreators: Contact[];
  conversations: Conversation[];
  isSending: boolean;
  onConfirm: (recipientUserIds: string[]) => void;
}

// Recipient picker for forwarding — mirrors CreateGroupModal's search +
// checkbox list, but sourced entirely from data Messages.tsx already has
// loaded (no new API calls).
export function ForwardMessageModal({
  open,
  onClose,
  messageCount,
  isCreator,
  teamMembers,
  myCreators,
  conversations,
  isSending,
  onConfirm,
}: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

  const candidates = useMemo(() => {
    const base: Recipient[] = isCreator
      ? teamMembers.map((m) => ({ user_id: m.user_id, name: m.name, avatar: m.avatar }))
      : myCreators.map((c) => ({ user_id: c.user_id, name: c.name, avatar: c.avatar }));
    const fromConversations: Recipient[] = conversations
      .filter((c) => c.other_user?.role !== "assistant")
      .map((c) => ({ user_id: c.other_user.id, name: c.other_user.name, avatar: c.other_user.avatar }));

    const byId = new Map<string, Recipient>();
    for (const r of [...base, ...fromConversations]) {
      if (!byId.has(r.user_id)) byId.set(r.user_id, r);
    }
    return Array.from(byId.values());
  }, [isCreator, teamMembers, myCreators, conversations]);

  const filtered = candidates.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleToggle = (userId: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedRecipientIds([]);
    onClose();
  };

  const handleSend = () => {
    if (selectedRecipientIds.length === 0) return;
    onConfirm(selectedRecipientIds);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message{messageCount !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Send {messageCount} message{messageCount !== 1 ? "s" : ""} to one or more people
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <ScrollArea className="h-64 rounded-md border border-border">
            <div className="p-4 space-y-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No one found</p>
              ) : (
                filtered.map((r) => (
                  <div
                    key={r.user_id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleToggle(r.user_id)}
                  >
                    <Checkbox
                      checked={selectedRecipientIds.includes(r.user_id)}
                      onCheckedChange={() => handleToggle(r.user_id)}
                    />
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={r.avatar || undefined} alt={r.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {r.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedRecipientIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedRecipientIds.length} recipient{selectedRecipientIds.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || selectedRecipientIds.length === 0} className="gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
