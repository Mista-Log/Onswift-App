import { cn } from "@/lib/utils";

interface DigitalNumberProps {
  /** Characters to show, e.g. "07" or ":". Digits and colons are supported by the 7-segment font. */
  value: string;
  className?: string;
}

/**
 * Renders a value in a 7-segment LCD font. A faint "unlit segment" ghost (a same-width string of 8s)
 * sits behind the real digits, like a real LCD; both inherit the text colour so it works in every theme.
 */
export function DigitalNumber({ value, className }: DigitalNumberProps) {
  const ghost = value.replace(/[0-9]/g, "8");
  return (
    <span className={cn("relative inline-block font-digital leading-none", className)}>
      <span aria-hidden className="absolute inset-0 opacity-[0.1] select-none">
        {ghost}
      </span>
      <span className="relative">{value}</span>
    </span>
  );
}
