/**
 * FormResponseDetail — Creator page showing one full response to a
 * standalone form, block by block. Answer-formatting logic copied from
 * ClientHistoryPage.tsx's formatAnswer() (kept separate rather than shared,
 * since that file belongs to the client-onboarding flow this feature must
 * not touch).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { FormBlock, BlockResponse } from "@/types/onboarding";
import type { StandaloneForm, StandaloneFormResponse } from "@/types/standaloneForm";

/** Formats a single block's response value for read-only display. */
function formatAnswer(block: FormBlock, value: BlockResponse["value"]) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">No answer</span>;
  }
  if (block.type === "checkbox") {
    return value === true ? "Yes" : "No";
  }
  if (block.type === "file_upload" && typeof value === "string" && /^https?:\/\//.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1"
      >
        View file <ExternalLink className="h-3.5 w-3.5" />
      </a>
    );
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export default function FormResponseDetail() {
  const { id, responseId } = useParams<{ id: string; responseId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<StandaloneForm | null>(null);
  const [response, setResponse] = useState<StandaloneFormResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id, responseId]);

  const loadData = async () => {
    try {
      const [formRes, responseRes] = await Promise.all([
        secureFetch(`/api/v4/forms/${id}/`),
        secureFetch(`/api/v4/forms/${id}/responses/${responseId}/`),
      ]);
      if (formRes.ok) setForm(await formRes.json());
      if (responseRes.ok) {
        setResponse(await responseRes.json());
      } else {
        toast.error("Response not found");
      }
    } catch (error) {
      toast.error("Failed to load response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/forms/${id}/responses`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {form?.title || "Response"}
            </h1>
            {response && (
              <p className="text-muted-foreground">
                Submitted {format(new Date(response.submitted_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>Every question and the respondent's answer.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !form || !response ? (
              <p className="text-muted-foreground text-center py-12">Response not found.</p>
            ) : (
              <div className="space-y-4">
                {form.blocks.map((block, index) => {
                  if (block.type === "welcome") return null;
                  const answer = response.responses.find((r) => r.block_index === index);
                  return (
                    <div key={index} className="border-l-2 border-muted pl-4">
                      <p className="text-sm font-medium">
                        {block.label || `Question ${index + 1}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatAnswer(block, answer?.value ?? null)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
