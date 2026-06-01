import { useState, useEffect } from "react";
import { secureFetch } from "@/api/apiClient";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { BlockRenderer } from "@/components/onboarding/BlockRenderer";
import type { FormBlock } from "@/types/onboarding";

interface Submission {
  id: string;
  form_title: string;
  creator_name: string;
  creator_company?: string;
  submitted_at: string;
  blocks: FormBlock[];
  responses: { block_index: number; value: any }[];
}

export default function ClientPortalView() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      const response = await secureFetch("/api/v4/my-submissions/");
      if (response.ok) {
        const data = await response.json();
        setSubmissions(Array.isArray(data) ? data : data.submissions || []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Client Portal</h1>
          <p className="text-muted-foreground mt-1">
            Your submitted onboarding forms — read-only view.
          </p>
        </div>

        {error || submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Submissions Yet</h3>
              <p className="text-muted-foreground">
                Your onboarding form submissions will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {submissions.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{submission.form_title}</CardTitle>
                      <CardDescription>
                        {submission.creator_name}
                        {submission.creator_company && ` · ${submission.creator_company}`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Submitted
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 pt-0">
                  {submission.blocks.map((block, index) => {
                    const response = submission.responses.find((r) => r.block_index === index);
                    return (
                      <BlockRenderer
                        key={index}
                        block={block}
                        index={index}
                        value={response?.value ?? null}
                        onChange={() => {}}
                        readOnly
                      />
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
