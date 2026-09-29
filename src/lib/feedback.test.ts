import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The module keeps preferences and rate-limit state at module level, so load it fresh per test.
async function load() {
  vi.resetModules();
  return import("./feedback");
}

class FakeParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  value = 0;
}
const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createOscillator() {
    const osc = {
      type: "sine",
      frequency: new FakeParam(),
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    };
    oscillators.push(osc);
    return osc;
  }
  createGain() {
    return { gain: new FakeParam(), connect: (n: unknown) => n };
  }
  resume() {
    return Promise.resolve();
  }
}

let vibrate: ReturnType<typeof vi.fn>;
let now = 0;

beforeEach(() => {
  localStorage.clear();
  oscillators.length = 0;
  vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true, writable: true });
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("feedback preferences", () => {
  it("defaults to both sound and haptics on", async () => {
    const { getFeedbackPrefs } = await load();
    expect(getFeedbackPrefs()).toEqual({ sound: true, haptics: true, alerts: true });
  });

  it("persists changes and reloads them", async () => {
    const first = await load();
    first.setFeedbackPrefs({ sound: false });
    expect(JSON.parse(localStorage.getItem("onswift_feedback")!)).toEqual({ sound: false, haptics: true, alerts: true });

    const second = await load();
    expect(second.getFeedbackPrefs()).toEqual({ sound: false, haptics: true, alerts: true });
  });

  it("treats saved preferences from before alerts existed as alerts on", async () => {
    localStorage.setItem("onswift_feedback", JSON.stringify({ sound: false, haptics: true }));
    const { getFeedbackPrefs } = await load();
    expect(getFeedbackPrefs().alerts).toBe(true);
  });
});

describe("alert sounds", () => {
  it("plays for notify, message and send", async () => {
    const { notify, message, send } = await load();
    notify();
    expect(oscillators.length).toBe(2);
    oscillators.length = 0;
    message();
    expect(oscillators.length).toBe(2);
    oscillators.length = 0;
    send();
    expect(oscillators.length).toBe(2);
  });

  it("follows the alerts switch, not the tap-sound switch", async () => {
    const { notify, setFeedbackPrefs } = await load();
    setFeedbackPrefs({ sound: false });
    notify();
    expect(oscillators.length).toBe(2); // muting tap sounds doesn't silence alerts

    oscillators.length = 0;
    setFeedbackPrefs({ sound: true, alerts: false });
    notify();
    expect(oscillators.length).toBe(0);
  });

  it("is not collapsed by the rapid-tap limiter", async () => {
    const { message } = await load();
    message();
    now += 5;
    message();
    expect(oscillators.length).toBe(4);
  });
});

describe("feedback()", () => {
  it("vibrates and plays a tone when both are on", async () => {
    const { feedback } = await load();
    feedback("tap");
    expect(vibrate).toHaveBeenCalledWith(20);
    expect(oscillators.length).toBe(1);
  });

  it("respects the mute switches independently", async () => {
    const { feedback, setFeedbackPrefs } = await load();
    setFeedbackPrefs({ haptics: false });
    feedback("success");
    expect(vibrate).not.toHaveBeenCalled();
    expect(oscillators.length).toBe(2); // success is a two-note chime

    oscillators.length = 0;
    setFeedbackPrefs({ haptics: true, sound: false });
    feedback("success");
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(oscillators.length).toBe(0);
  });

  it("collapses rapid taps but never drops outcomes", async () => {
    const { feedback } = await load();
    feedback("tap");
    now += 10;
    feedback("tap"); // too soon: ignored
    expect(vibrate).toHaveBeenCalledTimes(1);

    now += 10;
    feedback("success"); // outcomes always play
    expect(vibrate).toHaveBeenCalledTimes(2);

    now += 100;
    feedback("tap");
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it("does nothing, without throwing, where vibration and audio are unsupported", async () => {
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true, writable: true });
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    const { feedback } = await load();
    expect(() => {
      feedback("tap");
      feedback("swipe");
      feedback("success");
      feedback("error");
    }).not.toThrow();
  });

  it("swallows errors thrown by the browser APIs", async () => {
    vibrate.mockImplementation(() => {
      throw new Error("not allowed");
    });
    const { feedback } = await load();
    expect(() => feedback("error")).not.toThrow();
  });
});
