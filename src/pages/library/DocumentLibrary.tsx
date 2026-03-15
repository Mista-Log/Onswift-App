/**
 * DocumentLibrary — Creator-facing digital document library with:
 * - Folder tree sidebar
 * - Document grid / list view
 * - Drag-and-drop upload
 * - Search (name + tags)
 * - View and download actions
 * - Document info panel
 * - Trash view
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  File,
  FileText,
  Upload,
  Search,
  MoreVertical,
  Trash2,
  RotateCcw,
  Info,
  Grid3X3,
  List,
  X,
  Loader2,
  Download,
  Tag,
  Eye,
  Edit,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import type {
  LibraryFolder,
  LibraryDocument,
  DocumentActivity,
  ColorLabel,
  COLOR_LABELS,
} from "@/types/library";

// Color label options
const colorLabels: { value: ColorLabel; label: string; color: string }[] = [
  { value: "red", label: "Red", color: "bg-red-500" },
  { value: "orange", label: "Orange", color: "bg-orange-500" },
  { value: "yellow", label: "Yellow", color: "bg-yellow-500" },
  { value: "green", label: "Green", color: "bg-green-500" },
  { value: "blue", label: "Blue", color: "bg-blue-500" },
  { value: "purple", label: "Purple", color: "bg-purple-500" },
];

export default function DocumentLibrary() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LibraryDocument[] | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashDocuments, setTrashDocuments] = useState<LibraryDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [infoDoc, setInfoDoc] = useState<LibraryDocument | null>(null);
  const [docActivity, setDocActivity] = useState<DocumentActivity[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [editDoc, setEditDoc] = useState<LibraryDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editColor, setEditColor] = useState<string>("");

  // Load initial data
  useEffect(() => {
    loadFolders();
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadFolderContents(selectedFolder);
    } else {
      loadDocuments();
    }
  }, [selectedFolder]);

  const loadFolders = async () => {
    try {
      const response = await secureFetch("/api/v6/folders/");
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch {
      toast.error("Failed to load folders");
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await secureFetch("/api/v6/documents/");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const loadFolderContents = async (folderId: string) => {
    setLoading(true);
    try {
      const response = await secureFetch(`/api/v6/folders/${folderId}/`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch {
      toast.error("Failed to load folder contents");
    } finally {
      setLoading(false);
    }
  };

  // ---- Search ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const response = await secureFetch(`/api/v6/search/?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch {
      toast.error("Search failed");
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // ---- Upload ----
  const handleUpload = async (files: FileList | File[]) => {
    if (!files.length) return;
    if (!selectedFolder) {
      toast.error("Select a folder before uploading files");
      return;
    }

    setUploading(true);

    const fileArray = Array.from(files);
    let uploaded = 0;

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder_id", selectedFolder);

        const response = await secureFetch("/api/v6/documents/upload/", {
          method: "POST",
          body: formData,
          headers: {},
        });

        if (response.ok) {
          uploaded++;
        } else {
          const error = await response.json();
          toast.error(`Failed to upload ${file.name}: ${error?.detail || "Error"}`);
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}`);
      loadFolderContents(selectedFolder);
    }
    setUploading(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
    },
    [selectedFolder]
  );

  // ---- Folder CRUD ----
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const body: any = { name: newFolderName.trim() };
      if (selectedFolder) body.parent_folder_id = selectedFolder;

      const response = await secureFetch("/api/v6/folders/create/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success("Folder created");
        setNewFolderName("");
        setCreateFolderOpen(false);
        loadFolders();
      } else {
        toast.error("Failed to create folder");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // ---- Document actions ----
  const deleteDocument = async (docId: string) => {
    try {
      const response = await secureFetch(`/api/v6/documents/${docId}/`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Moved to trash");
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const updateDocument = async () => {
    if (!editDoc) return;
    try {
      const body: any = { name: editName };
      if (editTags.trim()) body.tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      if (editColor) body.color_label = editColor;
      else body.color_label = null;

      const response = await secureFetch(`/api/v6/documents/${editDoc.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const updated = await response.json();
        setDocuments((prev) => prev.map((d) => (d.id === editDoc.id ? updated : d)));
        setEditDoc(null);
        toast.success("Document updated");
      }
    } catch {
      toast.error("Failed to update");
    }
  };

  const viewDocument = (doc: LibraryDocument) => {
    if (!doc.file) {
      toast.error("File is not available");
      return;
    }
    window.open(doc.file, "_blank", "noopener,noreferrer");
  };

  const downloadDocument = (doc: LibraryDocument) => {
    if (!doc.file) {
      toast.error("File is not available");
      return;
    }

    const link = document.createElement("a");
    link.href = doc.file;
    link.download = doc.name || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- Info ----
  const openInfoDialog = async (doc: LibraryDocument) => {
    setInfoDoc(doc);
    setLoadingInfo(true);
    try {
      const response = await secureFetch(`/api/v6/documents/${doc.id}/activity/`);
      if (response.ok) {
        setDocActivity(await response.json());
      } else {
        setDocActivity([]);
      }
    } catch {
      setDocActivity([]);
      toast.error("Failed to load document info");
    } finally {
      setLoadingInfo(false);
    }
  };

  // ---- Trash ----
  const loadTrash = async () => {
    try {
      const response = await secureFetch("/api/v6/documents/trash/");
      if (response.ok) {
        setTrashDocuments(await response.json());
      }
    } catch {
      toast.error("Failed to load trash");
    }
  };

  const restoreDocument = async (docId: string) => {
    try {
      const response = await secureFetch(`/api/v6/documents/${docId}/restore/`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Document restored");
        setTrashDocuments((prev) => prev.filter((d) => d.id !== docId));
        loadDocuments();
      }
    } catch {
      toast.error("Failed to restore");
    }
  };

  const permanentDelete = async (docId: string) => {
    try {
      const response = await secureFetch(`/api/v6/documents/${docId}/permanent/`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Permanently deleted");
        setTrashDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ---- Folder tree helpers ----
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderFolderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = folders.filter((f) => f.parent_folder === parentId);
    if (!children.length) return null;

    return children.map((folder) => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolder === folder.id;
      const hasChildren = folders.some((f) => f.parent_folder === folder.id);

      return (
        <div key={folder.id}>
          <button
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              isSelected && "bg-accent font-medium"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              setSelectedFolder(folder.id);
              if (hasChildren) toggleFolder(folder.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
          </button>
          {isExpanded && renderFolderTree(folder.id, depth + 1)}
        </div>
      );
    });
  };

  // Document display list
  const displayDocs = searchResults !== null ? searchResults : documents;

  return (
    <MainLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Document Library</h1>
            <p className="text-sm text-muted-foreground">
              Organize and manage your documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showTrash ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowTrash(!showTrash);
                if (!showTrash) loadTrash();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Trash
            </Button>
            <Button size="sm" onClick={() => setCreateFolderOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />
              New Folder
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
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
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search documents by name or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={clearSearch}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Trash view */}
        {showTrash ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trash</CardTitle>
              <CardDescription>
                Documents in trash are kept for 30 days before permanent deletion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trashDocuments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Trash is empty</p>
              ) : (
                <div className="space-y-2">
                  {trashDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Deleted {doc.deleted_at && format(new Date(doc.deleted_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => restoreDocument(doc.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => permanentDelete(doc.id)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4">
            {/* Folder sidebar */}
            <div className="hidden md:block w-56 shrink-0">
              <Card>
                <CardContent className="p-3">
                  <button
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors mb-1",
                      selectedFolder === null && "bg-accent font-medium"
                    )}
                    onClick={() => setSelectedFolder(null)}
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    All Documents
                  </button>
                  <Separator className="my-1" />
                  {renderFolderTree()}
                  {folders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No folders yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Document area */}
            <div
              className={cn(
                "flex-1 min-w-0 rounded-lg border-2 border-dashed p-4 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-transparent"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {uploading && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/5 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : displayDocs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">
                    {searchResults !== null ? "No documents found" : "No documents yet"}
                  </p>
                  <p className="text-sm">
                    {searchResults !== null
                      ? "Try a different search term"
                      : "Drag & drop files here, or click Upload"}
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {displayDocs.map((doc) => (
                    <Card
                      key={doc.id}
                      className="group cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {doc.color_label && (
                              <span
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full",
                                  `bg-${doc.color_label}-500`
                                )}
                              />
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => viewDocument(doc)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openInfoDialog(doc)}>
                                <Info className="h-4 w-4 mr-2" />
                                Info
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setEditDoc(doc);
                                setEditName(doc.name);
                                setEditTags(doc.tags?.join(", ") || "");
                                setEditColor(doc.color_label || "");
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteDocument(doc.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Move to Trash
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                          <p className="text-sm font-medium truncate w-full">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {doc.file_type || "Document"} · {format(new Date(doc.updated_at), "MMM d")}
                          </p>
                        </div>
                        {doc.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {doc.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {doc.tags.length > 2 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                +{doc.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                // List view
                <div className="space-y-1">
                  {displayDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {doc.color_label && (
                          <span className={cn("h-2.5 w-2.5 rounded-full", `bg-${doc.color_label}-500`)} />
                        )}
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{doc.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_type || "Document"} · {format(new Date(doc.updated_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      {doc.tags?.length > 0 && (
                        <div className="hidden sm:flex gap-1">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewDocument(doc)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openInfoDialog(doc)}>
                            <Info className="h-4 w-4 mr-2" />
                            Info
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setEditDoc(doc);
                            setEditName(doc.name);
                            setEditTags(doc.tags?.join(", ") || "");
                            setEditColor(doc.color_label || "");
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteDocument(doc.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Move to Trash
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(open) => !open && setEditDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="design, branding, v2"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
            <div>
              <Label>Color Label</Label>
              <div className="flex gap-2 mt-2">
                <button
                  className={cn(
                    "h-6 w-6 rounded-full border-2",
                    !editColor ? "border-primary" : "border-transparent",
                    "bg-gray-200"
                  )}
                  onClick={() => setEditColor("")}
                  title="None"
                />
                {colorLabels.map((c) => (
                  <button
                    key={c.value}
                    className={cn(
                      "h-6 w-6 rounded-full border-2",
                      editColor === c.value ? "border-primary" : "border-transparent",
                      c.color
                    )}
                    onClick={() => setEditColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>
              Cancel
            </Button>
            <Button onClick={updateDocument}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={!!infoDoc} onOpenChange={(open) => !open && setInfoDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Info — {infoDoc?.name}</DialogTitle>
            <DialogDescription>Details and activity for this document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-72 overflow-y-auto">
            <div className="rounded-md border p-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">File Type</span>
                <span>{infoDoc?.file_type || "Unknown"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Size</span>
                <span>{Math.round(infoDoc?.size_kb || 0)} KB</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Folder</span>
                <span>{infoDoc?.folder_name || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Updated</span>
                <span>{infoDoc?.updated_at ? format(new Date(infoDoc.updated_at), "MMM d, yyyy h:mm a") : "—"}</span>
              </div>
            </div>

            {loadingInfo ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : docActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-2">No activity yet</p>
            ) : (
              docActivity.slice(0, 8).map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 rounded border">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.actor_name} · {format(new Date(activity.timestamp), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
