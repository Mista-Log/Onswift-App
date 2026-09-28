import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));
vi.mock("@/contexts/ProjectContext", () => ({ useProjects: () => ({ projects: [{ id: "p1", name: "Alpha" }] }) }));

import { UploadDeliverableModal } from "./UploadDeliverableModal";

const json = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  secureFetch.mockReset();
  secureFetch.mockImplementation(async (url: string) =>
    url.includes("my-tasks") ? json([{ id: "t1", name: "Logo", project: "p1", status: "planning" }]) : json([])
  );
});

async function renderForm() {
  const onSubmit = vi.fn();
  render(<UploadDeliverableModal open onOpenChange={vi.fn()} onSubmit={onSubmit} prefillTaskId="t1" />);
  fireEvent.change(screen.getByPlaceholderText("e.g., Final Logo Design"), { target: { value: "Final logo" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit Attachment" })).toBeEnabled());
  return onSubmit;
}

const input = () => screen.getByTestId("attachment-file-input") as HTMLInputElement;
const pick = (...files: File[]) => fireEvent.change(input(), { target: { files } });

describe("UploadDeliverableModal file attachments", () => {
  it("offers a file upload as well as links", async () => {
    await renderForm();
    expect(screen.getByText("File Attachments")).toBeInTheDocument();
    expect(screen.getByText("Attachment URLs")).toBeInTheDocument();
    expect(input()).toHaveAttribute("multiple");
  });

  it("lists picked files and lets you remove one", async () => {
    await renderForm();
    pick(new File(["a"], "logo.png", { type: "image/png" }), new File(["b"], "brief.pdf", { type: "application/pdf" }));
    expect(screen.getByText("logo.png")).toBeInTheDocument();
    expect(screen.getByText("brief.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove logo.png" }));
    expect(screen.queryByText("logo.png")).not.toBeInTheDocument();
    expect(screen.getByText("brief.pdf")).toBeInTheDocument();
  });

  it("submits the files together with the links", async () => {
    const onSubmit = await renderForm();
    const file = new File(["a"], "logo.png", { type: "image/png" });
    pick(file);
    fireEvent.change(screen.getByPlaceholderText(/Paste a link/), { target: { value: "https://drive.test/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    fireEvent.click(screen.getByRole("button", { name: "Submit Attachment" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.taskId).toBe("t1");
    expect(sent.title).toBe("Final logo");
    expect(sent.files).toEqual([file]);
    expect(sent.urls).toEqual(["https://drive.test/x"]);
  });

  it("still submits with only a link", async () => {
    const onSubmit = await renderForm();
    fireEvent.change(screen.getByPlaceholderText(/Paste a link/), { target: { value: "https://drive.test/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Attachment" }));
    expect(onSubmit.mock.calls[0][0].files).toEqual([]);
    expect(onSubmit.mock.calls[0][0].urls).toEqual(["https://drive.test/x"]);
  });
});
