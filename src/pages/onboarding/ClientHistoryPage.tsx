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
import { ArrowLeft, Users, Loader2, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

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

export default function ClientHistoryPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              {clients.length === 0
                ? "No clients yet"
                : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Clients Yet</h3>
                <p className="text-muted-foreground">
                  Clients will appear here when you add them to projects.
                </p>
              </div>
            ) : (
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
                    <TableRow key={client.id}>
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
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
