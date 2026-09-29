import { useSyncExternalStore } from "react";

// Tactile feedback for taps, swipes and outcomes: a short vibration (where the browser allows it)
// and a soft synthesised tone (no audio files). Both are on by default and switchable in Settings.
// iPhones do not let web pages vibrate, so they get sound only.

export type FeedbackKind = "tap" | "swipe" | "success" | "error" | "send" | "notify" | "message";

export interface FeedbackPrefs {
  sound: boolean;
  haptics: boolean;
  /** Sounds for incoming messages/notifications and sent messages (independent of tap sounds). */
  alerts: boolean;
}

const STORAGE_KEY = "onswift_feedback";
const DEFAULT_PREFS: FeedbackPrefs = { sound: true, haptics: true, alerts: true };
const ALERT_KINDS: FeedbackKind[] = ["send", "notify", "message"];

function loadPrefs(): FeedbackPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return { sound: parsed.sound !== false, haptics: parsed.haptics !== false, alerts: parsed.alerts !== false };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs: FeedbackPrefs = loadPrefs();
const listeners = new Set<() => void>();

export function getFeedbackPrefs(): FeedbackPrefs {
  return prefs;
}

export function setFeedbackPrefs(patch: Partial<FeedbackPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current preferences, re-rendering when they change (used by the Settings page). */
export function useFeedbackPrefs(): [FeedbackPrefs, (patch: Partial<FeedbackPrefs>) => void] {
  const current = useSyncExternalStore(subscribe, getFeedbackPrefs, getFeedbackPrefs);
  return [current, setFeedbackPrefs];
}

// Durations long enough for a real Android vibration motor to render — much shorter than this
// and the OS can clip the pulse to nothing, which is why vibration could look "non-existent."
const HAPTICS: Record<FeedbackKind, number | number[]> = {
  tap: 20,
  swipe: 25,
  success: [15, 50, 20],
  error: [35, 60, 35],
  send: 20,
  notify: [25, 70, 25],
  message: 25,
};

interface Tone {
  freq: number;
  duration: number;
  at?: number;
  type?: OscillatorType;
}

const TONES: Record<FeedbackKind, Tone[]> = {
  tap: [{ freq: 520, duration: 0.035 }],
  swipe: [{ freq: 380, duration: 0.05 }],
  success: [
    { freq: 660, duration: 0.07 },
    { freq: 880, duration: 0.11, at: 0.07 },
  ],
  error: [{ freq: 200, duration: 0.14, type: "triangle" }],
  // Alerts are a little louder-sounding than taps: rising blip for sent, bell for notifications,
  // soft two-note for an incoming message.
  send: [
    { freq: 500, duration: 0.05 },
    { freq: 760, duration: 0.07, at: 0.05 },
  ],
  notify: [
    { freq: 988, duration: 0.14 },
    { freq: 1319, duration: 0.24, at: 0.12 },
  ],
  message: [
    { freq: 740, duration: 0.09 },
    { freq: 587, duration: 0.14, at: 0.09 },
  ],
};

const UI_GAIN = 0.12; // taps/swipes/success/error — a soft click, not a chime
const ALERT_GAIN = 0.24; // notify/message/send — meant to be noticed, so twice as loud
const TAP_MIN_GAP_MS = 40;

let audioContext: AudioContext | null = null;
let lastTapAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext ??= new Ctor();
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function playTones(kind: FeedbackKind) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const peakGain = ALERT_KINDS.includes(kind) ? ALERT_GAIN : UI_GAIN;
  for (const tone of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = start + (tone.at ?? 0);
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.duration + 0.02);
  }
}

/** Fire feedback for an interaction. Never throws; silently does nothing where unsupported. */
export function feedback(kind: FeedbackKind): void {
  // Rapid taps would stack into a buzz; outcomes (success/error) always play.
  if (kind === "tap" || kind === "swipe") {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastTapAt < TAP_MIN_GAP_MS) return;
    lastTapAt = now;
  }

  if (prefs.haptics && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(HAPTICS[kind]);
    } catch {
      // Some browsers throw when vibration isn't permitted; ignore.
    }
  }
  if (ALERT_KINDS.includes(kind) ? prefs.alerts : prefs.sound) {
    try {
      playTones(kind);
    } catch {
      // Audio blocked or unsupported; ignore.
    }
  }
}

export const tap = () => feedback("tap");
export const swipe = () => feedback("swipe");
export const success = () => feedback("success");
export const error = () => feedback("error");
export const send = () => feedback("send");
export const notify = () => feedback("notify");
export const message = () => feedback("message");
