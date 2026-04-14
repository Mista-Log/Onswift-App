/**
 * FormBlockEditor — Reusable block editor for the Onboarding Form Builder.
 * Allows adding, editing, reordering, and removing form blocks.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import type { FormBlock, BlockType } from "@/types/onboarding";

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode }[] = [
  { value: "welcome", label: "Welcome / Intro", icon: <MessageSquare className="h-4 w-4" /> },
  { value: "short_answer", label: "Short Answer", icon: <Type className="h-4 w-4" /> },
  { value: "long_answer", label: "Long Answer", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "multiple_choice", label: "Multiple Choice", icon: <ListChecks className="h-4 w-4" /> },
  { value: "file_upload", label: "File Upload", icon: <Upload className="h-4 w-4" /> },
  { value: "checkbox", label: "Terms / Checkbox", icon: <CheckSquare className="h-4 w-4" /> },
];

interface FormBlockEditorProps {
  blocks: FormBlock[];
  onChange: (blocks: FormBlock[]) => void;
}

export function FormBlockEditor({ blocks, onChange }: FormBlockEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const addBlock = (type: BlockType) => {
    const newBlock: FormBlock = {
      type,
      label: type === "welcome" ? "" : "",
      content: type === "welcome" ? "<p>Welcome!</p>" : undefined,
      required: type !== "welcome",
      options: type === "multiple_choice" ? ["Option 1", "Option 2"] : undefined,
      placeholder: "",
    };
    onChange([...blocks, newBlock]);
    setExpandedIndex(blocks.length);
  };

  const updateBlock = (index: number, updates: Partial<FormBlock>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
    setExpandedIndex(null);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
    setExpandedIndex(newIndex);
  };

  const addOption = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block.options) return;
    updateBlock(blockIndex, {
      options: [...block.options, `Option ${block.options.length + 1}`],
    });
  };

  const updateOption = (blockIndex: number, optIndex: number, value: string) => {
    const block = blocks[blockIndex];
    if (!block.options) return;
    const opts = [...block.options];
    opts[optIndex] = value;
    updateBlock(blockIndex, { options: opts });
  };

  const removeOption = (blockIndex: number, optIndex: number) => {
    const block = blocks[blockIndex];
    if (!block.options || block.options.length <= 1) return;
    updateBlock(blockIndex, {
      options: block.options.filter((_, i) => i !== optIndex),
    });
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <Card
          key={index}
          className={`border ${expandedIndex === index ? "border-primary" : "border-border"}`}
        >
          <CardContent className="p-4">
            {/* Block header */}
            <div className="flex items-center gap-2 mb-3">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {BLOCK_TYPES.find((t) => t.value === block.type)?.label}
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, -1)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
              >
                {expandedIndex === index ? "Collapse" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => removeBlock(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Block label preview */}
            {block.type !== "welcome" && (
              <p className="text-sm font-medium">
                {block.label || "(No label set)"}
                {block.required && <span className="text-destructive ml-1">*</span>}
              </p>
            )}
            {block.type === "welcome" && (
              <p className="text-sm text-muted-foreground">
                {block.content ? "Welcome block configured" : "(No content set)"}
              </p>
            )}

            {/* Expanded editor */}
            {expandedIndex === index && (
              <div className="mt-4 space-y-3 border-t pt-3">
                {block.type === "welcome" ? (
                  <div>
                    <Label>Welcome Content</Label>
                    <Textarea
                      value={block.content || ""}
                      onChange={(e) => updateBlock(index, { content: e.target.value })}
                      placeholder="Write your welcome message..."
                      rows={4}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Label / Question</Label>
                      <Input
                        value={block.label || ""}
                        onChange={(e) => updateBlock(index, { label: e.target.value })}
                        placeholder="Enter your question..."
                      />
                    </div>
                    <div>
                      <Label>Placeholder text</Label>
                      <Input
                        value={block.placeholder || ""}
                        onChange={(e) =>
                          updateBlock(index, { placeholder: e.target.value })
                        }
                        placeholder="Optional placeholder..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={block.required ?? false}
                        onCheckedChange={(checked) =>
                          updateBlock(index, { required: checked })
                        }
                      />
                      <Label>Required</Label>
                    </div>
                  </>
                )}

                {/* Multiple choice options */}
                {block.type === "multiple_choice" && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {block.options?.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <Input
                          value={opt}
                          onChange={(e) =>
                            updateOption(index, optIndex, e.target.value)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeOption(index, optIndex)}
                          disabled={(block.options?.length ?? 0) <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(index)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add block buttons */}
      <div className="border-2 border-dashed rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-3 text-center">Add a block</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {BLOCK_TYPES.map((bt) => (
            <Button
              key={bt.value}
              variant="outline"
              size="sm"
              onClick={() => addBlock(bt.value)}
              className="gap-1"
            >
              {bt.icon}
              {bt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
