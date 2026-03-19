/**
 * OnboardingLinkTable — Displays all generated onboarding links with status tracking.
 */
import { useState, useEffect } from "react";
import { secureFetch } from "@/api/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { OnboardingInstance } from "@/types/onboarding";

interface OnboardingLinkTableProps {
  templateId?: string;
  refreshTrigger?: number;
}

export function OnboardingLinkTable({ templateId, refreshTrigger }: OnboardingLinkTableProps) {
  const [instances, setInstances] = useState<OnboardingInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstances();
  }, [templateId, refreshTrigger]);

  // Poll every 10s to catch status changes (SENT → OPENED → COMPLETED / Expired)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInstances();
    }, 10_000);
    return () => clearInterval(interval);
  }, [templateId]);

  const fetchInstances = async () => {
    try {
      const params = templateId ? `?template_id=${templateId}` : "";
      const response = await secureFetch(`/api/v4/instances/${params}`);
      if (response.ok) {
        const data = await response.json();
        setInstances(data);
      }
    } catch (error) {
      console.error("Failed to fetch instances:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (instance: { url?: string; slug?: string }) => {
    const linkUrl = instance.url || `${window.location.origin}/onboard/${instance.slug}`;
    navigator.clipboard.writeText(linkUrl);
    toast.success("Link copied to clipboard");
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "OPENED":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No onboarding links generated yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.id}>
              <TableCell className="font-medium">
                {instance.template_title}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={statusColor(instance.status)}>
                  {instance.status}
                </Badge>
                {instance.is_expired && (
                  <Badge variant="destructive" className="ml-1">
                    Expired
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {instance.client_name ? (
                  <div>
                    <p className="font-medium text-sm">{instance.client_name}</p>
                    <p className="text-xs text-muted-foreground">{instance.client_email}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(instance.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-sm">
                {instance.expires_at
                  ? format(new Date(instance.expires_at), "MMM d, yyyy")
                  : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(instance)}
                    title="Copy link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(instance.url, "_blank")}
                    title="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
