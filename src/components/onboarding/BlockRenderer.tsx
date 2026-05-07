/**
 * BlockRenderer — Renders form blocks in client-facing and preview modes.
 * Used both in the onboarding public page and the preview mode.
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { FormBlock, BlockResponse } from "@/types/onboarding";

interface BlockRendererProps {
  block: FormBlock;
  index: number;
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  readOnly?: boolean;
}

/** Renders a single form block based on its type. */
export function BlockRenderer({ block, index, value, onChange, readOnly = false }: BlockRendererProps) {
  switch (block.type) {
    case "welcome":
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none py-4">
          <div dangerouslySetInnerHTML={{ __html: block.content || "" }} />
        </div>
      );

    case "short_answer":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {block.label}
            {block.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={block.placeholder || "Your answer..."}
            disabled={readOnly}
          />
        </div>
      );

    case "long_answer":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {block.label}
            {block.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={block.placeholder || "Your answer..."}
            rows={4}
            disabled={readOnly}
          />
        </div>
      );

    case "multiple_choice":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {block.label}
            {block.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <RadioGroup
            value={(value as string) || ""}
            onValueChange={(v) => onChange(v)}
            disabled={readOnly}
          >
            {block.options?.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`block-${index}-opt-${i}`} />
                <Label htmlFor={`block-${index}-opt-${i}`} className="font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );

    case "file_upload":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {block.label}
            {block.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange(file?.name || null);
              }}
              className="max-w-xs mx-auto"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {block.placeholder || "Click to browse or drag and drop"}
            </p>
          </div>
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-start space-x-3 py-2">
          <Checkbox
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked as boolean)}
            id={`block-${index}-checkbox`}
            disabled={readOnly}
          />
          <Label htmlFor={`block-${index}-checkbox`} className="text-sm font-normal leading-relaxed">
            {block.label}
            {block.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      );

    default:
      return null;
  }
}
