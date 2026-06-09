import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, File, FilePlus, MoreHorizontal, Trash2, Plus } from "lucide-react";
import type { DocListItem } from "@/hooks/useDocs";

interface DocTreeProps {
  docs: DocListItem[];
  onNewPage: (parentId?: string) => void;
  onDelete: (id: string) => void;
}

interface DocNodeProps {
  node: DocListItem;
  allDocs: DocListItem[];
  depth: number;
  onNewPage: (parentId?: string) => void;
  onDelete: (id: string) => void;
}

function buildTree(docs: DocListItem[], parentId: string | null): DocListItem[] {
  return docs
    .filter((d) => d.parent === parentId)
    .sort((a, b) => a.order - b.order);
}

function DocNode({ node, allDocs, depth, onNewPage, onDelete }: DocNodeProps) {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const children = buildTree(allDocs, node.id);
  const hasChildren = node.children_count > 0 || children.length > 0;
  const isActive = docId === node.id;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  }, []);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer select-none",
          "hover:bg-muted/60 transition-colors",
          isActive && "bg-muted font-medium text-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => navigate(`/docs/${node.id}`)}
      >
        {/* Expand chevron */}
        <button
          className={cn(
            "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground",
            !hasChildren && "invisible"
          )}
          onClick={toggle}
        >
          <ChevronRight
            size={12}
            className={cn("transition-transform", expanded && "rotate-90")}
          />
        </button>

        {/* Icon + title */}
        <span className="flex-shrink-0 w-4 text-center text-xs leading-none">
          {node.icon || <File size={13} className="text-muted-foreground" />}
        </span>
        <span className="flex-1 truncate text-muted-foreground group-[.active]:text-foreground">
          {node.title || "Untitled"}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Add sub-page — desktop hover only */}
          <button
            className="hidden group-hover:flex w-5 h-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Add sub-page"
            onClick={(e) => { e.stopPropagation(); onNewPage(node.id); }}
          >
            <Plus size={12} />
          </button>
          {/* More menu — always visible on mobile, hover-reveal on desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground",
                  "md:invisible md:group-hover:visible"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => onNewPage(node.id)}>
                <FilePlus size={14} className="mr-2" />
                Add sub-page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(node.id)}
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <DocNode
              key={child.id}
              node={child}
              allDocs={allDocs}
              depth={depth + 1}
              onNewPage={onNewPage}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocTree({ docs, onNewPage, onDelete }: DocTreeProps) {
  const roots = buildTree(docs, null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pages
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="New page"
          onClick={() => onNewPage()}
        >
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {roots.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            No pages yet.
            <br />
            <button
              className="underline underline-offset-2 hover:text-foreground mt-1"
              onClick={() => onNewPage()}
            >
              Create your first page
            </button>
          </p>
        ) : (
          roots.map((node) => (
            <DocNode
              key={node.id}
              node={node}
              allDocs={docs}
              depth={0}
              onNewPage={onNewPage}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
