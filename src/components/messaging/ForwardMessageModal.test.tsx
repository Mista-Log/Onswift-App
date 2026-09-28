/**
 * Regression test for the Messages page blanking out: ForwardMessageModal is rendered
 * unconditionally by Messages, and used to throw while building its recipient list when a
 * conversation had no other participant (the API returns other_user: null for those).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForwardMessageModal } from "./ForwardMessageModal";

const conversations = [
  {
    id: "c1",
    other_user: null, // self-chat / deleted account
    last_message_content: null,
    last_message_time: null,
    unread_count: 0,
    updated_at: "2026-09-26T10:00:00Z",
  },
  {
    id: "c2",
    other_user: { id: "u2", name: "Ada Lovelace", avatar: null, company: null, role: "talent" },
    last_message_content: "hi",
    last_message_time: "2026-09-26T10:00:00Z",
    unread_count: 0,
    updated_at: "2026-09-26T10:00:00Z",
  },
  {
    id: "c3",
    other_user: { id: "bot", name: "OnSwift Ai", avatar: null, company: null, role: "assistant" },
    last_message_content: "hello",
    last_message_time: "2026-09-26T10:00:00Z",
    unread_count: 0,
    updated_at: "2026-09-26T10:00:00Z",
  },
];

describe("ForwardMessageModal", () => {
  it("does not crash when a conversation has no other participant", () => {
    expect(() =>
      render(
        <ForwardMessageModal
          open
          onClose={vi.fn()}
          messageCount={2}
          isCreator
          teamMembers={[]}
          myCreators={[]}
          conversations={conversations as never}
          isSending={false}
          onConfirm={vi.fn()}
        />
      )
    ).not.toThrow();

    // The valid contact is offered; the null one and the assistant are skipped.
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("OnSwift Ai")).toBeNull();
  });

  it("still renders when the modal is closed (Messages mounts it unconditionally)", () => {
    expect(() =>
      render(
        <ForwardMessageModal
          open={false}
          onClose={vi.fn()}
          messageCount={0}
          isCreator
          teamMembers={[]}
          myCreators={[]}
          conversations={conversations as never}
          isSending={false}
          onConfirm={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
