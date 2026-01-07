import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Message, GroupMember } from '@/types/messaging';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadReceiptModalProps {
  message: Message;
  members: GroupMember[];
  open: boolean;
  onClose: () => void;
}

export function ReadReceiptModal({
  message,
  members,
  open,
  onClose,
}: ReadReceiptModalProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Filter out the sender from the member list
  const otherMembers = members.filter(m => m.userId !== message.senderId);

  // Separate members into read and unread
  const readMembers = otherMembers.filter(m => message.readBy.includes(m.userId));
  const unreadMembers = otherMembers.filter(m => !message.readBy.includes(m.userId));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message Info</DialogTitle>
          <DialogDescription>See who has read this message</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read Section */}
          {readMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCheck className="h-4 w-4 text-blue-500" />
                <span>Read by {readMembers.length}</span>
              </div>

              <div className="space-y-2">
                {readMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                    <CheckCheck className="h-4 w-4 text-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivered/Unread Section */}
          {unreadMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Check className="h-4 w-4" />
                <span>Delivered to {unreadMembers.length}</span>
              </div>

              <div className="space-y-2">
                {unreadMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Timestamp */}
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Sent</p>
            <p className="text-sm font-medium text-foreground">
              {formatTime(message.timestamp)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
