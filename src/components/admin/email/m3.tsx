/**
 * Small Material 3 primitives for the /admin Email pages. Styling lives in m3.css,
 * scoped under `.m3`, so these only look right inside an `<M3Root>` (or an M3Dialog).
 */
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import './m3.css'

export function M3Root({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('m3 min-h-full', className)}>{children}</div>
}

export function Icon({ name, filled, size, className }: { name: string; filled?: boolean; size?: 24; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('m3-icon', filled && 'm3-icon--filled', size === 24 && 'm3-icon--24', className)}>
      {name}
    </span>
  )
}

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger'

interface M3ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: string
  danger?: boolean
}

export const Button = forwardRef<HTMLButtonElement, M3ButtonProps>(function Button(
  { variant = 'filled', icon, danger, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'm3-btn m3-state',
        `m3-btn--${variant}`,
        icon && 'm3-btn--has-icon',
        danger && variant === 'text' && 'm3-btn--danger-text',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
})

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn('m3-icon-btn m3-state', className)} {...rest}>
      <Icon name={icon} size={24} />
    </button>
  )
}

export function Card({
  variant = 'outlined',
  className,
  children,
}: {
  variant?: 'outlined' | 'filled' | 'elevated'
  className?: string
  children: ReactNode
}) {
  return <div className={cn('m3-card', `m3-card--${variant}`, className)}>{children}</div>
}

interface FieldShellProps {
  label: string
  supporting?: ReactNode
  error?: string | null
  className?: string
  staticLabel?: boolean
}

function FieldShell({
  id,
  label,
  supporting,
  error,
  className,
  staticLabel,
  children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn('m3-field', error && 'm3-field--error', staticLabel && 'm3-field--static', className)}>
      {children}
      <label htmlFor={id} className="m3-field__label">
        {label}
      </label>
      {(error || supporting) && (
        <span id={`${id}-support`} className="m3-field__support">
          {error || supporting}
        </span>
      )}
    </div>
  )
}

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldShellProps
>(function TextField({ label, supporting, error, className, staticLabel, id, placeholder, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} supporting={supporting} error={error} className={className} staticLabel={staticLabel}>
      <input
        ref={ref}
        id={fid}
        className="m3-field__input"
        placeholder={placeholder ?? ' '}
        aria-invalid={!!error || undefined}
        aria-describedby={error || supporting ? `${fid}-support` : undefined}
        {...rest}
      />
    </FieldShell>
  )
})

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShellProps
>(function TextArea({ label, supporting, error, className, staticLabel, id, placeholder, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} supporting={supporting} error={error} className={className} staticLabel={staticLabel}>
      <textarea
        ref={ref}
        id={fid}
        className="m3-field__input"
        placeholder={placeholder ?? ' '}
        aria-invalid={!!error || undefined}
        aria-describedby={error || supporting ? `${fid}-support` : undefined}
        {...rest}
      />
    </FieldShell>
  )
})

export function Select({
  label,
  supporting,
  error,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldShellProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} supporting={supporting} error={error} className={className} staticLabel>
      <select id={fid} className="m3-field__input" {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div id={id} className="body-large">
          {label}
        </div>
        {description && <div className="body-medium on-surface-variant">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        className="m3-switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} className="m3-chip m3-state" onClick={onClick}>
      {selected && <Icon name="check" />}
      {children}
    </button>
  )
}

export function AssistChip({ icon, onClick, children }: { icon: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="m3-chip m3-chip--assist m3-state" onClick={onClick}>
      <Icon name={icon} />
      {children}
    </button>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: string; icon?: string }[]
}) {
  return (
    <div role="tablist" className="m3-tabs">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className="m3-tab m3-state"
          onClick={() => onChange(t.value)}
        >
          <span>
            {t.icon && <Icon name={t.icon} />}
            {t.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function LinearProgress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="m3-progress">
      {pct > 0 && <div className="m3-progress__bar" style={{ width: `${pct}%` }} />}
      {pct < 100 && <div className="m3-progress__track" />}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-16" role="status" aria-label={label}>
      <div className="m3-spinner" />
    </div>
  )
}

export function Banner({
  tone,
  icon,
  children,
  action,
}: {
  tone: 'error' | 'info'
  icon: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={cn('m3-banner', `m3-banner--${tone}`)} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={24} />
      <div className="body-medium flex-1 pt-0.5">{children}</div>
      {action}
    </div>
  )
}

export function M3Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  icon,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  actions: ReactNode
  icon?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="m3 m3-dialog max-w-[560px] gap-0 sm:rounded-[28px]">
        {icon && (
          <div className="mb-4 flex justify-center text-[var(--md-secondary)]">
            <Icon name={icon} size={24} />
          </div>
        )}
        <DialogTitle className={cn('headline-small mb-4 font-normal', icon && 'text-center')}>{title}</DialogTitle>
        {description ? (
          <DialogDescription className="body-medium on-surface-variant mb-6">{description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{title}</DialogDescription>
        )}
        {children && <div className="mb-6">{children}</div>}
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </DialogContent>
    </Dialog>
  )
}
