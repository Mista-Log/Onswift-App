// Message types and interfaces for group messaging

export interface GroupMember {
  userId: string;
  name: string;
  role: string;
  avatar: string;
  isAdmin: boolean;
  joinedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  readBy: string[]; // Array of user IDs who have read the message
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'video' | 'document';
  replyTo?: {
    messageId: string;
    content: string;
    senderName: string;
  };
}

export interface Group {
  id: string;
  name: string;
  isGroup: boolean; // false for 1-on-1 chats
  creatorId: string;
  members: GroupMember[];
  avatar?: string;
  createdAt: string;
  lastMessage?: {
    content: string;
    timestamp: string;
    senderId: string;
  };
  unreadCount: number;
}

export interface TypingIndicator {
  userId: string;
  name: string;
  conversationId: string;
}

export interface ConversationMessages {
  [conversationId: string]: Message[];
}

export interface MessagingContextType {
  // State
  groups: Group[];
  messages: ConversationMessages;
  activeConversationId: string | null;
  typingIndicators: TypingIndicator[];
  currentUserId: string;

  // Group operations
  createGroup: (name: string, memberIds: string[], avatar?: string) => void;
  deleteGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: { name?: string; avatar?: string }) => void;

  // Member operations
  addMembersToGroup: (groupId: string, memberIds: string[]) => void;
  removeMemberFromGroup: (groupId: string, memberId: string) => void;

  // Message operations
  sendMessage: (conversationId: string, content: string, fileUrl?: string, fileName?: string, fileType?: 'image' | 'video' | 'document', replyTo?: Message['replyTo']) => void;
  markAsRead: (conversationId: string, messageIds: string[]) => void;

  // Conversation operations
  setActiveConversation: (conversationId: string | null) => void;
  getActiveConversation: () => Group | undefined;
  getConversationMessages: (conversationId: string) => Message[];

  // Typing operations
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  getTypingUsers: (conversationId: string) => TypingIndicator[];

  // Utility
  isUserAdmin: (groupId: string, userId: string) => boolean;
  getUnreadCount: (conversationId: string) => number;
}
