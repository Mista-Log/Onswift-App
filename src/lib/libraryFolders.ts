/**
 * Document Library folder API helpers — CRUD + per-user sharing.
 * Mirrors the fetch* helpers in src/hooks/useDocs.ts for DocAccess.
 */
import { secureFetch } from "@/api/apiClient";
import type { LibraryFolder, FolderAccess, FolderSharableUser } from "@/types/library";

export async function fetchFolders(): Promise<LibraryFolder[]> {
  try {
    const res = await secureFetch("/api/v6/folders/");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function createFolder(
  name: string,
  parentFolderId?: string | null
): Promise<{ data: LibraryFolder | null; error?: string }> {
  try {
    const res = await secureFetch("/api/v6/folders/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_folder_id: parentFolderId || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error || body.detail || "Failed to create folder." };
    }
    return { data: await res.json() };
  } catch {
    return { data: null, error: "Network error." };
  }
}

export async function renameFolder(
  folderId: string,
  name: string
): Promise<LibraryFolder | null> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Folder access / sharing ─────────────────────────────────────────────────

export async function fetchFolderAccess(folderId: string): Promise<FolderAccess[]> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/access/`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function addFolderAccess(
  folderId: string,
  email: string,
  role: "viewer" | "editor"
): Promise<{ data: FolderAccess | null; error?: string }> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/access/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error || "Failed to share." };
    }
    return { data: await res.json() };
  } catch {
    return { data: null, error: "Network error." };
  }
}

export async function updateFolderAccess(
  folderId: string,
  accessId: string,
  role: "viewer" | "editor"
): Promise<FolderAccess | null> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/access/${accessId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function removeFolderAccess(folderId: string, accessId: string): Promise<boolean> {
  try {
    const res = await secureFetch(`/api/v6/folders/${folderId}/access/${accessId}/`, {
      method: "DELETE",
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function fetchFolderSharableUsers(): Promise<FolderSharableUser[]> {
  try {
    const res = await secureFetch("/api/v6/sharable-users/");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
