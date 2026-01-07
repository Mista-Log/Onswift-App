export type NotificationType = "hire" | "system";

export interface Notification {
  id: string;
  user: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_read: boolean;
  hire_request?: string; // HireRequest ID if applicable
  created_at: string;
}

export interface HireRequestDetails {
  id: string;
  creator: string;
  talent: string;
  message: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  responded_at?: string;
}
