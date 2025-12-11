import { useState } from "react";
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
import { Upload, Search, Filter } from "lucide-react";
import { DeliverableCard, Deliverable } from "@/components/team/DeliverableCard";
import { UploadDeliverableModal, DeliverableFormData } from "@/components/team/UploadDeliverableModal";
import { DeliverableDetailModal } from "@/components/team/DeliverableDetailModal";

const mockDeliverables: Deliverable[] = [
  {
    id: "1",
    title: "Final Logo Design",
    description: "Here's the final logo with all requested changes for Brand Collab project",
    projectId: "1",
    projectName: "Brand Collaboration",
    taskId: "t1",
    taskName: "Design mockups",
    submittedBy: {
      id: "me",
      name: "You",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
    },
    files: [
      { name: "logo_final.png", url: "#", size: 2048576, type: "image/png" },
      { name: "logo_variants.pdf", url: "#", size: 5242880, type: "application/pdf" },
    ],
    status: "pending",
    revisionCount: 0,
    submittedAt: "2 hours ago",
  },
  {
    id: "2",
    title: "Video Edit V2",
    description: "Updated with the new intro and outro as requested",
    projectId: "2",
    projectName: "Content Series",
    taskId: "t3",
    taskName: "Video editing",
    submittedBy: {
      id: "me",
      name: "You",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
    },
    files: [
      { name: "video_edit_v2.mp4", url: "#", size: 104857600, type: "video/mp4" },
    ],
    status: "approved",
    revisionCount: 0,
    submittedAt: "1 day ago",
  },
  {
    id: "3",
    title: "Thumbnail Concepts",
    description: "Three different concepts for the video thumbnails",
    projectId: "2",
    projectName: "Content Series",
    taskId: "t4",
    taskName: "Thumbnail designs",
    submittedBy: {
      id: "me",
      name: "You",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
    },
    files: [
      { name: "thumb_1.jpg", url: "#", size: 512000, type: "image/jpeg" },
      { name: "thumb_2.jpg", url: "#", size: 480000, type: "image/jpeg" },
      { name: "thumb_3.jpg", url: "#", size: 495000, type: "image/jpeg" },
    ],
    status: "revision",
    revisionCount: 1,
    feedback: "Looks good! Can we try a warmer color palette for thumbnail 2?",
    submittedAt: "3 days ago",
  },
];

export default function Deliverables() {
  const [deliverables, setDeliverables] = useState(mockDeliverables);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleUploadDeliverable = (data: DeliverableFormData) => {
    const newDeliverable: Deliverable = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      projectName: data.projectId === "1" ? "Brand Collaboration" : data.projectId === "2" ? "Content Series" : "Product Launch",
      taskId: data.taskId,
      taskName: "Task Name",
      submittedBy: {
        id: "me",
        name: "You",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
      },
      files: data.files.map((f) => ({
        name: f.name,
        url: "#",
        size: f.size,
        type: f.type,
      })),
      status: "pending",
      revisionCount: 0,
      submittedAt: "Just now",
    };
    setDeliverables((prev) => [newDeliverable, ...prev]);
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
            <h1 className="text-3xl font-bold text-foreground">My Deliverables</h1>
            <p className="mt-1 text-muted-foreground">
              Upload and track your work submissions
            </p>
          </div>
          <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Deliverable
          </Button>
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
        {filteredDeliverables.length > 0 ? (
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
          onOpenChange={setUploadModalOpen}
          onSubmit={handleUploadDeliverable}
        />

        {/* Detail Modal */}
        <DeliverableDetailModal
          deliverable={selectedDeliverable}
          open={!!selectedDeliverable}
          onOpenChange={() => setSelectedDeliverable(null)}
          isCreator={false}
        />
      </div>
    </MainLayout>
  );
}
