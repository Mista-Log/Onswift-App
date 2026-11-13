import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

const auth = { user: { id: "creator-1", role: "creator" } as { id: string; role: string } };
const secureFetch = vi.fn();
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a), isNetworkError: () => false }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navigate }));

const data = {
  id: "talent-9", role: "talent", full_name: "Tala Nt", avatar: null, headline: "Designer", bio: "Hi", skills: [],
  links: [], social_links: {}, featured: [],
  stats: [{ label: "Projects", value: 2 }, { label: "Tasks done", value: 5 }, { label: "Featured", value: 0 }],
  member_since: 2025,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const open = (id = "talent-9") =>
  render(
    <MemoryRouter initialEntries={[`/profile/${id}`]}>
      <Routes><Route path="/profile/:userId" element={<ProfilePage />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  secureFetch.mockReset();
  navigate.mockReset();
  auth.user = { id: "creator-1", role: "creator" };
});

describe("profile page", () => {
  it("shows a team member's profile with a Message button", async () => {
    secureFetch.mockResolvedValue(json(data));
    open();
    expect(await screen.findByRole("heading", { name: "Tala Nt" })).toBeInTheDocument();
    expect(secureFetch).toHaveBeenCalledWith("/api/v1/profiles/talent-9/");
    expect(screen.getByRole("button", { name: /Message/ })).toBeInTheDocument();
  });

  it("Message starts a conversation, then goes to the inbox", async () => {
    secureFetch.mockResolvedValueOnce(json(data)).mockResolvedValueOnce(json({}));
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Message/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages"));
    expect(secureFetch.mock.calls[1][0]).toBe("/api/v2/conversations/start/");
    expect(JSON.parse(secureFetch.mock.calls[1][1].body)).toEqual({ user_id: "talent-9" });
  });

  it("on your own profile it offers Edit, not Message", async () => {
    auth.user = { id: "talent-9", role: "talent" };
    secureFetch.mockResolvedValue(json(data));
    open();
    const edit = await screen.findByRole("link", { name: /Edit profile/ });
    expect(edit).toHaveAttribute("href", "/profile/edit");
    expect(screen.queryByRole("button", { name: /Message/ })).toBeNull();
  });

  it("a creator's own profile edits at the creator page", async () => {
    auth.user = { id: "talent-9", role: "creator" };
    secureFetch.mockResolvedValue(json(data));
    open();
    expect(await screen.findByRole("link", { name: /Edit profile/ })).toHaveAttribute("href", "/profile/creator/edit");
  });

  it("says so, kindly, when the profile is not available", async () => {
    secureFetch.mockResolvedValue(json({ detail: "Not found." }, 404));
    open("stranger");
    expect(await screen.findByText("This profile isn't available")).toBeInTheDocument();
  });

  it("says the same when the request itself fails", async () => {
    secureFetch.mockRejectedValue(new Error("offline"));
    open();
    expect(await screen.findByText("This profile isn't available")).toBeInTheDocument();
  });
});
