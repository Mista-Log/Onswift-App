/**
 * StandaloneFormBuilder — Creator page for building plain, reusable forms
 * that are NOT linked to any project or client. Adapted from OnboardingBuilder:
 * same block-editing engine and draft-autosave pattern, but drops the
 * project requirement and the client-signup "Generate Link" flow — a
 * standalone form's link is always available once saved, and any number of
 * anonymous people can submit responses to it.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBlockEditor } from "@/components/onboarding/FormBlockEditor";
import { BlockRenderer } from "@/components/onboarding/BlockRenderer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Eye, Link2, History, BarChart3 } from "lucide-react";
import type { FormBlock } from "@/types/onboarding";
import type { StandaloneForm } from "@/types/standaloneForm";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

type FormFormData = z.infer<typeof formSchema>;

/** Auto-saved draft persisted to localStorage. */
interface FormDraft {
  title: string;
  blocks: FormBlock[];
  savedAt: string;
}

export default function StandaloneFormBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftBanner, setDraftBanner] = useState<FormDraft | null>(null);
  // Blocks auto-save only after the form has loaded (or immediately for new forms),
  // so an empty initial state never overwrites a real draft.
  const readyRef = useRef(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormFormData>({
    resolver: zodResolver(formSchema),
  });
  const title = watch("title");

  const draftKey = `onswift_standalone_form_draft_${id ?? "new"}`;

  // Auto-grow the title textarea so long titles wrap instead of clipping.
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const readDraft = (): FormDraft | null => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (typeof draft?.savedAt !== "string" || !Array.isArray(draft?.blocks)) throw new Error("bad draft");
      return draft as FormDraft;
    } catch {
      localStorage.removeItem(draftKey);
      return null;
    }
  };

  // New form: offer any existing draft right away. Edit mode waits for loadForm.
  useEffect(() => {
    if (!isEditing) {
      const draft = readDraft();
      if (draft) setDraftBanner(draft);
      readyRef.current = true;
    }
  }, []);

  // Debounced auto-save of the in-progress form.
  useEffect(() => {
    if (!readyRef.current) return;
    if (!title && blocks.length === 0) return;
    const timer = setTimeout(() => {
      const savedAt = new Date();
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title: title ?? "",
          blocks,
          savedAt: savedAt.toISOString(),
        } satisfies FormDraft),
      );
      setLastSavedAt(savedAt);
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, blocks]);

  const restoreDraft = () => {
    if (!draftBanner) return;
    setValue("title", draftBanner.title);
    setBlocks(draftBanner.blocks);
    setDraftBanner(null);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setDraftBanner(null);
  };

  // Load existing form
  useEffect(() => {
    if (isEditing) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    try {
      const response = await secureFetch(`/api/v4/forms/${id}/`);
      if (response.ok) {
        const data: StandaloneForm = await response.json();
        setValue("title", data.title);
        setSlug(data.slug);
        setShareUrl(data.url);
        setIsOpen(data.is_open);
        // Legacy blocks predate stable ids — assign them so @references can target them.
        setBlocks(data.blocks.map((b) => (b.id ? b : { ...b, id: crypto.randomUUID() })));
        // Offer a draft only if it's newer than the last saved version.
        const draft = readDraft();
        if (draft && new Date(draft.savedAt) > new Date(data.updated_at)) {
          setDraftBanner(draft);
        } else if (draft) {
          localStorage.removeItem(draftKey);
        }
        readyRef.current = true;
      } else {
        toast.error("Form not found");
        navigate("/forms");
      }
    } catch (error) {
      toast.error("Failed to load form");
    }
  };

  const onSubmit = async (data: FormFormData) => {
    setSaving(true);
    try {
      // Drop blank multiple-choice options so respondents never see empty radio rows.
      const cleanedBlocks = blocks.map((b) =>
        b.type === "multiple_choice" && b.options
          ? { ...b, options: b.options.map((o) => o.trim()).filter(Boolean) }
          : b
      );
      const payload = { title: data.title, blocks: cleanedBlocks };
      const url = isEditing ? `/api/v4/forms/${id}/` : "/api/v4/forms/";
      const method = isEditing ? "PATCH" : "POST";

      const response = await secureFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        localStorage.removeItem(draftKey);
        setLastSavedAt(null);
        toast.success(isEditing ? "Form updated" : "Form created");
        if (!isEditing) {
          navigate(`/forms/${result.id}`);
        }
      } else {
        const error = await response.json();
        toast.error(error?.detail || "Failed to save form");
      }
    } catch (error) {
      toast.error("Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async (next: boolean) => {
    setIsOpen(next); // optimistic
    try {
      const response = await secureFetch(`/api/v4/forms/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_open: next }),
      });
      if (response.ok) {
        toast.success(next ? "Now accepting responses" : "No longer accepting responses");
      } else {
        setIsOpen(!next);
        toast.error("Failed to update form");
      }
    } catch {
      setIsOpen(!next);
      toast.error("Failed to update form");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl || `${window.location.origin}/f/${slug}`);
    toast.success("Link copied to clipboard!");
  };

  return (
    <MainLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Slim toolbar */}
        <div className="container max-w-4xl mx-auto px-4 flex items-center gap-2 py-2 border-b border-border/50">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <TabsList className="h-9">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Preview
            </TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          {isEditing && (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-md border border-input px-3 h-9">
                <Label htmlFor="form-open" className="text-xs text-muted-foreground cursor-pointer">
                  {isOpen ? "Accepting responses" : "Closed"}
                </Label>
                <Switch id="form-open" checked={isOpen} onCheckedChange={toggleOpen} />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/forms/${id}/responses`)}>
                <BarChart3 className="h-3.5 w-3.5" /> Responses
              </Button>
            </>
          )}
          {lastSavedAt && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Draft saved {format(lastSavedAt, "h:mm a")}
            </span>
          )}
          <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Document */}
        <div className="container max-w-2xl mx-auto px-4 py-10 md:py-14">
          <TabsContent value="editor" className="mt-0">
            {draftBanner && (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-muted/60 border border-border px-4 py-3">
                <History className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground flex-1 min-w-0">
                  You have an unsaved draft from {formatDistanceToNow(new Date(draftBanner.savedAt))} ago.
                </p>
                <Button size="sm" variant="ghost" onClick={discardDraft}>Discard</Button>
                <Button size="sm" onClick={restoreDraft}>Restore</Button>
              </div>
            )}
            {(() => {
              const { ref: rhfRef, ...titleField } = register("title");
              return (
                <textarea
                  {...titleField}
                  ref={(el) => { rhfRef(el); titleRef.current = el; }}
                  rows={1}
                  placeholder="Form title"
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className="w-full bg-transparent border-0 outline-none focus:ring-0 p-0 text-3xl md:text-4xl font-bold placeholder:text-muted-foreground/30 resize-none overflow-hidden"
                />
              );
            })()}
            {errors.title && (
              <p className="text-sm text-destructive mt-2">{errors.title.message}</p>
            )}
            <div className="mt-8">
              <FormBlockEditor blocks={blocks} onChange={setBlocks} />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <h1 className="text-3xl md:text-4xl font-bold">
              {title || <span className="text-muted-foreground/30">Form title</span>}
            </h1>
            <div className="mt-8 space-y-6">
              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">
                  No blocks added yet. Switch to the Editor tab to add blocks.
                </p>
              ) : (
                blocks.map((block, index) => (
                  <BlockRenderer
                    key={index}
                    block={block}
                    index={index}
                    value={null}
                    onChange={() => {}}
                    readOnly
                  />
                ))
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </MainLayout>
  );
}
