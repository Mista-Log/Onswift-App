import { useState } from 'react';
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
import { useMessaging } from '@/contexts/MessagingContext';
import { mockTalents } from '@/data/mockMessaging';
import { toast } from 'sonner';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ open, onClose }: CreateGroupModalProps) {
  const { createGroup } = useMessaging();
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTalents = mockTalents.filter(
    (talent) =>
      talent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      talent.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    createGroup(groupName.trim(), selectedMembers);
    toast.success(`Group "${groupName}" created successfully!`);

    // Reset and close
    setGroupName('');
    setSelectedMembers([]);
    setSearchQuery('');
    onClose();
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
              placeholder="Search talents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Member List */}
          <ScrollArea className="h-64 rounded-md border border-border">
            <div className="p-4 space-y-3">
              {filteredTalents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No talents found
                </p>
              ) : (
                filteredTalents.map((talent) => (
                  <div
                    key={talent.userId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleToggleMember(talent.userId)}
                  >
                    <Checkbox
                      checked={selectedMembers.includes(talent.userId)}
                      onCheckedChange={() => handleToggleMember(talent.userId)}
                    />
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={talent.avatar} alt={talent.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {talent.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {talent.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {talent.role}
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
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateGroup}>Create Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
