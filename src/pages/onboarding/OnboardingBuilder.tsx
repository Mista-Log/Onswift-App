/**
 * OnboardingBuilder — Creator page for building onboarding form templates.
 * Allows creating/editing templates and generating shareable links.
 */
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBlockEditor } from "@/components/onboarding/FormBlockEditor";
import { BlockRenderer } from "@/components/onboarding/BlockRenderer";
import { OnboardingLinkTable } from "@/components/onboarding/OnboardingLinkTable";
import { ArrowLeft, Save, Eye, Link2, Plus, Loader2 } from "lucide-react";
import { FIXED_PROCESSING_MESSAGE, runWithFixedProcessingDelay } from "@/lib/loadingGate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormBlock, OnboardingTemplate } from "@/types/onboarding";

const templateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function OnboardingBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");
  const [linkRefresh, setLinkRefresh] = useState(0);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  });

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
        setBlocks(data.blocks);
      } else {
        toast.error("Template not found");
        navigate("/onboarding");
      }
    } catch (error) {
      toast.error("Failed to load template");
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    setSaving(true);
    try {
      const payload = { title: data.title, blocks };
      const url = isEditing ? `/api/v4/templates/${id}/` : "/api/v4/templates/";
      const method = isEditing ? "PATCH" : "POST";

      const response = await secureFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(isEditing ? "Template updated" : "Template created");
        if (!isEditing) {
          navigate(`/onboarding/${result.id}`);
        }
      } else {
        const error = await response.json();
        toast.error(error?.detail || "Failed to save template");
      }
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const generateLink = async () => {
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
        toast.error(error?.detail || "Failed to generate link");
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
      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isEditing ? "Edit Template" : "New Onboarding Template"}
            </h1>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-1" /> Preview
            </TabsTrigger>
            {isEditing && <TabsTrigger value="links">Tracker</TabsTrigger>}
          </TabsList>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label>Title</Label>
                    <Input
                      {...register("title")}
                      placeholder="e.g. Client Onboarding Form"
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Form Blocks</CardTitle>
                  <CardDescription>
                    Add questions and content blocks your clients will see.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormBlockEditor blocks={blocks} onChange={setBlocks} />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={saving} className="gap-1">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  This is how your clients will see the onboarding form.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {blocks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Links Tab */}
          {isEditing && (
            <TabsContent value="links" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Generated Links</CardTitle>
                  <CardDescription>
                    Track the status of all links generated from this template.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OnboardingLinkTable templateId={id} refreshTrigger={linkRefresh} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {isEditing && (
          <div className="mt-6">
            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                  <Link2 className="h-4 w-4" /> Generate Link
                </Button>
              </DialogTrigger>
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
          </div>
        )}
      </div>
    </MainLayout>
  );
}
