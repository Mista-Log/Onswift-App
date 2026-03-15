/**
 * PortalMessages — Client messaging page within a project scope.
 * Real-time-ish via polling. Supports text and file attachments.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  X,
  File as FileIcon,
  Check,
  CheckCheck,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import type { PortalMessage } from "@/types/portal";

const POLL_INTERVAL = 5000; // 5 seconds

export default function PortalMessages() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [projectId]);

  // Polling for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      pollNewMessages();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [projectId, messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const response = await secureFetch(`/api/v5/projects/${projectId}/messages/`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.results || data);
        setHasMore(!!data.next);
        if (data.next) {
          const url = new URL(data.next);
          setCursor(url.searchParams.get("cursor"));
        }
        // Mark as read
        markMessagesRead();
      } else if (response.status === 403) {
        toast.error("You don't have access to this project");
        navigate("/portal");
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const pollNewMessages = async () => {
    try {
      const response = await secureFetch(`/api/v5/projects/${projectId}/messages/`);
      if (response.ok) {
        const data = await response.json();
        const newMessages: PortalMessage[] = data.results || data;
        if (newMessages.length > messages.length) {
          setMessages(newMessages);
          markMessagesRead();
        }
      }
    } catch {
      // Silent fail for polling
    }
  };

  const markMessagesRead = async () => {
    try {
      await secureFetch(`/api/v5/projects/${projectId}/messages/read/`, {
        method: "POST",
      });
    } catch {
      // Silent
    }
  };

  const loadOlderMessages = async () => {
    if (!cursor) return;
    try {
      const response = await secureFetch(
        `/api/v5/projects/${projectId}/messages/?cursor=${cursor}`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...(data.results || data), ...prev]);
        setHasMore(!!data.next);
        if (data.next) {
          const url = new URL(data.next);
          setCursor(url.searchParams.get("cursor"));
        } else {
          setCursor(null);
        }
      }
    } catch {
      toast.error("Failed to load older messages");
    }
  };

  const sendMessage = async () => {
    if (!content.trim() && !file) return;

    setSending(true);
    try {
      const formData = new FormData();
      if (content.trim()) formData.append("content", content.trim());
      if (file) formData.append("file", file);

      const response = await secureFetch(`/api/v5/projects/${projectId}/messages/`, {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setContent("");
        setFile(null);
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
    return format(date, "MMM d, h:mm a");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/portal/${projectId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Project Messages</h1>
        </div>

        {/* Messages area */}
        <Card className="flex flex-col" style={{ height: "calc(100vh - 240px)", minHeight: "400px" }}>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {hasMore && (
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={loadOlderMessages}>
                  Load older messages
                </Button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", isMine ? "flex-row-reverse" : "flex-row")}
                  >
                    {!isMine && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(msg.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn("max-w-[75%]", isMine ? "items-end" : "items-start")}>
                      {!isMine && (
                        <p className="text-xs text-muted-foreground mb-1">{msg.sender_name}</p>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        {msg.file && (
                          <a
                            href={msg.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 text-xs mt-1 underline",
                              isMine ? "text-primary-foreground/80" : "text-primary"
                            )}
                          >
                            <FileIcon className="h-3 w-3" />
                            {msg.file_name || "Attachment"}
                          </a>
                        )}
                      </div>
                      <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end" : "")}>
                        <span className="text-[10px] text-muted-foreground">
                          {formatMessageDate(msg.created_at)}
                        </span>
                        {isMine && (
                          msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-primary" />
                          ) : (
                            <Check className="h-3 w-3 text-muted-foreground" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* File preview */}
          {file && (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-muted p-2 text-sm">
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Input area */}
          <div className="border-t p-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button
              size="icon"
              disabled={sending || (!content.trim() && !file)}
              onClick={sendMessage}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
