import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import {
  Group,
  Message,
  ConversationMessages,
  TypingIndicator,
  MessagingContextType,
  GroupMember,
} from '@/types/messaging';
import { mockGroups, mockMessages, CURRENT_USER_ID, mockTalents } from '@/data/mockMessaging';

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [messages, setMessages] = useState<ConversationMessages>(mockMessages);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const currentUserId = CURRENT_USER_ID;

  // Group operations
  const createGroup = useCallback((name: string, memberIds: string[], avatar?: string) => {
    const newGroupId = `group-${Date.now()}`;
    const selectedMembers: GroupMember[] = memberIds
      .map(id => {
        const talent = mockTalents.find(t => t.userId === id);
        return talent ? { ...talent, isAdmin: false } : null;
      })
      .filter((m): m is GroupMember => m !== null);

    // Add current user as admin
    selectedMembers.push({
      userId: currentUserId,
      name: 'You',
      role: 'Creator',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Creator',
      isAdmin: true,
      joinedAt: new Date().toISOString(),
    });

    const newGroup: Group = {
      id: newGroupId,
      name,
      isGroup: true,
      creatorId: currentUserId,
      members: selectedMembers,
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      createdAt: new Date().toISOString(),
      unreadCount: 0,
    };

    setGroups(prev => [newGroup, ...prev]);
    setMessages(prev => ({ ...prev, [newGroupId]: [] }));
  }, [currentUserId]);

  const deleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[groupId];
      return newMessages;
    });
    if (activeConversationId === groupId) {
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  const leaveGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.filter(m => m.userId !== currentUserId),
        };
      }
      return g;
    }));

    // Remove from active view after leaving
    if (activeConversationId === groupId) {
      setActiveConversationId(null);
    }
  }, [currentUserId, activeConversationId]);

  const updateGroup = useCallback((groupId: string, updates: { name?: string; avatar?: string }) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, ...updates };
      }
      return g;
    }));
  }, []);

  // Member operations
  const addMembersToGroup = useCallback((groupId: string, memberIds: string[]) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newMembers: GroupMember[] = memberIds
          .map(id => {
            const talent = mockTalents.find(t => t.userId === id);
            if (!talent) return null;
            // Check if member already exists
            if (g.members.some(m => m.userId === id)) return null;
            return {
              ...talent,
              isAdmin: false,
              joinedAt: new Date().toISOString(),
            };
          })
          .filter((m): m is GroupMember => m !== null);

        return {
          ...g,
          members: [...g.members, ...newMembers],
        };
      }
      return g;
    }));
  }, []);

  const removeMemberFromGroup = useCallback((groupId: string, memberId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.filter(m => m.userId !== memberId),
        };
      }
      return g;
    }));
  }, []);

  // Message operations
  const sendMessage = useCallback((
    conversationId: string,
    content: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: 'image' | 'video' | 'document',
    replyTo?: Message['replyTo']
  ) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      senderName: 'You',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Creator',
      content,
      timestamp: new Date().toISOString(),
      readBy: [currentUserId],
      fileUrl,
      fileName,
      fileType,
      replyTo,
    };

    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));

    // Update group's last message
    setGroups(prev => prev.map(g => {
      if (g.id === conversationId) {
        return {
          ...g,
          lastMessage: {
            content: content || (fileName ? `Sent ${fileType || 'file'}` : ''),
            timestamp: newMessage.timestamp,
            senderId: currentUserId,
          },
        };
      }
      return g;
    }));

    // Simulate message being read after a delay (mock WebSocket behavior)
    setTimeout(() => {
      markAsRead(conversationId, [newMessage.id]);
    }, 2000);
  }, [currentUserId]);

  const markAsRead = useCallback((conversationId: string, messageIds: string[]) => {
    setMessages(prev => {
      const conversationMessages = prev[conversationId] || [];
      const updatedMessages = conversationMessages.map(msg => {
        if (messageIds.includes(msg.id) && !msg.readBy.includes(currentUserId)) {
          return {
            ...msg,
            readBy: [...msg.readBy, currentUserId],
          };
        }
        return msg;
      });
      return {
        ...prev,
        [conversationId]: updatedMessages,
      };
    });

    // Update unread count
    setGroups(prev => prev.map(g => {
      if (g.id === conversationId) {
        return { ...g, unreadCount: 0 };
      }
      return g;
    }));
  }, [currentUserId]);

  // Conversation operations
  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);

    // Mark all messages as read when opening a conversation
    if (conversationId) {
      const conversationMessages = messages[conversationId] || [];
      const unreadMessageIds = conversationMessages
        .filter(msg => !msg.readBy.includes(currentUserId))
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        markAsRead(conversationId, unreadMessageIds);
      }
    }
  }, [currentUserId, messages, markAsRead]);

  const getActiveConversation = useCallback(() => {
    return groups.find(g => g.id === activeConversationId);
  }, [groups, activeConversationId]);

  const getConversationMessages = useCallback((conversationId: string) => {
    return messages[conversationId] || [];
  }, [messages]);

  // Typing operations
  const startTyping = useCallback((conversationId: string) => {
    const newIndicator: TypingIndicator = {
      userId: currentUserId,
      name: 'You',
      conversationId,
    };

    setTypingIndicators(prev => {
      // Remove existing indicator for this user in this conversation
      const filtered = prev.filter(
        t => !(t.userId === currentUserId && t.conversationId === conversationId)
      );
      return [...filtered, newIndicator];
    });

    // Auto-stop typing after 3 seconds
    setTimeout(() => {
      stopTyping(conversationId);
    }, 3000);
  }, [currentUserId]);

  const stopTyping = useCallback((conversationId: string) => {
    setTypingIndicators(prev =>
      prev.filter(t => !(t.userId === currentUserId && t.conversationId === conversationId))
    );
  }, [currentUserId]);

  const getTypingUsers = useCallback((conversationId: string) => {
    return typingIndicators.filter(
      t => t.conversationId === conversationId && t.userId !== currentUserId
    );
  }, [typingIndicators, currentUserId]);

  // Utility functions
  const isUserAdmin = useCallback((groupId: string, userId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return false;
    const member = group.members.find(m => m.userId === userId);
    return member?.isAdmin || false;
  }, [groups]);

  const getUnreadCount = useCallback((conversationId: string) => {
    const conversationMessages = messages[conversationId] || [];
    return conversationMessages.filter(msg => !msg.readBy.includes(currentUserId)).length;
  }, [messages, currentUserId]);

  return (
    <MessagingContext.Provider
      value={{
        groups,
        messages,
        activeConversationId,
        typingIndicators,
        currentUserId,
        createGroup,
        deleteGroup,
        leaveGroup,
        updateGroup,
        addMembersToGroup,
        removeMemberFromGroup,
        sendMessage,
        markAsRead,
        setActiveConversation,
        getActiveConversation,
        getConversationMessages,
        startTyping,
        stopTyping,
        getTypingUsers,
        isUserAdmin,
        getUnreadCount,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
}
