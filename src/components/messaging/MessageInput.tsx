import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, X } from 'lucide-react';
import { Message } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MessageInputProps {
  onSendMessage: (
    content: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: 'image' | 'video' | 'document',
    replyTo?: Message['replyTo']
  ) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  typingUsers?: string[];
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSendMessage,
  onTyping,
  onStopTyping,
  typingUsers = [],
  replyingTo,
  onCancelReply,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    name: string;
    type: 'image' | 'video' | 'document';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Trigger typing indicator
    if (onTyping && e.target.value) {
      onTyping();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (onStopTyping) {
          onStopTyping();
        }
      }, 3000);
    } else if (onStopTyping && !e.target.value) {
      onStopTyping();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In a real app, you'd upload the file to a server
    // For now, we'll create a mock URL
    const fileUrl = URL.createObjectURL(file);
    let fileType: 'image' | 'video' | 'document' = 'document';

    if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.type.startsWith('video/')) {
      fileType = 'video';
    }

    setAttachedFile({
      url: fileUrl,
      name: file.name,
      type: fileType,
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast.success(`${file.name} attached`);
  };

  const handleRemoveAttachment = () => {
    if (attachedFile) {
      URL.revokeObjectURL(attachedFile.url);
    }
    setAttachedFile(null);
  };

  const handleSendMessage = () => {
    if (!message.trim() && !attachedFile) return;

    const replyToData = replyingTo
      ? {
          messageId: replyingTo.id,
          content: replyingTo.content,
          senderName: replyingTo.senderName,
        }
      : undefined;

    onSendMessage(
      message.trim(),
      attachedFile?.url,
      attachedFile?.name,
      attachedFile?.type,
      replyToData
    );

    setMessage('');
    handleRemoveAttachment();
    if (onCancelReply) {
      onCancelReply();
    }
    if (onStopTyping) {
      onStopTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t border-border/50 p-4">
      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="mb-2 text-sm text-muted-foreground">
          {typingUsers.length === 1 ? (
            <span>{typingUsers[0]} is typing...</span>
          ) : (
            <span>{typingUsers.join(', ')} are typing...</span>
          )}
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
          <div className="flex-1">
            <p className="text-xs font-medium text-primary">
              Replying to {replyingTo.senderName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{attachedFile.name}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleRemoveAttachment}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-3">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        />

        <Button
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Input
          placeholder="Type a message..."
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex-1"
        />

        <Button
          onClick={handleSendMessage}
          disabled={disabled || (!message.trim() && !attachedFile)}
          className="gap-2 shrink-0"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
