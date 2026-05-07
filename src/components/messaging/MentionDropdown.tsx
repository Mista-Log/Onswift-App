import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface MentionMember {
  id: string;
  name: string;
  avatar: string | null;
  role?: string;
}

interface MentionDropdownProps {
  members: MentionMember[];
  searchQuery: string;
  onSelect: (member: MentionMember) => void;
  onClose?: () => void;
  position?: { top: number; left: number };
  selectedIndex: number;
  visible?: boolean;
}

export function MentionDropdown({
  members,
  searchQuery,
  onSelect,
  onClose,
  position,
  selectedIndex,
  visible = true,
}: MentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter members based on search query (text after @)
  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close on click outside
  useEffect(() => {
    if (!onClose) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    if (!onClose) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!visible || filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-64 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg bottom-full left-0 mb-2"
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Members
        </div>
        {filteredMembers.map((member, index) => (
          <button
            key={member.id}
            onClick={() => onSelect(member)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
              index === selectedIndex && "bg-accent"
            )}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.avatar || undefined} alt={member.name} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {member.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {member.name}
              </p>
              {member.role && (
                <p className="text-xs text-muted-foreground truncate">
                  {member.role}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
