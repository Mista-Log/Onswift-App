import { useEffect, useState } from 'react'
import { campaignsApi, type Suppression } from '@/api/adminApiClient'
import { Button, Card, Icon, IconButton, M3Dialog, Select, Spinner, TextArea } from '@/components/admin/email/m3'
import { EmailPage, LoadError, PageHeader, errorMessage, formatDateTime, snackbar, useLoad } from '@/components/admin/email/shared'

const REASONS: Record<Suppression['reason'], string> = {
  replied_stop: 'Replied “stop”',
  unsubscribed: 'Unsubscribe link',
  manual: 'Added manually',
}

export default function OptOutsPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, error, loading, reload } = useLoad(() => campaignsApi.suppressions(debounced), [debounced])
  const [emails, setEmails] = useState('')
  const [reason, setReason] = useState<Suppression['reason']>('replied_stop')
  const [adding, setAdding] = useState(false)
  const [toRemove, setToRemove] = useState<Suppression | null>(null)

  const add = async () => {
    setAdding(true)
    try {
      const res = await campaignsApi.addSuppressions(emails, reason)
      snackbar(`${res.added} added${res.invalid ? ` · ${res.invalid} not valid` : ''}`)
      setEmails('')
      reload()
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setAdding(false)
    }
  }

  const remove = async () => {
    if (!toRemove) return
    try {
      await campaignsApi.removeSuppression(toRemove.id)
      snackbar(`${toRemove.email} can be emailed again`)
      reload()
    } catch (e) {
      snackbar(errorMessage(e), 'error')
    } finally {
      setToRemove(null)
    }
  }

  return (
    <EmailPage>
      <PageHeader
        title="Opt-outs"
        supporting="Nobody on this list gets any campaign, from any admin. Unsubscribe-link clicks land here automatically."
      />

      <div className="flex flex-col gap-6">
        <Card variant="outlined" className="p-6">
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (emails.trim()) add()
            }}
          >
            <div className="title-medium">Add people who asked to stop</div>
            <TextArea
              label="Email addresses"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              supporting="Separate with commas or new lines"
              rows={3}
              style={{ minHeight: 96 }}
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value as Suppression['reason'])} className="w-full sm:w-60">
                <option value="replied_stop">Replied “stop”</option>
                <option value="manual">Other</option>
              </Select>
              <Button type="submit" icon="block" disabled={adding || !emails.trim()}>
                {adding ? 'Adding…' : 'Add to opt-outs'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="m3-search">
          <Icon name="search" size={24} />
          <input aria-label="Search opt-outs" placeholder="Search opt-outs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading && !data && <Spinner />}
        {error && <LoadError error={error} onRetry={reload} />}
        {data &&
          (data.suppressions.length === 0 ? (
            <Card variant="filled" className="flex flex-col items-center gap-2 py-10 text-center">
              <Icon name="person_off" size={24} />
              <div className="title-medium">{debounced ? 'No matches' : 'Nobody has opted out'}</div>
            </Card>
          ) : (
            <Card variant="outlined" className="overflow-x-auto p-0">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                    <th className="hidden md:table-cell">Added by</th>
                    <th className="hidden sm:table-cell">Date</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.suppressions.map((s) => (
                    <tr key={s.id}>
                      <td className="break-all">{s.email}</td>
                      <td className="on-surface-variant whitespace-nowrap">{REASONS[s.reason]}</td>
                      <td className="on-surface-variant hidden md:table-cell">{s.added_by}</td>
                      <td className="on-surface-variant hidden whitespace-nowrap sm:table-cell">{formatDateTime(s.created_at)}</td>
                      <td className="w-12 text-right">
                        <IconButton icon="delete" label={`Remove ${s.email}`} onClick={() => setToRemove(s)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.total > data.suppressions.length && (
                <div className="body-small on-surface-variant px-4 py-3">
                  Showing {data.suppressions.length} of {data.total}. Search to narrow it down.
                </div>
              )}
            </Card>
          ))}
      </div>

      <M3Dialog
        open={!!toRemove}
        onOpenChange={(v) => !v && setToRemove(null)}
        icon="delete"
        title="Remove from opt-outs?"
        description={toRemove ? `${toRemove.email} will be able to receive campaigns again. Only do this if they asked to be emailed.` : ''}
        actions={
          <>
            <Button variant="text" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button variant="text" danger onClick={remove}>
              Remove
            </Button>
          </>
        }
      />
    </EmailPage>
  )
}
