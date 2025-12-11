import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Send, FolderKanban, Upload, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeliverableCard, Deliverable } from "@/components/team/DeliverableCard";
import { UploadDeliverableModal, DeliverableFormData } from "@/components/team/UploadDeliverableModal";
import { DeliverableDetailModal } from "@/components/team/DeliverableDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const teamMembers = [
  {
    id: "1",
    name: "Alia Vance",
    role: "Manager",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia",
    hiredDate: "Jan 2023",
    activeProjects: 3,
    lastMessage: "The designs look great!",
    lastMessageTime: "2m ago",
  },
  {
    id: "2",
    name: "Ben Carter",
    role: "Video Editor",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben",
    hiredDate: "Mar 2023",
    activeProjects: 2,
    lastMessage: "I'll have the edits ready by tomorrow.",
    lastMessageTime: "1h ago",
  },
  {
    id: "3",
    name: "Clara Dane",
    role: "Illustrator",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara",
    hiredDate: "Feb 2023",
    activeProjects: 1,
    lastMessage: "Can we discuss the color palette?",
    lastMessageTime: "3h ago",
  },
];

const mockMessages = [
  { id: "1", senderId: "1", content: "Hey! How's the project going?", timestamp: "10:30 AM" },
  { id: "2", senderId: "me", content: "Great! I just finished the initial concepts.", timestamp: "10:32 AM" },
  { id: "3", senderId: "1", content: "The designs look great! Can we add more purple tones?", timestamp: "10:35 AM" },
  { id: "4", senderId: "me", content: "Absolutely, I'll work on that today.", timestamp: "10:36 AM" },
];

const mockDeliverables: Deliverable[] = [
  {
    id: "1",
    title: "Final Logo Design",
    description: "Here's the final logo with all requested changes @Alex",
    projectId: "1",
    projectName: "Brand Collaboration",
    taskId: "t1",
    taskName: "Design mockups",
    submittedBy: {
      id: "1",
      name: "Alia Vance",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia",
    },
    files: [
      { name: "logo_final.png", url: "#", size: 2048576, type: "image/png" },
      { name: "logo_variants.pdf", url: "#", size: 5242880, type: "application/pdf" },
    ],
    status: "pending",
    revisionCount: 1,
    submittedAt: "2 hours ago",
  },
  {
    id: "2",
    title: "Video Edit V2",
    description: "Updated with the new intro and outro @Ben requested",
    projectId: "2",
    projectName: "Content Series",
    taskId: "t3",
    taskName: "Video editing",
    submittedBy: {
      id: "2",
      name: "Ben Carter",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben",
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
    description: "Three different concepts for the thumbnails",
    projectId: "2",
    projectName: "Content Series",
    taskId: "t4",
    taskName: "Thumbnail designs",
    submittedBy: {
      id: "3",
      name: "Clara Dane",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara",
    },
    files: [
      { name: "thumb_1.jpg", url: "#", size: 512000, type: "image/jpeg" },
      { name: "thumb_2.jpg", url: "#", size: 480000, type: "image/jpeg" },
      { name: "thumb_3.jpg", url: "#", size: 495000, type: "image/jpeg" },
    ],
    status: "revision",
    revisionCount: 2,
    submittedAt: "3 days ago",
  },
];

export default function Team() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState(teamMembers[0]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [deliverables, setDeliverables] = useState(mockDeliverables);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Redirect talent users to dashboard
  useEffect(() => {
    if (user?.userType === 'talent') {
      toast.error("This page is only accessible to creators");
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSendMessage = () => {
    if (message.trim()) {
      setMessage("");
    }
  };

  const handleUploadDeliverable = (data: DeliverableFormData) => {
    const newDeliverable: Deliverable = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      projectName: data.projectId === "1" ? "Brand Collaboration" : data.projectId === "2" ? "Content Series" : "Product Launch",
      taskId: data.taskId,
      taskName: "New Task",
      submittedBy: {
        id: "me",
        name: "You",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
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
      d.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Team</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your team and deliverables
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          </TabsList>

          {/* Team Members Tab */}
          <TabsContent value="members" className="m-0">
            <div className="glass-card flex h-[calc(100vh-16rem)] overflow-hidden">
              {/* Team List */}
              <div className="w-80 border-r border-border/50">
                <div className="border-b border-border/50 p-4">
                  <h2 className="font-semibold text-foreground">Team Members</h2>
                </div>

                <div className="overflow-y-auto">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 border-b border-border/30 p-4 transition-colors hover:bg-secondary/50",
                        selectedMember.id === member.id && "bg-secondary/50"
                      )}
                    >
                      <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{member.lastMessageTime}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {member.lastMessage}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex flex-1 flex-col">
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={selectedMember.avatar} alt={selectedMember.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {selectedMember.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedMember.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedMember.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FolderKanban className="h-4 w-4" />
                    <span>{selectedMember.activeProjects} active projects</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    {mockMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.senderId === "me" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-md rounded-2xl px-4 py-2",
                            msg.senderId === "me"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          )}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-xs",
                              msg.senderId === "me"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {msg.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="border-t border-border/50 p-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Type a message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage} className="gap-2">
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Deliverables Tab */}
          <TabsContent value="deliverables" className="m-0 space-y-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search deliverables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="revision">Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setUploadModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Deliverable
              </Button>
            </div>

            {/* Deliverables Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDeliverables.map((deliverable) => (
                <DeliverableCard
                  key={deliverable.id}
                  deliverable={deliverable}
                  onClick={() => setSelectedDeliverable(deliverable)}
                />
              ))}
            </div>

            {filteredDeliverables.length === 0 && (
              <div className="glass-card py-12 text-center">
                <p className="text-muted-foreground">No deliverables found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

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
        />
      </div>
    </MainLayout>
  );
}
