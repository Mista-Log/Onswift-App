declare module "html-to-docx" {
  /**
   * Converts an HTML string to a .docx file.
   * Returns a Blob in browsers and a Buffer in Node.
   */
  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: Record<string, unknown>,
    footerHTMLString?: string | null,
  ): Promise<Blob | ArrayBuffer>;
}
