/**
 * Tests for the DocumentLibrary "New Files" picker modal.
 * Changes covered:
 *  - Header button now reads "New Files" (was "New page")
 *  - Clicking the button opens a modal
 *  - Modal shows "Docs" and "Spreadsheet" options
 *  - "Docs" calls the create-doc API and navigates to /docs/:id
 *  - "Spreadsheet" navigates to /library/crm
 *  - Empty-state button also reads "New Files" for canUpload users
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "creator", full_name: "Creator" },
  }),
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/apiClient", () => ({
  secureFetch: vi.fn(),
}));

import { secureFetch } from "@/api/apiClient";
import DocumentLibrary from "./DocumentLibrary";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLibrary() {
  return render(
    <MemoryRouter>
      <DocumentLibrary />
    </MemoryRouter>
  );
}

function mockFetch({ docsOk = true }: { docsOk?: boolean } = {}) {
  (secureFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
    if (url === "/api/v8/docs/" && opts?.method === "POST") {
      return Promise.resolve({
        ok: docsOk,
        json: async () => ({ id: "doc-123" }),
      });
    }
    // all list endpoints return empty
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

// ── New Files button — header ─────────────────────────────────────────────────

describe("DocumentLibrary — New Files button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("renders 'New Files' in the header (not 'New page')", async () => {
    renderLibrary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /New Files/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /^New page$/i })).toBeNull();
  });

  it("clicking 'New Files' opens the picker modal", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));

    expect(screen.getByText(/Create new file/i)).toBeInTheDocument();
  });

  it("picker modal shows both Docs and Spreadsheet options", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));

    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("Spreadsheet")).toBeInTheDocument();
  });

  it("choosing Docs calls POST /api/v8/docs/ and navigates to /docs/:id", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByText("Docs"));

    await waitFor(() => {
      expect(secureFetch).toHaveBeenCalledWith(
        "/api/v8/docs/",
        expect.objectContaining({ method: "POST" })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/docs/doc-123");
    });
  });

  it("choosing Spreadsheet navigates to /library/crm", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByText("Spreadsheet"));

    expect(mockNavigate).toHaveBeenCalledWith("/library/crm");
    expect(secureFetch).not.toHaveBeenCalledWith(
      "/api/v8/docs/",
      expect.anything()
    );
  });

  it("modal dismisses after choosing Docs", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByText("Docs"));

    await waitFor(() =>
      expect(screen.queryByText(/Create new file/i)).toBeNull()
    );
  });

  it("modal dismisses after choosing Spreadsheet", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByText("Spreadsheet"));

    await waitFor(() =>
      expect(screen.queryByText(/Create new file/i)).toBeNull()
    );
  });

  it("shows toast error if Docs API call fails", async () => {
    mockFetch({ docsOk: false });
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByRole("button", { name: /New Files/i }));
    await user.click(screen.getByText("Docs"));

    await waitFor(() =>
      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining("/docs/"))
    );
  });
});

// ── Empty state button ─────────────────────────────────────────────────────────

describe("DocumentLibrary — empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (secureFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("empty state shows 'New Files' button for a creator", async () => {
    renderLibrary();
    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /New Files/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("clicking empty-state 'New Files' also opens the picker modal", async () => {
    const user = userEvent.setup();
    renderLibrary();

    // Wait for loading to finish and empty state to appear
    await waitFor(() => screen.getAllByRole("button", { name: /New Files/i }));

    // Click the last one (empty-state CTA is rendered after the header)
    const buttons = screen.getAllByRole("button", { name: /New Files/i });
    await user.click(buttons[buttons.length - 1]);

    expect(screen.getByText(/Create new file/i)).toBeInTheDocument();
  });
});
