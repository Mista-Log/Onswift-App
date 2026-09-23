/**
 * Shared folder-browsing navigation state — breadcrumb trail + current
 * level's subfolders. Extracted from FolderManagerDialog so both the
 * in-page Library browser and the compact "Move to" picker can navigate
 * folders identically without duplicating the logic.
 */
import { useState, useEffect, useCallback } from "react";
import { fetchFolders, fetchFolderPath } from "@/lib/libraryFolders";
import type { LibraryFolder } from "@/types/library";

export interface FolderBreadcrumbEntry {
  id: string | null;
  name: string;
}

export function useFolderBrowser(initialFolderId: string | null = null) {
  const [breadcrumb, setBreadcrumb] = useState<FolderBreadcrumbEntry[]>([{ id: null, name: "Home" }]);
  const [subfolders, setSubfolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(false);

  const currentId = breadcrumb[breadcrumb.length - 1].id;

  const loadSubfolders = useCallback(async (folderId: string | null) => {
    setLoading(true);
    const folders = await fetchFolders({ parentId: folderId });
    setSubfolders(folders);
    setLoading(false);
    return folders;
  }, []);

  const goTo = useCallback(async (folderId: string | null) => {
    if (folderId === null) {
      setBreadcrumb([{ id: null, name: "Home" }]);
      await loadSubfolders(null);
      return;
    }
    const path = await fetchFolderPath(folderId);
    setBreadcrumb(path);
    await loadSubfolders(folderId);
  }, [loadSubfolders]);

  useEffect(() => {
    goTo(initialFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFolder = useCallback((folder: LibraryFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadSubfolders(folder.id);
  }, [loadSubfolders]);

  const goUp = useCallback(() => {
    setBreadcrumb((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      loadSubfolders(next[next.length - 1].id);
      return next;
    });
  }, [loadSubfolders]);

  const goToBreadcrumb = useCallback((index: number) => {
    setBreadcrumb((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = prev.slice(0, index + 1);
      loadSubfolders(next[next.length - 1].id);
      return next;
    });
  }, [loadSubfolders]);

  const refresh = useCallback(() => loadSubfolders(currentId), [loadSubfolders, currentId]);

  return {
    breadcrumb,
    currentId,
    subfolders,
    loading,
    openFolder,
    goUp,
    goToBreadcrumb,
    goTo,
    refresh,
    setSubfolders,
  };
}
