import { useCallback, useEffect, useState } from "react";
import { secureFetch } from "@/api/apiClient";

export type ReminderFrequency = "daily" | "weekly" | "weekends";

export interface ReminderSettings {
  reminder_enabled: boolean;
  reminder_frequency: ReminderFrequency;
  reminder_weekday: number;
  reminder_time: string;
  reminder_timezone: string;
  reminder_email: boolean;
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function describeReminder(s: ReminderSettings): string {
  const time = s.reminder_time.slice(0, 5);
  const when =
    s.reminder_frequency === "daily"
      ? "Every day"
      : s.reminder_frequency === "weekends"
      ? "Weekends"
      : `Every ${WEEKDAY_NAMES[s.reminder_weekday] ?? "Monday"}`;
  return `${when} at ${time}`;
}

export function useReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch("/api/v1/settings/");
        if (res.ok && !cancelled) setSettings(await res.json());
      } catch (error) {
        console.error("Error loading reminder settings:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Returns true when the change was saved. */
  const save = useCallback(async (patch: Partial<ReminderSettings>): Promise<boolean> => {
    try {
      const res = await secureFetch("/api/v1/settings/", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!res.ok) return false;
      setSettings(await res.json());
      return true;
    } catch {
      return false;
    }
  }, []);

  return { settings, isLoading, save };
}
