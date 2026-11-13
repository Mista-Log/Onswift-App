import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Team from "./Team";

const navigate = vi.hoisted(() => vi.fn());
const team = {
  teamMembers: [
    { id: "h1", user_id: "talent-9", name: "Tala Nt", email: "t@x.com", role: "Designer", skills: ["Animation"] },
  ],
  isLoading: false,
  removeTeamMember: vi.fn(),
  fetchTeam: vi.fn(),
};

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "creator-1", role: "creator" } }) }));
vi.mock("@/contexts/TeamContext", () => ({ useTeam: () => team }));
vi.mock("@/api/apiClient", () => ({ secureFetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })), isNetworkError: () => false }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/dashboard/InviteMemberModal", () => ({ InviteMemberModal: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navigate }));

beforeEach(() => navigate.mockReset());

describe("team cards", () => {
  it("have two buttons: View Profile (the purple one) and Message", () => {
    render(<MemoryRouter><Team /></MemoryRouter>);
    const view = screen.getByRole("button", { name: /View Profile/ });
    const message = screen.getByRole("button", { name: /^Message$/ });
    expect(view).toHaveClass("bg-primary");
    expect(message).not.toHaveClass("bg-primary");
  });

  it("View Profile opens that person's profile", async () => {
    render(<MemoryRouter><Team /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /View Profile/ }));
    expect(navigate).toHaveBeenCalledWith("/profile/talent-9");
  });
});
