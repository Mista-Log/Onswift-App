// Scrollbars are invisible until something scrolls. CSS cannot see a scroll, so while an element is
// scrolling this marks it with data-scrolling; index.css shows the thumb for marked elements only.
const HIDE_AFTER_MS = 900;

export function installScrollbarReveal(): () => void {
  const timers = new WeakMap<Element, number>();

  const onScroll = (event: Event) => {
    const target = event.target;
    // A scroll of the page itself reports the document; its scrollbar belongs to <html>.
    const el = target instanceof Element ? target : document.documentElement;
    el.setAttribute("data-scrolling", "");
    window.clearTimeout(timers.get(el));
    timers.set(el, window.setTimeout(() => el.removeAttribute("data-scrolling"), HIDE_AFTER_MS));
  };

  // Scroll events do not bubble, but they can be caught on the way down.
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => document.removeEventListener("scroll", onScroll, { capture: true });
}
