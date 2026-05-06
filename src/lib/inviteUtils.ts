/**
 * Invite utilities for client onboarding via invite links
 */

export interface InviteState {
  inviteToken: string;
  clientEmail: string;
  projectName: string;
  creatorName: string;
  responses: Record<string, any>;
}

/**
 * Store invite state in sessionStorage for post-signup redirect
 */
export function saveInviteState(state: InviteState): void {
  sessionStorage.setItem("inviteState", JSON.stringify(state));
}

/**
 * Retrieve and clear invite state from sessionStorage
 */
export function getInviteState(): InviteState | null {
  const stored = sessionStorage.getItem("inviteState");
  if (stored) {
    sessionStorage.removeItem("inviteState");
    return JSON.parse(stored);
  }
  return null;
}

/**
 * Check if invite token is valid (not expired, exists)
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean;
  error?: string;
  data?: any;
}> {
  try {
    const response = await fetch(`/api/v5/invites/${token}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 410) {
        return { valid: false, error: "Invite has expired" };
      } else if (response.status === 400) {
        return { valid: false, error: "Invite has already been accepted" };
      } else if (response.status === 404) {
        return { valid: false, error: "Invite not found" };
      }
      return { valid: false, error: "Failed to validate invite" };
    }

    const data = await response.json();
    return { valid: true, data };
  } catch (err) {
    return { valid: false, error: "Failed to validate invite" };
  }
}

/**
 * Submit invite responses and accept the invite
 */
export async function acceptInvite(
  token: string,
  responses: Record<string, any>
): Promise<{
  success: boolean;
  action?: "signup" | "redirect";
  projectId?: string;
  email?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/v5/invites/${token}/accept/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to accept invite" };
    }

    const data = await response.json();
    return {
      success: true,
      action: data.action,
      projectId: data.project_id,
      email: data.email,
    };
  } catch (err) {
    return { success: false, error: "Failed to accept invite" };
  }
}
