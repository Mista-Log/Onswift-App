import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const creators = [
  {
    id: "1",
    name: "Alex Johnson",
    company: "Creative Studio",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    lastMessage: "Thanks for the update on the project!",
    lastMessageTime: "10m ago",
    unreadCount: 2,
  },
  {
    id: "2",
    name: "Jordan Smith",
    company: "Digital Agency",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
    lastMessage: "The designs look perfect!",
    lastMessageTime: "1h ago",
    unreadCount: 0,
  },
  {
    id: "3",
    name: "Taylor Chen",
    company: "Brand Co",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor",
    lastMessage: "Can we schedule a call?",
    lastMessageTime: "3h ago",
    unreadCount: 1,
  },
];

const mockMessages = [
  { id: "1", senderId: "1", content: "Hey! How's the logo design coming along?", timestamp: "2:30 PM" },
  { id: "2", senderId: "me", content: "Great progress! I've finished the first three variations.", timestamp: "2:35 PM" },
  { id: "3", senderId: "1", content: "Awesome! Can't wait to see them.", timestamp: "2:36 PM" },
  { id: "4", senderId: "me", content: "I'll upload them to the deliverables section shortly.", timestamp: "2:38 PM" },
  { id: "5", senderId: "1", content: "Thanks for the update on the project!", timestamp: "2:40 PM" },
];

export default function Messages() {
  const { user } = useAuth();
  const [selectedCreator, setSelectedCreator] = useState(creators[0]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log("Sending message:", message);
      setMessage("");
    }
  };

  const filteredCreators = creators.filter(creator =>
    creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="animate-fade-in h-[calc(100vh-8rem)]">
        <div className="glass-card h-full overflow-hidden">
          <div className="grid h-full md:grid-cols-[320px_1fr]">
            {/* Creator List */}
            <div className="border-r border-border/50">
              <div className="border-b border-border/50 p-4">
                <h2 className="mb-3 text-lg font-semibold text-foreground">Messages</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search creators..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-y-auto" style={{ height: 'calc(100% - 120px)' }}>
                {filteredCreators.map((creator) => (
                  <button
                    key={creator.id}
                    onClick={() => setSelectedCreator(creator)}
                    className={cn(
                      "w-full border-b border-border/30 p-4 text-left transition-colors hover:bg-secondary/50",
                      selectedCreator.id === creator.id && "bg-secondary/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={creator.avatar} alt={creator.name} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {creator.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-foreground truncate">{creator.name}</p>
                          <span className="text-xs text-muted-foreground">{creator.lastMessageTime}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{creator.company}</p>
                        <p className="text-sm text-muted-foreground truncate">{creator.lastMessage}</p>
                      </div>
                      {creator.unreadCount > 0 && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                          {creator.unreadCount}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-border/50 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedCreator.avatar} alt={selectedCreator.name} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {selectedCreator.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedCreator.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCreator.company}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        msg.senderId === "me"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
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

              {/* Message Input */}
              <div className="border-t border-border/50 p-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
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
