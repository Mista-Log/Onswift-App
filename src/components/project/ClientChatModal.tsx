/**
 * ClientChatModal — the per-project creator↔client thread in a centered modal
 * over a blurred page (tap outside / Esc closes). Replaces the old inline
 * "Client Chats" card that sat under the task board. Polls while open.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { secureFetch } from "@/api/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import {
  File as FileIcon,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
} from "lucide-react";

const POLL_MS = 5000;

interface PortalMsg {
  id: string;
  sender: string;
  sender_name?: string;
  content?: string;
  file?: string | null;
  file_name?: string | null;
  created_at?: string;
}

interface ClientChatModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ClientChatModal({ projectId, open, onClose }: ClientChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PortalMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setIsLoading(true);
      try {
        const response = await secureFetch(`/api/v5/projects/${projectId}/messages/`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch {
        // Poll failures are silent; the next tick retries.
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [projectId]
  );

  // Load on open, then poll while the modal stays open.
  useEffect(() => {
    if (!open) return;
    loadMessages(true);
    const timer = setInterval(() => loadMessages(false), POLL_MS);
    return () => clearInterval(timer);
  }, [open, loadMessages]);

  // Keep the newest message in view.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  const sendMessage = async () => {
    if (!content.trim() && !file) return;
    setIsSending(true);
    try {
      const formData = new FormData();
      if (content.trim()) formData.append("content", content.trim());
      if (file) formData.append("file", file);

      const response = await secureFetch(`/api/v5/projects/${projectId}/messages/send/`, {
        method: "POST",
        body: formData,
        headers: {},
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setContent("");
        setFile(null);
        if (inputRef.current) inputRef.current.style.height = "auto";
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        {/* Blurred backdrop — scoped to this modal only */}
        <DialogOverlay className="bg-black/50 backdrop-blur-md" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden",
            "rounded-2xl border bg-background p-0 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-foreground">
                  Client Chat
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">
                  View messages from your client and your replies
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {messages.length} messages
              </span>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close chat">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 min-h-[16rem] space-y-4 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-5">
            {isLoading && messages.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                No messages yet. Start a conversation with your client!
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}
                  >
                    {!isMine && (
                      <Avatar className="h-8 w-8 shrink-0 self-end">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(msg.sender_name || "?").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={cn("min-w-0 max-w-[75%]", isMine && "text-right")}>
                      {!isMine && (
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {msg.sender_name}
                        </p>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 shadow-sm text-left",
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground border border-border/40"
                        )}
                      >
                        {msg.content && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {msg.content}
                          </p>
                        )}
                        {msg.file_name && (
                          <a
                            href={msg.file || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline",
                              isMine ? "text-primary-foreground/90" : "text-primary"
                            )}
                          >
                            <FileIcon className="h-3 w-3" />
                            {msg.file_name}
                          </a>
                        )}
                      </div>
                      <p className={cn("mt-1 text-[10px] text-muted-foreground", isMine && "text-right")}>
                        {msg.created_at && format(new Date(msg.created_at), "hh:mm a")}
                      </p>
                    </div>

                    {isMine && (
                      <Avatar className="h-8 w-8 shrink-0 self-end">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {user?.full_name?.charAt(0) || "Y"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
            <div ref={listEndRef} />
          </div>

          {/* Composer */}
          <div className="space-y-3 border-t border-border/50 p-3 sm:p-4">
            <div className="flex items-end gap-2">
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
                size="icon"
                variant="outline"
                disabled={isSending}
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach a file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Textarea
                ref={inputRef}
                rows={1}
                placeholder="Type your message..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="min-h-10 max-h-32 flex-1 resize-none rounded-2xl"
              />

              <Button
                onClick={sendMessage}
                className="shrink-0 rounded-full px-4"
                disabled={(!content.trim() && !file) || isSending}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
                <FileIcon className="h-3 w-3" />
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() => setFile(null)}
                  className="ml-auto rounded-full p-1 hover:bg-secondary"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
