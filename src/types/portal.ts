/** Portal types for Client Portal */

export interface PortalProject {
  id: string;
  name: string;
  description: string;
  due_date: string | null;
  status: string;
  creator_name: string;
  tasks: PortalTask[];
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
}

export interface PortalProjectListItem {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  creator_name: string;
  progress: number;
}

export interface PortalTask {
  id: string;
  name: string;
  description: string;
  status: "planning" | "in_progress" | "completed" | string;
  assignee_name: string | null;
  due_date: string | null;
  deliverables: PortalDeliverable[];
  created_at: string;
}

export interface PortalDeliverable {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "revision" | string;
  feedback: string | null;
  revision_count: number;
  files: PortalDeliverableFile[];
  submitted_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PortalDeliverableFile {
  id: string;
  name: string;
  file: string;
  file_type: string;
  size: number;
  uploaded_at: string;
}

export interface PortalMessage {
  id: string;
  project: string;
  sender: string;
  sender_name: string;
  sender_role: string;
  content: string;
  file: string | null;
  file_name: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
