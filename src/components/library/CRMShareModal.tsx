/**
 * CRMShareModal — share a CRM sheet with team members, modeled on
 * DocShareModal.tsx but backed by useCRM()'s existing CRMAccess helpers.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCRM, type SharableUser, type AccessRole } from "@/hooks/useCRM";
import { useAuth } from "@/contexts/AuthContext";

interface CRMShareModalProps {
  sheetId: string;
  sheetName: string;
  open: boolean;
  onClose: () => void;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

type Role = "none" | AccessRole;

export function CRMShareModal({ sheetId, sheetName, open, onClose }: CRMShareModalProps) {
  const { user } = useAuth();
  const { activeSheet, openSheet, upsertAccess, revokeAccess, fetchSharableUsers } = useCRM();
  const [sharableUsers, setSharableUsers] = useState<SharableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [users] = await Promise.all([fetchSharableUsers(), openSheet(sheetId)]);
    setSharableUsers(users);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const getAccess = (userId: string) => activeSheet?.access_list.find((a) => a.user === userId);

  const handleRoleChange = async (su: SharableUser, role: Role) => {
    const existing = getAccess(su.user_id);
    setPending((p) => ({ ...p, [su.user_id]: true }));
    try {
      if (role === "none") {
        if (!existing) return;
        await revokeAccess(sheetId, existing.id);
      } else {
        await upsertAccess(sheetId, su.user_id, role, existing?.id);
        toast.success(`${su.name} can now ${role} this sheet`);
      }
    } catch {
      toast.error("Failed to update sharing");
    } finally {
      setPending((p) => ({ ...p, [su.user_id]: false }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">Share "{sheetName}"</DialogTitle>
          <DialogDescription>Share with your team members and manage their access level.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-1 py-2 rounded-lg">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">{initials(user?.full_name || user?.email || "O")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs flex-shrink-0">Owner</Badge>
            </div>

            {sharableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-3">
                No team members yet. Hire talent first to share sheets with them.
              </p>
            ) : (
              sharableUsers.map((su) => {
                const existing = getAccess(su.user_id);
                const currentRole: Role = existing?.role ?? "none";
                const isBusy = pending[su.user_id];
                return (
                  <div key={su.user_id} className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">{initials(su.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{su.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{su.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isBusy && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                      <select
                        value={currentRole}
                        disabled={isBusy}
                        onChange={(e) => handleRoleChange(su, e.target.value as Role)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="none">No access</option>
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
