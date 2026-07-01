/**
 * ClientHistoryPage — Creator dashboard showing all clients and project history.
 * Displays aggregated client data: total projects, active projects, completed projects, etc.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Users, Loader2, Mail, Calendar, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { FormBlock, BlockResponse } from "@/types/onboarding";

interface Client {
  id: string;
  client_name: string;
  client_email: string;
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  on_hold_projects: number;
  last_activity: string | null;
}

interface ClientSubmission {
  id: string;
  form_title: string;
  client_name: string | null;
  client_email: string | null;
  submitted_at: string | null;
  blocks: FormBlock[];
  responses: BlockResponse[];
}

export default function ClientHistoryPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    loadClientHistory();
  }, []);

  const loadClientHistory = async () => {
    try {
      const response = await secureFetch("/api/v5/clients/history/");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        toast.error("Failed to load client history");
      }
    } catch (error) {
      console.error("Error loading client history:", error);
      toast.error("Something went wrong");
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/onboarding")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Client History</h1>
            <p className="text-muted-foreground mt-1">
              All clients you've worked with across projects
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + c.active_projects, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + c.completed_projects, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                On Hold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + c.on_hold_projects, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>
              {clients.length === 0 ? (
                "No clients yet"
              ) : (
                <>
                  {/* <span>{clients.length} client{clients.length !== 1 ? "s" : ""}</span> (should stay hidden, cards above already count clients)*/}
                  <span className="block mt-1 text-sm font-medium text-primary">
                    Tap a client to view their onboarding responses
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {clients.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Clients Yet</h3>
                <p className="text-muted-foreground">
                  Clients will appear here when you add them to projects.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">On Hold</TableHead>
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedClient(client)}
                        >
                          <TableCell className="font-medium">
                            {client.client_name || "Unknown"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {client.client_email}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {client.total_projects}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20">
                              {client.active_projects}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">
                              {client.completed_projects}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {client.on_hold_projects}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {client.last_activity ? (
                              <div className="flex items-center justify-end gap-2">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(client.last_activity), "MMM d, yyyy")}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
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

      <ClientSubmissionsDialog
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </MainLayout>
  );
}

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

/** Dialog that loads and displays a client's onboarding responses for the creator. */
function ClientSubmissionsDialog({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setLoading(true);
    setSubmissions([]);

    (async () => {
      try {
        const response = await secureFetch(`/api/v4/clients/${client.id}/submissions/`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setSubmissions(Array.isArray(data) ? data : data.results || []);
        } else if (!cancelled) {
          toast.error("Failed to load client responses");
        }
      } catch {
        if (!cancelled) toast.error("Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client?.client_name || "Client"} Onboarding Responses</DialogTitle>
          <DialogDescription>{client?.client_email}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              This client has no onboarding responses on your forms yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {submissions.map((submission) => (
              <div key={submission.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{submission.form_title}</h3>
                  {submission.submitted_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {submission.blocks.map((block, index) => {
                    if (block.type === "welcome") return null;
                    const response = submission.responses.find((r) => r.block_index === index);
                    return (
                      <div key={index} className="border-l-2 border-muted pl-4">
                        <p className="text-sm font-medium">
                          {block.label || `Question ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatAnswer(block, response?.value ?? null)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
