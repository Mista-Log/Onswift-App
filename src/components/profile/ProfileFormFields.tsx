import { useMemo, useRef, useState } from "react";
import { ImagePlus, Link as LinkIcon, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BANNER_BYTES = 8 * 1024 * 1024;

/**
 * The banner's form state: a newly picked file, or "removed", on top of what is saved.
 * `previewUrl` is what the profile would show right now; `appendTo` adds the change to the save.
 */
export function useBannerField(savedUrl?: string | null) {
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const previewUrl = fileUrl || (removed ? null : savedUrl || null);

  const pick = (next: File) => {
    if (!next.type.startsWith("image/")) return toast.error("The banner must be an image.");
    if (next.size > MAX_BANNER_BYTES) return toast.error("Banner images can be up to 8MB.");
    setFile(next);
    setRemoved(false);
  };
  const remove = () => {
    setFile(null);
    setRemoved(true);
  };
  const appendTo = (payload: FormData) => {
    if (file) payload.append("banner", file);
    else if (removed) payload.append("clear_fields", "banner");
  };

  return { previewUrl, pick, remove, appendTo };
}

interface BannerFieldProps {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/** The wide cover image at the top of a profile, shown here in its real 1584 x 396 (LinkedIn banner) shape. */
export function BannerField({ previewUrl, onPick, onRemove }: BannerFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="glass-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Banner</h2>
      <div
        className={
          "relative aspect-[1584/396] w-full overflow-hidden rounded-lg " +
          (previewUrl ? "bg-secondary" : "border border-dashed border-border bg-secondary/40")
        }
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Your banner" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No banner yet. Your profile shows a purple gradient until you add one.
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid="banner-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="gap-2" onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          {previewUrl ? "Change banner" : "Upload banner"}
        </Button>
        {previewUrl && (
          <Button type="button" variant="ghost" className="gap-2" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Recommended size: 1584 × 396 pixels, the same as a LinkedIn banner. JPG or PNG, up to 8MB.
      </p>
    </section>
  );
}

interface PortfolioLinksEditorProps {
  links: string[];
  onChange: (links: string[]) => void;
  max?: number;
}

/** Up to five links to work that lives elsewhere. They appear on the profile's Links tab. */
export function PortfolioLinksEditor({ links, onChange, max = 5 }: PortfolioLinksEditorProps) {
  return (
    <section className="glass-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Portfolio &amp; Work Samples</h2>
      <div className="space-y-4">
        {links.map((link, index) => (
          <div key={index} className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={link}
                aria-label={`Portfolio link ${index + 1}`}
                onChange={(e) => onChange(links.map((l, i) => (i === index ? e.target.value : l)))}
                placeholder="https://yourportfolio.com"
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove portfolio link ${index + 1}`}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {links.length < max && (
          <Button type="button" variant="ghost" className="gap-2" onClick={() => onChange([...links, ""])}>
            <Plus className="h-4 w-4" />
            {links.length ? "Add Another Link" : "Add a Link"}
          </Button>
        )}
      </div>
    </section>
  );
}
