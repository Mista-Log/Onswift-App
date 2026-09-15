/**
 * FormsListPage — Creator page listing all standalone (project/client-independent) forms.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { StandaloneFormListItem } from "@/types/standaloneForm";

export default function FormsListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<StandaloneFormListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await secureFetch("/api/v4/forms/");
      if (response.ok) {
        const data = await response.json();
        setForms(data);
      }
    } catch (error) {
      console.error("Failed to fetch forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Delete this form? All its responses will also be removed.")) return;

    try {
      const response = await secureFetch(`/api/v4/forms/${id}/`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Form deleted");
        setForms((prev) => prev.filter((f) => f.id !== id));
      } else {
        toast.error("Failed to delete form");
      }
    } catch (error) {
      toast.error("Failed to delete form");
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">Forms</h1>
            <p className="text-muted-foreground">
              Create plain, shareable forms. No project or client sign-up required.
            </p>
          </div>
          <Button onClick={() => navigate("/forms/new")} className="gap-1 px-2 sm:px-4">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">New Form</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No forms yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first form and share the link, 
                anyone can respond, no account needed.
              </p>
              <Button onClick={() => navigate("/forms/new")}>
                <Plus className="h-4 w-4 mr-1" /> Create Form
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {forms.map((form) => (
              <Card
                key={form.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/forms/${form.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{form.title}</CardTitle>
                        <Badge variant={form.is_open ? "default" : "secondary"}>
                          {form.is_open ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {form.response_count} {form.response_count === 1 ? "response" : "responses"}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteForm(form.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(form.created_at), "MMM d, yyyy")}
                    {" · "}
                    Updated {format(new Date(form.updated_at), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
