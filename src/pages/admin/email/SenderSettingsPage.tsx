import { useEffect, useMemo, useState } from 'react'
import { campaignsApi, type Sender, type SenderInput } from '@/api/adminApiClient'
import { Button, Card, FilterChip, Icon, Spinner, TextField } from '@/components/admin/email/m3'
import { EmailPage, LoadError, PageHeader, errorMessage, formatDateTime, snackbar, useLoad } from '@/components/admin/email/shared'

const PRESETS = [
  { key: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465 },
  { key: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 465 },
  { key: 'outlook', label: 'Outlook', host: 'smtp.office365.com', port: 587 },
]

type Form = Omit<SenderInput, 'smtp_port' | 'daily_cap'> & { smtp_port: string; daily_cap: string; password: string }

function toForm(s: Sender | null, email: string): Form {
  return {
    from_name: s?.from_name ?? '',
    from_email: s?.from_email ?? email,
    smtp_host: s?.smtp_host ?? 'smtp.zoho.com',
    smtp_port: String(s?.smtp_port ?? 465),
    smtp_username: s?.smtp_username ?? email,
    password: '',
    daily_cap: String(s?.daily_cap ?? 300),
  }
}

export default function SenderSettingsPage() {
  const { data, setData, error, loading, reload } = useLoad(() => campaignsApi.me())
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    if (data && !form) setForm(toForm(data.sender, data.email))
  }, [data, form])

  const sender = data?.sender ?? null
  const initial = useMemo(() => (data ? toForm(data.sender, data.email) : null), [data])
  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial)
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))

  const save = async () => {
    if (!form) return
    setSaving(true)
    setVerifyError(null)
    try {
      const { sender: saved } = await campaignsApi.saveSender({
        ...form,
        smtp_port: Number(form.smtp_port),
        daily_cap: Number(form.daily_cap),
        password: form.password || undefined,
      })
      setData((d) => (d ? { ...d, sender: saved } : d))
      setForm(toForm(saved, data?.email ?? ''))
      snackbar(saved.verified_at ? 'Saved' : 'Saved. Now verify the connection.')
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const verify = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await campaignsApi.verifySender()
      setData((d) => (d ? { ...d, sender: res.sender } : d))
      snackbar('Connected. You can send campaigns now.')
    } catch (e) {
      setVerifyError(errorMessage(e))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <EmailPage>
      <PageHeader
        title="Sender settings"
        supporting="The mailbox your campaigns send from. It's yours alone: other admins connect their own."
      />
      {loading && !data && <Spinner />}
      {error && !data && <LoadError error={error} onRetry={reload} />}

      {form && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card variant="outlined" className="p-6">
            <form
              className="flex flex-col gap-6"
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="title-medium">Your mailbox</div>
                {sender?.verified_at ? (
                  <span className="m3-status m3-status--success">
                    <Icon name="check_circle" />
                    Verified {formatDateTime(sender.verified_at)}
                  </span>
                ) : (
                  <span className="m3-status m3-status--tertiary">
                    <Icon name="schedule" />
                    {sender ? 'Not verified' : 'Not connected'}
                  </span>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <TextField label="From name" value={form.from_name} onChange={set('from_name')} supporting="e.g. Daniel from OnSwift" maxLength={100} required />
                <TextField label="From email" type="email" value={form.from_email} onChange={set('from_email')} supporting="Replies come back here" required />
              </div>

              <div>
                <div className="label-large on-surface-variant mb-3">Provider</div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <FilterChip
                      key={p.key}
                      selected={form.smtp_host === p.host && form.smtp_port === String(p.port)}
                      onClick={() => setForm((f) => (f ? { ...f, smtp_host: p.host, smtp_port: String(p.port) } : f))}
                    >
                      {p.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-[1fr_140px]">
                <TextField label="SMTP host" value={form.smtp_host} onChange={set('smtp_host')} required />
                <TextField label="Port" type="number" inputMode="numeric" value={form.smtp_port} onChange={set('smtp_port')} supporting="465 or 587" required />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <TextField label="Username" value={form.smtp_username} onChange={set('smtp_username')} supporting="Usually your full email address" autoComplete="username" required />
                <TextField
                  label="App password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  supporting={sender?.has_password ? 'Saved. Leave blank to keep it.' : 'Encrypted on the server, never shown again'}
                />
              </div>

              <TextField
                label="Daily limit"
                type="number"
                inputMode="numeric"
                value={form.daily_cap}
                onChange={set('daily_cap')}
                supporting={`Stay under your provider's sending limit. ${sender ? `${sender.sent_last_24h} sent in the last 24 hours.` : ''}`}
                className="sm:max-w-[240px]"
              />

              {verifyError && <div className="body-medium text-error" role="alert">{verifyError}</div>}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="tonal" icon="refresh" onClick={verify} disabled={!sender || dirty || verifying || saving}>
                  {verifying ? 'Checking…' : 'Verify connection'}
                </Button>
                <Button type="submit" disabled={!dirty || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </Card>

          <Card variant="filled" className="body-medium flex h-fit flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <Icon name="info" />
              <span className="title-small">Use an app password</span>
            </div>
            <p>Most providers block your normal password for SMTP. Create an app password instead:</p>
            <div>
              <div className="title-small">Zoho Mail</div>
              <p className="on-surface-variant">
                My Account → Security → App Passwords. Use smtp.zoho.com, or smtp.zoho.eu / smtp.zoho.in if your account is hosted there.
              </p>
            </div>
            <div>
              <div className="title-small">Gmail / Google Workspace</div>
              <p className="on-surface-variant">Turn on 2-Step Verification, then Google Account → Security → App passwords.</p>
            </div>
            <p className="on-surface-variant">Verify checks the login without sending anything.</p>
          </Card>
        </div>
      )}
    </EmailPage>
  )
}
