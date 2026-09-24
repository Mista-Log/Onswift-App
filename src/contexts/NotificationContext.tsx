import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { secureFetch } from "../api/apiClient";
import { useAuth } from "./AuthContext";
import { Notification } from "@/types/notification";
import { readCache, writeCache } from "../lib/cache";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(
    () => readCache<Notification[]>("notifications") ?? []
  );
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const signedInUserId = useRef<string | undefined>(undefined);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    // Check if user is authenticated before fetching
    const token = localStorage.getItem("onswift_access");
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await secureFetch("/api/v3/notifications/");

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        writeCache("notifications", data, 2 * 60 * 1000); // 2-min TTL — notifications are time-sensitive
      } else {
        console.error("Failed to fetch notifications");
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await secureFetch(
        `/api/v3/notifications/${notificationId}/read/`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_read: true }),
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Delete a single notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await secureFetch(`/api/v3/notifications/${notificationId}/`, {
        method: "DELETE",
      });
      if (response.ok || response.status === 204) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Mark all notifications as read (single bulk call, not one PATCH per item)
  const markAllAsRead = async () => {
    try {
      const response = await secureFetch("/api/v3/notifications/mark-all-read/", {
        method: "POST",
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, is_read: true }))
        );
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Delete every notification for the current user
  const deleteAllNotifications = async () => {
    try {
      const response = await secureFetch("/api/v3/notifications/delete-all/", {
        method: "DELETE",
      });
      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Error deleting all notifications:", error);
    }
  };

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Load when a user signs in (or the session is restored), clear when they sign out.
  useEffect(() => {
    if (!user) {
      if (signedInUserId.current) setNotifications([]);
      signedInUserId.current = undefined;
      return;
    }
    signedInUserId.current = user.id;
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [user?.id, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
