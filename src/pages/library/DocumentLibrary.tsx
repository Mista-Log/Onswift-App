/**
 * Files — Unified workspace for uploaded files, rich-text docs, and CRM
 * sheets, browsable as real nested folders (Google Drive style): the
 * breadcrumb is the page heading, folder tiles are drop targets, and Home
 * is just the folder with no parent.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import {
  Search,
  Upload,
  Grid3X3,
  List,
  File,
  FileText,
  NotebookPen,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  RotateCcw,
  Loader2,
  X,
  Plus,
  FolderOpen,
  Clock,
  Wrench,
  Table2,
  ArrowUpDown,
  Star,
  FolderInput,
  Share2,
  Menu,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LibraryDocument, LibraryFolder } from "@/types/library";
import { fetchDoc, fetchDocsByFolder, type DocListItem, type DocDetail } from "@/hooks/useDocs";
import { fetchSheetsByFolder, type CRMSheetSummary } from "@/hooks/useCRM";
import { createFolder, renameFolder, deleteFolder } from "@/lib/libraryFolders";
import { useFolderBrowser } from "@/hooks/useFolderBrowser";
import { FolderTileGrid } from "@/components/library/FolderTileGrid";
import { FolderShareModal } from "@/components/library/FolderShareModal";
import { LibraryTable } from "@/components/library/LibraryTable";
import { MoveToDialog } from "@/components/library/MoveToDialog";
import { FileShareModal } from "@/components/library/FileShareModal";
import { CRMShareModal } from "@/components/library/CRMShareModal";
import { DocShareModal } from "@/components/docs/DocShareModal";

// ── Unified item type ─────────────────────────────────────────────────────────

type ItemKind = "file" | "doc" | "crm";

interface UnifiedItem {
  kind: ItemKind;
  id: string;
  name: string;
  icon?: string;
  fileType?: string;
  sizeKb?: number;
  updatedAt: string;
  createdAt: string;
  fileUrl?: string;
  tags?: string[];
  folderId: string | null;
  folderName: string | null;
  isFavorite: boolean;
}

function fileToUnified(d: LibraryDocument): UnifiedItem {
  return {
    kind: "file",
    id: d.id,
    name: d.name,
    fileType: d.file_type,
    sizeKb: d.size_kb,
    updatedAt: d.updated_at,
    createdAt: d.created_at,
    fileUrl: d.file,
    tags: d.tags,
    folderId: d.folder,
    folderName: d.folder_name,
    isFavorite: d.is_favorite,
  };
}

function docToUnified(d: DocListItem): UnifiedItem {
  return {
    kind: "doc",
    id: d.id,
    name: d.title || "Untitled",
    icon: d.icon || undefined,
    updatedAt: d.updated_at,
    createdAt: d.updated_at,
    folderId: d.folder,
    folderName: d.folder_name,
    isFavorite: d.is_favorite,
  };
}

function crmToUnified(s: CRMSheetSummary): UnifiedItem {
  return {
    kind: "crm",
    id: s.id,
    name: s.name,
    fileType: `${s.column_count} col · ${s.row_count} row`,
    updatedAt: s.updated_at,
    createdAt: s.created_at,
    folderId: s.folder,
    folderName: s.folder_name,
    isFavorite: s.is_favorite,
  };
}

// ── File type icon ────────────────────────────────────────────────────────────

function ItemIcon({ item, size = 40 }: { item: UnifiedItem; size?: number }) {
  if (item.kind === "doc") {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-blue-500/10 flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {item.icon || <FileText size={size * 0.5} className="text-blue-500" />}
      </div>
    );
  }

  if (item.kind === "crm") {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-green-500/10 flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Table2 size={size * 0.5} className="text-green-500" />
      </div>
    );
  }

  const type = (item.fileType || "").toLowerCase();
  const isImage = type.startsWith("image/");
  const isPDF = type.includes("pdf");
  const color = isImage
    ? "text-green-500 bg-green-50 dark:bg-green-950/30"
    : isPDF
    ? "text-red-500 bg-red-50 dark:bg-red-950/30"
    : "text-blue-500 bg-blue-50 dark:bg-blue-950/30";

  return (
    <div
      className={cn("flex items-center justify-center rounded-xl flex-shrink-0", color)}
      style={{ width: size, height: size }}
    >
      <FileText size={size * 0.45} />
    </div>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onOpen,
  onDownload,
  onDelete,
  onToggleFavorite,
  onMoveTo,
  onShare,
}: {
  item: UnifiedItem;
  onOpen: (item: UnifiedItem) => void;
  onDownload?: (item: UnifiedItem) => void;
  onDelete?: (item: UnifiedItem) => void;
  onToggleFavorite?: (item: UnifiedItem) => void;
  onMoveTo?: (item: UnifiedItem) => void;
  onShare?: (item: UnifiedItem) => void;
}) {
  return (
    <div
      className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
      onClick={() => onOpen(item)}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={14} />
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
            {onDelete && (
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
      </div>

      <ItemIcon item={item} size={44} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
          {item.isFavorite && <Star size={11} className="fill-current text-amber-500 flex-shrink-0" />}
          {item.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] px-1.5 py-0 font-medium",
            item.kind === "doc" ? "bg-primary/10 text-primary border-0" : ""
          )}
        >
          {item.kind === "doc" ? "Docs" : item.kind === "crm" ? "CRM Sheet" : item.fileType?.split("/")[1]?.toUpperCase() || "File"}
        </Badge>
        {item.tags?.slice(0, 2).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  query,
  tab,
  canUpload,
  onNewDoc,
}: {
  query: string;
  tab: string;
  canUpload: boolean;
  onNewDoc: () => void;
}) {
  if (query) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Search size={40} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No results for "{query}"</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
        {tab === "docs" ? (
          <NotebookPen size={28} className="text-muted-foreground" />
        ) : (
          <FolderOpen size={28} className="text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="font-medium text-foreground">
          {tab === "docs" ? "No pages yet" : "No files yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {tab === "docs"
            ? "Create your first page in the Docs editor"
            : canUpload
            ? "Drag & drop files or click Upload"
            : "No files have been shared with you yet"}
        </p>
      </div>
      {canUpload ? (
        <Button size="sm" onClick={onNewDoc}>
          <Plus size={14} className="mr-1.5" />
          New Files
        </Button>
      ) : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: typeof File;
  label: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon size={15} className="text-muted-foreground" />
        {label}
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function DocumentLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUpload = user?.role === "creator" || user?.role === "talent";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlFolderId = searchParams.get("folder");
  const browser = useFolderBrowser(urlFolderId);
  const didMountFolderSync = useRef(false);

  const [files, setFiles] = useState<UnifiedItem[]>([]);
  const [docs, setDocs] = useState<UnifiedItem[]>([]);
  const [crmSheets, setCrmSheets] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "files" | "docs" | "crm">("all");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [trash, setTrash] = useState<UnifiedItem[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<LibraryFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sharingFolder, setSharingFolder] = useState<LibraryFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<LibraryFolder | null>(null);
  const [sortMethod, setSortMethod] = useState<"date-desc" | "date-asc" | "name-asc" | "name-desc">("date-desc");

  const [movingItem, setMovingItem] = useState<UnifiedItem | null>(null);
  const [shareTarget, setShareTarget] = useState<UnifiedItem | null>(null);
  const [shareDocDetail, setShareDocDetail] = useState<DocDetail | null>(null);

  // Keep the folder-browsing hook in sync with the URL (back/forward, direct
  // links, breadcrumb clicks) — skip the very first run since the hook's own
  // mount effect already loads the initial folder.
  useEffect(() => {
    if (!didMountFolderSync.current) {
      didMountFolderSync.current = true;
      return;
    }
    if (urlFolderId !== browser.currentId) {
      browser.goTo(urlFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFolderId]);

  const navigateToFolder = useCallback((folderId: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (folderId === null) next.delete("folder");
      else next.set("folder", folderId);
      return next;
    });
  }, [setSearchParams]);

  const loadFiles = useCallback(async (folderId: string | null) => {
    try {
      const qs = folderId === null ? "null" : folderId;
      const res = await secureFetch(`/api/v6/documents/?folder_id=${qs}`);
      if (res.ok) {
        const data: LibraryDocument[] = await res.json();
        setFiles(data.map(fileToUnified));
      }
    } catch { /* ignore */ }
  }, []);

  const loadDocs = useCallback(async (folderId: string | null) => {
    const data = await fetchDocsByFolder(folderId);
    setDocs(data.map(docToUnified));
  }, []);

  const loadCRM = useCallback(async (folderId: string | null) => {
    const data = await fetchSheetsByFolder(folderId);
    setCrmSheets(data.map(crmToUnified));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFiles(browser.currentId), loadDocs(browser.currentId), loadCRM(browser.currentId)])
      .finally(() => setLoading(false));
  }, [browser.currentId, loadFiles, loadDocs, loadCRM]);

  // ── Search + favorites filter ───────────────────────────────────────────
  const q = query.toLowerCase();
  const matchesFavorite = (i: UnifiedItem) => !favoritesOnly || i.isFavorite;

  const filteredFiles = files.filter(
    (f) => matchesFavorite(f) && (!q || f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.toLowerCase().includes(q)))
  );
  const filteredDocs = docs.filter((d) => matchesFavorite(d) && (!q || d.name.toLowerCase().includes(q)));
  const filteredCRM = crmSheets.filter((s) => matchesFavorite(s) && (!q || s.name.toLowerCase().includes(q)));

  const sortItems = (items: UnifiedItem[]) => {
    const arr = [...items];
    switch (sortMethod) {
      case "name-asc":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case "date-asc":
        return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "date-desc":
      default:
        return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  };

  const allItems = sortItems([...filteredFiles, ...filteredDocs, ...filteredCRM]);

  const displayItems =
    tab === "files" ? sortItems(filteredFiles) :
    tab === "docs"  ? sortItems(filteredDocs)  :
    tab === "crm"   ? sortItems(filteredCRM)   :
    allItems;

  const currentFolders = q ? browser.subfolders.filter((f) => f.name.toLowerCase().includes(q)) : browser.subfolders;
  const sortedCurrentFolders = [...currentFolders].sort((a, b) => {
    if (sortMethod === "name-asc") return a.name.localeCompare(b.name);
    if (sortMethod === "name-desc") return b.name.localeCompare(a.name);
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortMethod === "date-asc" ? -diff : diff;
  });
  const showFolderTiles = (tab === "all" || tab === "files") && !showTrash && !favoritesOnly;

  // ── Actions ──────────────────────────────────────────────────────────────

  const openItem = (item: UnifiedItem) => {
    if (item.kind === "doc") {
      navigate(`/docs/${item.id}`);
    } else if (item.kind === "crm") {
      navigate("/library/crm");
    } else if (item.fileUrl) {
      window.open(item.fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const downloadItem = (item: UnifiedItem) => {
    if (!item.fileUrl) return;
    const a = document.createElement("a");
    a.href = item.fileUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteItem = async (item: UnifiedItem) => {
    if (item.kind === "crm") {
      navigate("/library/crm");
      return;
    }
    if (item.kind === "doc") {
      const res = await secureFetch(`/api/v8/docs/${item.id}/`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setDocs((prev) => prev.filter((d) => d.id !== item.id));
        toast.success("Page deleted");
      } else {
        toast.error("Failed to delete page");
      }
    } else {
      const res = await secureFetch(`/api/v6/documents/${item.id}/`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== item.id));
        toast.success("Moved to trash");
      } else {
        toast.error("Failed to delete file");
      }
    }
  };

  const toggleFavorite = async (item: UnifiedItem) => {
    const newVal = !item.isFavorite;
    const endpoint =
      item.kind === "file" ? `/api/v6/documents/${item.id}/` :
      item.kind === "doc" ? `/api/v8/docs/${item.id}/` :
      `/api/v7/sheets/${item.id}/`;
    const res = await secureFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: newVal }),
    });
    if (res.ok) {
      const update = (arr: UnifiedItem[]) =>
        arr.map((i) => (i.kind === item.kind && i.id === item.id ? { ...i, isFavorite: newVal } : i));
      if (item.kind === "file") setFiles(update);
      else if (item.kind === "doc") setDocs(update);
      else setCrmSheets(update);
      toast.success(newVal ? "Added to favorites" : "Removed from favorites");
    } else {
      toast.error("Failed to update favorite");
    }
  };

  const handleMoveItem = async (item: UnifiedItem, folderId: string | null): Promise<boolean> => {
    const endpoint =
      item.kind === "file" ? `/api/v6/documents/${item.id}/` :
      item.kind === "doc" ? `/api/v8/docs/${item.id}/` :
      `/api/v7/sheets/${item.id}/`;
    const body = item.kind === "file" ? { folder_id: folderId } : { folder: folderId };
    const res = await secureFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await Promise.all([loadFiles(browser.currentId), loadDocs(browser.currentId), loadCRM(browser.currentId)]);
    }
    return res.ok;
  };

  const handleShare = async (item: UnifiedItem) => {
    if (item.kind === "doc") {
      const detail = await fetchDoc(item.id);
      if (detail) setShareDocDetail(detail);
      else toast.error("Failed to load page");
    } else {
      setShareTarget(item);
    }
  };

  const uploadFilesToFolder = async (arr: File[], folderId: string | null) => {
    setUploading(true);
    let uploaded = 0;

    for (const file of arr) {
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folder_id", folderId);
      try {
        const res = await secureFetch("/api/v6/documents/upload/", {
          method: "POST",
          body: fd,
          headers: {},
        });
        if (res.ok) uploaded++;
        else toast.error(`Failed to upload ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}`);
      await loadFiles(browser.currentId);
    }
    setUploading(false);
  };

  const handleUpload = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    await uploadFilesToFolder(arr, browser.currentId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const handleDropOnFolder = (folder: LibraryFolder, dropped: File[]) => {
    uploadFilesToFolder(dropped, folder.id);
  };

  const newPage = async () => {
    const res = await secureFetch("/api/v8/docs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    if (res.ok) {
      const doc = await res.json();
      navigate(`/docs/${doc.id}`);
    } else {
      toast.error("Failed to create page");
    }
  };

  const loadTrash = async () => {
    try {
      const res = await secureFetch("/api/v6/documents/trash/");
      if (res.ok) {
        const data: LibraryDocument[] = await res.json();
        setTrash(data.map(fileToUnified));
      }
    } catch { /* ignore */ }
  };

  const restoreFile = async (id: string) => {
    const res = await secureFetch(`/api/v6/documents/${id}/restore/`, { method: "POST" });
    if (res.ok) {
      toast.success("Restored");
      setTrash((p) => p.filter((t) => t.id !== id));
      await loadFiles(browser.currentId);
    }
  };

  const permanentDelete = async (id: string) => {
    const res = await secureFetch(`/api/v6/documents/${id}/permanent/`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Permanently deleted");
      setTrash((p) => p.filter((t) => t.id !== id));
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const canDelete = (item: UnifiedItem) =>
    item.kind === "doc" || (item.kind === "file" && canUpload);

  const renderGrid = (items: UnifiedItem[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {items.map((item) => (
        <ItemCard
          key={`${item.kind}-${item.id}`}
          item={item}
          onOpen={openItem}
          onDownload={item.kind === "file" ? downloadItem : undefined}
          onDelete={canDelete(item) ? deleteItem : undefined}
          onToggleFavorite={toggleFavorite}
          onMoveTo={canUpload ? setMovingItem : undefined}
          onShare={handleShare}
        />
      ))}
    </div>
  );

  const viewToggle = (
    <div className="flex items-center border border-border rounded-lg overflow-hidden flex-shrink-0">
      <button
        aria-label="Grid view"
        className={cn("px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors", viewMode === "grid" && "bg-muted text-foreground")}
        onClick={() => setViewMode("grid")}
      >
        <Grid3X3 size={15} />
      </button>
      <button
        aria-label="List view"
        className={cn("px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors border-l border-border", viewMode === "list" && "bg-muted text-foreground")}
        onClick={() => setViewMode("list")}
      >
        <List size={15} />
      </button>
    </div>
  );

  const renderItems = (items: UnifiedItem[]) =>
    viewMode === "grid" ? (
      renderGrid(items)
    ) : (
      <LibraryTable
        items={items}
        onOpen={openItem}
        onDownload={downloadItem}
        canDelete={canDelete}
        onDelete={deleteItem}
        onToggleFavorite={toggleFavorite}
        onMoveTo={canUpload ? (item: UnifiedItem) => setMovingItem(item) : undefined}
        onShare={handleShare}
      />
    );

  // ── Folder actions (apply at whatever level is currently browsed) ────────

  const startRenameFolder = (folder: LibraryFolder) => {
    setRenamingFolder(folder);
    setRenameValue(folder.name);
  };

  const confirmRenameFolder = async () => {
    if (!renamingFolder) return;
    const name = renameValue.trim();
    if (!name) return;
    const updated = await renameFolder(renamingFolder.id, name);
    if (updated) {
      toast.success("Folder renamed");
      setRenamingFolder(null);
      await browser.refresh();
    } else {
      toast.error("Failed to rename folder");
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    const ok = await deleteFolder(deletingFolder.id);
    if (ok) {
      toast.success("Folder deleted");
      setDeletingFolder(null);
      await browser.refresh();
    } else {
      toast.error("Failed to delete folder");
    }
  };

  const handleCreateFolder = async (rawName: string): Promise<boolean> => {
    const name = rawName.trim();
    if (!name) return false;
    setCreatingFolder(true);
    const { data, error } = await createFolder(name, browser.currentId);
    setCreatingFolder(false);
    if (data) {
      toast.success("Folder created");
      await browser.refresh();
      return true;
    }
    toast.error(error || "Failed to create folder");
    return false;
  };

  return (
    <MainLayout>
      <div
        className={cn(
          "flex flex-col gap-5 transition-colors rounded-2xl",
          dragOver && "ring-2 ring-primary/40 bg-primary/5"
        )}
        onDragOver={(e) => { if (canUpload) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canUpload ? handleDrop : undefined}
      >
        {/* Header: breadcrumb heading + actions */}
        <div className="flex items-center justify-between gap-3">
          <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
            <BreadcrumbList className="flex-nowrap">
              {browser.breadcrumb.map((entry, i) => {
                const isLast = i === browser.breadcrumb.length - 1;
                const isParent = i === browser.breadcrumb.length - 2;
                const hiddenOnMobile = !isLast && !isParent;
                return (
                  <span key={entry.id ?? "home"} className={hiddenOnMobile ? "hidden sm:contents" : "contents"}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="truncate max-w-[12rem] sm:max-w-none text-base font-semibold text-foreground">
                          {entry.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button type="button" className="truncate max-w-[8rem] sm:max-w-none" onClick={() => navigateToFolder(entry.id)}>
                            {entry.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator className={isParent ? "" : "hidden sm:list-item"} />}
                  </span>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {showTrash ? (
            <Button variant="outline" size="sm" onClick={() => setShowTrash(false)} className="flex-shrink-0">
              <FolderOpen size={14} className="mr-1.5" />
              Back to Files
            </Button>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                {canUpload && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setShowTrash(true); loadTrash(); }}>
                      <Trash2 size={14} className="mr-1.5" />
                      Trash
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
                      Upload
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => setNewFileModalOpen(true)}>
                  <Plus size={14} className="mr-1.5" />
                  Create
                </Button>
              </div>

              <div className="md:hidden flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
                      <Menu size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {canUpload && (
                      <>
                        <DropdownMenuItem onClick={() => { setShowTrash(true); loadTrash(); }}>
                          <Trash2 size={14} className="mr-2" /> Trash
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                          <Upload size={14} className="mr-2" /> Upload
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setNewFileModalOpen(true)}>
                      <Plus size={14} className="mr-2" /> Create
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>

        {/* Trash view */}
        {showTrash ? (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Trash</h2>
              <p className="text-sm text-muted-foreground">Files are permanently deleted after 30 days.</p>
            </div>
            <div className="divide-y divide-border">
              {trash.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm">Trash is empty</p>
              ) : (
                trash.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                    <p className="flex-1 text-sm font-medium truncate">{item.name}</p>
                    <Button variant="ghost" size="sm" onClick={() => restoreFile(item.id)}>
                      <RotateCcw size={13} className="mr-1.5" />
                      Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => permanentDelete(item.id)}>
                      <Trash2 size={13} className="mr-1.5" />
                      Delete
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Desktop: full search box */}
              <div className="relative hidden sm:block flex-1 min-w-[10rem] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-8 rounded-full h-9 bg-white"
                  placeholder="Search by name or tag…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}>
                    <X size={13} className="text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Mobile: just a lens that opens the search box, kept open while a query is active */}
              {searchOpen || query ? (
                <div className="relative w-full sm:hidden">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9 pr-9 rounded-full h-9 bg-white"
                    placeholder="Search by name or tag…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    aria-label="Close search"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => { setQuery(""); setSearchOpen(false); }}
                  >
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  aria-label="Search"
                  className="sm:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={16} />
                </button>
              )}

              <Button
                variant={favoritesOnly ? "default" : "outline"}
                size="sm"
                className="gap-1.5 flex-shrink-0"
                onClick={() => setFavoritesOnly((v) => !v)}
              >
                <Star size={14} className={favoritesOnly ? "fill-current" : ""} />
                Favorites
              </Button>

              <Select value={sortMethod} onValueChange={(v: typeof sortMethod) => setSortMethod(v)}>
                <SelectTrigger className="w-9 h-9 px-2 flex-shrink-0 [&>span]:hidden">
                  <ArrowUpDown size={14} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest first</SelectItem>
                  <SelectItem value="date-asc">Oldest first</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>

            </div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="bg-muted/50 h-9 gap-1">
                <TabsTrigger value="all" className="text-xs gap-1.5">
                  <Clock size={12} />
                  All
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{allItems.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs gap-1.5">
                  <File size={12} />
                  Files
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{filteredFiles.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="docs" className="text-xs gap-1.5">
                  <NotebookPen size={12} />
                  Docs
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{filteredDocs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="crm" className="text-xs gap-1.5">
                  <Wrench size={12} />
                  CRM
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{filteredCRM.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : displayItems.length === 0 && !(showFolderTiles && sortedCurrentFolders.length > 0) ? (
                <div className="space-y-5">
                  {showFolderTiles && canUpload && !query && (
                    <section className="space-y-3">
                      <SectionHeader icon={FolderOpen} label="Folders" count={0} />
                      <FolderTileGrid
                        folders={[]}
                        onOpen={(f) => navigateToFolder(f.id)}
                        onRename={startRenameFolder}
                        onShare={setSharingFolder}
                        onDelete={setDeletingFolder}
                        onCreateFolder={handleCreateFolder}
                        creatingFolder={creatingFolder}
                      />
                    </section>
                  )}
                  <EmptyState
                    query={query}
                    tab={tab}
                    canUpload={canUpload}
                    onNewDoc={() => setNewFileModalOpen(true)}
                  />
                </div>
              ) : (
                <>
                  <TabsContent value="all" className="mt-4 space-y-8">
                    {showFolderTiles && (
                      <section className="space-y-3">
                        <SectionHeader icon={FolderOpen} label="Folders" count={sortedCurrentFolders.length} />
                        <FolderTileGrid
                          folders={sortedCurrentFolders}
                          onOpen={(f) => navigateToFolder(f.id)}
                          onRename={startRenameFolder}
                          onShare={setSharingFolder}
                          onDelete={setDeletingFolder}
                          onDropFiles={canUpload ? handleDropOnFolder : undefined}
                          onCreateFolder={canUpload && !query ? handleCreateFolder : undefined}
                          creatingFolder={creatingFolder}
                        />
                      </section>
                    )}
                    {allItems.length > 0 && (
                      <section className="space-y-3">
                        <SectionHeader icon={File} label="Files" count={allItems.length}>
                          {viewToggle}
                        </SectionHeader>
                        {renderItems(allItems)}
                      </section>
                    )}
                  </TabsContent>
                  <TabsContent value="files" className="mt-4 space-y-8">
                    {showFolderTiles && (
                      <section className="space-y-3">
                        <SectionHeader icon={FolderOpen} label="Folders" count={sortedCurrentFolders.length} />
                        <FolderTileGrid
                          folders={sortedCurrentFolders}
                          onOpen={(f) => navigateToFolder(f.id)}
                          onRename={startRenameFolder}
                          onShare={setSharingFolder}
                          onDelete={setDeletingFolder}
                          onDropFiles={canUpload ? handleDropOnFolder : undefined}
                          onCreateFolder={canUpload && !query ? handleCreateFolder : undefined}
                          creatingFolder={creatingFolder}
                        />
                      </section>
                    )}
                    {filteredFiles.length > 0 && (
                      <section className="space-y-3">
                        <SectionHeader icon={File} label="Files" count={filteredFiles.length}>
                          {viewToggle}
                        </SectionHeader>
                        {renderItems(sortItems(filteredFiles))}
                      </section>
                    )}
                  </TabsContent>
                  <TabsContent value="docs" className="mt-4">
                    {filteredDocs.length > 0 && (
                      <section className="space-y-3">
                        <SectionHeader icon={NotebookPen} label="Docs" count={filteredDocs.length}>
                          {viewToggle}
                        </SectionHeader>
                        {renderItems(sortItems(filteredDocs))}
                      </section>
                    )}
                  </TabsContent>
                  <TabsContent value="crm" className="mt-4">
                    {filteredCRM.length > 0 && (
                      <section className="space-y-3">
                        <SectionHeader icon={Wrench} label="CRM sheets" count={filteredCRM.length}>
                          {viewToggle}
                        </SectionHeader>
                        {renderItems(sortItems(filteredCRM))}
                      </section>
                    )}
                  </TabsContent>
                </>
              )}
            </Tabs>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* New Files picker modal */}
      <Dialog open={newFileModalOpen} onOpenChange={setNewFileModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Create new file</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={async () => {
                setNewFileModalOpen(false);
                await newPage();
              }}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-muted transition-colors text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText size={22} className="text-blue-500" />
              </div>
              <span className="text-sm font-medium">Docs</span>
            </button>

            <button
              onClick={() => {
                setNewFileModalOpen(false);
                navigate("/library/crm");
              }}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-muted transition-colors text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Table2 size={22} className="text-green-500" />
              </div>
              <span className="text-sm font-medium">Spreadsheet</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder rename */}
      {renamingFolder && (
        <Dialog open onOpenChange={() => setRenamingFolder(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename folder</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmRenameFolder(); }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenamingFolder(null)}>Cancel</Button>
              <Button onClick={confirmRenameFolder}>Rename</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Folder share */}
      {sharingFolder && (
        <FolderShareModal
          folder={sharingFolder}
          open={!!sharingFolder}
          onClose={() => setSharingFolder(null)}
        />
      )}

      {/* Folder delete confirmation */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingFolder?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes everything inside it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to */}
      {movingItem && (
        <MoveToDialog
          open={!!movingItem}
          onClose={() => setMovingItem(null)}
          itemName={movingItem.name}
          currentFolderId={movingItem.folderId}
          onMove={(folderId) => handleMoveItem(movingItem, folderId)}
        />
      )}

      {/* Share */}
      {shareDocDetail && (
        <DocShareModal doc={shareDocDetail} open={!!shareDocDetail} onClose={() => setShareDocDetail(null)} />
      )}
      {shareTarget?.kind === "file" && (
        <FileShareModal fileId={shareTarget.id} fileName={shareTarget.name} open onClose={() => setShareTarget(null)} />
      )}
      {shareTarget?.kind === "crm" && (
        <CRMShareModal sheetId={shareTarget.id} sheetName={shareTarget.name} open onClose={() => setShareTarget(null)} />
      )}

      {/* Drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <Upload size={48} className="mx-auto text-primary mb-3" />
            <p className="text-lg font-semibold text-primary">Drop files to upload</p>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
