/**
 * OnboardingTemplates — Creator page listing all onboarding templates.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, FileText, Link2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { OnboardingLinkTable } from "@/components/onboarding/OnboardingLinkTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingTemplate } from "@/types/onboarding";

export default function OnboardingTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await secureFetch("/api/v4/templates/");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template? All generated links will also be removed.")) return;

    try {
      const response = await secureFetch(`/api/v4/templates/${id}/`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Template deleted");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error("Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-5xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Onboarding</h1>
            <p className="text-muted-foreground">
              Build onboarding forms and manage client intake links.
            </p>
          </div>
          <Button onClick={() => navigate("/onboarding/new")} className="gap-1">
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="all-links">All Links</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">No templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first onboarding form template to start generating client onboarding links.
                  </p>
                  <Button onClick={() => navigate("/onboarding/new")}>
                    <Plus className="h-4 w-4 mr-1" /> Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => navigate(`/onboarding/${template.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.title}</CardTitle>
                          <CardDescription>
                            {template.instance_count || 0} links generated
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Created {format(new Date(template.created_at), "MMM d, yyyy")}
                        {" · "}
                        Updated {format(new Date(template.updated_at), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all-links" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Onboarding Links</CardTitle>
                <CardDescription>
                  Track the status of every generated link across all templates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OnboardingLinkTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
