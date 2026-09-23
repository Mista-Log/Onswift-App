/**
 * FolderTileGrid — Explorer-style folder tiles (icon + name), used by the
 * Library main page at every level. Each tile is also a drop target: files
 * dragged from the desktop straight onto a tile upload into that folder.
 */
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Folder as FolderIcon, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryFolder } from "@/types/library";

interface FolderTileGridProps {
  folders: LibraryFolder[];
  onOpen: (folder: LibraryFolder) => void;
  onRename: (folder: LibraryFolder) => void;
  onShare: (folder: LibraryFolder) => void;
  onDelete: (folder: LibraryFolder) => void;
  /** Files dropped directly onto this folder tile. */
  onDropFiles?: (folder: LibraryFolder, files: File[]) => void;
}

export function FolderTileGrid({ folders, onOpen, onRename, onShare, onDelete, onDropFiles }: FolderTileGridProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (folders.length === 0) return null;

  const itemCount = (folder: LibraryFolder) =>
    folder.document_count + folder.doc_count + folder.crm_count;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={cn(
            "group relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all",
            dragOverId === folder.id && "ring-2 ring-primary/50 bg-primary/5"
          )}
          onClick={() => onOpen(folder)}
          onDragOver={(e) => {
            if (!onDropFiles) return;
            e.preventDefault();
            e.stopPropagation();
            setDragOverId(folder.id);
          }}
          onDragLeave={(e) => {
            if (!onDropFiles) return;
            e.stopPropagation();
            setDragOverId((id) => (id === folder.id ? null : id));
          }}
          onDrop={(e) => {
            if (!onDropFiles) return;
            e.preventDefault();
            e.stopPropagation();
            setDragOverId(null);
            if (e.dataTransfer.files.length) {
              onDropFiles(folder, Array.from(e.dataTransfer.files));
            }
          }}
        >
          <div className="flex items-center justify-center rounded-xl bg-amber-500/10 flex-shrink-0 h-10 w-10">
            <FolderIcon size={20} className="text-amber-500" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{folder.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {folder.subfolder_count > 0 ? `${folder.subfolder_count} folder${folder.subfolder_count === 1 ? "" : "s"}, ` : ""}
              {itemCount(folder)} {itemCount(folder) === 1 ? "item" : "items"}
            </p>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(folder); }}>
                  <Pencil size={13} className="mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(folder); }}>
                  <Users size={13} className="mr-2" /> Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                >
                  <Trash2 size={13} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}
