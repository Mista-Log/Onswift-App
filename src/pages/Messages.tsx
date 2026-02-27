import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Search, Loader2, ChevronLeft, Plus, Users } from "lucide-react";
import { CreateGroupModal } from "@/components/messaging/CreateGroupModal";
import { MentionDropdown, MentionMember } from "@/components/messaging/MentionDropdown";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

interface Conversation {
  id: string;
  other_user: {
    id: string;
    name: string;
    avatar: string | null;
    company: string | null;
    role: string;
  };
  last_message_content: string | null;
  last_message_time: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  sender: string;
  sender_name: string;
  sender_avatar: string | null;
  recipient: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface GroupMessage {
  id: string;
  group: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  is_mine: boolean;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  last_message: {
    content: string;
    sender_name: string;
    timestamp: string;
  } | null;
  unread_count: number;
  is_admin: boolean;
}

interface Contact {
  id: string;
  user_id: string;
  name: string;
  avatar?: string | null;
  company?: string | null;
}

interface GroupMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  is_admin: boolean;
}

export default function Messages() {
  const { user } = useAuth();
  const { teamMembers } = useTeam();
  const [activeTab, setActiveTab] = useState<"direct" | "groups">("direct");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [myCreators, setMyCreators] = useState<Contact[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mention state
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMemberIndex, setSelectedMemberIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionMember[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCreator = user?.role === "creator";

  // Fetch conversations, groups, and contacts
  useEffect(() => {
    fetchConversations();
    fetchGroups();
    if (!isCreator) {
      fetchMyCreators();
    }
  }, [isCreator]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Fetch group messages when group changes
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages(selectedGroup.id);
      fetchGroupMembers(selectedGroup.id);
      markGroupMessagesAsRead(selectedGroup.id);
      // Reset mentions when group changes
      setMentions([]);
      setShowMentionDropdown(false);
    }
  }, [selectedGroup]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!selectedConversation && !selectedGroup) return;

    const interval = setInterval(() => {
      if (selectedConversation) {
        fetchMessages(selectedConversation.id);
      } else if (selectedGroup) {
        fetchGroupMessages(selectedGroup.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConversation, selectedGroup]);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await secureFetch('/api/v2/conversations/');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !selectedConversation && activeTab === "direct") {
          setSelectedConversation(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const response = await secureFetch('/api/v2/groups/');
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const fetchGroupMessages = async (groupId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await secureFetch(`/api/v2/groups/${groupId}/messages/`);
      if (response.ok) {
        const data = await response.json();
        setGroupMessages(data);
      }
    } catch (error) {
      console.error("Error fetching group messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const response = await secureFetch(`/api/v2/groups/${groupId}/members/`);
      if (response.ok) {
        const data = await response.json();
        setGroupMembers(data);
      }
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  };

  const markGroupMessagesAsRead = async (groupId: string) => {
    try {
      await secureFetch(`/api/v2/groups/${groupId}/messages/read/`, {
        method: "POST",
      });
      setGroups(prev =>
        prev.map(g =>
          g.id === groupId ? { ...g, unread_count: 0 } : g
        )
      );
    } catch (error) {
      console.error("Error marking group messages as read:", error);
    }
  };

  const fetchMyCreators = async () => {
    try {
      const response = await secureFetch('/api/v3/my-creators/');
      if (response.ok) {
        const data = await response.json();
        setMyCreators(data);
      }
    } catch (error) {
      console.error("Error fetching creators:", error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await secureFetch(`/api/v2/conversations/${conversationId}/messages/`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    try {
      await secureFetch(`/api/v2/conversations/${conversationId}/messages/read/`, {
        method: "POST",
      });
      // Update local state
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const startConversation = async (userId: string) => {
    try {
      const response = await secureFetch('/api/v2/conversations/start/', {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        const conversation = await response.json();
        // Check if conversation already exists
        const existing = conversations.find(c => c.id === conversation.id);
        if (!existing) {
          setConversations(prev => [conversation, ...prev]);
        }
        setSelectedConversation(conversation);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Failed to start conversation");
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isSending) return;

    try {
      setIsSending(true);
      const response = await secureFetch(
        `/api/v2/conversations/${selectedConversation.id}/messages/send/`,
        {
          method: "POST",
          body: JSON.stringify({ content: message }),
        }
      );

      if (response.ok) {
        const newMessage = await response.json();
        setMessages(prev => [...prev, newMessage]);
        setMessage("");

        // Update conversation list
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation.id
              ? { ...c, last_message_content: message, last_message_time: new Date().toISOString() }
              : c
          )
        );
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGroupMessage = async () => {
    if (!message.trim() || !selectedGroup || isSending) return;

    try {
      setIsSending(true);
      const mentionIds = mentions.map(m => m.id);
      const response = await secureFetch(
        `/api/v2/groups/${selectedGroup.id}/messages/send/`,
        {
          method: "POST",
          body: JSON.stringify({ 
            content: message,
            mention_ids: mentionIds
          }),
        }
      );

      if (response.ok) {
        const newMessage = await response.json();
        setGroupMessages(prev => [...prev, newMessage]);
        setMessage("");
        setMentions([]); // Clear mentions after sending

        // Update group list
        setGroups(prev =>
          prev.map(g =>
            g.id === selectedGroup.id
              ? {
                  ...g,
                  last_message: {
                    content: message,
                    sender_name: "You",
                    timestamp: new Date().toISOString(),
                  },
                }
              : g
          )
        );
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    if (activeTab === "direct" && selectedConversation) {
      handleSendMessage();
    } else if (activeTab === "groups" && selectedGroup) {
      handleSendGroupMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return formatTime(dateString);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.other_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_user.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter groups based on search
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle tab change
  const handleTabChange = (tab: "direct" | "groups") => {
    setActiveTab(tab);
    if (tab === "direct") {
      setSelectedGroup(null);
      if (conversations.length > 0 && !selectedConversation) {
        setSelectedConversation(conversations[0]);
      }
    } else {
      setSelectedConversation(null);
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0]);
      }
    }
  };

  // Get contacts to start new conversations with
  // Creators can message their team members, talents can message their creators
  const availableContacts: Contact[] = isCreator
    ? teamMembers
        .filter(m => !conversations.some(c => c.other_user.id === m.user_id))
        .map(m => ({ id: m.id, user_id: m.user_id, name: m.name, avatar: m.avatar }))
    : myCreators.filter(c => !conversations.some(conv => conv.other_user.id === c.user_id));

  // Convert group members to mention members format (exclude current user)
  const mentionMembers: MentionMember[] = groupMembers
    .filter(m => m.user_id !== user?.id)
    .map(m => ({
      id: m.user_id,
      name: m.name,
      avatar: m.avatar,
      role: m.role,
    }));

  // Handle message input change with mention detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Only check for mentions in group chat
    if (activeTab !== "groups" || !selectedGroup) {
      setShowMentionDropdown(false);
      return;
    }

    // Find @ symbol position
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if @ is at the start or preceded by a space
      const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
      if (lastAtIndex === 0 || charBeforeAt === ' ') {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        // Only show dropdown if query doesn't contain space (still typing username)
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setShowMentionDropdown(true);
          setSelectedMemberIndex(0);
          return;
        }
      }
    }

    setShowMentionDropdown(false);
  };

  // Handle mention selection
  const handleMentionSelect = (member: MentionMember) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = message.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeMention = message.slice(0, lastAtIndex);
      const afterMention = message.slice(cursorPos);
      const newMessage = `${beforeMention}@${member.name} ${afterMention}`;
      setMessage(newMessage);

      // Add to mentions list if not already present
      if (!mentions.some(m => m.id === member.id)) {
        setMentions(prev => [...prev, member]);
      }
    }

    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionDropdown && mentionMembers.length > 0) {
      const filteredMembers = mentionMembers.filter(m => 
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMemberIndex(prev => 
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMemberIndex(prev => 
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
      } else if (e.key === 'Enter' && filteredMembers.length > 0) {
        e.preventDefault();
        handleMentionSelect(filteredMembers[selectedMemberIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in h-[calc(100vh-8rem)]">
        <div className="glass-card h-full overflow-hidden">
          <div className="h-full md:grid md:grid-cols-[320px_1fr]">
          {/* Contact List */}
          <div
            className={cn(
              "border-r border-border/50 flex flex-col",
              (selectedConversation || selectedGroup) ? "hidden md:flex" : "flex"
            )}
          >
              <div className="border-b border-border/50 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-foreground sm:text-lg">Messages</h2>
                  {isCreator && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowCreateGroup(true)}
                      title="Create new group"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as "direct" | "groups")} className="mb-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="direct">Direct</TabsTrigger>
                    <TabsTrigger value="groups">Groups</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={activeTab === "direct" ? "Search conversations..." : "Search groups..."}
                    className="pl-10 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === "direct" ? (
                  /* Direct Messages List */
                  isLoadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredConversations.length > 0 ? (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "w-full border-b border-border/30 p-4 text-left transition-colors hover:bg-secondary/50",
                        selectedConversation?.id === conv.id && "bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 sm:h-12 sm:w-12">
                          <AvatarImage src={conv.other_user.avatar || undefined} alt={conv.other_user.name} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {conv.other_user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate sm:text-base">
                              {conv.other_user.name}
                            </p>
                            <span className="hidden text-[10px] text-muted-foreground sm:inline sm:text-xs">
                              {formatDate(conv.last_message_time)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate sm:text-sm">
                            {conv.last_message_content || "No messages yet"}
                          </p>
                        </div>
                        {conv.unread_count > 0 && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {conv.unread_count}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                  </div>
                )
                ) : (
                  /* Groups List */
                  isLoadingGroups ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredGroups.length > 0 ? (
                    filteredGroups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroup(group)}
                        className={cn(
                          "w-full border-b border-border/30 p-4 text-left transition-colors hover:bg-secondary/50",
                          selectedGroup?.id === group.id && "bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 sm:h-12 sm:w-12">
                            <AvatarImage src={group.avatar_url || undefined} alt={group.name} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              <Users className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate sm:text-base">
                                {group.name}
                              </p>
                              {group.last_message && (
                                <span className="hidden text-[10px] text-muted-foreground sm:inline sm:text-xs">
                                  {formatDate(group.last_message.timestamp)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate sm:text-sm">
                              {group.last_message
                                ? `${group.last_message.sender_name}: ${group.last_message.content}`
                                : `${group.member_count} members`}
                            </p>
                          </div>
                          {group.unread_count > 0 && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                              {group.unread_count}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No groups yet</p>
                      {isCreator && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateGroup(true)}
                          className="mt-3"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Group
                        </Button>
                      )}
                    </div>
                  )
                )}

                {/* Available contacts to start conversations */}
                {activeTab === "direct" && availableContacts.length > 0 && (
                  <div className="border-t border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      {isCreator ? "Message team member" : "Message your creator"}
                    </p>
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => startConversation(contact.user_id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={contact.avatar || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {contact.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <span className="text-sm text-foreground block">{contact.name}</span>
                          {contact.company && (
                            <span className="text-xs text-muted-foreground">{contact.company}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div
              className={cn(
                "flex flex-col h-full",
                (selectedConversation || selectedGroup) ? "flex" : "hidden md:flex"
              )}
            >
              {selectedConversation ? (
                <>
                  {/* Chat Header - Direct Message */}
                  <div className="flex items-center gap-2 border-b border-border/50 p-4 sm:p-5">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label="Back to conversations"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={selectedConversation.other_user.avatar || undefined}
                        alt={selectedConversation.other_user.name}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {selectedConversation.other_user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{selectedConversation.other_user.name}</p>
                      {selectedConversation.other_user.company && (
                        <p className="text-sm text-muted-foreground">{selectedConversation.other_user.company}</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length > 0 ? (
                      <>
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.sender === user?.id ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[70%] rounded-2xl px-4 py-2",
                                msg.sender === user?.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-foreground"
                              )}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p
                                className={cn(
                                  "mt-1 text-xs",
                                  msg.sender === user?.id
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                                )}
                              >
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Send a message to start the conversation</p>
                      </div>
                    )}
                  </div>

                  {/* Message Input - Direct Message */}
                  <div className="border-t border-border/50 p-4 sm:p-5">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        className="flex-1"
                        disabled={isSending}
                      />
                      <Button onClick={handleSend} className="gap-2" disabled={isSending || !message.trim()}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send
                      </Button>
                    </div>
                  </div>
                </>
              ) : selectedGroup ? (
                <>
                  {/* Chat Header - Group */}
                  <div className="flex items-center gap-2 border-b border-border/50 p-4 sm:p-5">
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                      aria-label="Back to groups"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={selectedGroup.avatar_url || undefined}
                        alt={selectedGroup.name}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{selectedGroup.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedGroup.member_count} members</p>
                    </div>
                  </div>

                  {/* Group Messages */}
                  <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                    {isLoadingMessages && groupMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : groupMessages.length > 0 ? (
                      <>
                        {groupMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.is_mine ? "justify-end" : "justify-start"
                            )}
                          >
                            {!msg.is_mine && (
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={msg.sender_avatar || undefined} alt={msg.sender_name} />
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                  {msg.sender_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div>
                              {!msg.is_mine && (
                                <p className="text-xs text-muted-foreground mb-1">{msg.sender_name}</p>
                              )}
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-2xl px-4 py-2",
                                  msg.is_mine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-foreground"
                                )}
                              >
                                <p className="text-sm">{msg.content}</p>
                                <p
                                  className={cn(
                                    "mt-1 text-xs",
                                    msg.is_mine
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Users className="h-12 w-12 mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Send a message to start the conversation</p>
                      </div>
                    )}
                  </div>

                  {/* Message Input - Group */}
                  <div className="border-t border-border/50 p-4 sm:p-5">
                    <div className="flex gap-3 relative">
                      <div className="flex-1 relative">
                        <Input
                          ref={inputRef}
                          placeholder="Type a message... (use @ to mention)"
                          value={message}
                          onChange={handleMessageChange}
                          onKeyDown={handleKeyDown}
                          className="w-full"
                          disabled={isSending}
                        />
                        <MentionDropdown
                          members={mentionMembers}
                          searchQuery={mentionQuery}
                          selectedIndex={selectedMemberIndex}
                          onSelect={handleMentionSelect}
                          visible={showMentionDropdown}
                        />
                      </div>
                      <Button onClick={handleSend} className="gap-2" disabled={isSending || !message.trim()}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send
                      </Button>
                    </div>
                    {mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Mentioning:</span>
                        {mentions.map(m => (
                          <span key={m.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            @{m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose from your existing conversations or start a new one</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={fetchGroups}
      />
    </MainLayout>
  );
}
