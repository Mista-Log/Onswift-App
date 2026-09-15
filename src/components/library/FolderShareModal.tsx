/**
 * FolderShareModal — "People with access" UI for a Document Library folder.
 * Adapted from src/components/docs/DocShareModal.tsx (same pattern, folder
 * instead of doc) — kept as a separate component rather than a shared one
 * since DocShareModal belongs to the docs feature this change must not touch.
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
import {
  fetchFolderAccess,
  addFolderAccess,
  updateFolderAccess,
  removeFolderAccess,
  fetchFolderSharableUsers,
} from "@/lib/libraryFolders";
import type { FolderAccess, FolderSharableUser, LibraryFolder } from "@/types/library";
import { useAuth } from "@/contexts/AuthContext";

interface FolderShareModalProps {
  folder: LibraryFolder;
  open: boolean;
  onClose: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type FolderRole = "none" | "viewer" | "editor";

export function FolderShareModal({ folder, open, onClose }: FolderShareModalProps) {
  const { user } = useAuth();
  const [sharableUsers, setSharableUsers] = useState<FolderSharableUser[]>([]);
  const [accessList, setAccessList] = useState<FolderAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchFolderSharableUsers(), fetchFolderAccess(folder.id)]).then(
      ([users, access]) => {
        setSharableUsers(users);
        setAccessList(access);
        setLoading(false);
      }
    );
  }, [open, folder.id]);

  const getAccess = (userId: string): FolderAccess | undefined =>
    accessList.find((a) => a.user.id === userId);

  const handleRoleChange = useCallback(
    async (sharableUser: FolderSharableUser, role: FolderRole) => {
      const existing = getAccess(sharableUser.user_id);
      setPending((p) => ({ ...p, [sharableUser.user_id]: true }));
      try {
        if (role === "none") {
          if (!existing) return;
          const ok = await removeFolderAccess(folder.id, existing.id);
          if (ok) {
            setAccessList((prev) => prev.filter((a) => a.id !== existing.id));
          } else {
            toast.error("Failed to remove access");
          }
        } else if (existing) {
          const updated = await updateFolderAccess(folder.id, existing.id, role);
          if (updated) {
            setAccessList((prev) =>
              prev.map((a) => (a.id === existing.id ? updated : a))
            );
          } else {
            toast.error("Failed to update role");
          }
        } else {
          const { data, error } = await addFolderAccess(folder.id, sharableUser.email, role);
          if (data) {
            setAccessList((prev) => [...prev, data]);
            toast.success(`${sharableUser.name} can now ${role} this folder`);
          } else {
            toast.error(error || "Failed to share");
          }
        }
      } finally {
        setPending((p) => ({ ...p, [sharableUser.user_id]: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder.id, accessList]
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">
            Share &ldquo;{folder.name}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Share with your team members and manage their access level.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            People with access
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Owner row */}
              <div className="flex items-center gap-3 px-1 py-2 rounded-lg">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {initials(user?.full_name || user?.email || "O")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.full_name || user?.email}
                  </p>
                  {user?.full_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Owner
                </Badge>
              </div>

              {sharableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-3">
                  No team members yet. Hire talent first to share folders with them.
                </p>
              ) : (
                sharableUsers.map((su) => {
                  const existing = getAccess(su.user_id);
                  const currentRole: FolderRole = existing?.role ?? "none";
                  const isBusy = pending[su.user_id];

                  return (
                    <div
                      key={su.user_id}
                      className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {initials(su.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{su.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {su.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isBusy && (
                          <Loader2 size={12} className="animate-spin text-muted-foreground" />
                        )}
                        <select
                          value={currentRole}
                          disabled={isBusy}
                          onChange={(e) =>
                            handleRoleChange(su, e.target.value as FolderRole)
                          }
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="none">No access</option>
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
