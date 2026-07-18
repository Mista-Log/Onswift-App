import { useMemo, useState } from "react";
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
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  FilePlus,
  MoreHorizontal,
  Trash2,
  Plus,
} from "lucide-react";
import type { DocListItem } from "@/hooks/useDocs";

interface DocTreeProps {
  docs: DocListItem[];
  onNewPage: (parentId?: string) => void;
  onDelete: (id: string) => void;
}

interface DocNodeProps {
  node: DocListItem;
  allDocs: DocListItem[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onNewPage: (parentId?: string) => void;
  onDelete: (id: string) => void;
}

function buildTree(docs: DocListItem[], parentId: string | null): DocListItem[] {
  return docs
    .filter((d) => d.parent === parentId)
    .sort((a, b) => a.order - b.order);
}

function DocNode({ node, allDocs, expandedIds, onToggle, onNewPage, onDelete }: DocNodeProps) {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const children = buildTree(allDocs, node.id);
  const hasChildren = node.children_count > 0 || children.length > 0;
  const expanded = expandedIds.has(node.id);
  const isActive = docId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm cursor-pointer select-none",
          "hover:bg-muted/60 transition-colors",
          isActive ? "bg-muted font-medium text-foreground" : "text-foreground/80"
        )}
        onClick={() => navigate(`/docs/${node.id}`)}
      >
        {/* Expand chevron */}
        <button
          className={cn(
            "flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
            !hasChildren && "invisible"
          )}
          title={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          <ChevronRight
            size={14}
            className={cn("transition-transform", expanded && "rotate-90")}
          />
        </button>

        {/* Icon + title */}
        <span className="flex-shrink-0 h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center text-[13px] leading-none">
          {node.icon || <FileText size={13} className="text-blue-500" />}
        </span>
        <span className="flex-1 truncate">{node.title || "Untitled"}</span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Add sub-page — desktop hover only */}
          <button
            className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Add sub-document"
            onClick={(e) => { e.stopPropagation(); onNewPage(node.id); }}
          >
            <Plus size={14} />
          </button>
          {/* More menu — always visible on mobile, hover-reveal on desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground",
                  "md:invisible md:group-hover:visible"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => onNewPage(node.id)}>
                <FilePlus size={14} className="mr-2" />
                Add sub-document
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

      {/* Children — indented with a branch guide line */}
      {expanded && children.length > 0 && (
        <div className="ml-[15px] border-l border-border/60 pl-1.5">
          {children.map((child) => (
            <DocNode
              key={child.id}
              node={child}
              allDocs={allDocs}
              expandedIds={expandedIds}
              onToggle={onToggle}
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Every doc that has children — the target set for "Expand all".
  const parentIds = useMemo(
    () =>
      new Set(
        docs
          .filter((d) => d.children_count > 0 || docs.some((c) => c.parent === d.id))
          .map((d) => d.id)
      ),
    [docs]
  );
  const anyExpanded = expandedIds.size > 0;

  const toggleNode = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setExpandedIds(anyExpanded ? new Set() : new Set(parentIds));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pl-3 pr-2 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Docs
        </span>
        <div className="flex items-center gap-0.5">
          {parentIds.size > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={anyExpanded ? "Collapse all" : "Expand all"}
              onClick={toggleAll}
            >
              {anyExpanded ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="New page"
            onClick={() => onNewPage()}
          >
            <Plus size={15} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-4">
        {roots.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
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
              expandedIds={expandedIds}
              onToggle={toggleNode}
              onNewPage={onNewPage}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
