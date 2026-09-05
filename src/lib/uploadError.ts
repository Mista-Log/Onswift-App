import { isNetworkError } from "@/api/apiClient";

/**
 * Friendly message for a failed file upload. Only overrides the caller's
 * own message when we can't attribute the failure to anything specific —
 * a network error, or a 5xx (most commonly our backend's storage_unavailable
 * guard when Cloudinary itself is down or misconfigured). Ordinary 4xx
 * validation errors should keep showing the server's actual message via
 * `fallback`.
 */
export function uploadErrorMessage(
  status?: number,
  err?: unknown,
  fallback = "Upload failed. Please try again."
): string {
  if (isNetworkError(err) || (status !== undefined && status >= 500)) {
    return "Upload failed — please use the Attachment link for now.";
  }
  return fallback;
}
