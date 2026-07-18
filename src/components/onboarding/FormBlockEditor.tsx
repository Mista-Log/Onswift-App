/**
 * FormBlockEditor — Tally-style inline block editor for the Onboarding Form Builder.
 * Blocks render roughly as clients will see them and are edited in place:
 * hover a block for its controls, drag the grip to reorder, "+" inserts a block.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  GripVertical,
  Plus,
  Trash2,
  Type,
  AlignLeft,
  ListChecks,
  Upload,
  CheckSquare,
  MessageSquare,
  Settings2,
  Circle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WelcomeRichText } from "@/components/onboarding/WelcomeRichText";
import type { FormBlock, BlockType } from "@/types/onboarding";

const BLOCK_TYPES: { value: BlockType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "welcome", label: "Welcome / Intro", description: "Intro text your client reads first", icon: <MessageSquare className="h-4 w-4" /> },
  { value: "short_answer", label: "Short Answer", description: "Single-line text answer", icon: <Type className="h-4 w-4" /> },
  { value: "long_answer", label: "Long Answer", description: "Paragraph text answer", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "multiple_choice", label: "Multiple Choice", description: "Pick one from a list", icon: <ListChecks className="h-4 w-4" /> },
  { value: "file_upload", label: "File Upload", description: "Client uploads a file", icon: <Upload className="h-4 w-4" /> },
  { value: "checkbox", label: "Terms / Checkbox", description: "A box the client must tick", icon: <CheckSquare className="h-4 w-4" /> },
];

const inlineInput =
  "w-full bg-transparent border-0 outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/40";

interface FormBlockEditorProps {
  blocks: FormBlock[];
  onChange: (blocks: FormBlock[]) => void;
}

/**
 * Borderless textarea that wraps and grows with its content, so long questions
 * stay fully visible instead of scrolling off to the left like an <input>.
 * `singleLine` blocks Enter (labels/options shouldn't contain newlines).
 */
function AutoGrowTextarea({
  singleLine,
  className,
  value,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { singleLine?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onKeyDown={singleLine ? (e) => { if (e.key === "Enter") e.preventDefault(); } : undefined}
      className={cn(inlineInput, "resize-none overflow-hidden", className)}
      {...props}
    />
  );
}

/** Popover menu listing block types; used by every "+" trigger. */
function InsertMenu({ onSelect, children }: { onSelect: (type: BlockType) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.value}
            type="button"
            onClick={() => { onSelect(bt.value); setOpen(false); }}
            className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted transition-colors"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
              {bt.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{bt.label}</span>
              <span className="block text-xs text-muted-foreground truncate">{bt.description}</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function FormBlockEditor({ blocks, onChange }: FormBlockEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const newBlock = (type: BlockType): FormBlock => ({
    id: crypto.randomUUID(),
    type,
    label: "",
    content: type === "welcome" ? "" : undefined,
    required: type !== "welcome",
    options: type === "multiple_choice" ? ["", ""] : undefined,
    placeholder: "",
  });

  const insertBlock = (type: BlockType, at: number) => {
    const updated = [...blocks];
    updated.splice(at, 0, newBlock(type));
    onChange(updated);
  };

  const updateBlock = (index: number, updates: Partial<FormBlock>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  // Live-reorder while dragging: entering another block swaps the dragged one into place.
  const handleDragEnter = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...blocks];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    onChange(updated);
    setDragIndex(index);
  };

  const updateOption = (blockIndex: number, optIndex: number, value: string) => {
    const opts = [...(blocks[blockIndex].options ?? [])];
    opts[optIndex] = value;
    updateBlock(blockIndex, { options: opts });
  };

  const addOption = (blockIndex: number) => {
    const opts = blocks[blockIndex].options ?? [];
    updateBlock(blockIndex, { options: [...opts, ""] });
  };

  const removeOption = (blockIndex: number, optIndex: number) => {
    const opts = blocks[blockIndex].options ?? [];
    if (opts.length <= 1) return;
    updateBlock(blockIndex, { options: opts.filter((_, i) => i !== optIndex) });
  };

  return (
    <div>
      {blocks.map((block, index) => {
        const hasSettings = block.type !== "welcome";
        const hasPlaceholder = block.type === "short_answer" || block.type === "long_answer";
        return (
          <div
            key={block.id ?? index}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "group relative flex gap-1 rounded-lg py-2.5 -mx-2 px-2 transition-colors",
              dragIndex === index ? "bg-muted/70" : "hover:bg-muted/40",
            )}
          >
            {/* Left gutter — grip + insert, visible on hover */}
            <div className="flex w-12 shrink-0 items-start justify-end gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <InsertMenu onSelect={(type) => insertBlock(type, index + 1)}>
                <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Insert block below">
                  <Plus className="h-4 w-4" />
                </button>
              </InsertMenu>
              <button
                type="button"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Block body — edited inline */}
            <div className="min-w-0 flex-1">
              {block.type === "welcome" ? (
                <WelcomeRichText
                  content={block.content || ""}
                  onChange={(html) => updateBlock(index, { content: html })}
                  mentionItems={blocks
                    .filter((b) => b.type !== "welcome" && b.id && b.label?.trim())
                    .map((b) => ({ id: b.id!, label: b.label! }))}
                />
              ) : (
                <div className="flex items-start gap-1">
                  <AutoGrowTextarea
                    singleLine
                    value={block.label || ""}
                    onChange={(e) => updateBlock(index, { label: e.target.value })}
                    placeholder="Type your question…"
                    className="text-base font-medium"
                  />
                  {block.required && <span className="text-destructive mt-0.5">*</span>}
                </div>
              )}

              {/* Answer-area preview per type */}
              {block.type === "short_answer" && (
                <div className="mt-2 h-9 max-w-sm rounded-md border border-border/60 bg-muted/40 px-3 flex items-center text-sm text-muted-foreground/60">
                  {block.placeholder || "Short answer"}
                </div>
              )}
              {block.type === "long_answer" && (
                <div className="mt-2 h-20 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground/60">
                  {block.placeholder || "Long answer"}
                </div>
              )}
              {block.type === "multiple_choice" && (
                <div className="mt-2 space-y-1.5">
                  {block.options?.map((opt, optIndex) => (
                    <div key={optIndex} className="group/opt flex items-start gap-2.5">
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50 mt-0.5" />
                      <AutoGrowTextarea
                        singleLine
                        value={opt}
                        onChange={(e) => updateOption(index, optIndex, e.target.value)}
                        placeholder={`Option ${optIndex + 1}`}
                        className="text-sm"
                      />
                      {(block.options?.length ?? 0) > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index, optIndex)}
                          className="rounded p-0.5 text-muted-foreground/50 opacity-0 group-hover/opt:opacity-100 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(index)}
                    className="flex items-center gap-2.5 text-sm text-muted-foreground/60 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add option
                  </button>
                </div>
              )}
              {block.type === "file_upload" && (
                <div className="mt-2 flex h-16 max-w-sm items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground/60">
                  <Upload className="h-4 w-4" /> Client uploads a file
                </div>
              )}
              {block.type === "checkbox" && (
                <div className="mt-2 flex items-center gap-2.5 text-sm text-muted-foreground/60">
                  <span className="h-4 w-4 shrink-0 rounded-sm border border-border" />
                  Client ticks this box to agree
                </div>
              )}
            </div>

            {/* Right controls — settings + delete, visible on hover */}
            <div className="flex shrink-0 items-start gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {hasSettings && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Block settings">
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-4" align="end">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Required</Label>
                      <Switch
                        checked={block.required ?? false}
                        onCheckedChange={(checked) => updateBlock(index, { required: checked })}
                      />
                    </div>
                    {hasPlaceholder && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">Placeholder</Label>
                        <Input
                          value={block.placeholder || ""}
                          onChange={(e) => updateBlock(index, { placeholder: e.target.value })}
                          placeholder="Optional placeholder…"
                          className="h-8"
                        />
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              <button
                type="button"
                onClick={() => removeBlock(index)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                title="Delete block"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Add block — always available at the bottom */}
      <div className="mt-1 pl-11">
        <InsertMenu onSelect={(type) => insertBlock(type, blocks.length)}>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
            <Plus className="h-4 w-4" />
            {blocks.length === 0 ? "Click to add your first block" : "Add block"}
          </Button>
        </InsertMenu>
      </div>
    </div>
  );
}
