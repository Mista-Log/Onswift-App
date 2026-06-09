/**
 * Files — Unified workspace for uploaded files and rich-text docs.
 * Think Google Drive: all roles see what belongs to them, search by content,
 * upload files (creator/talent), navigate to docs editor pages.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { LibraryDocument } from "@/types/library";
import type { DocListItem } from "@/hooks/useDocs";

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
  folderName?: string;
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
    folderName: d.folder_name,
  };
}

function docToUnified(d: DocListItem): UnifiedItem {
  return {
    kind: "doc",
    id: d.id,
    name: d.title || "Untitled",
    icon: d.icon || "📄",
    updatedAt: d.updated_at,
    createdAt: d.updated_at,
  };
}

interface CRMSheetSummary {
  id: string;
  name: string;
  column_count: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

function crmToUnified(s: CRMSheetSummary): UnifiedItem {
  return {
    kind: "crm",
    id: s.id,
    name: s.name,
    fileType: `${s.column_count} col · ${s.row_count} row`,
    updatedAt: s.updated_at,
    createdAt: s.created_at,
  };
}

// ── File type icon ────────────────────────────────────────────────────────────

function ItemIcon({ item, size = 40 }: { item: UnifiedItem; size?: number }) {
  if (item.kind === "doc") {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {item.icon}
      </div>
    );
  }

  if (item.kind === "crm") {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-500 flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Wrench size={size * 0.45} />
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
}: {
  item: UnifiedItem;
  onOpen: (item: UnifiedItem) => void;
  onDownload?: (item: UnifiedItem) => void;
  onDelete?: (item: UnifiedItem) => void;
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
        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
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
          {item.kind === "doc" ? "Page" : item.kind === "crm" ? "CRM Sheet" : item.fileType?.split("/")[1]?.toUpperCase() || "File"}
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

// ── List row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onOpen,
  onDownload,
  onDelete,
}: {
  item: UnifiedItem;
  onOpen: (item: UnifiedItem) => void;
  onDownload?: (item: UnifiedItem) => void;
  onDelete?: (item: UnifiedItem) => void;
}) {
  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50"
      onClick={() => onOpen(item)}
    >
      <ItemIcon item={item} size={36} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {item.kind === "doc" ? "Page" : item.kind === "crm" ? "CRM Sheet" : item.fileType || "File"}
          {item.folderName ? ` · ${item.folderName}` : ""}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-1.5">
        {item.tags?.slice(0, 2).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>

      <p className="hidden md:block text-xs text-muted-foreground flex-shrink-0 w-28 text-right">
        {format(new Date(item.updatedAt), "MMM d, yyyy")}
      </p>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  query,
  tab,
  canUpload,
  onUpload,
  onNewDoc,
}: {
  query: string;
  tab: string;
  canUpload: boolean;
  onUpload: () => void;
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

export default function DocumentLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUpload = user?.role === "creator" || user?.role === "talent";

  const [files, setFiles] = useState<UnifiedItem[]>([]);
  const [docs, setDocs] = useState<UnifiedItem[]>([]);
  const [crmSheets, setCrmSheets] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [tab, setTab] = useState<"all" | "files" | "docs" | "crm">("all");
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState<UnifiedItem[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      const res = await secureFetch("/api/v6/documents/");
      if (res.ok) {
        const data: LibraryDocument[] = await res.json();
        setFiles(data.map(fileToUnified));
      }
    } catch { /* ignore */ }
  }, []);

  const loadDocs = useCallback(async () => {
    try {
      const res = await secureFetch("/api/v8/docs/?all=1");
      if (res.ok) {
        const data: DocListItem[] = await res.json();
        setDocs(data.map(docToUnified));
      }
    } catch { /* ignore */ }
  }, []);

  const loadCRM = useCallback(async () => {
    try {
      const res = await secureFetch("/api/v7/sheets/");
      if (res.ok) {
        const data: CRMSheetSummary[] = await res.json();
        setCrmSheets(data.map(crmToUnified));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadFiles(), loadDocs(), loadCRM()]).finally(() => setLoading(false));
  }, [loadFiles, loadDocs, loadCRM]);

  // ── Search filter ────────────────────────────────────────────────────────
  const q = query.toLowerCase();

  const filteredFiles = q
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.tags?.some((t) => t.toLowerCase().includes(q))
      )
    : files;

  const filteredDocs = q
    ? docs.filter((d) => d.name.toLowerCase().includes(q))
    : docs;

  const filteredCRM = q
    ? crmSheets.filter((s) => s.name.toLowerCase().includes(q))
    : crmSheets;

  const allItems = [...filteredFiles, ...filteredDocs, ...filteredCRM].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const displayItems =
    tab === "files" ? filteredFiles :
    tab === "docs"  ? filteredDocs  :
    tab === "crm"   ? filteredCRM   :
    allItems;

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

  const handleUpload = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;

    setUploading(true);
    let uploaded = 0;
    let folderId: string | null = null;

    try {
      const res = await secureFetch("/api/v6/folders/");
      if (res.ok) {
        const folders = await res.json();
        if (folders.length > 0) folderId = folders[0].id;
      }
    } catch { /* ignore */ }

    if (!folderId) {
      toast.error("No folder found — create a folder in the legacy Files section first");
      setUploading(false);
      return;
    }

    for (const file of arr) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder_id", folderId);
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
      await loadFiles();
    }
    setUploading(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
      await loadFiles();
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
        />
      ))}
    </div>
  );

  const renderList = (items: UnifiedItem[]) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="w-9 flex-shrink-0" />
        <span className="flex-1">Name</span>
        <span className="hidden md:block w-28 text-right">Modified</span>
        <div className="w-7 flex-shrink-0" />
      </div>
      {items.map((item) => (
        <ItemRow
          key={`${item.kind}-${item.id}`}
          item={item}
          onOpen={openItem}
          onDownload={item.kind === "file" ? downloadItem : undefined}
          onDelete={canDelete(item) ? deleteItem : undefined}
        />
      ))}
    </div>
  );

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Files</h1>
            <p className="text-sm text-muted-foreground">
              {files.length + docs.length + crmSheets.length} item{files.length + docs.length + crmSheets.length !== 1 ? "s" : ""} · pages, uploads, CRM sheets, and shared documents
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showTrash ? (
              <Button variant="outline" size="sm" onClick={() => setShowTrash(false)}>
                <FolderOpen size={14} className="mr-1.5" />
                Back to Files
              </Button>
            ) : (
              <>
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
                  New Files
                </Button>
              </>
            )}
          </div>
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
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-8 rounded-full h-9 bg-secondary/50"
                  placeholder="Filter by name or tag…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}>
                    <X size={13} className="text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  className={cn("px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors", viewMode === "grid" && "bg-muted text-foreground")}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 size={15} />
                </button>
                <button
                  className={cn("px-2.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors border-l border-border", viewMode === "list" && "bg-muted text-foreground")}
                  onClick={() => setViewMode("list")}
                >
                  <List size={15} />
                </button>
              </div>
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
                  Pages
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
              ) : displayItems.length === 0 ? (
                <EmptyState
                  query={query}
                  tab={tab}
                  canUpload={canUpload}
                  onUpload={() => fileInputRef.current?.click()}
                  onNewDoc={() => setNewFileModalOpen(true)}
                />
              ) : (
                <>
                  <TabsContent value="all" className="mt-4">
                    {viewMode === "grid" ? renderGrid(allItems) : renderList(allItems)}
                  </TabsContent>
                  <TabsContent value="files" className="mt-4">
                    {viewMode === "grid" ? renderGrid(filteredFiles) : renderList(filteredFiles)}
                  </TabsContent>
                  <TabsContent value="docs" className="mt-4">
                    {viewMode === "grid" ? renderGrid(filteredDocs) : renderList(filteredDocs)}
                  </TabsContent>
                  <TabsContent value="crm" className="mt-4">
                    {viewMode === "grid" ? renderGrid(filteredCRM) : renderList(filteredCRM)}
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
          <div className="grid grid-cols-2 gap-3 pt-2">
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
