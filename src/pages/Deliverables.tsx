import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Deliverables() {
  const { user } = useAuth();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isCreator = user?.role === "creator";

  useEffect(() => {
    fetchDeliverables();
  }, []);

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
          status: d.status,
          revisionCount: d.revision_count,
          feedback: d.feedback,
          submittedAt: new Date(d.created_at).toLocaleDateString(),
        }));
        setDeliverables(mapped);
      }
    } catch (error) {
      console.error("Error fetching deliverables:", error);
      toast.error("Failed to load deliverables");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDeliverable = async (data: DeliverableFormData) => {
    try {
      const formData = new FormData();
      formData.append("task", data.taskId);
      formData.append("title", data.title);
      formData.append("description", data.description);

      data.files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await secureFetch('/api/v2/deliverables/', {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      });

      if (response.ok) {
        toast.success("Deliverable uploaded successfully!");
        setUploadModalOpen(false);
        fetchDeliverables();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to upload deliverable");
      }
    } catch (error) {
      console.error("Error uploading deliverable:", error);
      toast.error("Failed to upload deliverable");
    }
  };

  const handleReviewDeliverable = async (deliverableId: string, status: "approved" | "revision", feedback?: string) => {
    try {
      const response = await secureFetch(`/api/v2/deliverables/${deliverableId}/review/`, {
        method: "PATCH",
        body: JSON.stringify({ status, feedback }),
      });

      if (response.ok) {
        toast.success(status === "approved" ? "Deliverable approved!" : "Revision requested");
        setSelectedDeliverable(null);
        fetchDeliverables();
      } else {
        toast.error("Failed to review deliverable");
      }
    } catch (error) {
      console.error("Error reviewing deliverable:", error);
      toast.error("Failed to review deliverable");
    }
  };

  const filteredDeliverables = deliverables.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: deliverables.length,
    pending: deliverables.filter(d => d.status === "pending").length,
    approved: deliverables.filter(d => d.status === "approved").length,
    revision: deliverables.filter(d => d.status === "revision").length,
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isCreator ? "Team Deliverables" : "My Deliverables"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isCreator ? "Review and manage work submissions from your team" : "Upload and track your work submissions"}
            </p>
          </div>
          {!isCreator && (
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Deliverable
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
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

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
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
              <SelectTrigger className="w-full sm:w-48">
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
            {!searchQuery && statusFilter === "all" && !isCreator && (
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
          onOpenChange={setUploadModalOpen}
          onSubmit={handleUploadDeliverable}
        />

        {/* Detail Modal */}
        <DeliverableDetailModal
          deliverable={selectedDeliverable}
          open={!!selectedDeliverable}
          onOpenChange={() => setSelectedDeliverable(null)}
          isCreator={isCreator}
          onApprove={isCreator ? (id) => handleReviewDeliverable(id, "approved") : undefined}
          onRequestRevision={isCreator ? (id, feedback) => handleReviewDeliverable(id, "revision", feedback) : undefined}
        />
      </div>
    </MainLayout>
  );
}
