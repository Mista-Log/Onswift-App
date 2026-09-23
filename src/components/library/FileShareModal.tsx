/**
 * FileShareModal — create/list/revoke time-limited share links for a file.
 * Uses the existing (previously unwired) DocumentShareLink backend.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Link as LinkIcon, Copy, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import type { DocumentShareLink } from "@/types/library";

interface FileShareModalProps {
  fileId: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
}

export function FileShareModal({ fileId, fileName, open, onClose }: FileShareModalProps) {
  const [links, setLinks] = useState<DocumentShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permission, setPermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureFetch(`/api/v6/documents/${fileId}/shares/`);
      if (res.ok) setLinks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (open) loadLinks();
  }, [open, loadLinks]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await secureFetch(`/api/v6/documents/${fileId}/share/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission, expires_at: expiresAt }),
      });
      if (res.ok) {
        const link: DocumentShareLink = await res.json();
        setLinks((prev) => [link, ...prev]);
        toast.success("Share link created");
      } else {
        toast.error("Failed to create share link");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    const res = await secureFetch(`/api/v6/documents/${fileId}/share/${linkId}/`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success("Link revoked");
    } else {
      toast.error("Failed to revoke link");
    }
  };

  const handleCopy = (link: DocumentShareLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">Share "{fileName}"</DialogTitle>
          <DialogDescription>Create a link anyone can use to view or edit this file for 7 days.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Select value={permission} onValueChange={(v: "VIEW" | "EDIT") => setPermission(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEW">Can view</SelectItem>
              <SelectItem value="EDIT">Can edit</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <LinkIcon size={14} className="mr-1.5" />}
            Create link
          </Button>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Active links
          </p>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No share links yet.</p>
          ) : (
            <div className="space-y-1">
              {links.map((link) => (
                <div key={link.id} className="flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{link.url}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {link.permission === "EDIT" ? "Can edit" : "Can view"} · expires{" "}
                      {format(new Date(link.expires_at), "MMM d, yyyy")}
                      {link.is_expired ? " (expired)" : ""}
                    </p>
                  </div>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
                    onClick={() => handleCopy(link)}
                  >
                    {copiedId === link.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive flex-shrink-0"
                    onClick={() => handleRevoke(link.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
