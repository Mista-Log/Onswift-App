import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  date?: Date;
  time: string;
  onDateChange: (date?: Date) => void;
  onTimeChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  placeholder = "Pick date & time",
  disabled,
  className,
  align = "start",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const label = date
    ? `${format(date, "MMM d, yyyy")}  ·  ${time || "00:00"}`
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal gap-2",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {label ?? placeholder}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          initialFocus
        />
        <div className="border-t border-border/50 px-3 py-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground w-10">Time</span>
          <Input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="h-8 flex-1 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
