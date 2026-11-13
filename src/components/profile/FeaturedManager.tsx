import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link as LinkIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadErrorMessage } from "@/lib/uploadError";
import type { FeaturedItem } from "./ProfileView";

export const MAX_FEATURED = 8;
const MAX_BYTES = 5 * 1024 * 1024;

/** The server's own message when it has one ({"detail": "..."} or {"image": ["..."]}). */
async function errorText(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    const first = Object.values(body ?? {})[0];
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  } catch {
    /* not JSON */
  }
  return fallback;
}

/** Your own Featured section, loaded once. Edits go straight to the server, not through "Save Changes". */
export function useFeaturedWork() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch("/api/v1/auth/featured/");
        if (res.ok && !cancelled) setItems(await res.json());
      } catch {
        /* the section just starts empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, setItems, loading };
}

interface FeaturedManagerProps {
  items: FeaturedItem[];
  onChange: (items: FeaturedItem[]) => void;
}

export function FeaturedManager({ items, onChange }: FeaturedManagerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // What the server last confirmed per piece, so a blur only saves real changes.
  const saved = useRef<Record<string, { title: string; link: string }>>({});
  items.forEach((i) => {
    if (!saved.current[i.id]) saved.current[i.id] = { title: i.title, link: i.link };
  });

  const add = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image.");
    if (file.size > MAX_BYTES) return toast.error("Images can be up to 5MB.");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await secureFetch("/api/v1/auth/featured/", { method: "POST", body });
      if (!res.ok) {
        toast.error(uploadErrorMessage(res.status, undefined, await errorText(res, "Couldn't add that image.")));
        return;
      }
      const created: FeaturedItem = await res.json();
      saved.current[created.id] = { title: created.title, link: created.link };
      onChange([created, ...items]);
    } catch (err) {
      toast.error(uploadErrorMessage(undefined, err));
    } finally {
      setUploading(false);
    }
  };

  const edit = (id: string, patch: Partial<Pick<FeaturedItem, "title" | "link">>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const persist = async (item: FeaturedItem) => {
    const last = saved.current[item.id];
    if (last && last.title === item.title && last.link === item.link) return;
    const body = new FormData();
    body.append("title", item.title);
    body.append("link", item.link);
    const res = await secureFetch(`/api/v1/auth/featured/${item.id}/`, { method: "PATCH", body });
    if (res.ok) {
      saved.current[item.id] = { title: item.title, link: item.link };
    } else {
      toast.error(await errorText(res, "Couldn't save that change."));
    }
  };

  const remove = async (id: string) => {
    const res = await secureFetch(`/api/v1/auth/featured/${id}/`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      delete saved.current[id];
      onChange(items.filter((i) => i.id !== id));
    } else {
      toast.error("Couldn't remove that piece. Please try again.");
    }
  };

  return (
    <section className="glass-card p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Featured work</h2>
        <span className="text-xs text-muted-foreground">{items.length}/{MAX_FEATURED}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Your best pieces, shown as a grid on your profile. Add a title, and a link if it lives somewhere online.
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-lg border border-border/60 p-2">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
              {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                value={item.title}
                maxLength={120}
                placeholder="Title"
                aria-label="Title"
                onChange={(e) => edit(item.id, { title: e.target.value })}
                onBlur={() => persist(item)}
              />
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={item.link}
                  placeholder="https://link-to-this-work.com"
                  aria-label="Link"
                  className="pl-10"
                  onChange={(e) => edit(item.id, { link: e.target.value })}
                  onBlur={() => persist(item)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${item.title || "this piece"}`}
              onClick={() => remove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="featured-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) add(file);
        }}
      />
      {items.length < MAX_FEATURED ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 gap-2"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading..." : "Add an image"}
        </Button>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">That's the maximum. Remove one to add another.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or GIF. Max size 5MB each.</p>
    </section>
  );
}
