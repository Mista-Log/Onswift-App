import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Info, Users } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useMessaging } from '@/contexts/MessagingContext';
import { Message } from '@/types/messaging';
import { ReadReceiptModal } from './ReadReceiptModal';

interface GroupChatProps {
  onShowGroupInfo?: () => void;
}

export function GroupChat({ onShowGroupInfo }: GroupChatProps) {
  const {
    getActiveConversation,
    getConversationMessages,
    sendMessage,
    startTyping,
    stopTyping,
    getTypingUsers,
    currentUserId,
  } = useMessaging();

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const activeConversation = getActiveConversation();
  const messages = activeConversation ? getConversationMessages(activeConversation.id) : [];
  const typingUsers = activeConversation ? getTypingUsers(activeConversation.id) : [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeConversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No conversation selected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a group or chat to start messaging
          </p>
        </div>
      </div>
    );
  }

  const handleSendMessage = (
    content: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: 'image' | 'video' | 'document',
    replyTo?: Message['replyTo']
  ) => {
    sendMessage(activeConversation.id, content, fileUrl, fileName, fileType, replyTo);
    setReplyingTo(null);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleShowReadReceipts = (message: Message) => {
    setSelectedMessage(message);
    setShowReadReceipts(true);
  };

  const getMemberNames = () => {
    if (!activeConversation.isGroup) return '';
    return `${activeConversation.members.length} members`;
  };

  const typingUserNames = typingUsers.map(t => t.name);

  return (
    <div className="flex flex-1 flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarImage src={activeConversation.avatar} alt={activeConversation.name} />
            <AvatarFallback className="bg-primary/20 text-primary">
              {activeConversation.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{activeConversation.name}</h3>
            {activeConversation.isGroup && (
              <p className="text-sm text-muted-foreground">{getMemberNames()}</p>
            )}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onShowGroupInfo}
        >
          <Info className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.senderId === currentUserId}
                isGroupChat={activeConversation.isGroup}
                onReply={handleReply}
                onShowReadReceipts={handleShowReadReceipts}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={() => startTyping(activeConversation.id)}
        onStopTyping={() => stopTyping(activeConversation.id)}
        typingUsers={typingUserNames}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Read Receipts Modal */}
      {selectedMessage && (
        <ReadReceiptModal
          message={selectedMessage}
          members={activeConversation.members}
          open={showReadReceipts}
          onClose={() => {
            setShowReadReceipts(false);
            setSelectedMessage(null);
          }}
        />
      )}
    </div>
  );
}
