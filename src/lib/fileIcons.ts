/** File-type → icon/color mapping shared by the Library table and folder tiles. */
import { FileText, Image, FileArchive, type LucideIcon } from "lucide-react";

export interface FileIconInfo {
  Icon: LucideIcon;
  colorClass: string;
}

export function getFileIconInfo(fileType?: string): FileIconInfo {
  const type = (fileType || "").toLowerCase();
  const isImage = type.startsWith("image/");
  const isPDF = type.includes("pdf");
  const isArchive = type.includes("zip") || type.includes("compressed") || type.includes("rar");

  if (isImage) {
    return { Icon: Image, colorClass: "text-green-500 bg-green-50 dark:bg-green-950/30" };
  }
  if (isArchive) {
    return { Icon: FileArchive, colorClass: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" };
  }
  if (isPDF) {
    return { Icon: FileText, colorClass: "text-red-500 bg-red-50 dark:bg-red-950/30" };
  }
  return { Icon: FileText, colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" };
}
