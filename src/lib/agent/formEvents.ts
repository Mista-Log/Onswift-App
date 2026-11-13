// A confirmed Agent change to a form is announced in the browser, so the form builder (if that form
// is open) can show it. Without this, a later Save from the builder would overwrite the change with
// the older version it still holds.
const FORM_UPDATED = "onswift:form-updated";

export function announceFormUpdated(formId: string): void {
  window.dispatchEvent(new CustomEvent(FORM_UPDATED, { detail: { formId } }));
}

/** Calls `handler` with the form's id each time the Agent changes a form. Returns the unsubscribe function. */
export function onFormUpdated(handler: (formId: string) => void): () => void {
  const listener = (event: Event) => {
    const formId = (event as CustomEvent).detail?.formId;
    if (typeof formId === "string") handler(formId);
  };
  window.addEventListener(FORM_UPDATED, listener);
  return () => window.removeEventListener(FORM_UPDATED, listener);
}
