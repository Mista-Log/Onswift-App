import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkLabel, safeHref } from "@/lib/profileLinks";
import { ProfileView, type ProfileData } from "./ProfileView";

const profile = (over: Partial<ProfileData> = {}): ProfileData => ({
  role: "talent",
  full_name: "Tala Nt",
  avatar: null,
  headline: "Motion designer",
  bio: "I make things move.",
  skills: ["Animation", "3D Design"],
  links: ["https://behance.net/tala"],
  social_links: { linkedin: "https://linkedin.com/in/tala", github: "" },
  featured: [
    { id: "f1", title: "Brand film", link: "https://vimeo.com/1", image: "https://img.example/1.png" },
    { id: "f2", title: "", link: "", image: "https://img.example/2.png" },
  ],
  stats: [
    { label: "Projects", value: 4 },
    { label: "Tasks done", value: 21 },
    { label: "Featured", value: 2 },
  ],
  member_since: 2025,
  ...over,
});

describe("profile view", () => {
  it("shows the name, headline and bio up top, and opens on the work", () => {
    render(<ProfileView profile={profile()} />);
    expect(screen.getByRole("heading", { name: "Tala Nt" })).toBeInTheDocument();
    expect(screen.getByText("Motion designer")).toBeInTheDocument();
    expect(screen.getByText("I make things move.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Work" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the numbers, skills and join year under Info", async () => {
    render(<ProfileView profile={profile()} />);
    expect(screen.queryByText("Tasks done")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Info" }));
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("Tasks done")).toBeInTheDocument();
    expect(screen.getByText("3D Design")).toBeInTheDocument();
    expect(screen.getByText(/since 2025/)).toBeInTheDocument();
  });

  describe("wide layout", () => {
    const screenIs = (desktop: boolean) =>
      vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    afterEach(() => vi.unstubAllGlobals());

    it("on desktop the info sits beside the work, so there is no Info tab", () => {
      screenIs(true);
      render(<ProfileView profile={profile()} layout="wide" />);
      expect(screen.queryByRole("tab", { name: "Info" })).toBeNull();
      expect(screen.getByText("Tasks done")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open Brand film" })).toBeInTheDocument();
    });

    it("on a phone it is the same single column as the preview", () => {
      screenIs(false);
      render(<ProfileView profile={profile()} layout="wide" />);
      expect(screen.getByRole("tab", { name: "Info" })).toBeInTheDocument();
      expect(screen.queryByText("Tasks done")).toBeNull();
    });

    it("the previews stay a single column even on a desktop screen", () => {
      screenIs(true);
      render(<ProfileView profile={profile()} />);
      expect(screen.getByRole("tab", { name: "Info" })).toBeInTheDocument();
    });
  });

  it("puts the page's own buttons under the name", () => {
    render(<ProfileView profile={profile()} actions={<button>Message</button>} />);
    expect(screen.getByRole("button", { name: "Message" })).toBeInTheDocument();
  });

  it("shows featured work as cards, one per piece", () => {
    render(<ProfileView profile={profile()} />);
    expect(screen.getByRole("button", { name: "Open Brand film" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open featured work" })).toBeInTheDocument();
  });

  it("opens a piece larger, with a link out when it has one", async () => {
    render(<ProfileView profile={profile()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open Brand film" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Brand film")).toBeInTheDocument();
    const visit = within(dialog).getByRole("link", { name: /Visit link/ });
    expect(visit).toHaveAttribute("href", "https://vimeo.com/1");
    expect(visit).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("has no link button for a piece without a link", async () => {
    render(<ProfileView profile={profile()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open featured work" }));
    expect(within(screen.getByRole("dialog")).queryByRole("link")).toBeNull();
  });

  it("says so when nothing is featured", () => {
    render(<ProfileView profile={profile({ featured: [] })} />);
    expect(screen.getByText("Nothing featured yet.")).toBeInTheDocument();
  });

  it("lists portfolio links on the Links tab", async () => {
    render(<ProfileView profile={profile()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByRole("link", { name: /behance.net\/tala/ })).toHaveAttribute("href", "https://behance.net/tala");
  });

  it("shows social links as logo buttons, only for the ones filled in", () => {
    render(
      <ProfileView
        profile={profile({
          social_links: { linkedin: "https://linkedin.com/in/tala", tiktok: "tiktok.com/@tala", github: "", dribbble: "  " },
        })}
      />,
    );
    const row = within(screen.getByRole("list", { name: "Social links" }));
    expect(row.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://linkedin.com/in/tala");
    expect(row.getByRole("link", { name: "TikTok" })).toHaveAttribute("href", "https://tiktok.com/@tala");
    expect(row.getByRole("link", { name: "LinkedIn" }).querySelector("svg")).not.toBeNull();
    expect(row.queryByRole("link", { name: "GitHub" })).toBeNull();
    expect(row.queryByRole("link", { name: "Dribbble" })).toBeNull();
    expect(row.getAllByRole("link")).toHaveLength(2);
  });

  it("has no social row at all when none are set, and never links a script", () => {
    render(<ProfileView profile={profile({ social_links: { github: "javascript:alert(1)" } })} />);
    expect(screen.queryByRole("list", { name: "Social links" })).toBeNull();
  });

  it("never turns a script link into a clickable link", async () => {
    render(<ProfileView profile={profile({ links: ["javascript:alert(1)"], social_links: {} })} />);
    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No links added yet.")).toBeInTheDocument();
  });

  it("copes with a brand-new, empty profile", () => {
    render(
      <ProfileView
        profile={profile({ full_name: "", headline: "", bio: "", skills: [], links: [], social_links: {}, featured: [], member_since: null })}
      />,
    );
    expect(screen.getByText("Your name")).toBeInTheDocument();
    expect(screen.getByText("Nothing featured yet.")).toBeInTheDocument();
  });
});

describe("safeHref", () => {
  it.each([
    ["https://x.com/a", "https://x.com/a"],
    ["HTTP://x.com", "HTTP://x.com"],
    ["behance.net/tala", "https://behance.net/tala"],
    ["  www.site.io  ", "https://www.site.io"],
    ["javascript:alert(1)", null],
    ["data:text/html,<b>x</b>", null],
    ["mailto:a@b.co", null],
    ["not a link", null],
    ["", null],
    [undefined, null],
  ])("%s -> %s", (input, out) => {
    expect(safeHref(input as string | undefined)).toBe(out);
  });

  it("makes a tidy label", () => {
    expect(linkLabel("https://www.behance.net/tala/")).toBe("behance.net/tala");
  });
});
