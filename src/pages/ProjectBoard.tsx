import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Calendar, Upload, Link as LinkIcon, FileText, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const projectData = {
  id: "1",
  name: 'Brand Collab - "Future Funk"',
  description: "Music video production and promotional materials for upcoming EP release.",
  teamMembers: [
    { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
    { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
    { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
  ],
};

const initialTasks = [
  {
    id: "1",
    name: "Create storyboard",
    description: "Design initial storyboard for the music video",
    assignee: { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
    status: "completed" as const,
    deadline: "15 Oct 2023",
    createdAt: "01 Oct 2023",
  },
  {
    id: "2",
    name: "Edit first draft",
    description: "Compile and edit first draft of video footage",
    assignee: { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
    status: "in-progress" as const,
    deadline: "20 Oct 2023",
    createdAt: "05 Oct 2023",
  },
  {
    id: "3",
    name: "Design cover art",
    description: "Create album cover artwork variations",
    assignee: { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
    status: "in-progress" as const,
    deadline: "18 Oct 2023",
    createdAt: "08 Oct 2023",
  },
  {
    id: "4",
    name: "Color grading",
    description: "Apply color grading to final video",
    assignee: { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
    status: "planning" as const,
    deadline: "24 Oct 2023",
    createdAt: "10 Oct 2023",
  },
];

type TaskStatus = "planning" | "in-progress" | "completed";

interface ProjectSample {
  id: string;
  name: string;
  type: "file" | "link";
  url?: string;
  description?: string;
}

const initialSamples: ProjectSample[] = [
  { id: "1", name: "Reference Design 1", type: "link", url: "https://example.com/ref1", description: "Similar style to what we want" },
  { id: "2", name: "Brand Guidelines.pdf", type: "file", description: "Our brand colors and fonts" },
];

export default function ProjectBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTalent = user?.userType === 'talent';
  const [tasks, setTasks] = useState(initialTasks);
  const [samples, setSamples] = useState<ProjectSample[]>(initialSamples);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false);
  const [sampleFormData, setSampleFormData] = useState({
    name: "",
    type: "file" as "file" | "link",
    url: "",
    description: "",
  });

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));
    toast.success("Task status updated!");
  };

  const handleCreateTask = () => {
    toast.success("Task created successfully!");
    setIsDialogOpen(false);
  };

  const handleAddSample = () => {
    if (!sampleFormData.name.trim()) {
      toast.error("Please provide a name for the sample");
      return;
    }
    if (sampleFormData.type === "link" && !sampleFormData.url.trim()) {
      toast.error("Please provide a URL for the link");
      return;
    }

    const newSample: ProjectSample = {
      id: Date.now().toString(),
      name: sampleFormData.name,
      type: sampleFormData.type,
      url: sampleFormData.url || undefined,
      description: sampleFormData.description || undefined,
    };

    setSamples([...samples, newSample]);
    toast.success("Sample added successfully!");
    setSampleFormData({ name: "", type: "file", url: "", description: "" });
    setIsSampleDialogOpen(false);
  };

  const handleDeleteSample = (sampleId: string) => {
    setSamples(samples.filter(s => s.id !== sampleId));
    toast.success("Sample removed");
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{projectData.name}</h1>
            <p className="mt-1 text-muted-foreground">{projectData.description}</p>

            {/* Team Avatars */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Team:</span>
              <div className="flex -space-x-2">
                {projectData.teamMembers.map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-card">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task to this project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="taskName">Task Name</Label>
                  <Input id="taskName" placeholder="Enter task name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskDescription">Description</Label>
                  <Textarea id="taskDescription" placeholder="Describe the task" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assign To</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectData.teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" type="date" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>Create Task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Samples - Creator Only */}
        {!isTalent && (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Samples & References</h2>
                <p className="text-sm text-muted-foreground">Add reference materials for your team to follow</p>
              </div>
              <Dialog open={isSampleDialogOpen} onOpenChange={setIsSampleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Sample
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-border/50 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Project Sample</DialogTitle>
                    <DialogDescription>
                      Add a reference file or link for your team to follow
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sampleName">Sample Name</Label>
                      <Input
                        id="sampleName"
                        placeholder="e.g., Reference Design"
                        value={sampleFormData.name}
                        onChange={(e) => setSampleFormData({ ...sampleFormData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={sampleFormData.type}
                        onValueChange={(value: "file" | "link") => setSampleFormData({ ...sampleFormData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="file">File Upload</SelectItem>
                          <SelectItem value="link">Link/URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {sampleFormData.type === "link" && (
                      <div className="space-y-2">
                        <Label htmlFor="sampleUrl">URL</Label>
                        <Input
                          id="sampleUrl"
                          placeholder="https://..."
                          value={sampleFormData.url}
                          onChange={(e) => setSampleFormData({ ...sampleFormData, url: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="sampleDescription">Description (Optional)</Label>
                      <Textarea
                        id="sampleDescription"
                        placeholder="Why is this sample important?"
                        value={sampleFormData.description}
                        onChange={(e) => setSampleFormData({ ...sampleFormData, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsSampleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSample}>Add Sample</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <div key={sample.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {sample.type === "link" ? (
                        <LinkIcon className="h-4 w-4 text-primary" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary" />
                      )}
                      <p className="font-medium text-foreground">{sample.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteSample(sample.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {sample.description && (
                    <p className="text-sm text-muted-foreground mb-2">{sample.description}</p>
                  )}
                  {sample.url && (
                    <a
                      href={sample.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {sample.url}
                    </a>
                  )}
                </div>
              ))}
              {samples.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No samples added yet</p>
                  <p className="text-sm">Add reference materials to help guide your team</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Table */}
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Task</TableHead>
                <TableHead className="text-muted-foreground">Assigned To</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer border-border/30 transition-colors hover:bg-secondary/30"
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                >
                  <TableCell className="text-muted-foreground">{task.createdAt}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {task.assignee.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{task.assignee.name}</span>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.status}
                      onValueChange={(value) => updateTaskStatus(task.id, value as TaskStatus)}
                    >
                      <SelectTrigger className="w-36 border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <StatusBadge status={task.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{task.deadline}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
