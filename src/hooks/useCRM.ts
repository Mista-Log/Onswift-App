import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CRMFieldType =
  | "text" | "email" | "phone" | "url" | "number"
  | "date" | "single_select" | "multi_select" | "checkbox";

export type AccessRole = "viewer" | "editor" | "admin";
export type UserRole = "owner" | AccessRole;

export interface CRMColumn {
  id: string;
  name: string;
  field_type: CRMFieldType;
  options: string[];
  order: number;
  created_at: string;
}

export interface CRMRow {
  id: string;
  values: Record<string, string | number | boolean | string[]>;
  order: number;
  created_at: string;
}

export interface CRMAccessEntry {
  id: string;
  user: string;
  user_name: string;
  user_email: string;
  role: AccessRole;
  created_at: string;
}

export interface CRMSheetSummary {
  id: string;
  name: string;
  column_count: number;
  row_count: number;
  column_names: string[];
  user_role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface CRMSheetFull {
  id: string;
  name: string;
  columns: CRMColumn[];
  rows: CRMRow[];
  access_list: CRMAccessEntry[];
  user_role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface SharableUser {
  user_id: string;
  name: string;
  email: string;
  type: "team" | "client";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCRM() {
  const [sheets, setSheets] = useState<CRMSheetSummary[]>([]);
  const [activeSheet, setActiveSheet] = useState<CRMSheetFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // ── Fetch sheet list ───────────────────────────────────────────────────────

  const fetchSheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await secureFetch("/api/v7/sheets/");
      if (res.ok) setSheets(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  // ── Open sheet (fetch full detail) ────────────────────────────────────────

  const openSheet = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const res = await secureFetch(`/api/v7/sheets/${id}/`);
      if (res.ok) setActiveSheet(await res.json());
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const closeSheet = useCallback(() => setActiveSheet(null), []);

  // ── Sheet CRUD ─────────────────────────────────────────────────────────────

  const createSheet = useCallback(async (name: string) => {
    const res = await secureFetch("/api/v7/sheets/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create sheet");
    const created: CRMSheetSummary = await res.json();
    setSheets((prev) => [created, ...prev]);
    return created;
  }, []);

  const renameSheet = useCallback(async (id: string, name: string) => {
    const res = await secureFetch(`/api/v7/sheets/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to rename sheet");
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    if (activeSheet?.id === id) setActiveSheet((prev) => prev ? { ...prev, name } : prev);
  }, [activeSheet]);

  const deleteSheet = useCallback(async (id: string) => {
    const res = await secureFetch(`/api/v7/sheets/${id}/`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete sheet");
    setSheets((prev) => prev.filter((s) => s.id !== id));
    if (activeSheet?.id === id) setActiveSheet(null);
  }, [activeSheet]);

  // ── Column CRUD ────────────────────────────────────────────────────────────

  const addColumn = useCallback(async (
    sheetId: string,
    col: { name: string; field_type: CRMFieldType; options?: string[]; order?: number }
  ) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/columns/`, {
      method: "POST",
      body: JSON.stringify(col),
    });
    if (!res.ok) throw new Error("Failed to add column");
    const created: CRMColumn = await res.json();

    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return {
        ...prev,
        columns: [...prev.columns, created],
        rows: prev.rows.map((r) => ({
          ...r,
          values: {
            ...r.values,
            [created.id]: created.field_type === "checkbox" ? false
              : created.field_type === "multi_select" ? []
              : "",
          },
        })),
      };
    });

    setSheets((prev) =>
      prev.map((s) => s.id === sheetId ? { ...s, column_count: s.column_count + 1 } : s)
    );

    return created;
  }, []);

  const renameColumn = useCallback(async (sheetId: string, columnId: string, name: string) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/columns/${columnId}/`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to rename column");
    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return { ...prev, columns: prev.columns.map((c) => c.id === columnId ? { ...c, name } : c) };
    });
  }, []);

  const updateColumn = useCallback(async (
    sheetId: string,
    columnId: string,
    updates: { name?: string; field_type?: CRMFieldType; options?: string[] }
  ) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/columns/${columnId}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update column");
    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return { ...prev, columns: prev.columns.map((c) => c.id === columnId ? { ...c, ...updates } : c) };
    });
  }, []);

  const deleteColumn = useCallback(async (sheetId: string, columnId: string) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/columns/${columnId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete column");

    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return { ...prev, columns: prev.columns.filter((c) => c.id !== columnId) };
    });

    setSheets((prev) =>
      prev.map((s) => s.id === sheetId ? { ...s, column_count: Math.max(0, s.column_count - 1) } : s)
    );
  }, []);

  // ── Row CRUD ───────────────────────────────────────────────────────────────

  const addRow = useCallback(async (sheetId: string, columns: CRMColumn[]) => {
    const values: Record<string, string | number | boolean | string[]> = {};
    for (const col of columns) {
      values[col.id] = col.field_type === "checkbox" ? false
        : col.field_type === "multi_select" ? []
        : "";
    }

    const res = await secureFetch(`/api/v7/sheets/${sheetId}/rows/`, {
      method: "POST",
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error("Failed to add row");
    const created: CRMRow = await res.json();

    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return { ...prev, rows: [...prev.rows, created] };
    });

    setSheets((prev) =>
      prev.map((s) => s.id === sheetId ? { ...s, row_count: s.row_count + 1 } : s)
    );

    return created;
  }, []);

  const deleteRow = useCallback(async (sheetId: string, rowId: string) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/rows/${rowId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete row");

    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return { ...prev, rows: prev.rows.filter((r) => r.id !== rowId) };
    });

    setSheets((prev) =>
      prev.map((s) => s.id === sheetId ? { ...s, row_count: Math.max(0, s.row_count - 1) } : s)
    );
  }, []);

  const updateRowValues = useCallback(async (
    sheetId: string,
    rowId: string,
    values: Record<string, string | number | boolean | string[]>
  ) => {
    setActiveSheet((prev) => {
      if (!prev || prev.id !== sheetId) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => r.id === rowId ? { ...r, values } : r),
      };
    });

    const res = await secureFetch(`/api/v7/sheets/${sheetId}/rows/${rowId}/`, {
      method: "PATCH",
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error("Failed to save cell");
  }, []);

  // ── Access ─────────────────────────────────────────────────────────────────

  const upsertAccess = useCallback(async (
    sheetId: string,
    userId: string,
    role: AccessRole,
    existingAccessId?: string
  ) => {
    if (existingAccessId) {
      const res = await secureFetch(`/api/v7/sheets/${sheetId}/access/${existingAccessId}/`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update access");
      setActiveSheet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          access_list: prev.access_list.map((a) =>
            a.id === existingAccessId ? { ...a, role } : a
          ),
        };
      });
    } else {
      const res = await secureFetch(`/api/v7/sheets/${sheetId}/access/`, {
        method: "POST",
        body: JSON.stringify({ user: userId, role }),
      });
      if (!res.ok) throw new Error("Failed to grant access");
      const created: CRMAccessEntry = await res.json();
      setActiveSheet((prev) => {
        if (!prev) return prev;
        return { ...prev, access_list: [...prev.access_list, created] };
      });
    }
  }, []);

  const revokeAccess = useCallback(async (sheetId: string, accessId: string) => {
    const res = await secureFetch(`/api/v7/sheets/${sheetId}/access/${accessId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to revoke access");
    setActiveSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        access_list: prev.access_list.filter((a) => a.id !== accessId),
      };
    });
  }, []);

  const fetchSharableUsers = useCallback(async (): Promise<SharableUser[]> => {
    const res = await secureFetch("/api/v7/sharable-users/");
    if (!res.ok) return [];
    return res.json();
  }, []);

  return {
    sheets,
    activeSheet,
    isLoading,
    isDetailLoading,
    fetchSheets,
    openSheet,
    closeSheet,
    createSheet,
    renameSheet,
    deleteSheet,
    addColumn,
    renameColumn,
    updateColumn,
    deleteColumn,
    addRow,
    deleteRow,
    updateRowValues,
    upsertAccess,
    revokeAccess,
    fetchSharableUsers,
  };
}
