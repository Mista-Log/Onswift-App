interface DateDividerProps {
  label: string;
}

// Centered "Today" / "Yesterday" / dated chip between messages from
// different calendar days — bubble real estate can't also carry a date.
export function DateDivider({ label }: DateDividerProps) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
