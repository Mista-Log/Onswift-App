/**
 * FormResponsesPage — Creator page listing all responses to one standalone
 * form. Modeled on ClientHistoryPage.tsx's table + DocumentLibrary.tsx's
 * row-to-route navigation pattern (click a row -> full detail page).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { StandaloneForm, StandaloneFormResponseListItem } from "@/types/standaloneForm";

export default function FormResponsesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<StandaloneForm | null>(null);
  const [responses, setResponses] = useState<StandaloneFormResponseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [formRes, responsesRes] = await Promise.all([
        secureFetch(`/api/v4/forms/${id}/`),
        secureFetch(`/api/v4/forms/${id}/responses/`),
      ]);
      if (formRes.ok) setForm(await formRes.json());
      if (responsesRes.ok) setResponses(await responsesRes.json());
      if (!formRes.ok) toast.error("Form not found");
    } catch (error) {
      toast.error("Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/forms/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {form?.title || "Responses"}
            </h1>
            <p className="text-muted-foreground">
              {responses.length} {responses.length === 1 ? "response" : "responses"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Responses</CardTitle>
            <CardDescription>Click a row to see the full response.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : responses.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No responses yet. Share the form's link to start collecting them.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Answered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((response) => (
                        <TableRow
                          key={response.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/forms/${id}/responses/${response.id}`)}
                        >
                          <TableCell>{format(new Date(response.submitted_at), "MMM d, yyyy h:mm a")}</TableCell>
                          <TableCell>{response.answered_count} fields</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
