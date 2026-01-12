import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Search, Loader2 } from "lucide-react";
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

interface Contact {
  id: string;
  user_id: string;
  name: string;
  avatar?: string | null;
  company?: string | null;
}

export default function Messages() {
  const { user } = useAuth();
  const { teamMembers } = useTeam();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [myCreators, setMyCreators] = useState<Contact[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCreator = user?.role === "creator";

  // Fetch conversations and contacts
  useEffect(() => {
    fetchConversations();
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      fetchMessages(selectedConversation.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await secureFetch('/api/v2/conversations/');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !selectedConversation) {
          setSelectedConversation(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoadingConversations(false);
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

  // Get contacts to start new conversations with
  // Creators can message their team members, talents can message their creators
  const availableContacts: Contact[] = isCreator
    ? teamMembers
        .filter(m => !conversations.some(c => c.other_user.id === m.user_id))
        .map(m => ({ id: m.id, user_id: m.user_id, name: m.name, avatar: m.avatar }))
    : myCreators.filter(c => !conversations.some(conv => conv.other_user.id === c.user_id));

  return (
    <MainLayout>
      <div className="animate-fade-in h-[calc(100vh-8rem)]">
        <div className="glass-card h-full overflow-hidden">
          <div className="grid h-full md:grid-cols-[320px_1fr]">
            {/* Contact List */}
            <div className="border-r border-border/50">
              <div className="border-b border-border/50 p-4">
                <h2 className="mb-3 text-lg font-semibold text-foreground">Messages</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-y-auto" style={{ height: 'calc(100% - 120px)' }}>
                {isLoadingConversations ? (
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
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.other_user.avatar || undefined} alt={conv.other_user.name} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {conv.other_user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-foreground truncate">{conv.other_user.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(conv.last_message_time)}
                            </span>
                          </div>
                          {conv.other_user.company && (
                            <p className="text-xs text-muted-foreground mb-1">{conv.other_user.company}</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate">
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
                )}

                {/* Available contacts to start conversations */}
                {availableContacts.length > 0 && (
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
            <div className="flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center gap-3 border-b border-border/50 p-4">
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
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
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

                  {/* Message Input */}
                  <div className="border-t border-border/50 p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                        disabled={isSending}
                      />
                      <Button onClick={handleSendMessage} className="gap-2" disabled={isSending || !message.trim()}>
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
    </MainLayout>
  );
}
