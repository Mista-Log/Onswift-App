import { Fragment, useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Search, Loader2, ChevronLeft, Plus, Users, Info, UserPlus, FolderKanban, ArrowDown, X, GripVertical, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateGroupModal } from "@/components/messaging/CreateGroupModal";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { MessageActionBar } from "@/components/messaging/MessageActionBar";
import { SelectionToolbar } from "@/components/messaging/SelectionToolbar";
import { ForwardMessageModal } from "@/components/messaging/ForwardMessageModal";
import { DateDivider } from "@/components/messaging/DateDivider";
import { InviteMemberModal } from "@/components/dashboard/InviteMemberModal";
import { ConversationInfoPanel } from "@/components/messaging/ConversationInfoPanel";
import { MentionDropdown, MentionMember } from "@/components/messaging/MentionDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useTheme } from "next-themes";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

export interface Conversation {
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

export interface ReplyPreview {
  id: string;
  content: string;
  sender_name: string;
}

export interface Message {
  id: string;
  sender: string;
  sender_name: string;
  sender_avatar: string | null;
  recipient: string;
  content: string;
  is_read: boolean;
  reply_to: ReplyPreview | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface GroupMessage {
  id: string;
  group: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  is_mine: boolean;
  reply_to: ReplyPreview | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
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

export interface Contact {
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
  const { teamMembers, removeTeamMember } = useTeam();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"direct" | "groups">("direct");
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured before any effect runs: when arriving via /messages?user=<id>,
  // fetchConversations must NOT auto-select the first (pinned assistant)
  // conversation — the deep-link handler picks the right one instead.
  const deepLinkUserRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get("user")
  );
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Whether the user is currently scrolled near the bottom of the chat pane —
  // used to decide if a new message should auto-scroll the view, or if we'd
  // just be yanking them away from history they're reading.
  const isNearBottomRef = useRef(true);
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState(false);

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollToBottomBtn(!nearBottom);
    setActiveMessageForActions(null);
  };

  const scrollToBottom = () => {
    isNearBottomRef.current = true;
    setShowScrollToBottomBtn(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Draggable width for the contact list column (desktop only — mobile stays
  // single-pane). Persisted so it doesn't reset every visit.
  const CONTACT_LIST_WIDTH_KEY = "onswift:messages:contactListWidth";
  const CONTACT_LIST_MIN_WIDTH = 260;
  const CONTACT_LIST_MAX_WIDTH = 480;
  const [contactListWidth, setContactListWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(CONTACT_LIST_WIDTH_KEY));
      if (saved && saved >= CONTACT_LIST_MIN_WIDTH && saved <= CONTACT_LIST_MAX_WIDTH) {
        return saved;
      }
    } catch {
      // Ignore — fall back to the default width.
    }
    return 320;
  });

  const handleContactListResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = contactListWidth;
    let latestWidth = startWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      latestWidth = Math.min(
        CONTACT_LIST_MAX_WIDTH,
        Math.max(CONTACT_LIST_MIN_WIDTH, startWidth + delta)
      );
      setContactListWidth(latestWidth);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        localStorage.setItem(CONTACT_LIST_WIDTH_KEY, String(latestWidth));
      } catch {
        // Ignore — persistence is a nice-to-have, not required for resizing to work.
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Reply / edit / delete state (shared between direct and group chat)
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; isGroup: boolean } | null>(null);

  // Mobile long-press action bar + select-to-forward (desktop keeps the
  // hover dropdown instead — see MessageBubble's isMobile gate).
  const [activeMessageForActions, setActiveMessageForActions] = useState<Message | GroupMessage | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  // Mention state
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMemberIndex, setSelectedMemberIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionMember[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const directInputRef = useRef<HTMLTextAreaElement>(null);

  const isCreator = user?.role === "creator";
  const isMobile = useIsMobile();

  // Auto-grow the chat textareas (up to ~5 lines) so long messages wrap
  // visibly instead of scrolling off to the left.
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  // Collapse both inputs back to one line after a message is sent/cleared.
  useEffect(() => {
    if (message !== "") return;
    [directInputRef.current, inputRef.current].forEach((el) => {
      if (el) el.style.height = "auto";
    });
  }, [message]);

  // Client-side: the per-project creator thread (portal chat) lives on its own
  // page — surface those threads here in Chats so clients actually find them.
  const [projectThreads, setProjectThreads] = useState<
    { id: string; name: string; creator_name?: string; unread: number }[]
  >([]);

  useEffect(() => {
    if (user?.role !== "client") return;
    let cancelled = false;
    const loadThreads = async () => {
      try {
        const res = await secureFetch("/api/v5/projects/");
        if (!res.ok) return;
        const data = await res.json();
        const projects: { id: string; name: string; creator_name?: string }[] =
          data.projects || [];
        const withUnread = await Promise.all(
          projects.map(async (p) => {
            try {
              const r = await secureFetch(`/api/v5/projects/${p.id}/messages/unread/`);
              const d = r.ok ? await r.json() : {};
              return { ...p, unread: d.unread_count || 0 };
            } catch {
              return { ...p, unread: 0 };
            }
          })
        );
        if (!cancelled) setProjectThreads(withUnread);
      } catch {
        // Leave the current list on failure.
      }
    };
    loadThreads();
    const timer = setInterval(loadThreads, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.role]);

  // OnSwift Assistant branding — logo avatar matches the sidebar's theme swap.
  const { resolvedTheme } = useTheme();
  const assistantLogo =
    resolvedTheme === "light" ? "/onswift-purple-logo.png" : "/onswift%20logo.png";
  const isAssistantConv = (c: Conversation | null | undefined) =>
    c?.other_user?.role === "assistant";

  // Team record for the person in the open DM (creator side), used to surface
  // their role/email/join date in the contact info panel.
  const selectedMember = teamMembers.find(
    (m) => m.user_id === selectedConversation?.other_user?.id
  );

  const handleRemoveFromTeam = async () => {
    if (!selectedMember) return;
    const ok = await removeTeamMember(selectedMember.id);
    if (ok) {
      toast.success(`${selectedMember.name} removed from your team`);
      setShowContactInfo(false);
    } else {
      toast.error("Failed to remove team member");
    }
  };

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
      // Opening a thread should always land at the newest message.
      isNearBottomRef.current = true;
      setShowScrollToBottomBtn(false);
      fetchMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
      // Reset compose state — a reply/edit in flight belongs to the old thread
      setReplyingTo(null);
      setEditingMessageId(null);
      // Selection/action-bar state is scoped to one thread — don't leak across
      setActiveMessageForActions(null);
      setIsSelecting(false);
      setSelectedMessageIds(new Set());
    }
  }, [selectedConversation]);

  // Fetch group messages when group changes
  useEffect(() => {
    if (selectedGroup) {
      // Opening a thread should always land at the newest message.
      isNearBottomRef.current = true;
      setShowScrollToBottomBtn(false);
      fetchGroupMessages(selectedGroup.id);
      fetchGroupMembers(selectedGroup.id);
      markGroupMessagesAsRead(selectedGroup.id);
      // Reset mentions when group changes
      setMentions([]);
      setShowMentionDropdown(false);
      // Reset compose state — a reply/edit in flight belongs to the old thread
      setReplyingTo(null);
      setEditingMessageId(null);
      // Selection/action-bar state is scoped to one thread — don't leak across
      setActiveMessageForActions(null);
      setIsSelecting(false);
      setSelectedMessageIds(new Set());
    }
  }, [selectedGroup]);

  // Scroll to bottom when messages change — but only if the user is already
  // near the bottom. Otherwise a background poll tick (every 5s) would keep
  // yanking them back down while they're reading older messages.
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, groupMessages]);

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
        const data: Conversation[] = await response.json();
        // Pin the OnSwift Assistant to the top (stable sort keeps recency order
        // for everyone else).
        const sorted = [...data].sort(
          (a, b) => Number(isAssistantConv(b)) - Number(isAssistantConv(a))
        );
        setConversations(sorted);
        if (
          sorted.length > 0 &&
          !selectedConversation &&
          activeTab === "direct" &&
          !deepLinkUserRef.current
        ) {
          setSelectedConversation(sorted[0]);
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

  // Deep link: /messages?user=<id> (e.g. a talent picked from global search)
  // opens — creating if needed — the direct conversation with that person.
  useEffect(() => {
    const userId = searchParams.get("user");
    if (!userId) return;
    // Strip the param so back/refresh doesn't re-trigger it.
    setSearchParams(
      (prev) => {
        prev.delete("user");
        return prev;
      },
      { replace: true },
    );
    setActiveTab("direct");
    startConversation(userId);
  }, [searchParams]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isSending) return;

    try {
      setIsSending(true);
      const response = await secureFetch(
        `/api/v2/conversations/${selectedConversation.id}/messages/send/`,
        {
          method: "POST",
          body: JSON.stringify({ content: message, reply_to_id: replyingTo?.id }),
        }
      );

      if (response.ok) {
        const newMessage = await response.json();
        setMessages(prev => [...prev, newMessage]);
        setMessage("");
        setReplyingTo(null);
        // Sending always jumps to the bottom, even if scrolled up.
        isNearBottomRef.current = true;
        setShowScrollToBottomBtn(false);

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
            mention_ids: mentionIds,
            reply_to_id: replyingTo?.id
          }),
        }
      );

      if (response.ok) {
        const newMessage = await response.json();
        setGroupMessages(prev => [...prev, newMessage]);
        setMessage("");
        setMentions([]); // Clear mentions after sending
        setReplyingTo(null);
        // Sending always jumps to the bottom, even if scrolled up.
        isNearBottomRef.current = true;
        setShowScrollToBottomBtn(false);

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

  // Message and GroupMessage flag "is this mine" differently (sender vs
  // is_mine) — this normalizes it for code that handles either type.
  const isMessageOwn = (msg: Message | GroupMessage) =>
    "is_mine" in msg ? msg.is_mine : msg.sender === user?.id;

  const handleSend = () => {
    if (editingMessageId) {
      handleSaveEdit();
      return;
    }
    if (activeTab === "direct" && selectedConversation) {
      handleSendMessage();
    } else if (activeTab === "groups" && selectedGroup) {
      handleSendGroupMessage();
    }
  };

  const activeInputRef = activeTab === "direct" ? directInputRef : inputRef;

  const handleReplyToMessage = (msg: Message | GroupMessage) => {
    setEditingMessageId(null);
    setReplyingTo({ id: msg.id, content: msg.content, sender_name: msg.sender_name });
    activeInputRef.current?.focus();
  };

  // Messages older than this can no longer be edited (enforced server-side
  // too — see MessageEditView/GroupMessageEditView in the backend).
  const EDIT_WINDOW_MS = 5 * 60 * 1000;
  const isEditable = (msg: Message | GroupMessage) =>
    Date.now() - new Date(msg.created_at).getTime() < EDIT_WINDOW_MS;

  const handleStartEdit = (msg: Message | GroupMessage) => {
    if (!isEditable(msg)) {
      toast.error("This message can no longer be edited");
      return;
    }
    setReplyingTo(null);
    setEditingMessageId(msg.id);
    setMessage(msg.content);
    activeInputRef.current?.focus();
  };

  const handleCancelReply = () => setReplyingTo(null);

  const handleCopyMessage = async (msg: Message | GroupMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      toast.success("Message copied");
    } catch (error) {
      console.error("Error copying message:", error);
      toast.error("Failed to copy message");
    }
  };

  const openActionBarFor = (msg: Message | GroupMessage) => setActiveMessageForActions(msg);
  const closeActionBar = () => setActiveMessageForActions(null);

  const handleEnterSelectMode = (msg: Message | GroupMessage) => {
    setIsSelecting(true);
    setSelectedMessageIds(new Set([msg.id]));
    setActiveMessageForActions(null);
  };

  const handleCancelSelectMode = () => {
    setIsSelecting(false);
    setSelectedMessageIds(new Set());
  };

  const toggleMessageSelected = (id: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenForwardModal = () => setShowForwardModal(true);

  const handleConfirmForward = async (recipientUserIds: string[]) => {
    const activeMessages = activeTab === "direct" ? messages : groupMessages;
    const messagesToForward = activeMessages
      .filter(m => selectedMessageIds.has(m.id))
      .map(m => ({ content: m.content }));
    if (messagesToForward.length === 0) return;

    setIsForwarding(true);
    const results = await Promise.allSettled(
      recipientUserIds.map(async (userId) => {
        const convRes = await secureFetch('/api/v2/conversations/start/', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        });
        if (!convRes.ok) throw new Error('Failed to start conversation');
        const conversation = await convRes.json();

        for (const msg of messagesToForward) {
          const sendRes = await secureFetch(`/api/v2/conversations/${conversation.id}/messages/send/`, {
            method: 'POST',
            body: JSON.stringify({ content: msg.content }),
          });
          if (!sendRes.ok) throw new Error('Failed to send message');
        }
      })
    );
    setIsForwarding(false);

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(
        `Forwarded ${messagesToForward.length} message${messagesToForward.length !== 1 ? 's' : ''} to ${succeeded} recipient${succeeded !== 1 ? 's' : ''}`
      );
    }
    if (failed > 0) {
      toast.error(`Failed to forward to ${failed} recipient${failed !== 1 ? 's' : ''}`);
    }
    if (succeeded > 0) {
      setShowForwardModal(false);
      handleCancelSelectMode();
      fetchConversations();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setMessage("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !message.trim() || isSending) return;

    try {
      setIsSending(true);
      if (activeTab === "direct" && selectedConversation) {
        const response = await secureFetch(
          `/api/v2/conversations/${selectedConversation.id}/messages/${editingMessageId}/edit/`,
          { method: "PATCH", body: JSON.stringify({ content: message }) }
        );
        if (response.ok) {
          const updated = await response.json();
          setMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        } else if (response.status === 403) {
          toast.error("Your 5-minute edit window has expired");
        } else {
          toast.error("Failed to edit message");
        }
      } else if (activeTab === "groups" && selectedGroup) {
        const response = await secureFetch(
          `/api/v2/groups/${selectedGroup.id}/messages/${editingMessageId}/edit/`,
          { method: "PATCH", body: JSON.stringify({ content: message }) }
        );
        if (response.ok) {
          const updated = await response.json();
          setGroupMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        } else if (response.status === 403) {
          toast.error("Your 5-minute edit window has expired");
        } else {
          toast.error("Failed to edit message");
        }
      }
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error("Failed to edit message");
    } finally {
      setIsSending(false);
      setEditingMessageId(null);
      setMessage("");
    }
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;
    const { id, isGroup } = messageToDelete;

    try {
      if (isGroup && selectedGroup) {
        const response = await secureFetch(
          `/api/v2/groups/${selectedGroup.id}/messages/${id}/delete/`,
          { method: "DELETE" }
        );
        if (response.ok) {
          const updated = await response.json();
          setGroupMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        } else {
          toast.error("Failed to delete message");
        }
      } else if (!isGroup && selectedConversation) {
        const response = await secureFetch(
          `/api/v2/conversations/${selectedConversation.id}/messages/${id}/delete/`,
          { method: "DELETE" }
        );
        if (response.ok) {
          const updated = await response.json();
          setMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        } else {
          toast.error("Failed to delete message");
        }
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    } finally {
      setMessageToDelete(null);
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

  // WhatsApp-style day dividers between messages — compares local calendar
  // days (midnight-to-midnight), not raw 24h diffs, so it's correct right
  // across a midnight boundary.
  const isSameLocalDay = (a: string, b: string) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };

  const getDateDividerLabel = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "long", day: "numeric" });
    }
    return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    (conv.other_user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (conv.other_user?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Filter groups based on search
  const filteredGroups = groups.filter(group =>
    group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
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
      .filter(m => !conversations.some(c => c.other_user?.id === m.user_id))
      .map(m => ({ id: m.id, user_id: m.user_id, name: m.name, avatar: m.avatar }))
    : myCreators.filter(c => !conversations.some(conv => conv.other_user?.id === c.user_id));

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
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    autoGrow(e.target);

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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    <MainLayout hideTopBarOnMobile>
      {({ toggleMobileSidebar }) => (
      <>
      {/* <div className="animate-fade-in h-[100dvh] md:h-[calc(100vh-8rem)]"> */}
      <div className="animate-fade-in h-[100dvh] md:h-[calc(100vh-8rem)]">
        <div className="glass-card h-full overflow-hidden">
          <div
            className="h-full md:grid md:grid-cols-[var(--contact-list-width)_4px_1fr]"
            style={{ "--contact-list-width": `${contactListWidth}px` } as React.CSSProperties}
          >
            {/* Contact List */}
            <div
              className={cn(
                "border-r border-border/50 flex flex-col min-h-0",
                (selectedConversation || selectedGroup) ? "hidden md:flex" : "flex"
              )}
            >
              <div className="border-b border-border/50 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMobileSidebar}
                      className="md:hidden -ml-1 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">Messages</h2>
                  </div>
                  {isCreator && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="New"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                          <Users className="h-4 w-4 mr-2" />
                          Create group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowInviteModal(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  ) : (
                    <>
                      {/* Client-only: per-project creator threads (portal chat) */}
                      {user?.role === "client" && projectThreads.length > 0 && (
                        <>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Project chats
                          </p>
                          {projectThreads
                            .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() => navigate(`/projects/${p.id}/messages`)}
                                className="w-full border-b border-border/30 p-4 text-left transition-colors hover:bg-secondary/50"
                              >
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-11 w-11 sm:h-12 sm:w-12">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                      <FolderKanban className="h-5 w-5" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate sm:text-base">
                                      {p.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate sm:text-sm">
                                      Project thread with {p.creator_name || "your creator"}
                                    </p>
                                  </div>
                                  {p.unread > 0 && (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                      {p.unread}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                        </>
                      )}
                      {filteredConversations.length > 0 ? (
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
                                <AvatarImage
                                  src={isAssistantConv(conv) ? assistantLogo : conv.other_user?.avatar || undefined}
                                  alt={conv.other_user?.name || "User"}
                                  className={isAssistantConv(conv) ? "object-contain p-1.5" : undefined}
                                />
                                <AvatarFallback className="bg-primary/20 text-primary">
                                  {conv.other_user?.name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground truncate sm:text-base">
                                    {conv.other_user?.name || "Unknown"}
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
                      ) : !(user?.role === "client" && projectThreads.length > 0) ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No conversations yet</p>
                        </div>
                      ) : null}
                    </>
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
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowGroupInfo(false);
                        }}
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

            {/* Contact list resize handle — desktop only */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize contact list"
              onPointerDown={handleContactListResizeStart}
              className="hidden md:flex cursor-col-resize items-center justify-center transition-colors hover:bg-primary/10 active:bg-primary/20"
            >
              <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border border-border bg-background">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            {/* Chat Area */}
            <div
              className={cn(
                "flex flex-col h-full min-h-0",
                (selectedConversation || selectedGroup) ? "flex" : "hidden md:flex"
              )}
            >
              {selectedConversation ? (
                <>
                  {/* Chat Header - Direct Message */}
                  {isSelecting ? (
                    <SelectionToolbar
                      count={selectedMessageIds.size}
                      onCancel={handleCancelSelectMode}
                      onForward={handleOpenForwardModal}
                    />
                  ) : activeMessageForActions ? (
                    <MessageActionBar
                      isOwn={isMessageOwn(activeMessageForActions)}
                      isEditable={isEditable(activeMessageForActions)}
                      onReply={() => { handleReplyToMessage(activeMessageForActions); closeActionBar(); }}
                      onCopy={() => { handleCopyMessage(activeMessageForActions); closeActionBar(); }}
                      onSelect={() => handleEnterSelectMode(activeMessageForActions)}
                      onEdit={() => { handleStartEdit(activeMessageForActions); closeActionBar(); }}
                      onDelete={() => { setMessageToDelete({ id: activeMessageForActions.id, isGroup: false }); closeActionBar(); }}
                      onClose={closeActionBar}
                    />
                  ) : (
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 p-4 sm:p-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        onClick={toggleMobileSidebar}
                        className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label="Open menu"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setSelectedConversation(null)}
                        className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label="Back to conversations"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowContactInfo(true)}
                        className="-mx-1 flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-secondary/40 active:scale-[0.99]"
                        title="View contact info"
                        aria-label="View contact info"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={isAssistantConv(selectedConversation) ? assistantLogo : selectedConversation.other_user?.avatar || undefined}
                            alt={selectedConversation.other_user?.name || "User"}
                            className={isAssistantConv(selectedConversation) ? "object-contain p-1.5" : undefined}
                          />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {selectedConversation.other_user?.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{selectedConversation.other_user?.name || "Unknown"}</p>
                          {(selectedMember?.role || selectedConversation.other_user?.company) && (
                            <p className="text-sm text-muted-foreground truncate">{selectedMember?.role || selectedConversation.other_user?.company}</p>
                          )}
                        </div>
                      </button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowContactInfo(true)}
                      aria-label="Contact info"
                      title="Contact info"
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                  )}

                  {/* Messages */}
                  <div className="relative flex-1 min-h-0">
                  <div
                    className="absolute inset-0 space-y-4 overflow-y-auto p-3 sm:p-5 md:p-6 scrollbar-hide"
                    onScroll={handleChatScroll}
                  >
                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length > 0 ? (
                      <>
                        {messages.map((msg, index) => {
                          const isOwn = msg.sender === user?.id;
                          const prevMsg = index > 0 ? messages[index - 1] : null;
                          const showDivider = !prevMsg || !isSameLocalDay(prevMsg.created_at, msg.created_at);
                          return (
                            <Fragment key={msg.id}>
                              {showDivider && <DateDivider label={getDateDividerLabel(msg.created_at)} />}
                              <MessageBubble
                                message={msg}
                                isOwn={isOwn}
                                showSenderHeader={false}
                                isMobile={isMobile}
                                isSelecting={isSelecting}
                                isSelected={selectedMessageIds.has(msg.id)}
                                isEditable={isEditable(msg)}
                                formatTime={formatTime}
                                onReply={handleReplyToMessage}
                                onEdit={handleStartEdit}
                                onDelete={(m) => setMessageToDelete({ id: m.id, isGroup: false })}
                                onLongPress={openActionBarFor}
                                onToggleSelected={toggleMessageSelected}
                              />
                            </Fragment>
                          );
                        })}
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
                  {showScrollToBottomBtn && (
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      aria-label="Scroll to latest messages"
                      title="Scroll to latest messages"
                      className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 hover:shadow-xl hover:shadow-primary/50 active:scale-95"
                    >
                      <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  )}
                  </div>

                  {/* Message Input - Direct Message */}
                  <div className="border-t border-border/50 p-3 sm:p-4 md:p-5">
                    {editingMessageId && (
                      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary">Editing message</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {!editingMessageId && replyingTo && (
                      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary">Replying to {replyingTo.sender_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelReply}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-end gap-2 sm:gap-3">
                      <Textarea
                        ref={directInputRef}
                        rows={1}
                        placeholder={editingMessageId ? "Edit message..." : "Type a message..."}
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          autoGrow(e.target);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        className="flex-1 min-h-10 max-h-32 resize-none"
                        disabled={isSending}
                      />
                      <Button onClick={handleSend} size="icon" className="sm:w-auto sm:px-4 shrink-0" disabled={isSending || !message.trim()}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            <span className="hidden sm:inline sm:ml-2">{editingMessageId ? "Save" : "Send"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : selectedGroup ? (
                <>
                  {/* Chat Header - Group */}
                  {isSelecting ? (
                    <SelectionToolbar
                      count={selectedMessageIds.size}
                      onCancel={handleCancelSelectMode}
                      onForward={handleOpenForwardModal}
                    />
                  ) : activeMessageForActions ? (
                    <MessageActionBar
                      isOwn={isMessageOwn(activeMessageForActions)}
                      isEditable={isEditable(activeMessageForActions)}
                      onReply={() => { handleReplyToMessage(activeMessageForActions); closeActionBar(); }}
                      onCopy={() => { handleCopyMessage(activeMessageForActions); closeActionBar(); }}
                      onSelect={() => handleEnterSelectMode(activeMessageForActions)}
                      onEdit={() => { handleStartEdit(activeMessageForActions); closeActionBar(); }}
                      onDelete={() => { setMessageToDelete({ id: activeMessageForActions.id, isGroup: true }); closeActionBar(); }}
                      onClose={closeActionBar}
                    />
                  ) : (
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleMobileSidebar}
                        className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                        aria-label="Open menu"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGroup(null);
                          setShowGroupInfo(false);
                        }}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowGroupInfo(true)}
                      aria-label="Open group info"
                      title="Group info"
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                  )}

                  {/* Group Messages */}
                  <div className="relative flex-1 min-h-0">
                  <div
                    className="absolute inset-0 space-y-4 overflow-y-auto p-3 sm:p-5 md:p-6 scrollbar-hide"
                    onScroll={handleChatScroll}
                  >
                    {isLoadingMessages && groupMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : groupMessages.length > 0 ? (
                      <>
                        {groupMessages.map((msg, index) => {
                          const prevMsg = index > 0 ? groupMessages[index - 1] : null;
                          const showDivider = !prevMsg || !isSameLocalDay(prevMsg.created_at, msg.created_at);
                          return (
                            <Fragment key={msg.id}>
                              {showDivider && <DateDivider label={getDateDividerLabel(msg.created_at)} />}
                              <MessageBubble
                                message={msg}
                                isOwn={msg.is_mine}
                                showSenderHeader={true}
                                isMobile={isMobile}
                                isSelecting={isSelecting}
                                isSelected={selectedMessageIds.has(msg.id)}
                                isEditable={isEditable(msg)}
                                formatTime={formatTime}
                                onReply={handleReplyToMessage}
                                onEdit={handleStartEdit}
                                onDelete={(m) => setMessageToDelete({ id: m.id, isGroup: true })}
                                onLongPress={openActionBarFor}
                                onToggleSelected={toggleMessageSelected}
                              />
                            </Fragment>
                          );
                        })}
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
                  {showScrollToBottomBtn && (
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      aria-label="Scroll to latest messages"
                      title="Scroll to latest messages"
                      className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 hover:shadow-xl hover:shadow-primary/50 active:scale-95"
                    >
                      <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  )}
                  </div>

                  {/* Message Input - Group */}
                  <div className="border-t border-border/50 p-3 sm:p-4 md:p-5">
                    {editingMessageId && (
                      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary">Editing message</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {!editingMessageId && replyingTo && (
                      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary">Replying to {replyingTo.sender_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelReply}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-end gap-2 sm:gap-3 relative">
                      <div className="flex-1 relative">
                        <Textarea
                          ref={inputRef}
                          rows={1}
                          placeholder={editingMessageId ? "Edit message..." : "Type a message... (use @ to mention)"}
                          value={message}
                          onChange={handleMessageChange}
                          onKeyDown={handleKeyDown}
                          className="w-full min-h-10 max-h-32 resize-none"
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
                      <Button onClick={handleSend} size="icon" className="sm:w-auto sm:px-4 shrink-0" disabled={isSending || !message.trim()}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            <span className="hidden sm:inline sm:ml-2">{editingMessageId ? "Save" : "Send"}</span>
                          </>
                        )}
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

      <InviteMemberModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onNavigateToTalent={() => navigate('/talent')}
      />

      <ForwardMessageModal
        open={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        messageCount={selectedMessageIds.size}
        isCreator={isCreator}
        teamMembers={teamMembers}
        myCreators={myCreators}
        conversations={conversations}
        isSending={isForwarding}
        onConfirm={handleConfirmForward}
      />

      <ConversationInfoPanel
        open={showContactInfo}
        onOpenChange={setShowContactInfo}
        otherUser={selectedConversation?.other_user}
        member={selectedMember}
        canRemove={isCreator}
        onRemoveFromTeam={handleRemoveFromTeam}
      />

      <Dialog open={showGroupInfo} onOpenChange={setShowGroupInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              {selectedGroup?.description?.trim() || "No group description yet."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">Members</span>
              <Badge variant="secondary">{selectedGroup?.member_count ?? 0}</Badge>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {groupMembers.length > 0 ? (
                groupMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-md border p-2">
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge variant={member.is_admin ? "default" : "outline"}>
                      {member.is_admin ? "Admin" : "Member"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No member details available.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Message Confirmation */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The message will be removed for everyone in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </MainLayout>
  );
}
