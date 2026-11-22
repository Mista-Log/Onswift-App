import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminApiError, type CampaignStatus, type RecipientStatus } from '@/api/adminApiClient'
import { Banner, Button, Icon, M3Root } from './m3'

/** M3 snackbar look (inverse surface) on top of the app's existing sonner toaster. */
export function snackbar(message: string, kind: 'info' | 'error' = 'info') {
  toast(message, {
    style: {
      background: '#322f35',
      color: '#f5eff7',
      border: 0,
      borderRadius: 4,
      fontFamily: 'Roboto, system-ui, sans-serif',
      ...(kind === 'error' ? { boxShadow: 'inset 4px 0 0 #f2b8b5' } : {}),
    },
  })
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export function formatDateTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

/** Load data on mount (and on `reload()`), keeping the last good value while refreshing. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(async () => {
    try {
      const value = await loaderRef.current()
      setData(value)
      setError(null)
      return value
    } catch (e) {
      setError(e)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, setData, error, loading, reload }
}

/** Shell for every Email page: the existing admin sidebar + an M3 surface. */
export function EmailPage({ children }: { children: ReactNode }) {
  return (
    <AdminLayout>
      <M3Root>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </M3Root>
    </AdminLayout>
  )
}

export function PageHeader({
  title,
  supporting,
  actions,
  back,
}: {
  title: ReactNode
  supporting?: ReactNode
  actions?: ReactNode
  back?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Link to={back} aria-label="Back" className="m3-icon-btn m3-state -ml-2 shrink-0">
            <Icon name="arrow_back" size={24} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="headline-small break-words">{title}</h1>
          {supporting && <div className="body-medium on-surface-variant mt-1">{supporting}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Error state. A 403 means the Supabase admin isn't on CAMPAIGN_ADMIN_EMAILS yet. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof AdminApiError && error.status === 403) {
    return (
      <Banner tone="info" icon="block">
        <div className="title-small mb-1">You don&rsquo;t have access to email campaigns yet</div>
        Ask whoever manages the server to add your admin email to <code>CAMPAIGN_ADMIN_EMAILS</code>.
      </Banner>
    )
  }
  return (
    <Banner
      tone="error"
      icon="error"
      action={onRetry && <Button variant="text" onClick={onRetry}>Retry</Button>}
    >
      {errorMessage(error)}
    </Banner>
  )
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: string; icon: string }> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'description' },
  sending: { label: 'Sending', tone: 'primary', icon: 'send' },
  paused: { label: 'Paused', tone: 'tertiary', icon: 'pause' },
  done: { label: 'Done', tone: 'success', icon: 'check_circle' },
}

const RECIPIENT_STATUS: Record<RecipientStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
  skipped: { label: 'Skipped', tone: 'tertiary' },
}

export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  const s = CAMPAIGN_STATUS[status]
  return (
    <span className={`m3-status m3-status--${s.tone}`}>
      <Icon name={s.icon} />
      {s.label}
    </span>
  )
}

export function RecipientStatusPill({ status }: { status: RecipientStatus }) {
  const s = RECIPIENT_STATUS[status]
  return <span className={`m3-status m3-status--${s.tone}`}>{s.label}</span>
}
