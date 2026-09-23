/**
 * MoveToDialog — compact folder picker for the "Move to" item action.
 * Reuses useFolderBrowser (same breadcrumb/subfolder navigation as the main
 * Library page) plus an inline "create folder" action.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Folder as FolderIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useFolderBrowser } from "@/hooks/useFolderBrowser";
import { createFolder } from "@/lib/libraryFolders";

interface MoveToDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  currentFolderId: string | null;
  onMove: (folderId: string | null) => Promise<boolean>;
}

export function MoveToDialog({ open, onClose, itemName, currentFolderId, onMove }: MoveToDialogProps) {
  const browser = useFolderBrowser(currentFolderId);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);

  const handleCreateFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { data, error } = await createFolder(name, browser.currentId);
    setCreating(false);
    if (data) {
      setNewName("");
      await browser.refresh();
    } else {
      toast.error(error || "Failed to create folder");
    }
  };

  const handleMoveHere = async () => {
    setMoving(true);
    const ok = await onMove(browser.currentId);
    setMoving(false);
    if (ok) {
      toast.success(`Moved "${itemName}"`);
      onClose();
    } else {
      toast.error("Failed to move");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">Move "{itemName}"</DialogTitle>
        </DialogHeader>

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap overflow-x-auto">
            {browser.breadcrumb.map((entry, i) => {
              const isLast = i === browser.breadcrumb.length - 1;
              return (
                <span key={entry.id ?? "home"} className="contents">
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="truncate max-w-[10rem]">{entry.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button type="button" className="truncate max-w-[8rem]" onClick={() => browser.goToBreadcrumb(i)}>
                          {entry.name}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex gap-2">
          <Input
            placeholder="New folder name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            disabled={creating}
          />
          <Button size="sm" variant="outline" onClick={handleCreateFolder} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {browser.loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : browser.subfolders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No subfolders here</p>
          ) : (
            <div className="flex flex-col gap-1">
              {browser.subfolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                  onClick={() => browser.openFolder(folder)}
                >
                  <FolderIcon size={16} className="text-amber-500 flex-shrink-0" />
                  <span className="text-sm truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMoveHere} disabled={moving || browser.currentId === currentFolderId}>
            {moving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
