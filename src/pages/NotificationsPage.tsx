/**
 * NotificationsPage — full-page notification center for every role.
 * Search + read/unread tabs modeled on DocumentLibrary.tsx's pill-search +
 * Tabs pattern; per-row rendering reuses NotificationItem verbatim (the
 * same component NotificationDropdown already uses).
 */
import { useState } from "react";
import { Bell, Check, Loader2, Search, Trash2, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationItem } from "@/components/notifications/NotificationItem";

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "read">("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const q = query.toLowerCase();
  const searched = q
    ? notifications.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      )
    : notifications;

  const displayed =
    tab === "unread" ? searched.filter((n) => !n.is_read) :
    tab === "read" ? searched.filter((n) => n.is_read) :
    searched;

  const readCount = notifications.length - unreadCount;

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    await markAllAsRead();
    setIsMarkingAll(false);
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete all notifications? This can't be undone.")) return;
    setIsDeletingAll(true);
    await deleteAllNotifications();
    setIsDeletingAll(false);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll || unreadCount === 0}
            >
              {isMarkingAll ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={handleDeleteAll}
              disabled={isDeletingAll || notifications.length === 0}
            >
              {isDeletingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete all
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8 rounded-full h-9 bg-secondary/50"
            placeholder="Search notifications…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}>
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="bg-muted/50 h-9 gap-1">
            <TabsTrigger value="all" className="text-xs gap-1.5">
              All
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{notifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs gap-1.5">
              Unread
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{unreadCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs gap-1.5">
              Read
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{readCount}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={28} className="animate-spin text-muted-foreground" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {query ? "No matching notifications" : "No notifications"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {displayed.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
