import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Search, Filter, Loader2 } from "lucide-react";
import { DeliverableCard, Deliverable } from "@/components/team/DeliverableCard";
import { UploadDeliverableModal, DeliverableFormData } from "@/components/team/UploadDeliverableModal";
import { DeliverableDetailModal } from "@/components/team/DeliverableDetailModal";
import { CelebrationModal } from "@/components/CelebrationModal";
import { secureFetch, isNetworkError } from "@/api/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface DeliverablesPanelProps {
  /** When set, scopes the panel to a single project's deliverables. */
  projectId?: string;
  /** When this changes to a task id, the upload modal opens pre-filled for that task. */
  openUploadForTask?: string;
  /** Called once the panel has consumed `openUploadForTask` (so the parent can clear it). */
  onUploadOpened?: () => void;
  /** Hide the four summary stat cards (used inside the compact project tab). */
  hideStats?: boolean;
}

/**
 * Self-contained deliverables experience: fetch, stats, filters, grid, and the
 * upload/detail/celebration modals. Rendered both by the standalone Deliverables
 * page and the Deliverables tab inside a project, so the two stay in sync.
 */
export function DeliverablesPanel({
  projectId,
  openUploadForTask,
  onUploadOpened,
  hideStats,
}: DeliverablesPanelProps) {
  const { user } = useAuth();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [prefillTaskId, setPrefillTaskId] = useState<string | undefined>(undefined);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [celebration, setCelebration] = useState<
    { emoji: string; title: string; description: string } | null
  >(null);

  const isCreator = user?.role === "creator";

  // Open the upload modal pre-filled when the parent hands us a task id
  // (e.g. talent clicking "Add deliverable" on a task card).
  useEffect(() => {
    if (openUploadForTask) {
      setPrefillTaskId(openUploadForTask);
      setUploadModalOpen(true);
      onUploadOpened?.();
    }
  }, [openUploadForTask]);

  useEffect(() => {
    fetchDeliverables();
  }, []);

  // Celebrate a talent the first time they see one of their deliverables approved
  // (approval also auto-completes the task, so this covers that milestone too).
  useEffect(() => {
    if (isCreator) return;
    if (localStorage.getItem("onswift_talent_deliverable_approved")) return;
    if (deliverables.some((d) => d.status === "approved")) {
      localStorage.setItem("onswift_talent_deliverable_approved", "1");
      setCelebration({
        emoji: "🏆",
        title: "Your work got approved!",
        description:
          "Your creator approved your deliverable and the task is done. That's a real win, keep it going!",
      });
    }
    
  }, [deliverables, isCreator]);

  const fetchDeliverables = async () => {
    try {
      setIsLoading(true);
      const response = await secureFetch('/api/v2/deliverables/');
      if (response.ok) {
        const data = await response.json();
        // Map backend data to frontend format
        const mapped = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          projectId: d.project_id,
          projectName: d.project_name,
          taskId: d.task,
          taskName: d.task_name,
          submittedBy: {
            id: d.submitted_by,
            name: d.submitted_by_name,
            avatar: d.submitted_by_avatar,
          },
          files: d.files?.map((f: any) => ({
            name: f.name,
            url: f.url,
            size: f.size,
            type: f.file_type,
          })) || [],
          urls: d.links?.map((l: any) => l.url) || [],
          status: d.status,
          revisionCount: d.revision_count,
          feedback: d.feedback,
          submittedAt: new Date(d.created_at).toLocaleDateString(),
        }));
        setDeliverables(mapped);
      }
    } catch (error) {
      console.error("Error fetching deliverables:", error);
      toast.error("Unable to fetch deliverables now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDeliverable = async (data: DeliverableFormData) => {
    // Captured before the upload so we can celebrate a talent's first-ever submission.
    // Gated on !isLoading so an in-flight initial fetch (e.g. auto-opening the upload
    // modal on navigation) doesn't misfire the celebration for users who already have deliverables.
    const isFirstDeliverable = !isLoading && deliverables.length === 0;
    try {
      const formData = new FormData();
      formData.append("task", data.taskId);
      formData.append("title", data.title);
      formData.append("description", data.description);

      // Safely handle files property if it exists
      const files = (data as any).files as File[] | undefined;
      if (Array.isArray(files)) {
        files.forEach((file) => {
          formData.append("files", file);
        });
      }

      if (Array.isArray(data.urls)) {
        data.urls.forEach((url) => {
          formData.append("urls", url);
        });
      }

      const response = await secureFetch('/api/v2/deliverables/', {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      });

      if (response.ok) {
        toast.success("Deliverable uploaded successfully!");
        setUploadModalOpen(false);
        fetchDeliverables();
        if (
          !isCreator &&
          isFirstDeliverable &&
          !localStorage.getItem("onswift_talent_first_deliverable")
        ) {
          localStorage.setItem("onswift_talent_first_deliverable", "1");
          setCelebration({
            emoji: "🎉",
            title: "First deliverable sent!",
            description:
              "You just shipped your first piece of work on Onswift. Your creator will review it shortly nice momentum!",
          });
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || "Hmm, I'm having trouble uploading your deliverable. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading deliverable:", error);
      if (isNetworkError(error)) {
        toast.warning("Slow connection, your upload may have gone through. Refreshing...");
        setTimeout(fetchDeliverables, 2000);
      } else {
        toast.error("Hmm, I'm having trouble uploading your deliverable. Please try again.");
      }
    }
  };

  const handleReviewDeliverable = async (deliverableId: string, status: "approved" | "revision" | "pending", feedback?: string) => {
    try {
      const response = await secureFetch(`/api/v2/deliverables/${deliverableId}/review/`, {
        method: "PATCH",
        body: JSON.stringify({ status, feedback }),
      });

      if (response.ok) {
        const msg = status === "approved" ? "Deliverable approved!" : status === "pending" ? "Approval reversed." : "Revision requested";
        toast.success(msg);
        setSelectedDeliverable(null);
        fetchDeliverables();
      } else {
        toast.error("Having trouble reviewing your deliverable. Please try again.");
      }
    } catch (error) {
      console.error("Error reviewing deliverable:", error);
      if (isNetworkError(error)) {
        toast.warning("Slow connection your review may have been saved. Refreshing...");
        setTimeout(fetchDeliverables, 2000);
      } else {
        toast.error("We're having trouble reviewing your deliverable. Please try again.");
      }
    }
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    try {
      const response = await secureFetch(`/api/v2/deliverables/${deliverableId}/`, {
        method: "DELETE",
      });

      if (response.ok || response.status === 204) {
        toast.success("Deliverable deleted");
        setSelectedDeliverable(null);
        fetchDeliverables();
      } else {
        toast.error("Unable to delete deliverable. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting deliverable:", error);
      if (isNetworkError(error)) {
        toast.warning("Slow connection, your delete may have gone through. Refreshing...");
        setTimeout(fetchDeliverables, 2000);
      } else {
        toast.error("Unable to delete deliverable. Please try again.");
      }
    }
  };

  // Scope to a single project when requested, then apply search + status filters.
  const scopedDeliverables = projectId
    ? deliverables.filter((d) => d.projectId === projectId)
    : deliverables;

  const filteredDeliverables = scopedDeliverables.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: scopedDeliverables.length,
    pending: scopedDeliverables.filter(d => d.status === "pending").length,
    approved: scopedDeliverables.filter(d => d.status === "approved").length,
    revision: scopedDeliverables.filter(d => d.status === "revision").length,
  };

  return (
    <div className="space-y-6">
      {/* Upload action */}
      <div className="flex justify-end">
        <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Deliverable
        </Button>
      </div>

      {/* Stats */}
      {!hideStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-success">{stats.approved}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Needs Revision</p>
            <p className="text-2xl font-bold text-destructive">{stats.revision}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-3 sm:p-4">
        {/* Mobile: icon buttons + expandable search */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-9 shrink-0 p-0 justify-center [&>svg:last-child]:hidden">
                <Filter className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="revision">Needs Revision</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || statusFilter !== "all") && (
              <span className="text-xs text-muted-foreground ml-1">
                {statusFilter !== "all" ? statusFilter : ""}
                {searchQuery ? `"${searchQuery}"` : ""}
              </span>
            )}
          </div>
          {mobileSearchOpen && (
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search deliverables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>

        {/* Desktop: full row */}
        <div className="hidden sm:flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deliverables by title, project, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="revision">Needs Revision</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deliverables Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDeliverables.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDeliverables.map((deliverable) => (
            <DeliverableCard
              key={deliverable.id}
              deliverable={deliverable}
              onClick={() => setSelectedDeliverable(deliverable)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card py-16 text-center">
          <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery || statusFilter !== "all" ? "No deliverables found" : "No deliverables yet"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : isCreator
                ? "Your team hasn't submitted any deliverables yet"
                : "Upload your first deliverable to get started"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Deliverable
            </Button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <UploadDeliverableModal
        open={uploadModalOpen}
        onOpenChange={(open) => {
          setUploadModalOpen(open);
          if (!open) setPrefillTaskId(undefined);
        }}
        onSubmit={handleUploadDeliverable}
        revisionDeliverables={deliverables}
        prefillTaskId={prefillTaskId}
      />

      {/* Detail Modal */}
      <DeliverableDetailModal
        deliverable={selectedDeliverable}
        open={!!selectedDeliverable}
        onOpenChange={() => setSelectedDeliverable(null)}
        isCreator={isCreator}
        onApprove={isCreator ? (id) => handleReviewDeliverable(id, "approved") : undefined}
        onUnapprove={isCreator ? (id) => handleReviewDeliverable(id, "pending") : undefined}
        onRequestRevision={isCreator ? (id, feedback) => handleReviewDeliverable(id, "revision", feedback) : undefined}
        onResubmit={!isCreator ? (taskId, title, description, urls) => {
          setSelectedDeliverable(null);
          handleUploadDeliverable({ projectId: "", taskId, title, description, urls, mentionedUserIds: [] });
        } : undefined}
        onDelete={handleDeleteDeliverable}
      />

      {/* Talent milestone celebration (first submit / first approval) */}
      <CelebrationModal
        open={!!celebration}
        onClose={() => setCelebration(null)}
        emoji={celebration?.emoji ?? "🎉"}
        title={celebration?.title ?? ""}
        description={celebration?.description ?? ""}
        secondaryLabel="Nice!"
      />
    </div>
  );
}
