import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowRight } from "lucide-react";
import { secureFetch } from "@/api/apiClient";

interface OnboardedClient {
  id: string;
  email: string;
  full_name: string;
}

interface ClientInviteModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (client: OnboardedClient) => void;
}

export function ClientInviteModal({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSuccess,
}: ClientInviteModalProps) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<OnboardedClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const response = await secureFetch("/api/v4/instances/");
      if (response.ok) {
        const data = await response.json();
        const clientMap = new Map<string, OnboardedClient>();

        const items = Array.isArray(data) ? data : (data.results ?? []);
        items.forEach((instance: any) => {
          if (instance.client) {
            clientMap.set(instance.client, {
              id: instance.client,
              email: instance.client_email,
              full_name: instance.client_name,
            });
          }
        });

        setClients(Array.from(clientMap.values()));
      } else {
        toast.error("Failed to load onboarded clients");
      }
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load onboarded clients");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }

    const selectedClient = clients.find((c) => c.id === selectedClientId);
    if (!selectedClient) {
      toast.error("Client not found");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await secureFetch(`/api/v5/projects/${projectId}/add-client/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to add client");
        return;
      }

      toast.success(`${selectedClient.full_name} added to ${projectName}!`);
      setSelectedClientId("");
      if (onSuccess) onSuccess(selectedClient);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      console.error("Error adding client:", err);
      toast.error("Failed to add client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToClientPortal = () => {
    onClose();
    navigate("/onboarding/new");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client to {projectName}</DialogTitle>
          <DialogDescription>
            Select a client who has completed onboarding.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No clients yet</p>
              <p className="text-sm text-muted-foreground">
                Create a client portal to onboard your first client.
              </p>
            </div>
            <Button onClick={goToClientPortal} className="gap-2 mt-2">
              <UserPlus className="h-4 w-4" />
              Invite Your First Client
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        ) : (
          /* ── Has clients ── */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="client-select">Select Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select">
                  <SelectValue placeholder="Choose a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <span>{client.full_name}</span>
                        <span className="text-xs text-muted-foreground">({client.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Portal nudge */}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Don't see the right client?</p>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                onClick={goToClientPortal}
              >
                Create a new client portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedClientId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Client
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
