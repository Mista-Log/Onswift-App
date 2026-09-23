/**
 * LibraryTable — Explorer-style file table: icon | name | date created | type.
 * Reused by all Document Library tabs. Renders a real <table> on desktop and
 * stacked cards on mobile (a table doesn't fit a phone width). No built-in
 * sort UI — pass already-sorted `items`.
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotebookPen, Table2, MoreVertical, Download, Eye, Trash2, Star, FolderInput, Share2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getFileIconInfo } from "@/lib/fileIcons";
import { useIsMobile } from "@/hooks/use-mobile";

export interface LibraryTableItem {
  id: string;
  kind: "file" | "doc" | "crm";
  name: string;
  fileType?: string;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  tags?: string[];
  isFavorite?: boolean;
}

interface LibraryTableProps<T extends LibraryTableItem> {
  items: T[];
  onOpen: (item: T) => void;
  onDownload?: (item: T) => void;
  canDelete?: (item: T) => boolean;
  onDelete?: (item: T) => void;
  onToggleFavorite?: (item: T) => void;
  onMoveTo?: (item: T) => void;
  onShare?: (item: T) => void;
}

function RowIcon({ item }: { item: LibraryTableItem }) {
  if (item.kind === "doc") {
    return (
      <div className="flex items-center justify-center rounded-lg bg-blue-500/10 flex-shrink-0 h-8 w-8">
        <NotebookPen size={16} className="text-blue-500" />
      </div>
    );
  }
  if (item.kind === "crm") {
    return (
      <div className="flex items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0 h-8 w-8">
        <Table2 size={16} className="text-green-500" />
      </div>
    );
  }
  const { Icon, colorClass } = getFileIconInfo(item.fileType);
  return (
    <div className={cn("flex items-center justify-center rounded-lg flex-shrink-0 h-8 w-8", colorClass)}>
      <Icon size={16} />
    </div>
  );
}

function typeLabel(item: LibraryTableItem) {
  if (item.kind === "doc") return "Docs";
  if (item.kind === "crm") return "CRM Sheet";
  return item.fileType?.split("/")[1]?.toUpperCase() || "File";
}

export function LibraryTable<T extends LibraryTableItem>({
  items, onOpen, onDownload, canDelete, onDelete, onToggleFavorite, onMoveTo, onShare,
}: LibraryTableProps<T>) {
  const isMobile = useIsMobile();

  if (items.length === 0) return null;

  const ActionsMenu = ({ item }: { item: T }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(item); }}>
          <Eye size={13} className="mr-2" /> Open
        </DropdownMenuItem>
        {item.kind === "file" && onDownload && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(item); }}>
            <Download size={13} className="mr-2" /> Download
          </DropdownMenuItem>
        )}
        {onShare && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(item); }}>
            <Share2 size={13} className="mr-2" /> Share
          </DropdownMenuItem>
        )}
        {onToggleFavorite && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}>
            <Star size={13} className={cn("mr-2", item.isFavorite && "fill-current text-amber-500")} />
            {item.isFavorite ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
        )}
        {onMoveTo && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveTo(item); }}>
            <FolderInput size={13} className="mr-2" /> Move to
          </DropdownMenuItem>
        )}
        {onDelete && canDelete?.(item) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            >
              <Trash2 size={13} className="mr-2" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50"
            onClick={() => onOpen(item)}
          >
            <RowIcon item={item} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(item.createdAt), "MMM d, yyyy")} · {typeLabel(item)}
              </p>
            </div>
            <ActionsMenu item={item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <th className="w-11 text-left px-2 py-2" />
          <th className="text-left px-2 py-2">Name</th>
          <th className="text-left px-2 py-2 w-32">Date created</th>
          <th className="text-left px-2 py-2 w-28">Type</th>
          <th className="w-9 px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={`${item.kind}-${item.id}`}
            className="group hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onOpen(item)}
          >
            <td className="px-2 py-2 rounded-l-xl">
              <RowIcon item={item} />
            </td>
            <td className="px-2 py-2 text-sm font-medium text-foreground truncate max-w-0">
              <span className="inline-flex items-center gap-1.5">
                {item.isFavorite && <Star size={11} className="fill-current text-amber-500 flex-shrink-0" />}
                {item.name}
              </span>
            </td>
            <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(item.createdAt), "MMM d, yyyy")}
            </td>
            <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{typeLabel(item)}</td>
            <td className="px-2 py-2 rounded-r-xl opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionsMenu item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
