import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { DocTree } from "@/components/docs/DocTree";
import { DocEditor } from "@/components/docs/DocEditor";
import { useDocs, fetchDoc } from "@/hooks/useDocs";
import type { DocDetail } from "@/hooks/useDocs";
import { toast } from "sonner";
import { FileText, Loader2, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DocsPage() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const { docs, loading: treeLoading, fetchAll, createDoc, deleteDoc } = useDocs();

  const [activeDoc, setActiveDoc] = useState<DocDetail | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close mobile drawer whenever active doc changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [docId]);

  useEffect(() => {
    if (!docId) {
      setActiveDoc(null);
      return;
    }
    let cancelled = false;
    setDocLoading(true);
    fetchDoc(docId).then((doc) => {
      if (!cancelled) {
        setActiveDoc(doc);
        setDocLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [docId]);

  const handleNewPage = useCallback(
    async (parentId?: string) => {
      const doc = await createDoc({ parent: parentId ?? null });
      if (doc) {
        navigate(`/docs/${doc.id}`);
      } else {
        toast.error("Failed to create page");
      }
    },
    [createDoc, navigate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteDoc(id);
      if (ok) {
        toast.success("Page deleted");
        if (docId === id) navigate("/docs");
      } else {
        toast.error("Failed to delete page");
      }
    },
    [deleteDoc, docId, navigate]
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setActiveDoc((prev) => prev ? { ...prev, title: newTitle } : prev);
    },
    []
  );

  // Refresh sidebar tree periodically so title updates propagate
  useEffect(() => {
    const interval = setInterval(() => {
      if (docId) fetchAll();
    }, 10000);
    return () => clearInterval(interval);
  }, [docId, fetchAll]);

  return (
    <MainLayout>
      <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border bg-background">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — absolute drawer on mobile, in-flow panel on desktop */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-sidebar overflow-hidden",
            "transition-transform duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:relative md:z-auto md:w-60 md:flex-shrink-0 md:translate-x-0 md:transition-none"
          )}
        >
          {treeLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DocTree
              docs={docs}
              onNewPage={handleNewPage}
              onDelete={handleDelete}
            />
          )}
        </aside>

        {/* Editor area */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {docLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : activeDoc ? (
            <DocEditor
              key={activeDoc.id}
              doc={activeDoc}
              onTitleChange={handleTitleChange}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />
          ) : (
            <EmptyState
              onNewPage={() => handleNewPage()}
              onOpenSidebar={() => setSidebarOpen(true)}
            />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

function EmptyState({
  onNewPage,
  onOpenSidebar,
}: {
  onNewPage: () => void;
  onOpenSidebar: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-8">
      

      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center",
        "bg-muted/60"
      )}>
        <FileText size={32} className="text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">No page selected</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          Select a page from the sidebar or create your first one to get started.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onNewPage}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          )}
        >
          New page
        </button>

        <button
          onClick={onOpenSidebar}
          className="md:hidden flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <PanelLeft size={16} />
          Browse pages
        </button>
      </div>

      


    </div>
  );
}

