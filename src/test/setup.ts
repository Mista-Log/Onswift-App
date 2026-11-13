import "@testing-library/jest-dom";

// jsdom has no matchMedia. Components that read the screen size (useIsMobile) need it, so give every test a
// desktop-sized default. A test that cares about mobile replaces it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
