import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicProfile from "@/pages/PublicProfile";
import { CreatorProfileCard } from "./CreatorProfileCard";
import { ShareProfileButton } from "./ShareProfileButton";
import type { ProfileData } from "./ProfileView";

const secureFetch = vi.fn();
const publicFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({
  secureFetch: (...a: unknown[]) => secureFetch(...a),
  publicFetch: (...a: unknown[]) => publicFetch(...a),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({
  user: null as null | { id: string; role: string },
  isAuthenticated: false,
  logout: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const profile: ProfileData = {
  role: "creator", full_name: "Ada Lovelace", avatar: null, headline: "Studio X", bio: "We make films", skills: [],
  links: [], social_links: {}, featured: [], handle: null,
  stats: [{ label: "Projects", value: 2 }, { label: "Team", value: 3 }, { label: "Featured", value: 0 }],
};

beforeEach(() => {
  secureFetch.mockReset();
  publicFetch.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  auth.logout.mockReset();
  auth.user = { id: "u1", role: "creator" };
  auth.isAuthenticated = true;
});

const openShare = async () => {
  render(<MemoryRouter><ShareProfileButton /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Share profile" }));
  return screen.getByRole("dialog");
};

describe("share button, creator", () => {
  it("starts with the suggested link, switched off, and nothing to copy yet", async () => {
    secureFetch.mockResolvedValue(json({ handle: null, suggested_handle: "ada.lovelace", is_public: false }));
    const dialog = await openShare();
    expect(await within(dialog).findByLabelText("Your link")).toHaveValue("ada.lovelace");
    expect(within(dialog).getByText(`${window.location.host}/`)).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Public link" })).not.toBeChecked();
    expect(within(dialog).queryByRole("button", { name: /Copy link/ })).toBeNull();
  });

  it("switching it on saves the link and offers Copy and Open", async () => {
    secureFetch
      .mockResolvedValueOnce(json({ handle: null, suggested_handle: "ada.lovelace", is_public: false }))
      .mockResolvedValueOnce(json({ handle: "ada.lovelace", suggested_handle: "ada.lovelace", is_public: true }));
    const dialog = await openShare();
    await userEvent.click(await within(dialog).findByRole("switch", { name: "Public link" }));
    await waitFor(() => expect(secureFetch).toHaveBeenCalledTimes(2));
    const [url, init] = secureFetch.mock.calls[1];
    expect(url).toBe("/api/v1/auth/share/");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ handle: "ada.lovelace", is_public: true });
    expect(await within(dialog).findByRole("button", { name: /Copy link/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Open/ })).toHaveAttribute("href", `${window.location.origin}/ada.lovelace`);
    expect(within(dialog).getByText(/Anyone with the link can see your profile/)).toBeInTheDocument();
  });

  it("shows the server's reason when a link is taken, and stays off", async () => {
    secureFetch
      .mockResolvedValueOnce(json({ handle: null, suggested_handle: "ada.lovelace", is_public: false }))
      .mockResolvedValueOnce(json({ handle: ["That link is taken. Try another."] }, 400));
    const dialog = await openShare();
    await userEvent.click(await within(dialog).findByRole("switch", { name: "Public link" }));
    expect(await within(dialog).findByText("That link is taken. Try another.")).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Public link" })).not.toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("renaming a live link asks to save, with a warning that the old one breaks", async () => {
    secureFetch
      .mockResolvedValueOnce(json({ handle: "ada.lovelace", suggested_handle: "ada.lovelace", is_public: true }))
      .mockResolvedValueOnce(json({ handle: "ada.films", suggested_handle: "ada.films", is_public: true }));
    const dialog = await openShare();
    const input = await within(dialog).findByLabelText("Your link");
    await userEvent.clear(input);
    await userEvent.type(input, "Ada.Films");
    expect(within(dialog).queryByRole("button", { name: /Copy link/ })).toBeNull();
    expect(within(dialog).getByText(/breaks the old one/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save new link" }));
    await waitFor(() => expect(secureFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(secureFetch.mock.calls[1][1].body)).toEqual({ handle: "ada.films" });
    expect(await within(dialog).findByRole("button", { name: /Copy link/ })).toBeInTheDocument();
  });

  it("says so when the link can't be loaded", async () => {
    secureFetch.mockResolvedValue(json({}, 500));
    const dialog = await openShare();
    expect(await within(dialog).findByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});

describe("share button, other roles", () => {
  it("talents get a friendly nudge to a creator account, and no request is made", async () => {
    auth.user = { id: "t1", role: "talent" };
    const dialog = await openShare();
    expect(within(dialog).getByText("Public links come with a creator account")).toBeInTheDocument();
    expect(within(dialog).getByText(/already visible to the creators you work with/)).toBeInTheDocument();
    expect(secureFetch).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out and create one" }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it("'Not now' just closes it", async () => {
    auth.user = { id: "t1", role: "talent" };
    const dialog = await openShare();
    await userEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("clients have no share button", () => {
    auth.user = { id: "c1", role: "client" };
    const { container } = render(<MemoryRouter><ShareProfileButton /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("public profile page", () => {
  const visit = (path = "/ada.lovelace") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:handle" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows the profile to a signed-out visitor with a nudge to sign up", async () => {
    auth.user = null;
    auth.isAuthenticated = false;
    publicFetch.mockResolvedValue(json({ ...profile, handle: "ada.lovelace" }));
    visit();
    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(publicFetch).toHaveBeenCalledWith("/api/v1/public/profiles/ada.lovelace/");
    expect(screen.getByRole("link", { name: "Sign up free" })).toHaveAttribute("href", "/get-started");
    const nudge = screen.getByRole("region", { name: "Join OnSwift" });
    expect(within(nudge).getByText(/Like how Ada shows their work/)).toBeInTheDocument();
    expect(within(nudge).getByRole("link", { name: "Create your account" })).toHaveAttribute("href", "/get-started");
  });

  it("does not nudge someone who is already signed in", async () => {
    publicFetch.mockResolvedValue(json(profile));
    visit();
    await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(screen.queryByRole("region", { name: "Join OnSwift" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign up free" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open OnSwift" })).toHaveAttribute("href", "/home");
  });

  it("a link that is off or unknown is the normal not-found page", async () => {
    publicFetch.mockResolvedValue(json({ detail: "Not found." }, 404));
    visit("/no.body");
    expect(await screen.findByText("Oops! Page not found")).toBeInTheDocument();
  });

  it("a network failure is not-found too, not a crash", async () => {
    publicFetch.mockImplementation(async () => {
      throw new Error("offline");
    });
    visit();
    expect(await screen.findByText("Oops! Page not found")).toBeInTheDocument();
  });
});

describe("creator profile pill on a form", () => {
  it("opens the profile in place", async () => {
    render(<CreatorProfileCard profile={profile} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "View Ada's profile" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    // No public link is on, so there is nowhere to send them.
    expect(within(dialog).queryByRole("link", { name: /Open full profile/ })).toBeNull();
  });

  it("links to the full page only while the public link is on", async () => {
    render(<CreatorProfileCard profile={{ ...profile, handle: "ada.lovelace" }} />);
    await userEvent.click(screen.getByRole("button", { name: "View Ada's profile" }));
    const link = within(screen.getByRole("dialog")).getByRole("link", { name: /Open full profile/ });
    expect(link).toHaveAttribute("href", "/ada.lovelace");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
