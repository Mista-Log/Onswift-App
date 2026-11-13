import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileCompletionBanner } from "./ProfileCompletionBanner";

const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

const show = (pct: number) =>
  render(
    <MemoryRouter>
      <ProfileCompletionBanner completionPercentage={pct} />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  auth.user = { id: "u1" };
});

describe("profile completion ring", () => {
  it("shows the percentage and links to the profile editor", () => {
    show(60);
    const link = screen.getByRole("link", { name: /Profile 60% complete/ });
    expect(link).toHaveAttribute("href", "/profile/edit");
    expect(link).toHaveTextContent("60%");
  });

  it("is hidden once the profile is complete", () => {
    show(100);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("stays closed after the close button is used, even after a reload", async () => {
    const first = show(60);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss profile reminder" }));
    expect(screen.queryByRole("link")).toBeNull();
    first.unmount(); // a reload mounts it again from scratch
    show(60);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closing it for one person does not close it for another on the same browser", async () => {
    const first = show(60);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss profile reminder" }));
    first.unmount();
    auth.user = { id: "u2" };
    show(60);
    expect(screen.getByRole("link", { name: /Profile 60% complete/ })).toBeInTheDocument();
  });

  it("still closes for this visit when storage is blocked", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    show(60);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss profile reminder" }));
    expect(screen.queryByRole("link")).toBeNull();
    spy.mockRestore();
  });

  it("never shows a negative percentage", () => {
    show(-5);
    expect(screen.getByRole("link")).toHaveTextContent("0%");
  });
});

describe("header variant (beside the notification bell, phones only)", () => {
  const both = () =>
    render(
      <MemoryRouter>
        <ProfileCompletionBanner variant="header" completionPercentage={60} />
        <ProfileCompletionBanner completionPercentage={60} />
      </MemoryRouter>,
    );

  it("is just the ring: no label, one tap to the profile editor, phones only", () => {
    render(
      <MemoryRouter>
        <ProfileCompletionBanner variant="header" completionPercentage={60} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Complete your profile$/)).toBeNull();
    const link = screen.getByRole("link", { name: /Profile 60% complete/ });
    expect(link).toHaveAttribute("href", "/profile/edit");
    expect(link.parentElement?.parentElement).toHaveClass("md:hidden");
  });

  it("is 36px, in proportion with the other top-bar controls, while the card ring stays 56px", () => {
    const header = render(
      <MemoryRouter>
        <ProfileCompletionBanner variant="header" completionPercentage={60} />
      </MemoryRouter>,
    );
    expect(header.container.querySelector("svg")).toHaveAttribute("width", "36");
    header.unmount();
    const card = render(
      <MemoryRouter>
        <ProfileCompletionBanner completionPercentage={60} />
      </MemoryRouter>,
    );
    expect(card.container.querySelector("svg")).toHaveAttribute("width", "56");
  });

  it("the card version is hidden on phones so the two never show together", () => {
    show(60);
    expect(screen.getByRole("link").parentElement?.parentElement).toHaveClass("hidden", "md:flex");
  });

  it("closing one copy closes the other too, with no reload", async () => {
    both();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss profile reminder" })[0]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("does not close another account's copy", async () => {
    both();
    auth.user = { id: "u2" };
    window.dispatchEvent(new CustomEvent("onswift:profile-ring-dismissed", { detail: "someone-else" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
