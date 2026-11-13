import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyCreatorsCard } from "./MyCreatorsCard";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const show = () => render(<MemoryRouter><MyCreatorsCard /></MemoryRouter>);

// Braces matter: a hook that *returns* a function has it run as cleanup, and mockReset() returns the mock.
beforeEach(() => {
  secureFetch.mockReset();
});

describe("my creators card", () => {
  it("lists each creator with a View Profile link to their profile", async () => {
    secureFetch.mockResolvedValue(json([
      { id: "h1", user_id: "creator-1", name: "Cree Ator", company: "Studio X", avatar: null },
      { id: "h2", user_id: "creator-2", name: "Dee Rector", company: null, avatar: null },
    ]));
    show();
    expect(await screen.findByText("Cree Ator")).toBeInTheDocument();
    expect(secureFetch).toHaveBeenCalledWith("/api/v3/my-creators/");
    expect(screen.getByText("Studio X")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Cree Ator's profile" })).toHaveAttribute("href", "/profile/creator-1");
    expect(screen.getByRole("link", { name: "View Dee Rector's profile" })).toHaveAttribute("href", "/profile/creator-2");
  });

  it("never shows the creator's email", async () => {
    secureFetch.mockResolvedValue(json([{ id: "h1", user_id: "c1", name: "Cree Ator", email: "c@x.com" }]));
    show();
    await screen.findByText("Cree Ator");
    expect(screen.queryByText("c@x.com")).toBeNull();
  });

  it("is hidden when the talent has no creators yet", async () => {
    secureFetch.mockResolvedValue(json([]));
    const { container } = show();
    await waitFor(() => expect(secureFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden, without crashing, when the request fails", async () => {
    secureFetch.mockImplementation(async () => {
      throw new Error("offline");
    });
    const { container } = show();
    await waitFor(() => expect(secureFetch).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10)); // let the card's own catch run
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden on a server error", async () => {
    secureFetch.mockResolvedValue(json({ detail: "nope" }, 500));
    const { container } = show();
    await waitFor(() => expect(secureFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
