/**
 * ClientInvitesTable — Shows all invites for a project with status tracking.
 */
import { useState, useEffect } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";

interface ClientInvite {
  id: string;
  client_email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface ClientInvitesTableProps {
  projectId: string;
  refreshTrigger?: number;
}

export function ClientInvitesTable({ projectId, refreshTrigger }: ClientInvitesTableProps) {
  const [invites, setInvites] = useState<ClientInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; inviteId: string; email: string }>({
    isOpen: false,
    inviteId: "",
    email: "",
  });

  useEffect(() => {
    fetchInvites();
  }, [projectId, refreshTrigger]);

  // Poll every 30s to catch acceptance status changes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInvites();
    }, 30_000);
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const response = await secureFetch(`/api/v5/projects/${projectId}/invites/`);
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (token: string) => {
    const inviteLink = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to clipboard");
  };

  const handleDeleteClick = (inviteId: string, email: string) => {
    setDeleteDialog({
      isOpen: true,
      inviteId,
      email,
    });
  };

  const confirmDelete = async () => {
    const { inviteId, email } = deleteDialog;
    setDeleteDialog({ isOpen: false, inviteId: "", email: "" });

    try {
      setDeleting(inviteId);
      const response = await secureFetch(`/api/v5/projects/${projectId}/invites/${inviteId}/`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to delete invite");
        return;
      }

      toast.success(`Invite for ${email} deleted`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (error) {
      console.error("Error deleting invite:", error);
      toast.error("Failed to delete invite");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (invite: ClientInvite) => {
    if (invite.accepted_at) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Accepted</Badge>;
    }

    const expiresAt = new Date(invite.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      return <Badge variant="outline">Expired</Badge>;
    }

    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Expiring soon ({daysLeft}d)</Badge>;
    }

    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No invites sent yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="font-medium">{invite.client_email}</TableCell>
              <TableCell>{getStatusBadge(invite)}</TableCell>
              <TableCell className="text-sm text-slate-600">
                {format(new Date(invite.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {format(new Date(invite.expires_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyLink(invite.token)}
                  title="Copy invite link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(invite.id, invite.client_email)}
                  disabled={deleting === invite.id}
                  title="Delete invite"
                  className="text-red-600 hover:text-red-700"
                >
                  {deleting === invite.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setDeleteDialog({ isOpen: false, inviteId: "", email: "" });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invite</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the invite for <strong>{deleteDialog.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting === deleteDialog.inviteId}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting === deleteDialog.inviteId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
