/**
 * docExport — client-side PDF/DOCX export for Docs.
 * PDF goes through the browser's print dialog (crisp vector text, no deps);
 * DOCX is generated in the browser by the MIT-licensed html-to-docx.
 */

/** Shared print/document styling for exported HTML. */
const EXPORT_STYLES = `
  @page { margin: 20mm; }
  body {
    font-family: Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.6;
    font-size: 12pt;
    max-width: 100%;
  }
  h1 { font-size: 22pt; margin: 0 0 0.6em; }
  h2 { font-size: 16pt; margin: 1.2em 0 0.4em; }
  h3 { font-size: 13pt; margin: 1em 0 0.3em; }
  h1, h2, h3 { page-break-after: avoid; line-height: 1.3; }
  p { margin: 0.4em 0; }
  ul, ol { margin: 0.4em 0; padding-left: 1.5em; }
  li { margin: 0.2em 0; }
  a { color: #4f46e5; }
  img { max-width: 100%; height: auto; page-break-inside: avoid; }
  blockquote { border-left: 3px solid #d1d5db; margin: 0.6em 0; padding-left: 1em; color: #4b5563; }
  pre, code { font-family: ui-monospace, Consolas, monospace; font-size: 10.5pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 4pt 6pt; text-align: left; }
`;

/** Branding line shown in the footer of every exported page. */
const FOOTER_TEXT = "Created with OnSwift · onswift.org";

/** PDF-only: position:fixed repeats on every printed page in Chromium. */
const PRINT_FOOTER_STYLES = `
  .onswift-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    text-align: center; font-size: 8.5pt; color: #9ca3af; padding: 4pt 0;
  }
  body { padding-bottom: 24pt; }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDocumentHtml(contentHtml: string, title: string, withPrintFooter = false): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_STYLES}${withPrintFooter ? PRINT_FOOTER_STYLES : ""}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${contentHtml}
${withPrintFooter ? `<div class="onswift-footer">${FOOTER_TEXT}</div>` : ""}
</body>
</html>`;
}

/** Trigger a browser download for the given content. */
export function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open the doc in a hidden iframe and trigger the print dialog, where the user
 * picks "Save as PDF". Iframe avoids popup blockers; it is removed after printing.
 */
export function exportDocAsPdf(contentHtml: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.srcdoc = buildDocumentHtml(contentHtml, title, true);

  // Browsers name the printed PDF after the top-level page's title, not the
  // iframe's — swap it to the doc title while the print dialog is open.
  const prevTitle = document.title;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = prevTitle;
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.addEventListener("afterprint", cleanup);
    // Fallback: some browsers don't fire afterprint inside iframes.
    setTimeout(cleanup, 60_000);
    document.title = title || "Untitled";
    win.focus();
    win.print();
  };

  document.body.appendChild(iframe);
}

/** Generate a real .docx in the browser and download it. */
export async function exportDocAsDocx(contentHtml: string, title: string) {
  const HTMLtoDOCX = (await import("html-to-docx")).default;
  const data = await HTMLtoDOCX(
    buildDocumentHtml(contentHtml, title),
    null,
    { title, orientation: "portrait", footer: true },
    `<p style="font-size:9px;color:#9ca3af;text-align:center;">${FOOTER_TEXT}</p>`,
  );
  downloadBlob(
    data as BlobPart,
    `${title || "untitled"}.docx`,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}
