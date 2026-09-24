import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEEKDAY_NAMES,
  browserTimezone,
  type ReminderFrequency,
  type ReminderSettings,
} from "@/hooks/useReminderSettings";

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReminderSettings | null;
  onSave: (values: Partial<ReminderSettings>) => Promise<boolean>;
}

const OPTIONS: { value: ReminderFrequency; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Every morning" },
  { value: "weekly", label: "Weekly", hint: "Once every 7 days" },
  { value: "weekends", label: "Weekends only", hint: "Saturday and Sunday" },
];

export function ReminderDialog({ open, onOpenChange, settings, onSave }: ReminderDialogProps) {
  const [frequency, setFrequency] = useState<ReminderFrequency>("daily");
  const [weekday, setWeekday] = useState(0);
  const [time, setTime] = useState("08:00");
  const [email, setEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrequency(settings?.reminder_frequency ?? "daily");
    setWeekday(settings?.reminder_weekday ?? 0);
    setTime((settings?.reminder_time ?? "08:00:00").slice(0, 5));
    setEmail(settings?.reminder_email ?? true);
    setFailed(false);
  }, [open, settings]);

  const submit = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave({
      reminder_enabled: true,
      reminder_frequency: frequency,
      reminder_weekday: weekday,
      reminder_time: `${time || "08:00"}:00`,
      reminder_timezone: browserTimezone(),
      reminder_email: email,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
    else setFailed(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deadline reminders</DialogTitle>
          <DialogDescription>
            Get a report of what's overdue, due soon and waiting on you across all your projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as ReminderFrequency)} className="space-y-2">
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                htmlFor={`reminder-${o.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem id={`reminder-${o.value}`} value={o.value} />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {frequency === "weekly" && (
            <div className="space-y-1.5">
              <Label>Day of the week</Label>
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reminder-time">Send at</Label>
            <Input id="reminder-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <p className="text-xs text-muted-foreground">Times use your timezone ({browserTimezone()}).</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={email} onCheckedChange={(c) => setEmail(c === true)} />
            Also email me this report
          </label>

          {failed && (
            <p className="text-sm text-destructive">Couldn't save your reminder. Please try again.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
