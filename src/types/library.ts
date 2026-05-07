/** Document Library types */

export type ColorLabel = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

export interface LibraryFolder {
  id: string;
  creator: string;
  parent_folder: string | null;
  name: string;
  folder_type: "CLIENT" | "TEMPLATE" | "INTERNAL";
  client: string | null;
  document_count: number;
  subfolder_count: number;
  created_at: string;
}

export interface LibraryDocument {
  id: string;
  creator: string;
  client: string | null;
  folder: string;
  folder_name: string;
  name: string;
  file: string;
  file_type: string;
  size_kb: number;
  tags: string[];
  color_label: string | null;
  is_locked: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document: string;
  version_number: number;
  file: string;
  file_type: string;
  size_kb: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface DocumentActivity {
  id: string;
  document: string;
  actor: string;
  actor_name: string;
  actor_role: string;
  action: "VIEWED" | "DOWNLOADED" | "EDITED" | "SHARED" | "UPLOADED" | "DELETED" | "RESTORED";
  timestamp: string;
}

export interface DocumentShareLink {
  id: string;
  document: string;
  slug: string;
  url: string;
  permission: "VIEW" | "EDIT";
  is_expired: boolean;
  expires_at: string;
  created_at: string;
}

/** Color label options for documents */
export const COLOR_LABELS = [
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
] as const;
