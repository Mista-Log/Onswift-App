import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
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


export default function Team() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState(teamMembers[0]);
  const [message, setMessage] = useState("");

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

        {/* Team Members */}
        <div className="space-y-6">

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
        </div>
      </div>
    </MainLayout>
  );
}
