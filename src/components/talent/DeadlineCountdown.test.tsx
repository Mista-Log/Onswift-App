import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeadlineCountdown } from "./DeadlineCountdown";

const { useNextDeadline, useReminderSettings, save, toastError } = vi.hoisted(() => ({
  useNextDeadline: vi.fn(),
  useReminderSettings: vi.fn(),
  save: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useNextDeadline", () => ({ useNextDeadline }));
vi.mock("@/hooks/useReminderSettings", () => ({ useReminderSettings }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const aDeadline = { at: new Date(Date.now() + 3 * 24 * 3_600_000), row: { name: "Cut the trailer" } };
const withSetting = (show_deadline_timer?: boolean) => {
  useReminderSettings.mockReturnValue({ settings: { show_deadline_timer }, isLoading: false, save });
};

describe("DeadlineCountdown hide/show button", () => {
  beforeEach(() => {
    useNextDeadline.mockReset();
    useReminderSettings.mockReset();
    save.mockReset();
    toastError.mockReset();
    useNextDeadline.mockReturnValue(aDeadline);
    save.mockResolvedValue(true);
  });

  it("shows the clock and a Hide button by default", () => {
    withSetting(undefined);
    render(<DeadlineCountdown />);
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Deadline Timer" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the clock hidden when the account says so, with a Show button", () => {
    withSetting(false);
    render(<DeadlineCountdown />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("button", { name: "Show Deadline Timer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the clock at once and saves the choice on the account", async () => {
    withSetting(true);
    render(<DeadlineCountdown />);
    fireEvent.click(screen.getByRole("button", { name: "Hide Deadline Timer" }));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(save).toHaveBeenCalledWith({ show_deadline_timer: false });
    await waitFor(() => expect(screen.getByRole("button", { name: "Show Deadline Timer" })).toBeInTheDocument());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("brings the clock back from hidden", async () => {
    withSetting(false);
    render(<DeadlineCountdown />);
    fireEvent.click(screen.getByRole("button", { name: "Show Deadline Timer" }));
    expect(screen.getByRole("timer")).toBeInTheDocument();
    await waitFor(() => expect(save).toHaveBeenCalledWith({ show_deadline_timer: true }));
  });

  it("says so and puts the clock back when the save fails", async () => {
    save.mockResolvedValue(false);
    withSetting(true);
    render(<DeadlineCountdown />);
    fireEvent.click(screen.getByRole("button", { name: "Hide Deadline Timer" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });

  it("has no button when there is no deadline to count down to", () => {
    useNextDeadline.mockReturnValue(null);
    withSetting(true);
    render(<DeadlineCountdown />);
    expect(screen.getByText(/No upcoming deadlines/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
