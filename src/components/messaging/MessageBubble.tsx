import { Message } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Download, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  onReply?: (message: Message) => void;
  onShowReadReceipts?: (message: Message) => void;
}

export function MessageBubble({
  message,
  isOwnMessage,
  isGroupChat,
  onReply,
  onShowReadReceipts,
}: MessageBubbleProps) {
  const [imageError, setImageError] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getReadStatus = () => {
    const readCount = message.readBy.length;
    if (readCount === 1 && message.readBy.includes(message.senderId)) {
      return 'sent'; // Only sender has read (just sent)
    } else if (readCount > 1) {
      // Check if all members have read (would need member count from parent)
      return 'read'; // At least one other person has read
    }
    return 'delivered';
  };

  const readStatus = getReadStatus();

  const renderFileAttachment = () => {
    if (!message.fileUrl) return null;

    if (message.fileType === 'image') {
      return (
        <div className="mb-2">
          {!imageError ? (
            <img
              src={message.fileUrl}
              alt={message.fileName || 'Attached image'}
              className="max-w-xs rounded-lg"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3">
              <Download className="h-4 w-4" />
              <span className="text-sm">{message.fileName || 'Image'}</span>
            </div>
          )}
        </div>
      );
    }

    if (message.fileType === 'video') {
      return (
        <div className="mb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3">
            <Download className="h-4 w-4" />
            <span className="text-sm">{message.fileName || 'Video'}</span>
          </div>
        </div>
      );
    }

    if (message.fileType === 'document') {
      return (
        <div className="mb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3">
            <Download className="h-4 w-4" />
            <span className="text-sm">{message.fileName || 'Document'}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderReplyIndicator = () => {
    if (!message.replyTo) return null;

    return (
      <div className="mb-2 rounded border-l-4 border-primary/50 bg-secondary/30 p-2">
        <p className="text-xs font-medium text-primary">{message.replyTo.senderName}</p>
        <p className="truncate text-xs text-muted-foreground">{message.replyTo.content}</p>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'group relative flex gap-3',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
    >
      {!isOwnMessage && isGroupChat && (
        <Avatar className="h-8 w-8 border border-border/50">
          <AvatarImage src={message.senderAvatar} alt={message.senderName} />
          <AvatarFallback className="bg-primary/20 text-xs text-primary">
            {message.senderName.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex max-w-md flex-col', isOwnMessage && 'items-end')}>
        {!isOwnMessage && isGroupChat && (
          <p className="mb-1 text-xs font-medium text-foreground">{message.senderName}</p>
        )}

        <div
          className={cn(
            'group/bubble relative rounded-2xl px-4 py-2',
            isOwnMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {/* Reply button - shows on hover */}
          {onReply && (
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                'absolute -top-2 h-6 w-6 opacity-0 transition-opacity group-hover/bubble:opacity-100',
                isOwnMessage ? '-left-8' : '-right-8'
              )}
              onClick={() => onReply(message)}
            >
              <Reply className="h-3 w-3" />
            </Button>
          )}

          {renderReplyIndicator()}
          {renderFileAttachment()}

          {message.content && <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}

          <div className="mt-1 flex items-center justify-end gap-1">
            <p
              className={cn(
                'text-xs',
                isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {formatTime(message.timestamp)}
            </p>

            {isOwnMessage && (
              <button
                onClick={() => onShowReadReceipts?.(message)}
                className="ml-1 transition-opacity hover:opacity-70"
              >
                {readStatus === 'sent' && (
                  <Check
                    className={cn(
                      'h-4 w-4',
                      isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  />
                )}
                {readStatus === 'delivered' && (
                  <CheckCheck
                    className={cn(
                      'h-4 w-4',
                      isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  />
                )}
                {readStatus === 'read' && (
                  <CheckCheck className="h-4 w-4 text-blue-500" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
