import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, Check, Loader2, Unlink, RefreshCw } from "lucide-react";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events";

interface GoogleCalendarSyncProps {
  open: boolean;
  onClose: () => void;
}

interface CalendarStatus {
  is_connected: boolean;
  synced_tasks_count: number;
}

interface SyncedTask {
  id: string;
  task_name: string;
  project_name: string;
  deadline: string;
  google_event_id: string;
  synced_at: string;
}

export function GoogleCalendarSync({ open, onClose }: GoogleCalendarSyncProps) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [syncedTasks, setSyncedTasks] = useState<SyncedTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (open) {
      fetchStatus();
      fetchSyncedTasks();
    }
  }, [open]);

  const fetchStatus = async () => {
    try {
      const response = await secureFetch("/api/v2/calendar/status/");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Error fetching calendar status:", error);
    }
  };

  const fetchSyncedTasks = async () => {
    try {
      const response = await secureFetch("/api/v2/calendar/synced/");
      if (response.ok) {
        const data = await response.json();
        setSyncedTasks(data);
      }
    } catch (error) {
      console.error("Error fetching synced tasks:", error);
    }
  };

  const handleGoogleConnect = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID environment variable.");
      return;
    }

    // Build OAuth URL
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", GOOGLE_SCOPES);
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", "calendar_connect");

    // Open in popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl.toString(),
      "google-oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === "google-oauth-callback") {
        popup?.close();
        window.removeEventListener("message", handleMessage);
        
        if (event.data.error) {
          toast.error("Failed to connect to Google Calendar");
          return;
        }
        
        if (event.data.access_token) {
          await saveToken(event.data.access_token, event.data.expires_in);
        }
      }
    };

    window.addEventListener("message", handleMessage);
  };

  const saveToken = async (accessToken: string, expiresIn?: number) => {
    setIsLoading(true);
    try {
      const response = await secureFetch("/api/v2/calendar/connect/", {
        method: "POST",
        body: JSON.stringify({ 
          access_token: accessToken,
          expires_in: expiresIn 
        }),
      });

      if (response.ok) {
        toast.success("Google Calendar connected successfully");
        fetchStatus();
      } else {
        throw new Error("Failed to connect");
      }
    } catch (error) {
      toast.error("Could not connect to Google Calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await secureFetch("/api/v2/calendar/disconnect/", {
        method: "DELETE",
      });

      if (response.ok) {
        setStatus({ is_connected: false, synced_tasks_count: 0 });
        setSyncedTasks([]);
        toast.success("Google Calendar has been disconnected");
      }
    } catch (error) {
      toast.error("Failed to disconnect Google Calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const response = await secureFetch("/api/v2/calendar/sync-all/", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchStatus();
        fetchSyncedTasks();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Sync failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Could not sync tasks");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Sync
          </DialogTitle>
          <DialogDescription>
            Sync your OnSwift task deadlines to Google Calendar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.is_connected ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <div>
                <p className="font-medium">
                  {status?.is_connected ? "Connected" : "Not Connected"}
                </p>
                {status?.is_connected && (
                  <p className="text-sm text-muted-foreground">
                    {status.synced_tasks_count} tasks synced
                  </p>
                )}
              </div>
            </div>

            {status?.is_connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                <span className="ml-2">Disconnect</span>
              </Button>
            ) : (
              <Button
                onClick={handleGoogleConnect}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Connect Google
              </Button>
            )}
          </div>

          {/* Sync All Button */}
          {status?.is_connected && (
            <Button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="w-full gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync All Task Deadlines
            </Button>
          )}

          {/* Synced Tasks List */}
          {syncedTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recently Synced</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {syncedTasks.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.task_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.project_name} • Due: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'No date'}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          {!status?.is_connected && (
            <p className="text-xs text-muted-foreground text-center">
              Connect your Google account to sync task deadlines to your calendar.
              Events will be created with reminders.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
