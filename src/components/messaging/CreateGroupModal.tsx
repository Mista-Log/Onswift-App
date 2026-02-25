import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { secureFetch } from '@/api/apiClient';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated?: () => void;
}

export function CreateGroupModal({ open, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch available team members when modal opens
  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    setIsLoading(true);
    try {
      const response = await secureFetch('/api/v2/groups/available-members/');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      } else {
        toast.error('Failed to load team members');
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setIsCreating(true);
    try {
      const response = await secureFetch('/api/v2/groups/', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          member_ids: selectedMembers,
        }),
      });

      if (response.ok) {
        toast.success(`Group "${groupName}" created successfully!`);
        handleClose();
        onGroupCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedMembers([]);
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Department</DialogTitle>
          <DialogDescription>
            Create a group chat and add your team members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Department Name</Label>
            <Input
              id="group-name"
              placeholder="Enter Department name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {groupName.length}/50 characters
            </p>
          </div>

          {/* Member Search */}
          <div className="space-y-2">
            <Label htmlFor="member-search">Add Members</Label>
            <Input
              id="member-search"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Member List */}
          <ScrollArea className="h-64 rounded-md border border-border">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {teamMembers.length === 0
                    ? 'No team members available. Hire talents first!'
                    : 'No members found'}
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleToggleMember(member.userId)}
                  >
                    <Checkbox
                      checked={selectedMembers.includes(member.userId)}
                      onCheckedChange={() => handleToggleMember(member.userId)}
                    />
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={member.avatar || undefined} alt={member.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedMembers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreateGroup} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
