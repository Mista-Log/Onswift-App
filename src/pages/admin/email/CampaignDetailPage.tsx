import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  campaignsApi,
  type AddResult,
  type Campaign,
  type Recipient,
  type RecipientStatus,
  type Sender,
  type UserFilters,
} from '@/api/adminApiClient'
import {
  AssistChip,
  Banner,
  Button,
  Card,
  FilterChip,
  Icon,
  IconButton,
  LinearProgress,
  M3Dialog,
  Select,
  Spinner,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from '@/components/admin/email/m3'
import {
  CampaignStatusPill,
  EmailPage,
  LoadError,
  PageHeader,
  RecipientStatusPill,
  errorMessage,
  formatDateTime,
  formatTime,
  snackbar,
  useLoad,
} from '@/components/admin/email/shared'

type Tab = 'content' | 'recipients' | 'review'
const AVG_GAP_S = 32.5 // midpoint of the 20–45s spacing

function summarize(r: AddResult) {
  const parts = [`${r.added} added`]
  if (r.duplicates) parts.push(`${r.duplicates} already on the list`)
  if (r.opted_out) parts.push(`${r.opted_out} opted out`)
  if (r.previously_emailed) parts.push(`${r.previously_emailed} emailed before`)
  if (r.invalid) parts.push(`${r.invalid} invalid`)
  return parts.join(' · ')
}

function estimate(pending: number) {
  const minutes = Math.max(1, Math.ceil((pending * AVG_GAP_S) / 60))
  return minutes < 60 ? `about ${minutes} min` : `about ${(minutes / 60).toFixed(1)} hours`
}

function blockers(c: Campaign, sender: Sender | null) {
  const out: string[] = []
  if (!sender) out.push('Connect your mailbox in Sender settings')
  else if (!sender.verified_at) out.push('Verify your mailbox in Sender settings')
  if (!c.subject.trim() || !c.body.trim()) out.push('Add a subject and body')
  if (c.counts.pending === 0) out.push('Add recipients')
  return out
}

// ── Progress summary ──────────────────────────────────────────────────────────

function ProgressCard({ campaign }: { campaign: Campaign }) {
  const { total, pending, sent, failed, skipped } = campaign.counts
  const stats: { label: string; value: number; tone?: string }[] = [
    { label: 'Pending', value: pending },
    { label: 'Sent', value: sent },
    { label: 'Failed', value: failed, tone: failed ? 'text-error' : undefined },
    { label: 'Skipped', value: skipped },
  ]
  return (
    <Card variant="filled" className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className={`title-large ${s.tone ?? ''}`}>{s.value}</div>
            <div className="label-medium on-surface-variant">{s.label}</div>
          </div>
        ))}
      </div>
      {total > 0 && <LinearProgress value={((sent + failed + skipped) / total) * 100} label="Campaign progress" />}
      {campaign.status === 'sending' && (
        <div className="body-small on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon name="schedule" />
          {campaign.next_send_at ? `Next email around ${formatTime(campaign.next_send_at)}` : 'Starting within a minute'}
          {campaign.sender && (
            <span>
              · from {campaign.sender.from_name} &lt;{campaign.sender.from_email}&gt;
            </span>
          )}
          {pending > 0 && <span>· {estimate(pending)} left</span>}
        </div>
      )}
    </Card>
  )
}

// ── Content tab ───────────────────────────────────────────────────────────────

function ContentTab({
  campaign,
  onSaved,
  onDirty,
  onDelete,
}: {
  campaign: Campaign
  onSaved: (c: Campaign) => void
  onDirty: (dirty: boolean) => void
  onDelete: () => void
}) {
  const locked = campaign.status === 'sending'
  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [body, setBody] = useState(campaign.body)
  const [exclude, setExclude] = useState(campaign.exclude_previously_emailed)
  const [saving, setSaving] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const lastFocused = useRef<'subject' | 'body'>('body')

  const dirty =
    name !== campaign.name ||
    subject !== campaign.subject ||
    body !== campaign.body ||
    exclude !== campaign.exclude_previously_emailed

  useEffect(() => onDirty(dirty), [dirty, onDirty])

  // Pick up server changes (e.g. after pausing) when there are no local edits.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    if (dirtyRef.current) return
    setName(campaign.name)
    setSubject(campaign.subject)
    setBody(campaign.body)
    setExclude(campaign.exclude_previously_emailed)
  }, [campaign.updated_at, campaign.name, campaign.subject, campaign.body, campaign.exclude_previously_emailed])

  const insert = (token: string) => {
    const inSubject = lastFocused.current === 'subject'
    const target = inSubject ? subjectRef.current : bodyRef.current
    const value = inSubject ? subject : body
    const setValue = inSubject ? setSubject : setBody
    const start = target?.selectionStart ?? value.length
    const end = target?.selectionEnd ?? value.length
    setValue(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      target?.focus()
      target?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const { campaign: saved } = await campaignsApi.update(campaign.id, {
        name,
        subject,
        body,
        exclude_previously_emailed: exclude,
      })
      onSaved(saved)
      snackbar('Saved')
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {locked && (
        <Banner tone="info" icon="info">
          Pause the campaign to edit it.
        </Banner>
      )}
      <Card variant="outlined" className="p-6">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <TextField
            label="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={locked}
            maxLength={200}
            supporting="Only your team sees this"
          />
          <TextField
            ref={subjectRef}
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastFocused.current = 'subject')}
            disabled={locked}
            maxLength={300}
          />
          <TextArea
            ref={bodyRef}
            label="Email body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => (lastFocused.current = 'body')}
            disabled={locked}
            rows={16}
            style={{ minHeight: 320 }}
            supporting="Plain text. If you leave out {unsubscribe_link}, one is added at the end."
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-large on-surface-variant mr-1">Insert</span>
            <AssistChip icon="add" onClick={() => insert('{first_name}')}>
              {'{first_name}'}
            </AssistChip>
            <AssistChip icon="add" onClick={() => insert('{unsubscribe_link}')}>
              {'{unsubscribe_link}'}
            </AssistChip>
          </div>
          <div className="body-small on-surface-variant -mt-3">
            {'{first_name}'} becomes the first word of their name, or &ldquo;there&rdquo; if we don&rsquo;t have one.
          </div>
          <hr className="border-[var(--md-outline-variant)]" />
          <Switch
            checked={exclude}
            onChange={setExclude}
            disabled={locked}
            label="Skip people already emailed"
            description="Anyone another campaign has already sent to is skipped. Turn off for a follow-up to the same list."
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="text" danger icon="delete" onClick={onDelete} disabled={locked}>
              Delete campaign
            </Button>
            <Button type="submit" disabled={!dirty || saving || locked || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ── Recipients tab ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = { '': 'Any role', creator: 'Creators', talent: 'Talent', client: 'Clients' }

function UsersDialog({
  open,
  onOpenChange,
  campaignId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  campaignId: number
  onAdded: (c: Campaign, r: AddResult) => void
}) {
  const [filters, setFilters] = useState<UserFilters>({ role: '', inactive_days: 30, never_logged_in: false })
  const [preview, setPreview] = useState<{ matched: number; sample: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (patch: Partial<UserFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPreview(null)
  }

  const clean = (): UserFilters => ({
    ...filters,
    inactive_days: filters.inactive_days === '' ? undefined : filters.inactive_days,
    joined_after: filters.joined_after || undefined,
    joined_before: filters.joined_before || undefined,
  })

  const check = async () => {
    setBusy(true)
    try {
      setPreview(await campaignsApi.previewUsers(campaignId, clean()))
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    setBusy(true)
    try {
      const { campaign, result } = await campaignsApi.addUsers(campaignId, clean())
      onAdded(campaign, result)
      onOpenChange(false)
      setPreview(null)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <M3Dialog
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      icon="group_add"
      title="Add OnSwift users"
      description="Pick people by role and activity. Deactivated accounts and opt-outs are never added."
      actions={
        <>
          <Button variant="text" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={add} disabled={busy || preview.matched === 0}>
              {busy ? 'Adding…' : `Add ${preview.matched} ${preview.matched === 1 ? 'person' : 'people'}`}
            </Button>
          ) : (
            <Button variant="tonal" onClick={check} disabled={busy}>
              {busy ? 'Checking…' : 'Check matches'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 pt-2">
        <Select label="Role" value={filters.role} onChange={(e) => update({ role: e.target.value as UserFilters['role'] })}>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <TextField
          label="Inactive for at least (days)"
          type="number"
          inputMode="numeric"
          min={0}
          value={filters.inactive_days ?? ''}
          onChange={(e) => update({ inactive_days: e.target.value === '' ? '' : Number(e.target.value) })}
          supporting="People who haven't logged in since then. Leave blank for anyone."
        />
        <Switch checked={!!filters.never_logged_in} onChange={(v) => update({ never_logged_in: v })} label="Only people who never logged in" />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField label="Joined on or after" type="date" staticLabel value={filters.joined_after ?? ''} onChange={(e) => update({ joined_after: e.target.value })} />
          <TextField label="Joined on or before" type="date" staticLabel value={filters.joined_before ?? ''} onChange={(e) => update({ joined_before: e.target.value })} />
        </div>
        {preview && (
          <Card variant="outlined" className="body-medium">
            <div className="title-small mb-1">
              {preview.matched} {preview.matched === 1 ? 'person matches' : 'people match'}
            </div>
            {preview.sample.length > 0 && (
              <div className="on-surface-variant break-all">
                {preview.sample.join(', ')}
                {preview.matched > preview.sample.length ? ', …' : ''}
              </div>
            )}
          </Card>
        )}
      </div>
    </M3Dialog>
  )
}

const STATUS_FILTERS: { value: RecipientStatus | ''; label: string; key: keyof Campaign['counts'] }[] = [
  { value: '', label: 'All', key: 'total' },
  { value: 'pending', label: 'Pending', key: 'pending' },
  { value: 'sent', label: 'Sent', key: 'sent' },
  { value: 'failed', label: 'Failed', key: 'failed' },
  { value: 'skipped', label: 'Skipped', key: 'skipped' },
]

function RecipientsTab({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (c: Campaign) => void }) {
  const [status, setStatus] = useState<RecipientStatus | ''>('')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [extra, setExtra] = useState<Recipient[]>([])
  const [usersOpen, setUsersOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const c = campaign.counts
  const refreshKey = `${c.total}-${c.pending}-${c.sent}-${c.failed}-${c.skipped}`
  const list = useLoad(() => campaignsApi.recipients(campaign.id, { status, q: debounced }), [campaign.id, status, debounced, refreshKey])
  useEffect(() => setExtra([]), [list.data])

  const rows = [...(list.data?.recipients ?? []), ...extra]
  const total = list.data?.total ?? 0

  const loadMore = async () => {
    try {
      const more = await campaignsApi.recipients(campaign.id, { status, q: debounced, offset: rows.length })
      setExtra((e) => [...e, ...more.recipients])
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    }
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { campaign: updated, result } = await campaignsApi.uploadCsv(campaign.id, file)
      onCampaign(updated)
      snackbar(summarize(result))
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const retryFailed = async () => {
    try {
      const res = await campaignsApi.retryFailed(campaign.id)
      onCampaign(res.campaign)
      snackbar(`${res.requeued} queued to retry`)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    }
  }

  const clearPending = async () => {
    setConfirmClear(false)
    try {
      const res = await campaignsApi.clearPending(campaign.id)
      onCampaign(res.campaign)
      snackbar(`${res.removed} removed`)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    }
  }

  const remove = async (rid: number) => {
    try {
      await campaignsApi.removeRecipient(campaign.id, rid)
      const { campaign: updated } = await campaignsApi.get(campaign.id)
      onCampaign(updated)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="outlined" className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Icon name="upload_file" size={24} />
            <span className="title-medium">Upload a CSV</span>
          </div>
          <div className="body-medium on-surface-variant">
            Needs an <code>email</code> column. <code>first_name</code> is optional (a full name works too). Up to 5,000 rows.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <div>
            <Button variant="outlined" icon="upload_file" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Choose file'}
            </Button>
          </div>
        </Card>
        <Card variant="outlined" className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Icon name="group_add" size={24} />
            <span className="title-medium">Add OnSwift users</span>
          </div>
          <div className="body-medium on-surface-variant">Pick signed-up users by role, when they joined, or how long since they last logged in.</div>
          <div>
            <Button variant="outlined" icon="group_add" onClick={() => setUsersOpen(true)}>
              Choose users
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip key={f.label} selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label} ({c[f.key]})
          </FilterChip>
        ))}
      </div>

      <div className="m3-search">
        <Icon name="search" size={24} />
        <input aria-label="Search recipients" placeholder="Search by email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {list.loading && !list.data && <Spinner />}
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.data &&
        (rows.length === 0 ? (
          <Card variant="filled" className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon name="alternate_email" size={24} />
            <div className="title-medium">{c.total === 0 ? 'No recipients yet' : 'Nobody matches'}</div>
            {c.total === 0 && <div className="body-medium on-surface-variant">Upload a CSV or add OnSwift users.</div>}
          </Card>
        ) : (
          <Card variant="outlined" className="overflow-x-auto p-0">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th className="hidden sm:table-cell">First name</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Details</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="break-all">{r.email}</td>
                    <td className="on-surface-variant hidden sm:table-cell">{r.first_name || '—'}</td>
                    <td>
                      <RecipientStatusPill status={r.status} />
                    </td>
                    <td className="body-small on-surface-variant hidden md:table-cell">
                      {r.status === 'sent' ? formatDateTime(r.sent_at) : r.error}
                    </td>
                    <td className="w-12 text-right">
                      {r.status === 'pending' && <IconButton icon="close" label={`Remove ${r.email}`} onClick={() => remove(r.id)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length < total && (
              <div className="flex justify-center p-3">
                <Button variant="text" onClick={loadMore}>
                  Show more ({total - rows.length} left)
                </Button>
              </div>
            )}
          </Card>
        ))}

      {(c.failed > 0 || (c.pending > 0 && campaign.status !== 'sending')) && (
        <div className="flex flex-wrap justify-end gap-2">
          {c.failed > 0 && (
            <Button variant="tonal" icon="refresh" onClick={retryFailed}>
              Retry failed
            </Button>
          )}
          {c.pending > 0 && campaign.status !== 'sending' && (
            <Button variant="text" danger icon="delete" onClick={() => setConfirmClear(true)}>
              Remove all pending
            </Button>
          )}
        </div>
      )}

      <UsersDialog
        open={usersOpen}
        onOpenChange={setUsersOpen}
        campaignId={campaign.id}
        onAdded={(updated, result) => {
          onCampaign(updated)
          snackbar(summarize(result))
        }}
      />
      <M3Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        icon="delete"
        title="Remove all pending recipients?"
        description={`${c.pending} people who haven't been emailed yet will be removed from this campaign. Sent history stays.`}
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="text" danger onClick={clearPending}>
              Remove
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── Review & send tab ─────────────────────────────────────────────────────────

function CheckRow({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon name={ok ? 'check_circle' : 'error'} filled className={ok ? 'text-[var(--md-success)]' : 'text-[var(--md-error)]'} />
      <span className="body-medium">{children}</span>
    </li>
  )
}

function ReviewTab({
  campaign,
  me,
  dirty,
  onStart,
}: {
  campaign: Campaign
  me: { email: string; sender: Sender | null }
  dirty: boolean
  onStart: () => void
}) {
  const sender = me.sender
  const preview = useLoad(() => campaignsApi.preview(campaign.id), [campaign.id, campaign.updated_at, campaign.counts.pending])
  const [testTo, setTestTo] = useState(me.email)
  const [sending, setSending] = useState(false)
  const problems = blockers(campaign, sender)
  const canStart = (campaign.status === 'draft' || campaign.status === 'paused') && problems.length === 0
  const remainingToday = sender ? Math.max(sender.daily_cap - sender.sent_last_24h, 0) : 0

  const sendTest = async () => {
    setSending(true)
    try {
      const res = await campaignsApi.sendTest(campaign.id, testTo)
      snackbar(res.message)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {dirty && (
          <Banner tone="info" icon="info">
            You have unsaved changes on the Content tab. The preview and tests use the saved version.
          </Banner>
        )}
        <Card variant="outlined" className="p-0">
          {preview.loading && !preview.data && <Spinner label="Loading preview" />}
          {preview.error && (
            <div className="p-4">
              <LoadError error={preview.error} onRetry={preview.reload} />
            </div>
          )}
          {preview.data && (
            <>
              <dl className="body-medium grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 p-5">
                <dt className="on-surface-variant">From</dt>
                <dd className="break-all">{preview.data.from}</dd>
                <dt className="on-surface-variant">To</dt>
                <dd className="break-all">{preview.data.to}</dd>
                <dt className="on-surface-variant">Subject</dt>
                <dd className="title-small">{preview.data.subject || <span className="text-error">No subject</span>}</dd>
              </dl>
              <hr className="border-[var(--md-outline-variant)]" />
              <div className="body-large whitespace-pre-wrap break-words p-5">{preview.data.body}</div>
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card variant="outlined" className="flex flex-col gap-4 p-5">
          <div className="title-medium">Before you send</div>
          <ul className="flex flex-col gap-3">
            <CheckRow ok={!!sender?.verified_at}>
              {sender?.verified_at ? (
                <>
                  Sends from {sender.from_name} &lt;{sender.from_email}&gt;
                </>
              ) : (
                <>
                  <Link to="/admin/email/sender" className="underline">
                    {sender ? 'Verify your mailbox' : 'Connect your mailbox'}
                  </Link>{' '}
                  first
                </>
              )}
            </CheckRow>
            <CheckRow ok={!!campaign.subject.trim() && !!campaign.body.trim()}>
              {campaign.subject.trim() && campaign.body.trim() ? 'Subject and body are set' : 'Add a subject and body'}
            </CheckRow>
            <CheckRow ok={campaign.counts.pending > 0}>
              {campaign.counts.pending > 0
                ? `${campaign.counts.pending} ${campaign.counts.pending === 1 ? 'person' : 'people'} waiting, ${estimate(campaign.counts.pending)}`
                : 'Add recipients'}
            </CheckRow>
          </ul>
          {sender && campaign.counts.pending > remainingToday && (
            <div className="body-small on-surface-variant">
              Your daily limit allows {remainingToday} more today. The rest go out automatically after that.
            </div>
          )}
          {campaign.status === 'sending' ? (
            <div className="body-medium on-surface-variant">This campaign is sending now.</div>
          ) : campaign.status === 'done' ? (
            <div className="body-medium on-surface-variant">Finished. Add more recipients to send again.</div>
          ) : (
            <Button icon="play_arrow" onClick={onStart} disabled={!canStart || dirty}>
              {campaign.status === 'paused' ? 'Resume sending' : 'Start sending'}
            </Button>
          )}
        </Card>

        <Card variant="outlined" className="flex flex-col gap-4 p-5">
          <div className="title-medium">Send a test</div>
          <div className="body-medium on-surface-variant">Sends one copy from your mailbox right now. It doesn&rsquo;t count toward the campaign.</div>
          <TextField label="Send to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Button variant="tonal" icon="send" onClick={sendTest} disabled={sending || !testTo || !sender?.has_password}>
            {sending ? 'Sending…' : 'Send test'}
          </Button>
        </Card>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams()
  const cid = Number(id)
  const navigate = useNavigate()
  const { data, setData, error, loading, reload } = useLoad(async () => {
    const [{ campaign }, me] = await Promise.all([campaignsApi.get(cid), campaignsApi.me()])
    return { campaign, me }
  }, [cid])
  const [tab, setTab] = useState<Tab>('content')
  const [dirty, setDirty] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const campaign = data?.campaign
  const setCampaign = (c: Campaign) => setData((d) => (d ? { ...d, campaign: c } : d))

  // While sending, refresh progress every 10s.
  useEffect(() => {
    if (campaign?.status !== 'sending') return
    const t = setInterval(() => {
      campaignsApi
        .get(cid)
        .then((r) => setData((d) => (d ? { ...d, campaign: r.campaign } : d)))
        .catch(() => {})
    }, 10_000)
    return () => clearInterval(t)
  }, [campaign?.status, cid, setData])

  const run = async (fn: () => Promise<{ campaign: Campaign }>, message: string) => {
    setBusy(true)
    try {
      const { campaign: updated } = await fn()
      setCampaign(updated)
      snackbar(message)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await campaignsApi.remove(cid)
      snackbar('Campaign deleted')
      navigate('/admin/email/campaigns')
    } catch (e) {
      snackbar(errorMessage(e), 'error')
      setBusy(false)
    }
  }

  const problems = campaign && data ? blockers(campaign, data.me.sender) : []
  const startable = campaign && (campaign.status === 'draft' || campaign.status === 'paused')

  return (
    <EmailPage>
      {loading && !data && <Spinner />}
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {campaign && data && (
        <>
          <PageHeader
            back="/admin/email/campaigns"
            title={
              <span className="inline-flex flex-wrap items-center gap-3">
                {campaign.name}
                <CampaignStatusPill status={campaign.status} />
              </span>
            }
            supporting={`Created by ${campaign.created_by} · ${formatDateTime(campaign.created_at)}${
              campaign.started_by ? ` · started by ${campaign.started_by}` : ''
            }`}
            actions={
              campaign.status === 'sending' ? (
                <Button variant="tonal" icon="pause" disabled={busy} onClick={() => run(() => campaignsApi.pause(cid), 'Paused')}>
                  Pause
                </Button>
              ) : startable ? (
                <Button
                  icon="play_arrow"
                  disabled={busy || problems.length > 0 || dirty}
                  title={dirty ? 'Save your changes first' : problems.join(' · ') || undefined}
                  onClick={() => setConfirmStart(true)}
                >
                  {campaign.status === 'paused' ? 'Resume' : 'Start sending'}
                </Button>
              ) : null
            }
          />

          <div className="flex flex-col gap-6">
            {campaign.last_error && (
              <Banner
                tone={campaign.status === 'paused' ? 'error' : 'info'}
                icon={campaign.status === 'paused' ? 'error' : 'hourglass_top'}
              >
                {campaign.last_error}
              </Banner>
            )}
            <ProgressCard campaign={campaign} />
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'content', label: 'Content', icon: 'description' },
                { value: 'recipients', label: `Recipients (${campaign.counts.total})`, icon: 'alternate_email' },
                { value: 'review', label: 'Review & send', icon: 'send' },
              ]}
            />
            {/* The Content panel stays mounted so unsaved edits survive tab switches. */}
            <div role="tabpanel" hidden={tab !== 'content'}>
              <ContentTab campaign={campaign} onSaved={setCampaign} onDirty={setDirty} onDelete={() => setConfirmDelete(true)} />
            </div>
            {tab === 'recipients' && (
              <div role="tabpanel">
                <RecipientsTab campaign={campaign} onCampaign={setCampaign} />
              </div>
            )}
            {tab === 'review' && (
              <div role="tabpanel">
                <ReviewTab campaign={campaign} me={data.me} dirty={dirty} onStart={() => setConfirmStart(true)} />
              </div>
            )}
          </div>

          <M3Dialog
            open={confirmStart}
            onOpenChange={setConfirmStart}
            icon="send"
            title={campaign.status === 'paused' ? 'Resume sending?' : 'Start sending?'}
            description={`${campaign.counts.pending} ${campaign.counts.pending === 1 ? 'email' : 'emails'} will go out from ${
              data.me.sender ? `${data.me.sender.from_name} <${data.me.sender.from_email}>` : 'your mailbox'
            }, one every 20–45 seconds (${estimate(campaign.counts.pending)}). You can pause at any time, and it's fine to close this page.`}
            actions={
              <>
                <Button variant="text" onClick={() => setConfirmStart(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setConfirmStart(false)
                    run(() => campaignsApi.start(cid), 'Sending started')
                  }}
                >
                  {campaign.status === 'paused' ? 'Resume' : 'Start'}
                </Button>
              </>
            }
          />
          <M3Dialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            icon="delete"
            title="Delete this campaign?"
            description="Its recipient list and send history are deleted too, so future campaigns won't know who it already emailed. Opt-outs are kept."
            actions={
              <>
                <Button variant="text" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button variant="text" danger onClick={remove} disabled={busy}>
                  Delete
                </Button>
              </>
            }
          />
        </>
      )}
    </EmailPage>
  )
}
