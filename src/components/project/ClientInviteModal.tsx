import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
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
  const [clients, setClients] = useState<OnboardedClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load onboarded clients
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
        // Extract unique clients from onboarding instances
        const clientMap = new Map<string, OnboardedClient>();
        
        if (Array.isArray(data)) {
          data.forEach((instance: any) => {
            if (instance.client) {
              clientMap.set(instance.client, {
                id: instance.client,
                email: instance.client_email,
                full_name: instance.client_name,
              });
            }
          });
        } else if (data.results && Array.isArray(data.results)) {
          data.results.forEach((instance: any) => {
            if (instance.client) {
              clientMap.set(instance.client, {
                id: instance.client,
                email: instance.client_email,
                full_name: instance.client_name,
              });
            }
          });
        }
        
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
        body: JSON.stringify({
          client_id: selectedClient.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to add client");
        return;
      }

      toast.success(`${selectedClient.full_name} has been added to the project!`);

      // Reset form
      setSelectedClientId("");

      // Callback with client data
      if (onSuccess) {
        onSuccess(selectedClient);
      }

      // Close after success
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Error adding client:", err);
      toast.error("Failed to add client");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Client to {projectName}</DialogTitle>
          <DialogDescription>
            Select an onboarded client to invite to this project.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No onboarded clients found</p>
            <p className="text-sm text-muted-foreground">
              Clients must complete onboarding before they can be invited to projects.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client-select">Select Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <span>{client.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({client.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedClientId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate & Send Invite
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

