import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m) } }));

import { AttachmentsSection } from "./AttachmentsSection";

const setup = (overrides: Partial<React.ComponentProps<typeof AttachmentsSection>> = {}) => {
  const props = {
    attachments: [{ id: "a1", name: "Brief", url: "https://example.com/brief" }],
    onAddLink: vi.fn().mockResolvedValue(undefined),
    onAddFile: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<AttachmentsSection {...props} />);
  return props;
};

describe("AttachmentsSection", () => {
  it("lists attachments as links that open in a new tab", () => {
    setup();
    const link = screen.getByRole("link", { name: /Brief/ });
    expect(link).toHaveAttribute("href", "https://example.com/brief");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("adds a pasted link and clears the box", async () => {
    const props = setup();
    const input = screen.getByPlaceholderText("Paste a link");
    fireEvent.change(input, { target: { value: "https://a.test" } });
    fireEvent.click(screen.getByRole("button", { name: /Add link/ }));
    await waitFor(() => expect(props.onAddLink).toHaveBeenCalledWith("https://a.test"));
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("removes an attachment", async () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove Brief" }));
    await waitFor(() => expect(props.onRemove).toHaveBeenCalledWith("a1"));
  });

  it("hides remove for attachments the user can't delete", () => {
    setup({ canRemove: () => false });
    expect(screen.queryByRole("button", { name: "Remove Brief" })).not.toBeInTheDocument();
  });

  it("shows the message from a failed add and keeps the link in the box", async () => {
    const props = setup({ onAddLink: vi.fn().mockRejectedValue(new Error("Couldn't add that link.")) });
    const input = screen.getByPlaceholderText("Paste a link");
    fireEvent.change(input, { target: { value: "https://a.test" } });
    fireEvent.click(screen.getByRole("button", { name: /Add link/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't add that link."));
    expect(props.onAddLink).toHaveBeenCalled();
    expect(input).toHaveValue("https://a.test");
  });
});
