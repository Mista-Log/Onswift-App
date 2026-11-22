import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { campaignsApi, type Campaign } from '@/api/adminApiClient'
import { Banner, Button, Card, Icon, LinearProgress, M3Dialog, Select, Spinner, TextField } from '@/components/admin/email/m3'
import {
  CampaignStatusPill,
  EmailPage,
  LoadError,
  PageHeader,
  errorMessage,
  formatDateTime,
  snackbar,
  useLoad,
} from '@/components/admin/email/shared'

const BLANK_BODY = `Hi {first_name},



If you'd rather not hear from us, unsubscribe here: {unsubscribe_link}
`

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { total, sent, pending, failed, skipped } = campaign.counts
  const processed = sent + failed + skipped
  return (
    <Link to={`/admin/email/campaigns/${campaign.id}`} className="m3-card m3-card--outlined m3-state flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="title-medium min-w-0 break-words">{campaign.name}</div>
        <CampaignStatusPill status={campaign.status} />
      </div>
      <div className="body-medium on-surface-variant line-clamp-1">{campaign.subject || 'No subject yet'}</div>
      {total > 0 ? (
        <>
          <LinearProgress value={(processed / total) * 100} label={`${campaign.name} progress`} />
          <div className="body-small">
            {sent} sent · {pending} pending
            {failed > 0 && <span className="text-error"> · {failed} failed</span>}
            {skipped > 0 && ` · ${skipped} skipped`}
          </div>
        </>
      ) : (
        <div className="body-small on-surface-variant">No recipients yet</div>
      )}
      <div className="body-small on-surface-variant mt-auto">
        Created by {campaign.created_by} · {formatDateTime(campaign.created_at)}
      </div>
    </Link>
  )
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useLoad(async () => {
    const [list, me] = await Promise.all([campaignsApi.list(), campaignsApi.me()])
    return { campaigns: list.campaigns, sender: me.sender }
  })
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    const source = data?.campaigns.find((c) => String(c.id) === copyFrom)
    setBusy(true)
    try {
      const { campaign } = await campaignsApi.create({
        name: name.trim(),
        subject: source?.subject ?? '',
        body: source?.body ?? BLANK_BODY,
        exclude_previously_emailed: source?.exclude_previously_emailed ?? true,
      })
      navigate(`/admin/email/campaigns/${campaign.id}`)
    } catch (e) {
      snackbar(errorMessage(e), 'error')
      setBusy(false)
    }
  }

  const sender = data?.sender

  return (
    <EmailPage>
      <PageHeader
        title="Email campaigns"
        supporting="Each campaign sends from the mailbox of the admin who starts it, one email every 20–45 seconds."
        actions={
          <Button icon="add" onClick={() => setOpen(true)} disabled={!data}>
            New campaign
          </Button>
        }
      />

      {loading && !data && <Spinner />}
      {error && !data && <LoadError error={error} onRetry={reload} />}

      {data && (
        <div className="flex flex-col gap-4">
          {(!sender || !sender.verified_at) && (
            <Banner
              tone="info"
              icon="manage_accounts"
              action={
                <Link to="/admin/email/sender" className="m3-btn m3-btn--text m3-state">
                  {sender ? 'Verify' : 'Connect'}
                </Link>
              }
            >
              {sender
                ? 'Your mailbox is saved but not verified yet. Verify it before sending.'
                : 'Connect your mailbox to send campaigns. Each admin sends from their own address.'}
            </Banner>
          )}

          {data.campaigns.length === 0 ? (
            <Card variant="filled" className="flex flex-col items-center gap-3 py-12 text-center">
              <Icon name="mail" size={24} />
              <div className="title-medium">No campaigns yet</div>
              <div className="body-medium on-surface-variant max-w-sm">
                Write an email, add people from a CSV or from OnSwift&rsquo;s users, send yourself a test, then start.
              </div>
              <Button icon="add" variant="tonal" onClick={() => setOpen(true)}>
                New campaign
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </div>
      )}

      <M3Dialog
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        title="New campaign"
        description="Only your team sees the name."
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-6 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) create()
          }}
        >
          <TextField label="Campaign name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} />
          {data && data.campaigns.length > 0 && (
            <Select
              label="Start from"
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value)}
              supporting="Copies the subject and body. Recipients aren't copied."
            >
              <option value="">Blank email</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </form>
      </M3Dialog>
    </EmailPage>
  )
}
