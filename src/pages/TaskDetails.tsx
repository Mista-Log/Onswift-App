import { useState } from "react";
import { DeliverableDetailModal } from "@/components/team/DeliverableDetailModal";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Upload, Link as LinkIcon, Check, RotateCcw, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const taskData = {
  id: "1",
  name: "Create storyboard",
  description: "Design initial storyboard for the music video including key scenes, transitions, and visual references.",
  assignee: { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  status: "in-progress" as const,
  deadline: "15 Oct 2023",
  createdAt: "01 Oct 2023",
};

interface Deliverable {
  id: string;
  name: string;
  type: string;
  url?: string;
  submittedAt: string;
  status: "pending" | "approved" | "revision";
  revisionCount: number;
  feedback?: string;
}

const initialDeliverables: Deliverable[] = [
  {
    id: "1",
    name: "storyboard_v1.pdf",
    type: "file",
    submittedAt: "10 Oct 2023",
    status: "revision",
    revisionCount: 1,
    feedback: "Great start! Can we add more detail to scenes 3-5?",
  },
  {
    id: "2",
    name: "Updated scenes reference",
    type: "link",
    url: "https://example.com/scenes",
    submittedAt: "12 Oct 2023",
    status: "pending",
    revisionCount: 0,
  },
];

export default function TaskDetails() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTalent = user?.userType === 'talent';
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const maxRevisions = 3;

  const handleApprove = (deliverableId: string) => {
    setDeliverables(deliverables.map(d =>
      d.id === deliverableId ? { ...d, status: "approved" as const } : d
    ));
    toast.success("Deliverable approved!");
    setIsDetailModalOpen(false);
  };

  const handleRequestRevision = () => {
    // handled in modal
  };

  const openRevisionDialog = (deliverableId: string) => {
    // handled in modal
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{taskData.name}</h1>
              <StatusBadge status={taskData.status} />
            </div>
            <p className="mt-2 text-muted-foreground">{taskData.description}</p>

            {/* Task Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Assigned to:</span>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={taskData.assignee.avatar} alt={taskData.assignee.name} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {taskData.assignee.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground">{taskData.assignee.name}</span>
              </div>
              <div className="text-muted-foreground">
                Deadline: <span className="text-foreground">{taskData.deadline}</span>
              </div>
              <div className="text-muted-foreground">
                Created: <span className="text-foreground">{taskData.createdAt}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("grid gap-6", isTalent ? "lg:grid-cols-1" : "lg:grid-cols-2")}> 
          {/* Upload Section - Talent Only */}
          {isTalent && (
            <section className="glass-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Submit Deliverable</h2>

              <div className="mb-4 rounded-xl border-2 border-dashed border-border/50 p-8 text-center transition-colors hover:border-primary/50">
                <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-foreground">Drag and drop files here</p>
                <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                <Button variant="outline" className="mt-4">
                  Choose File
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-sm text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              <div className="mt-4 space-y-3">
                <Label htmlFor="linkInput">Submit a link</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="linkInput"
                      placeholder="https://..."
                      className="pl-10"
                    />
                  </div>
                  <Button>Submit</Button>
                </div>
              </div>
            </section>
          )}

          {/* Deliverables List */}
          <section className={cn("glass-card p-6", !isTalent && "lg:col-span-2")}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {isTalent ? "My Submissions" : "Submitted Deliverables"}
            </h2>

            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className={cn(
                    "rounded-lg border p-4 cursor-pointer",
                    deliverable.status === "approved"
                      ? "border-success/30 bg-success/5"
                      : deliverable.status === "revision"
                      ? "border-warning/30 bg-warning/5"
                      : "border-border/50 bg-secondary/30"
                  )}
                  onClick={() => {
                    setSelectedDeliverable(deliverable);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {deliverable.type === "link" ? (
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground">{deliverable.name}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Submitted: {deliverable.submittedAt}
                      </p>
                      {deliverable.revisionCount > 0 && (
                        <p className="mt-1 text-sm text-warning">
                          Revision {deliverable.revisionCount} of {maxRevisions}
                        </p>
                      )}
                      {deliverable.feedback && deliverable.status === "revision" && (
                        <p className="mt-2 rounded bg-secondary/50 p-2 text-sm text-muted-foreground">
                          Feedback: {deliverable.feedback}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={deliverable.status} />
                  </div>
                </div>
                      {/* Deliverable Detail Modal */}
                      <DeliverableDetailModal
                        deliverable={selectedDeliverable}
                        open={isDetailModalOpen && !!selectedDeliverable}
                        onOpenChange={(open) => {
                          setIsDetailModalOpen(open);
                          if (!open) setSelectedDeliverable(null);
                        }}
                        isCreator={!isTalent}
                        onApprove={handleApprove}
                        onRequestRevision={(id, feedback) => {
                          setDeliverables(deliverables.map(d =>
                            d.id === id
                              ? { ...d, status: "revision" as const, revisionCount: d.revisionCount + 1, feedback }
                              : d
                          ));
                          toast.success("Revision requested!");
                          setIsDetailModalOpen(false);
                          setSelectedDeliverable(null);
                        }}
                      />
              ))}
            </div>
          </section>
        </div>

        {/* Revision Dialog */}
        <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
          <DialogContent className="glass-card border-border/50 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request Revision</DialogTitle>
              <DialogDescription>
                Provide feedback for the revision request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="feedback">Revision Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Describe what needs to be changed..."
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRevisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="warning" onClick={handleRequestRevision}>
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
