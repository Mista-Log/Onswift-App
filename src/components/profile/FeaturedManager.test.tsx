import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturedManager, MAX_FEATURED } from "./FeaturedManager";
import type { FeaturedItem } from "./ProfileView";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({
  secureFetch: (...a: unknown[]) => secureFetch(...a),
  isNetworkError: () => false,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const item = (over: Partial<FeaturedItem> = {}): FeaturedItem => ({
  id: "f1", title: "Poster", link: "", image: "https://img.example/1.png", ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The page owns the list; this stands in for it. */
function Harness({ start = [] as FeaturedItem[] }) {
  const [items, setItems] = useState(start);
  return (
    <>
      <FeaturedManager items={items} onChange={setItems} />
      <output data-testid="count">{items.length}</output>
    </>
  );
}

const png = () => new File(["x"], "w.png", { type: "image/png" });
const pick = (file: File) => fireEvent.change(screen.getByTestId("featured-file"), { target: { files: [file] } });

beforeEach(() => {
  secureFetch.mockReset();
  toast.error.mockReset();
});

describe("featured work manager", () => {
  it("uploads an image and adds it to the list", async () => {
    secureFetch.mockResolvedValue(json(item({ id: "new", title: "" }), 201));
    render(<Harness />);
    pick(png());
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    const [url, init] = secureFetch.mock.calls[0];
    expect(url).toBe("/api/v1/auth/featured/");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("refuses a file that is not an image, without calling the server", () => {
    render(<Harness />);
    pick(new File(["x"], "a.txt", { type: "text/plain" }));
    expect(toast.error).toHaveBeenCalledWith("Please choose an image.");
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it("refuses an image over 5MB, without calling the server", () => {
    render(<Harness />);
    pick(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(toast.error).toHaveBeenCalledWith("Images can be up to 5MB.");
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it says no", async () => {
    secureFetch.mockResolvedValue(json({ detail: "You can feature up to 8 pieces." }, 400));
    render(<Harness />);
    pick(png());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You can feature up to 8 pieces."));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("saves a title when you click away, and only then", async () => {
    secureFetch.mockResolvedValue(json(item({ title: "Brand film" })));
    render(<Harness start={[item()]} />);
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Brand film");
    expect(secureFetch).not.toHaveBeenCalled();
    await userEvent.tab();
    await waitFor(() => expect(secureFetch).toHaveBeenCalledTimes(1));
    expect(secureFetch.mock.calls[0][0]).toBe("/api/v1/auth/featured/f1/");
    expect(secureFetch.mock.calls[0][1].method).toBe("PATCH");
  });

  it("does not save when nothing changed", async () => {
    render(<Harness start={[item()]} />);
    await userEvent.click(screen.getByLabelText("Title"));
    await userEvent.tab();
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it("removes a piece", async () => {
    secureFetch.mockResolvedValue(new Response(null, { status: 204 }));
    render(<Harness start={[item()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Poster" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
    expect(secureFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("keeps the piece when removing fails", async () => {
    secureFetch.mockResolvedValue(json({}, 500));
    render(<Harness start={[item()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Poster" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("stops offering uploads at the maximum", () => {
    const full = Array.from({ length: MAX_FEATURED }, (_, i) => item({ id: `f${i}`, title: `T${i}` }));
    render(<Harness start={full} />);
    expect(screen.queryByRole("button", { name: /Add an image/ })).toBeNull();
    expect(screen.getByText(/That's the maximum/)).toBeInTheDocument();
  });
});
