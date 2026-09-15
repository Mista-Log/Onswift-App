/**
 * FolderManagerDialog — full folder CRUD for the Document Library: create,
 * rename, delete, and share (per-user viewer/editor access via
 * FolderShareModal). Also used as a folder picker when `onSelectFolder` is
 * passed — clicking a row selects that folder and closes (used both to
 * filter the library view and to choose the destination folder on upload).
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Folder as FolderIcon, Plus, MoreVertical, Pencil, Trash2, Users, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { fetchFolders, createFolder, renameFolder, deleteFolder } from "@/lib/libraryFolders";
import type { LibraryFolder } from "@/types/library";
import { FolderShareModal } from "./FolderShareModal";

interface FolderManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectFolder?: (folder: LibraryFolder) => void;
  /** Called whenever the folder list changes (create/rename/delete), so the
   * parent page can refresh its own cached folder list. */
  onFoldersChanged?: (folders: LibraryFolder[]) => void;
}

export function FolderManagerDialog({ open, onClose, onSelectFolder, onFoldersChanged }: FolderManagerDialogProps) {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sharingFolder, setSharingFolder] = useState<LibraryFolder | null>(null);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open]);

  const load = async () => {
    setLoading(true);
    const data = await fetchFolders();
    setFolders(data);
    onFoldersChanged?.(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { data, error } = await createFolder(name);
    setCreating(false);
    if (data) {
      setNewName("");
      toast.success("Folder created");
      await load();
    } else {
      toast.error(error || "Failed to create folder");
    }
  };

  const startRename = (folder: LibraryFolder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const confirmRename = async (folderId: string) => {
    const name = renameValue.trim();
    if (!name) return;
    const updated = await renameFolder(folderId, name);
    if (updated) {
      toast.success("Folder renamed");
      setRenamingId(null);
      await load();
    } else {
      toast.error("Failed to rename folder");
    }
  };

  const handleDelete = async (folder: LibraryFolder) => {
    if (!confirm(`Delete "${folder.name}"? This also deletes everything inside it.`)) return;
    const ok = await deleteFolder(folder.id);
    if (ok) {
      toast.success("Folder deleted");
      await load();
    } else {
      toast.error("Failed to delete folder");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Folders</DialogTitle>
            <DialogDescription>
              {onSelectFolder ? "Choose a folder, or create a new one." : "Create, rename, delete, and share folders."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="New folder name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              disabled={creating}
            />
            <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No folders yet — create your first one above.
              </p>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <FolderIcon size={16} className="text-muted-foreground flex-shrink-0" />
                  {renamingId === folder.id ? (
                    <>
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmRename(folder.id); if (e.key === "Escape") setRenamingId(null); }}
                        className="h-7 text-sm"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => confirmRename(folder.id)}>
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => setRenamingId(null)}>
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        className="flex-1 min-w-0 text-left text-sm truncate"
                        onClick={() => onSelectFolder ? onSelectFolder(folder) : undefined}
                        disabled={!onSelectFolder}
                      >
                        {folder.name}
                        <span className="text-xs text-muted-foreground ml-1.5">
                          {folder.document_count} {folder.document_count === 1 ? "file" : "files"}
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100">
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startRename(folder)}>
                            <Pencil size={13} className="mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSharingFolder(folder)}>
                            <Users size={13} className="mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(folder)} className="text-destructive focus:text-destructive">
                            <Trash2 size={13} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {sharingFolder && (
        <FolderShareModal
          folder={sharingFolder}
          open={!!sharingFolder}
          onClose={() => setSharingFolder(null)}
        />
      )}
    </>
  );
}
