import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMessaging } from '@/contexts/MessagingContext';
import { mockTalents } from '@/data/mockMessaging';
import { Group } from '@/types/messaging';
import { Crown, LogOut, Plus, Save, Trash2, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface GroupInfoModalProps {
  group: Group | null;
  open: boolean;
  onClose: () => void;
}

export function GroupInfoModal({ group, open, onClose }: GroupInfoModalProps) {
  const {
    updateGroup,
    deleteGroup,
    leaveGroup,
    addMembersToGroup,
    removeMemberFromGroup,
    currentUserId,
    isUserAdmin,
  } = useMessaging();

  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  if (!group) return null;

  const isAdmin = isUserAdmin(group.id, currentUserId);
  const isCreator = group.creatorId === currentUserId;

  // Get available talents not in the group
  const availableTalents = mockTalents.filter(
    (talent) => !group.members.some((m) => m.userId === talent.userId)
  );

  const handleStartEdit = () => {
    setGroupName(group.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!groupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    updateGroup(group.id, { name: groupName.trim() });
    toast.success('Group name updated');
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setGroupName('');
    setIsEditing(false);
  };

  const handleDeleteGroup = () => {
    deleteGroup(group.id);
    toast.success('Group deleted');
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleLeaveGroup = () => {
    leaveGroup(group.id);
    toast.success('Left the group');
    setShowLeaveConfirm(false);
    onClose();
  };

  const handleRemoveMember = (memberId: string) => {
    removeMemberFromGroup(group.id, memberId);
    toast.success('Member removed from group');
  };

  const handleAddMembers = () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    addMembersToGroup(group.id, selectedMembers);
    toast.success(`${selectedMembers.length} member(s) added to group`);
    setSelectedMembers([]);
    setShowAddMembers(false);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {group.isGroup ? 'Group Info' : 'Contact Info'}
            </DialogTitle>
            <DialogDescription>
              {group.isGroup ? 'Manage group settings and members' : 'View contact details'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Group Avatar & Name */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={group.avatar} alt={group.name} />
                  <AvatarFallback className="bg-primary/20 text-2xl text-primary">
                    {group.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {isEditing ? (
                  <div className="flex w-full items-center gap-2">
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name"
                      maxLength={50}
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-foreground">{group.name}</h3>
                    {isAdmin && group.isGroup && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleStartEdit}
                        className="mt-1"
                      >
                        Edit name
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {group.isGroup && (
                <>
                  <Separator />

                  {/* Members Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">
                        Members ({group.members.length})
                      </Label>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddMembers(true)}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50"
                        >
                          <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarImage src={member.avatar} alt={member.name} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {member.name}
                                {member.userId === currentUserId && ' (You)'}
                              </p>
                              {member.isAdmin && (
                                <Badge variant="secondary" className="gap-1">
                                  <Crown className="h-3 w-3" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                          </div>

                          {isAdmin && member.userId !== currentUserId && member.userId !== group.creatorId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveMember(member.userId)}
                            >
                              <UserMinus className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-2">
                    {!isCreator && (
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-destructive hover:text-destructive"
                        onClick={() => setShowLeaveConfirm(true)}
                      >
                        <LogOut className="h-4 w-4" />
                        Leave Group
                      </Button>
                    )}

                    {isCreator && (
                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Group
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={showAddMembers} onOpenChange={setShowAddMembers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
            <DialogDescription>Select members to add to the group</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-64 rounded-md border border-border">
            <div className="p-4 space-y-3">
              {availableTalents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available talents to add
                </p>
              ) : (
                availableTalents.map((talent) => (
                  <div
                    key={talent.userId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50 cursor-pointer"
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
                      <p className="text-sm font-medium text-foreground">{talent.name}</p>
                      <p className="text-xs text-muted-foreground">{talent.role}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddMembers(false);
              setSelectedMembers([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddMembers}>
              Add {selectedMembers.length > 0 && `(${selectedMembers.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Group Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer receive messages from this group. You can be re-added by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
