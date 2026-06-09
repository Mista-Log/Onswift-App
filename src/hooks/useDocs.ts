import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocListItem {
  id: string;
  title: string;
  icon: string;
  parent: string | null;
  project: number | null;
  order: number;
  children_count: number;
  updated_at: string;
}

export interface DocDetail {
  id: string;
  title: string;
  icon: string;
  content: object[];
  parent: string | null;
  project: number | null;
  order: number;
  created_at: string;
  updated_at: string;
  user_role: "owner" | "editor" | "viewer";
}

// ── Share / Access types ──────────────────────────────────────────────────────

export interface DocAccessUser {
  id: string;
  email: string;
  full_name: string;
}

export interface DocAccess {
  id: string;
  user: DocAccessUser;
  role: "viewer" | "editor";
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
}

export interface DocSharableUser {
  user_id: string;
  name: string;
  email: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDocs() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureFetch("/api/v8/docs/?all=1");
      if (!res.ok) throw new Error("Failed to load docs");
      const data: DocListItem[] = await res.json();
      setDocs(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createDoc = useCallback(async (payload: {
    title?: string;
    icon?: string;
    parent?: string | null;
    project?: number | null;
  }): Promise<DocDetail | null> => {
    try {
      const res = await secureFetch("/api/v8/docs/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", ...payload }),
      });
      if (!res.ok) throw new Error("Failed to create doc");
      const doc: DocDetail = await res.json();
      await fetchAll();
      return doc;
    } catch {
      return null;
    }
  }, [fetchAll]);

  const deleteDoc = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await secureFetch(`/api/v8/docs/${id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      await fetchAll();
      return true;
    } catch {
      return false;
    }
  }, [fetchAll]);

  return { docs, loading, error, fetchAll, createDoc, deleteDoc };
}

// ── Single doc fetch/save ─────────────────────────────────────────────────────

export async function fetchDoc(id: string): Promise<DocDetail | null> {
  try {
    const res = await secureFetch(`/api/v8/docs/${id}/`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveDoc(id: string, patch: Partial<Omit<DocDetail, "id" | "created_at" | "updated_at">>): Promise<DocDetail | null> {
  try {
    const res = await secureFetch(`/api/v8/docs/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchDocChildren(id: string): Promise<DocListItem[]> {
  try {
    const res = await secureFetch(`/api/v8/docs/${id}/children/`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── Doc access / sharing ──────────────────────────────────────────────────────

export async function fetchDocAccess(docId: string): Promise<DocAccess[]> {
  try {
    const res = await secureFetch(`/api/v8/docs/${docId}/access/`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function addDocAccess(
  docId: string,
  email: string,
  role: "viewer" | "editor",
): Promise<{ data: DocAccess | null; error?: string }> {
  try {
    const res = await secureFetch(`/api/v8/docs/${docId}/access/`, {
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

export async function updateDocAccess(
  docId: string,
  accessId: string,
  role: "viewer" | "editor",
): Promise<DocAccess | null> {
  try {
    const res = await secureFetch(`/api/v8/docs/${docId}/access/${accessId}/`, {
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

export async function removeDocAccess(docId: string, accessId: string): Promise<boolean> {
  try {
    const res = await secureFetch(`/api/v8/docs/${docId}/access/${accessId}/`, {
      method: "DELETE",
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (query.length < 2) return [];
  try {
    const res = await secureFetch(`/api/v8/users/search/?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchDocSharableUsers(): Promise<DocSharableUser[]> {
  try {
    const res = await secureFetch("/api/v8/sharable-users/");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
