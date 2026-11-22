/**
 * Client for the Django email-campaign API (/api/v10), used by the /admin panel.
 *
 * The admin panel signs in with Supabase, not the app's Django JWT, so this sends the
 * Supabase access token. Django checks it with Supabase and requires the email to be
 * listed in CAMPAIGN_ADMIN_EMAILS (see backend/core/campaigns/auth.py).
 */
import { supabase } from '@/lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const PREFIX = '/api/v10'
const TIMEOUT_MS = 30_000

export class AdminApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${PREFIX}${path}`, { ...init, headers, signal: controller.signal })
  } catch {
    throw new AdminApiError(0, "Couldn't reach the server. Check your connection and try again.")
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AdminApiError(res.status, body.error || body.detail || `Request failed (${res.status}).`)
  }
  return body as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'sending' | 'paused' | 'done'
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface Sender {
  from_name: string
  from_email: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  has_password: boolean
  daily_cap: number
  verified_at: string | null
  sent_last_24h: number
}

export interface Campaign {
  id: number
  name: string
  subject: string
  body: string
  exclude_previously_emailed: boolean
  status: CampaignStatus
  created_by: string
  started_by: string
  sender: { from_name: string; from_email: string } | null
  last_error: string
  next_send_at: string | null
  created_at: string
  updated_at: string
  counts: { total: number; pending: number; sent: number; failed: number; skipped: number }
}

export interface Recipient {
  id: number
  email: string
  first_name: string
  source: 'csv' | 'user' | 'import'
  status: RecipientStatus
  error: string
  sent_at: string | null
}

export interface AddResult {
  added: number
  duplicates: number
  opted_out: number
  previously_emailed: number
  invalid?: number
}

export interface Suppression {
  id: number
  email: string
  reason: 'unsubscribed' | 'replied_stop' | 'manual'
  added_by: string
  created_at: string
}

export interface UserFilters {
  role?: '' | 'creator' | 'talent' | 'client'
  inactive_days?: number | ''
  never_logged_in?: boolean
  joined_after?: string
  joined_before?: string
}

export interface SenderInput {
  from_name: string
  from_email: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  password?: string
  daily_cap: number
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const campaignsApi = {
  me: () => request<{ email: string; sender: Sender | null }>('/me/'),

  getSender: () => request<{ sender: Sender | null }>('/senders/me/'),
  saveSender: (data: SenderInput) => request<{ sender: Sender }>('/senders/me/', json('PUT', data)),
  verifySender: () => request<{ ok: boolean; message: string; sender: Sender }>('/senders/me/verify/', json('POST')),

  list: () => request<{ campaigns: Campaign[] }>('/campaigns/'),
  create: (data: Partial<Pick<Campaign, 'name' | 'subject' | 'body' | 'exclude_previously_emailed'>>) =>
    request<{ campaign: Campaign }>('/campaigns/', json('POST', data)),
  get: (id: number) => request<{ campaign: Campaign }>(`/campaigns/${id}/`),
  update: (id: number, data: Partial<Pick<Campaign, 'name' | 'subject' | 'body' | 'exclude_previously_emailed'>>) =>
    request<{ campaign: Campaign }>(`/campaigns/${id}/`, json('PATCH', data)),
  remove: (id: number) => request<void>(`/campaigns/${id}/`, { method: 'DELETE' }),

  recipients: (id: number, params: { status?: RecipientStatus | ''; q?: string; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    if (params.offset) qs.set('offset', String(params.offset))
    return request<{ total: number; offset: number; recipients: Recipient[] }>(`/campaigns/${id}/recipients/?${qs}`)
  },
  uploadCsv: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ result: AddResult; campaign: Campaign }>(`/campaigns/${id}/recipients/csv/`, {
      method: 'POST',
      body: form,
    })
  },
  previewUsers: (id: number, filters: UserFilters) =>
    request<{ matched: number; sample: string[] }>(`/campaigns/${id}/recipients/users/`, json('POST', { ...filters, preview: true })),
  addUsers: (id: number, filters: UserFilters) =>
    request<{ result: AddResult; campaign: Campaign }>(`/campaigns/${id}/recipients/users/`, json('POST', filters)),
  removeRecipient: (id: number, rid: number) => request<void>(`/campaigns/${id}/recipients/${rid}/`, { method: 'DELETE' }),
  clearPending: (id: number) =>
    request<{ removed: number; campaign: Campaign }>(`/campaigns/${id}/recipients/clear-pending/`, json('POST')),
  retryFailed: (id: number) =>
    request<{ requeued: number; campaign: Campaign }>(`/campaigns/${id}/recipients/retry-failed/`, json('POST')),

  preview: (id: number) => request<{ from: string; to: string; subject: string; body: string }>(`/campaigns/${id}/preview/`),
  sendTest: (id: number, email: string) =>
    request<{ ok: boolean; message: string }>(`/campaigns/${id}/test/`, json('POST', { email })),
  start: (id: number) => request<{ campaign: Campaign }>(`/campaigns/${id}/start/`, json('POST')),
  pause: (id: number) => request<{ campaign: Campaign }>(`/campaigns/${id}/pause/`, json('POST')),

  suppressions: (q = '') =>
    request<{ total: number; suppressions: Suppression[] }>(`/suppressions/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  addSuppressions: (emails: string, reason: Suppression['reason']) =>
    request<{ added: number; invalid: number }>('/suppressions/', json('POST', { emails, reason })),
  removeSuppression: (sid: number) => request<void>(`/suppressions/${sid}/`, { method: 'DELETE' }),
}
