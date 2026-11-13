import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BannerField, PortfolioLinksEditor, useBannerField } from "./ProfileFormFields";
import { ProfilePreviewButton } from "./ProfilePreviewPanel";
import { SocialLinksEditor, toSocialValues } from "./socials";
import { ProfileView, type ProfileData } from "./ProfileView";

vi.mock("@/api/apiClient", () => ({ secureFetch: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const profile: ProfileData = {
  role: "talent", full_name: "Tala Nt", avatar: null, headline: "Designer", bio: "Hello", skills: [], links: [],
  social_links: { instagram: "https://instagram.com/tala" }, featured: [],
  stats: [{ label: "Projects", value: 1 }, { label: "Tasks done", value: 2 }, { label: "Featured", value: 0 }],
};

beforeEach(() => {
  toast.error.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:preview");
});

describe("preview button", () => {
  it("opens a full-screen mirror of what the other side sees, Message button included", async () => {
    render(<ProfilePreviewButton profile={profile} audience="your creators" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Preview profile" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("h-[100dvh]");
    expect(dialog.className).toContain("w-screen");
    expect(within(dialog).getByText(/what your creators see/)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Tala Nt" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Instagram" })).toBeInTheDocument();
    // They see a Message button; in your own preview it can't be pressed.
    expect(within(dialog).getByRole("button", { name: /Message/ })).toBeDisabled();
  });

  it("the back arrow returns to the edit form", async () => {
    render(<ProfilePreviewButton profile={profile} audience="your creators" />);
    await userEvent.click(screen.getByRole("button", { name: "Preview profile" }));
    await userEvent.click(screen.getByRole("button", { name: "Back to editing" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview profile" })).toBeInTheDocument();
  });

  it("there is no side panel any more", () => {
    render(<ProfilePreviewButton profile={profile} audience="your creators" />);
    expect(screen.queryByLabelText("Profile preview")).toBeNull();
    expect(screen.queryByRole("button", { name: /Hide preview|Show preview/ })).toBeNull();
  });
});

describe("banner", () => {
  function Form({ saved = null as string | null }) {
    const banner = useBannerField(saved);
    const payload = new FormData();
    banner.appendTo(payload);
    return (
      <>
        <BannerField previewUrl={banner.previewUrl} onPick={banner.pick} onRemove={banner.remove} />
        <output data-testid="sends">{JSON.stringify([payload.has("banner"), payload.getAll("clear_fields")])}</output>
      </>
    );
  }
  const pick = (file: File) => fireEvent.change(screen.getByTestId("banner-file"), { target: { files: [file] } });
  const sends = () => JSON.parse(screen.getByTestId("sends").textContent!);

  it("is shown in the LinkedIn 1584 x 396 shape and says the recommended size", () => {
    render(<Form />);
    expect(screen.getByText(/1584 × 396/)).toBeInTheDocument();
    expect(screen.getByText(/No banner yet/).parentElement).toHaveClass("aspect-[1584/396]");
    expect(sends()).toEqual([false, []]);
  });

  it("previews a picked image and sends it with the save", () => {
    render(<Form />);
    pick(new File(["x"], "b.png", { type: "image/png" }));
    expect(screen.getByAltText("Your banner")).toHaveAttribute("src", "blob:preview");
    expect(sends()).toEqual([true, []]);
  });

  it("refuses a non-image and anything over 8MB", () => {
    render(<Form />);
    pick(new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(toast.error).toHaveBeenCalledWith("The banner must be an image.");
    pick(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(toast.error).toHaveBeenCalledWith("Banner images can be up to 8MB.");
    expect(sends()).toEqual([false, []]);
  });

  it("removing a saved banner tells the server to clear it", async () => {
    render(<Form saved="https://img.example/banner.png" />);
    expect(screen.getByAltText("Your banner")).toHaveAttribute("src", "https://img.example/banner.png");
    expect(sends()).toEqual([false, []]);
    await userEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(screen.queryByAltText("Your banner")).toBeNull();
    expect(sends()).toEqual([false, ["banner"]]);
  });

  it("the profile shows the banner image, or the gradient without one", () => {
    const { rerender } = render(<ProfileView profile={{ ...profile, banner: "https://img.example/banner.png" }} />);
    const band = screen.getByTestId("profile-banner");
    expect(band).toHaveClass("aspect-[1584/396]");
    expect(band.querySelector("img")).toHaveAttribute("src", "https://img.example/banner.png");
    rerender(<ProfileView profile={{ ...profile, banner: null }} />);
    expect(screen.getByTestId("profile-banner").querySelector("img")).toBeNull();
    expect(screen.getByTestId("profile-banner").className).toContain("linear-gradient");
  });
});

describe("portfolio links editor", () => {
  function Editor({ start = [] as string[] }) {
    const [links, setLinks] = useState(start);
    return (
      <>
        <PortfolioLinksEditor links={links} onChange={setLinks} />
        <output data-testid="out">{JSON.stringify(links)}</output>
      </>
    );
  }
  const out = () => JSON.parse(screen.getByTestId("out").textContent!);

  it("adds, edits and removes links", async () => {
    render(<Editor />);
    await userEvent.click(screen.getByRole("button", { name: /Add a Link/ }));
    await userEvent.type(screen.getByLabelText("Portfolio link 1"), "https://a.example");
    expect(out()).toEqual(["https://a.example"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove portfolio link 1" }));
    expect(out()).toEqual([]);
  });

  it("stops at five", () => {
    render(<Editor start={["a", "b", "c", "d", "e"]} />);
    expect(screen.queryByRole("button", { name: /Add/ })).toBeNull();
  });
});

describe("social links editor", () => {
  function Editor({ start = {} as Record<string, string> }) {
    const [value, setValue] = useState(toSocialValues(start));
    return (
      <>
        <SocialLinksEditor value={value} onChange={setValue} />
        <output data-testid="out">{JSON.stringify(value)}</output>
      </>
    );
  }

  it("has a labelled field with a logo for every network", () => {
    render(<Editor />);
    for (const label of ["LinkedIn", "X (Twitter)", "Instagram", "YouTube", "TikTok", "Facebook", "Threads", "GitHub", "Behance", "Dribbble"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(document.querySelectorAll("section svg")).toHaveLength(10);
  });

  it("fills in saved links and keeps unrelated ones when one changes", async () => {
    render(<Editor start={{ linkedin: "https://linkedin.com/in/tala" }} />);
    expect(screen.getByLabelText("LinkedIn")).toHaveValue("https://linkedin.com/in/tala");
    await userEvent.type(screen.getByLabelText("TikTok"), "tiktok.com/@tala");
    const out = JSON.parse(screen.getByTestId("out").textContent!);
    expect(out.tiktok).toBe("tiktok.com/@tala");
    expect(out.linkedin).toBe("https://linkedin.com/in/tala");
  });
});
