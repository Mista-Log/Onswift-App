import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessaging } from '@/contexts/MessagingContext';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupInfoModal } from './GroupInfoModal';

export function GroupList() {
  const { groups, activeConversationId, setActiveConversation, getUnreadCount } = useMessaging();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [infoGroup, setInfoGroup] = useState(null);

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes === 0 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-80 border-r border-border/50 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Messages</h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowCreateGroup(true)}
            title="Create new group"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Group/Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'Create a group to get started'}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateGroup(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            )}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const unreadCount = getUnreadCount(group.id);
            const isActive = activeConversationId === group.id;

            return (
              <div
                key={group.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 border-b border-border/30 p-4 transition-colors hover:bg-secondary/50',
                  isActive && 'bg-secondary/50'
                )}
              >
                <div className="relative group">
                  <Avatar className="h-12 w-12 border border-border/50 cursor-pointer"
                    onClick={e => { e.stopPropagation(); setInfoGroup(group); }}
                  >
                    <AvatarImage src={group.avatar} alt={group.name} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {group.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </div>

                <div className="flex-1 overflow-hidden" onClick={() => setActiveConversation(group.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      unreadCount > 0 ? "text-foreground" : "text-foreground/90"
                    )}>
                      {group.name}
                    </span>
                    {group.lastMessage && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(group.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>

                  {group.isGroup && (
                    <p className="text-xs text-muted-foreground">
                      {group.members.length} members
                    </p>
                  )}

                  {group.lastMessage && (
                    <p className={cn(
                      "mt-1 truncate text-sm",
                      unreadCount > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}>
                      {group.lastMessage.senderId === 'me' && 'You: '}
                      {group.lastMessage.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
      {/* Group Info Modal (moved outside main container for stacking) */}
      <GroupInfoModal group={infoGroup} open={!!infoGroup} onClose={() => setInfoGroup(null)} />
    </div>
  );
}
