/**
 * OnboardingBuilder — Creator page for building onboarding form templates.
 * Tally-style document editor: borderless title, inline blocks, slim toolbar.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { useProjects } from "@/contexts/ProjectContext";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBlockEditor } from "@/components/onboarding/FormBlockEditor";
import { BlockRenderer } from "@/components/onboarding/BlockRenderer";
import { OnboardingLinkTable } from "@/components/onboarding/OnboardingLinkTable";
import { ArrowLeft, Save, Eye, Link2, Loader2, History, FolderKanban, EllipsisVertical } from "lucide-react";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FIXED_PROCESSING_MESSAGE, runWithFixedProcessingDelay } from "@/lib/loadingGate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormBlock, OnboardingTemplate } from "@/types/onboarding";

const templateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

type TemplateFormData = z.infer<typeof templateSchema>;

/** Auto-saved draft persisted to localStorage. */
interface FormDraft {
  title: string;
  blocks: FormBlock[];
  projectId?: string;
  savedAt: string;
}

export default function OnboardingBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const [showProfile, setShowProfile] = useState(false);
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");
  const [linkRefresh, setLinkRefresh] = useState(0);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState("");

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftBanner, setDraftBanner] = useState<FormDraft | null>(null);
  // Blocks auto-save only after the template has loaded (or immediately for new forms),
  // so an empty initial state never overwrites a real draft.
  const readyRef = useRef(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  });
  const title = watch("title");

  const draftKey = `onswift_form_draft_${id ?? "new"}`;

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

  // New form: offer any existing draft right away. Edit mode waits for loadTemplate.
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
          projectId: projectId || undefined,
          savedAt: savedAt.toISOString(),
        } satisfies FormDraft),
      );
      setLastSavedAt(savedAt);
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, blocks, projectId]);

  const restoreDraft = () => {
    if (!draftBanner) return;
    setValue("title", draftBanner.title);
    setBlocks(draftBanner.blocks);
    if (draftBanner.projectId) setProjectId(draftBanner.projectId);
    setDraftBanner(null);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setDraftBanner(null);
  };

  // Load existing template
  useEffect(() => {
    if (isEditing) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      const response = await secureFetch(`/api/v4/templates/${id}/`);
      if (response.ok) {
        const data: OnboardingTemplate = await response.json();
        setValue("title", data.title);
        setProjectId(data.project ?? "");
        setShowProfile(!!data.show_creator_profile);
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
        toast.error("Template not found");
        navigate("/onboarding");
      }
    } catch (error) {
      toast.error("Failed to load template");
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    if (!projectId) {
      toast.error(
        projects.length === 0
          ? "Create a project first, your client lands in it after onboarding."
          : "Link this form to a project before saving."
      );
      return;
    }
    setSaving(true);
    try {
      // Drop blank multiple-choice options so clients never see empty radio rows.
      const cleanedBlocks = blocks.map((b) =>
        b.type === "multiple_choice" && b.options
          ? { ...b, options: b.options.map((o) => o.trim()).filter(Boolean) }
          : b
      );
      const payload = { title: data.title, blocks: cleanedBlocks, project: projectId };
      const url = isEditing ? `/api/v4/templates/${id}/` : "/api/v4/templates/";
      const method = isEditing ? "PATCH" : "POST";

      const response = await secureFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        localStorage.removeItem(draftKey);
        setLastSavedAt(null);
        toast.success(isEditing ? "Template updated" : "Template created");
        if (!isEditing) {
          navigate(`/onboarding/${result.id}`);
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

  // Whether clients filling the form can open my profile from it. Saved straight away, on its own.
  const toggleShowProfile = async (next: boolean) => {
    setShowProfile(next); // optimistic
    try {
      const response = await secureFetch(`/api/v4/templates/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ show_creator_profile: next }),
      });
      if (response.ok) {
        toast.success(next ? "Your profile now shows on this form" : "Your profile is hidden on this form");
      } else {
        setShowProfile(!next);
        toast.error("Failed to update form");
      }
    } catch {
      setShowProfile(!next);
      toast.error("Failed to update form");
    }
  };

  const generateLink = async () => {
    if (!projectId) {
      toast.error("Link this form to a project (and save) before generating a link.");
      return;
    }
    setGenerating(true);
    setGeneratingMessage(FIXED_PROCESSING_MESSAGE);
    try {
      const payload: Record<string, unknown> = { template_id: id };
      if (expiresAt) {
        payload.expires_at = new Date(expiresAt).toISOString();
      }

      const response = await runWithFixedProcessingDelay(
        secureFetch("/api/v4/instances/create/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );

      if (response.ok) {
        const data = await response.json();
        const linkUrl = data.url || `${window.location.origin}/onboard/${data.slug}`;
        navigator.clipboard.writeText(linkUrl);
        toast.success("Link generated and copied to clipboard!");
        setGenerateDialogOpen(false);
        setExpiresAt("");
        setLinkRefresh((prev) => prev + 1);
      } else {
        const error = await response.json();
        toast.error(error?.error || error?.detail || "Failed to generate link");
      }
    } catch (error) {
      toast.error("Failed to generate link");
    } finally {
      setGenerating(false);
      setGeneratingMessage("");
    }
  };

  return (
    <MainLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Slim toolbar */}
        <div className="container max-w-4xl mx-auto px-4 flex items-center gap-2 py-2 border-b border-border/50">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/onboarding")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <TabsList className="h-9">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Preview
            </TabsTrigger>
            {isEditing && <TabsTrigger value="links">Tracker</TabsTrigger>}
          </TabsList>
          <div className="flex-1" />
          {/* Secondary actions live behind the ⋮ menu so the toolbar fits on a phone. */}
          {(projects.length > 0 || isEditing || lastSavedAt) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="More options">
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 max-h-[70vh] overflow-y-auto">
                {isEditing && (
                  <DropdownMenuItem onSelect={() => setGenerateDialogOpen(true)}>
                    <Link2 className="mr-2 h-4 w-4" /> Generate link
                  </DropdownMenuItem>
                )}
                {isEditing && (
                  <DropdownMenuCheckboxItem checked={showProfile} onCheckedChange={toggleShowProfile}>
                    Show my profile on this form
                  </DropdownMenuCheckboxItem>
                )}
                {projects.length > 0 && (
                  <>
                    {isEditing && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <FolderKanban className="h-3.5 w-3.5" /> Link to project
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={projectId} onValueChange={setProjectId}>
                      {projects.map((p) => (
                        <DropdownMenuRadioItem key={p.id} value={p.id}>
                          <span className="truncate">{p.name}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </>
                )}
                {lastSavedAt && (
                  <>
                    {(isEditing || projects.length > 0) && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Draft saved {format(lastSavedAt, "h:mm a")}
                    </DropdownMenuLabel>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isEditing && (
            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Onboarding Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Expiry Date (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for no expiration
                    </p>
                  </div>
                  <Button onClick={generateLink} disabled={generating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating link...
                      </>
                    ) : (
                      "Generate & Copy Link"
                    )}
                  </Button>
                  {generating && (
                    <p className="text-xs text-muted-foreground">{generatingMessage}</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Document */}
        <div className="container max-w-2xl mx-auto px-4 py-10 md:py-14">
          <TabsContent value="editor" className="mt-0">
            {projects.length === 0 && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <FolderKanban className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
                <p className="text-sm text-foreground flex-1 min-w-0">
                  Forms must be linked to a project, that's where your Client lands
                  after Onboarding. You don't have any projects yet.
                </p>
                <Button size="sm" onClick={() => navigate("/projects")}>
                  Create a project
                </Button>
              </div>
            )}
            
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

          {isEditing && (
            <TabsContent value="links" className="mt-0">
              <h2 className="text-lg font-semibold mb-1">Generated Links</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Track the status of all links generated from this template.
              </p>
              <OnboardingLinkTable templateId={id} refreshTrigger={linkRefresh} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </MainLayout>
  );
}
