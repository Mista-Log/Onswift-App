export type Stage = "planning" | "in-progress" | "completed";

/**
 * What happens when the signed-in user tries to move a project task between stages:
 * - apply: change it now (saved on this device first, then sent to the server)
 * - gate:  ask about a deliverable / send it to the creator for approval instead
 * - locked: not allowed (also used to hide the swipe hint and drag for that card)
 *
 * Creators can set any stage. Talents can start or pause their own task (planning <-> in-progress);
 * completing goes through the creator, and a completed task or one awaiting approval is locked.
 * Personal tasks don't use this: their owner can always set any stage.
 */
export type StageAction = "apply" | "gate" | "locked";

export function stageAction(
  role: string | undefined,
  from: Stage,
  to: Stage,
  awaitingApproval = false,
): StageAction {
  if (from === to) return "locked";
  if (role === "creator") return "apply";
  if (from === "completed" || awaitingApproval) return "locked";
  return to === "completed" ? "gate" : "apply";
}
