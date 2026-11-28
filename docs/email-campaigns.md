# Email Campaigns

The admin email-campaign feature: what it is, how it works, and how to run and maintain it.

> **Where:** `/admin/email/*` (frontend) · `backend/core/campaigns/` (Django app) · API at `/api/v10/`
> **Replaces:** the local `send_winback.py` script and its `sent_log.txt` / `optouts.txt` files

---

## 1. What it is

Email campaigns let OnSwift team members send personal, plain-text outreach emails from the admin panel, such as win-back emails, product updates and announcements. Each email goes out **from the sending admin's own mailbox** (for example Zoho), one at a time, with a random 20–45 second gap between sends, so it reads like a real person writing rather than a newsletter blast.

It is the production version of `send_winback.py`, with the same behaviour:

| `send_winback.py` (old) | Campaigns (now) |
|---|---|
| Ran on one laptop, had to stay open for the whole send | Runs on the server; survives closing the browser, restarts and deploys |
| SMTP password in a local `.env` | Each admin's password is stored **encrypted** in the database |
| `sent_log.txt` stopped double-sends | The database records every send; "skip anyone already emailed" is a per-campaign switch |
| `optouts.txt`, edited by hand | A shared **Opt-outs** list, filled automatically by unsubscribe links |
| CSV only | CSV upload **or** filtered platform users (role, inactivity, sign-up date) |
| Only the person with the script could send | Any admin on the allowlist can, from their own mailbox |

---

## 2. Who can use it

Access takes three things:

1. **Being signed in to the admin panel.** The admin panel uses **Supabase Auth**, not the main app's Django login.
2. **Being on the allowlist.** Your email must be listed in the `CAMPAIGN_ADMIN_EMAILS` environment variable on Cloud Run (comma-separated). Anyone else gets *"This account doesn't have access to email campaigns."*
3. **Having your own mailbox connected.** To actually send, you need a connected and verified mailbox under **Sender settings**. Each admin sends from their own mailbox only; nobody can send from someone else's.

**To give a teammate access:** add their email to `CAMPAIGN_ADMIN_EMAILS` on Cloud Run and deploy a new revision. They then sign in to `/admin` and connect their mailbox. Removing their email takes away their access the next time the server checks their session, within about a minute.

---

## 3. The admin screens

All four live under **Email** in the admin sidebar.

### Campaigns (`/admin/email/campaigns`)
A list of every campaign with its status and counts (sent, pending, failed, skipped). **New campaign** creates a draft.

### Campaign detail (`/admin/email/campaigns/:id`)
Everything for one campaign:

- **Content:**
  - Name, subject and body (plain text).
  - Placeholders:
    - `{first_name}`: the recipient's first name, or **"there"** if unknown ("Hi there,").
    - `{unsubscribe_link}`: their personal unsubscribe link. If you leave it out, a line `Unsubscribe: <link>` is added to the bottom automatically. Every email always carries one.
  - **Skip anyone already emailed by another campaign** (on by default), which is the old `sent_log.txt` behaviour.
- **Recipients:**
  - **Upload CSV:**
    - Needs an `email` column.
    - The first name is read from the first of these columns that has a value: `first_name`, `firstname`, `first name`, `full_name` or `name` (only the first word is kept).
    - Limits are 2 MB and 5,000 rows per upload.
    - Invalid emails, duplicates and opted-out addresses are dropped, and the result tells you how many of each.
  - **Add platform users:** filter active users by role (creator, talent, client), "never logged in", "inactive for N days", or a sign-up date range. **Preview** shows the match count and five sample emails before anything is added.
  - A searchable, filterable recipient table (pending, sent, failed, skipped) with the error for each failure.
  - **Remove** a single pending recipient, **Clear pending** (only while paused), or **Retry failed**, which puts failed recipients back in the queue.
- **Preview:** the exact email as the next recipient will receive it, with the From line, subject and filled-in body.
- **Send test:** sends one copy to any address, right away, from your mailbox. A successful test also marks your mailbox as verified.
- **Start / Pause / Resume:** start sending, or stop and continue later. The page refreshes itself while sending.
- **Last error banner:** why a campaign paused or is waiting (wrong password, daily limit reached, mail server unreachable).

### Sender settings (`/admin/email/sender`)
Your own mailbox:

| Field | Notes |
|---|---|
| From name / From email | What recipients see. |
| SMTP host / port | Zoho: `smtp.zoho.com`, `465`. Port **465** uses implicit TLS; any other port (usually **587**) uses STARTTLS. |
| SMTP username | Usually the full mailbox address. |
| Password | Use an **app password** if the provider has 2FA (Zoho, Gmail). It is encrypted on save and **never shown or sent back**. The UI only shows whether one is saved. |
| Daily limit | 1–2000, default 300. This caps emails sent from this mailbox in any rolling 24 hours, across all campaigns. |

**Verify connection** logs in to the mail server without sending anything. Changing the host, port, username or password clears verification, so you need to verify again before starting a campaign. The page also shows how many emails were sent in the last 24 hours.

### Opt-outs (`/admin/email/opt-outs`)
The global do-not-email list, shared by every campaign and every admin. Each entry shows a reason: **Unsubscribed via link**, **Replied stop**, or **Added manually**.

- **Add:** paste one or many addresses (comma- or line-separated). Use this when someone replies "stop".
- **Remove:** only if someone explicitly asks to be emailed again.

Opted-out addresses can't be added to a campaign, and are skipped at send time even if they were added before they opted out.

---

## 4. How it works

### 4.1 Architecture

```
 Admin browser (/admin, Supabase session)
        │  Bearer <Supabase access token>
        ▼
 Django on Cloud Run  /api/v10/...  ──►  Supabase /auth/v1/user  (who is this?)
        │                                 + CAMPAIGN_ADMIN_EMAILS allowlist
        ▼
 Neon Postgres: SenderAccount, Campaign, CampaignRecipient, EmailSuppression
        ▲
        │  POST /api/v10/campaigns/send-due/  (X-Cron-Token), every minute
 Cloud Scheduler job "campaigns-send-due"
        │
        ▼
 Admin's SMTP server (e.g. Zoho) ──► recipient inbox
```

### 4.2 Why a scheduler instead of a loop
Cloud Run can't run a 40-minute loop that sleeps 20–45 seconds between emails: requests time out after 60 seconds and the CPU is throttled outside requests. So **Cloud Scheduler calls `send-due` every minute**, and each call:

1. Works for up to **45 seconds** (`TICK_BUDGET_S`), safely under the timeout.
2. Finds every campaign with status `sending` whose `next_send_at` is due.
3. Sends **one** email for each due campaign, then books that campaign's next slot 20–45 seconds later (random, `min_gap_s` to `max_gap_s`).
4. If the next slot falls within the same 45 seconds it waits and sends again; otherwise it stops and the next minute's call continues.

All progress lives in the database, so a send survives restarts, deploys and closed browsers. In practice, one campaign sends roughly **1.5–2 emails a minute**, about 100 an hour.

### 4.3 What happens for each email
For one due campaign, `sender._process_campaign` does the following:

1. **Claims the slot** with a conditional database update, so two overlapping scheduler calls can never send the same email twice.
2. **Checks the mailbox.** If there's no sender, it's unverified, or there's no password, the campaign **pauses** with a message.
3. **Checks the daily limit.** If the mailbox has hit `daily_cap` sends in the last 24 hours, the campaign waits **30 minutes** and tries again on its own, without pausing.
4. **Picks the next pending recipient** in upload order, and marks them **skipped** instead if they've opted out, or if "skip previously emailed" is on and another campaign has already emailed them.
5. If nobody is pending, the campaign becomes **done**.
6. **Logs in to SMTP and sends.** Each email gets:
   - `From: <from name> <from email>`, with `Reply-To` set to the same address
   - A personalised subject and body
   - A `List-Unsubscribe` header (link + `mailto:...?subject=stop`) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, so Gmail and others show their native "Unsubscribe" button
7. **Records the result:**
   - **Sent:** recipient marked `sent` with a time.
   - **The server rejects this one address:** recipient marked `failed` with the error, and the campaign carries on.
   - **Login rejected:** the mailbox is un-verified and the campaign **pauses** ("rejected the login. Update the password…").
   - **Mail server unreachable or busy:** the recipient stays pending and is retried at the next slot. The campaign shows "Mail server unreachable, retrying".

### 4.4 Campaign states

```
 draft ──Start──► sending ──Pause──► paused ──Resume──► sending
                    │                   ▲
                    │ nobody pending    │ adding recipients / Retry failed
                    ▼                   │
                   done ────────────────┘
```

- You can only edit, delete or clear pending recipients while a campaign is **not** sending, so pause first.
- Adding recipients to a **done** campaign, or retrying its failures, moves it to **paused** so you can resume it.
- **Start** requires a subject and body, your verified mailbox, and at least one pending recipient. The campaign then sends from **the mailbox of the admin who pressed Start**.

### 4.5 Unsubscribing
- Every email carries a personal link: `PUBLIC_API_URL/api/v10/unsubscribe/<signed token>/`. The token is the email address signed with Django's `SECRET_KEY`, so it can't be forged or edited to unsubscribe someone else.
- **Opening** the link shows a confirmation page with an **Unsubscribe** button. It doesn't unsubscribe on open, because email security scanners open links automatically.
- **Pressing the button**, or a mail client's one-click unsubscribe (a POST), adds the address to Opt-outs with the reason "Unsubscribed via link".
- People who **reply "stop"** have to be added by hand on the Opt-outs page.

### 4.6 Security
| Concern | How it's handled |
|---|---|
| Who can call the API | A Supabase token is checked against Supabase on each request (cached for 60s), plus the `CAMPAIGN_ADMIN_EMAILS` allowlist |
| SMTP passwords | Fernet-encrypted with `CAMPAIGN_CREDS_KEY`; never returned by any API response |
| The scheduler endpoint | `X-Cron-Token` must match `DIGEST_CRON_TOKEN` (constant-time compare); 503 if not configured, 403 if wrong |
| Unsubscribe tokens | Signed with `SECRET_KEY` (salt `campaigns.unsubscribe`) |
| Double sending | Atomic slot claim per campaign; unique (campaign, email) per recipient |
| Template injection | Placeholders use plain string replacement, so a stray `{` in a body can't crash a send |

---

## 5. Data model (`campaigns/models.py`)

| Model | Purpose | Key fields |
|---|---|---|
| `SenderAccount` | One admin's mailbox (one per admin) | `admin_email` (unique), `from_name`, `from_email`, `smtp_host`, `smtp_port`, `smtp_username`, `password_encrypted`, `daily_cap`, `verified_at` |
| `Campaign` | One email and its send state | `name`, `subject`, `body`, `exclude_previously_emailed`, `sender`, `status` (draft/sending/paused/done), `created_by`, `started_by`, `last_error`, `next_send_at`, `min_gap_s`/`max_gap_s` (20/45) |
| `CampaignRecipient` | One person on one campaign | `email` (lowercase, unique per campaign), `first_name`, `source` (csv/user/import), `status` (pending/sent/failed/skipped), `error`, `sent_at` |
| `EmailSuppression` | The global opt-out list | `email` (unique), `reason` (unsubscribed/replied_stop/manual), `added_by` |

Deleting a campaign deletes its recipients. That also removes the record that those people were emailed, so **"skip previously emailed" would no longer protect them**. Prefer leaving finished campaigns in place.

---

## 6. API reference (`/api/v10/`)

All endpoints need `Authorization: Bearer <Supabase access token>` from an allowlisted admin, except where noted.

| Method | Path | What it does |
|---|---|---|
| GET | `me/` | Your email and your sender (if any) |
| GET / PUT | `senders/me/` | Read / save your mailbox (password optional on update) |
| POST | `senders/me/verify/` | Test the SMTP login without sending |
| GET / POST | `campaigns/` | List / create campaigns |
| GET / PATCH / DELETE | `campaigns/<id>/` | Read / edit / delete (not while sending) |
| GET | `campaigns/<id>/recipients/` | Paged list (100), `?status=`, `?q=`, `?offset=` |
| POST | `campaigns/<id>/recipients/csv/` | Upload a CSV (`file`) |
| POST | `campaigns/<id>/recipients/users/` | Add platform users by filters; `preview: true` only counts |
| POST | `campaigns/<id>/recipients/clear-pending/` | Remove all pending (not while sending) |
| POST | `campaigns/<id>/recipients/retry-failed/` | Re-queue failed recipients |
| DELETE | `campaigns/<id>/recipients/<rid>/` | Remove one pending recipient |
| GET | `campaigns/<id>/preview/` | Rendered email for the next recipient |
| POST | `campaigns/<id>/test/` | Send one test to `email` |
| POST | `campaigns/<id>/start/` · `pause/` | Start/resume · pause |
| GET / POST | `suppressions/` | List (`?q=`, first 500) / add (`email` or `emails`) |
| DELETE | `suppressions/<id>/` | Remove an opt-out |
| POST | `campaigns/send-due/` | **Scheduler only.** Header `X-Cron-Token`. Returns `{"sent": n}` |
| GET / POST | `unsubscribe/<token>/` | **Public.** Confirm page / unsubscribe |

Errors come back as `{"error": "<message the UI can show>"}`.

---

## 7. Configuration

### Cloud Run environment variables (`onswift-backend`, us-central1)

| Variable | Required | What it is |
|---|---|---|
| `CAMPAIGN_ADMIN_EMAILS` | Yes | Comma-separated admin emails allowed to use campaigns |
| `SUPABASE_URL` | Yes | The Supabase project URL the admin panel signs in with (**no** `VITE_` prefix on the server) |
| `SUPABASE_ANON_KEY` | Yes | That project's public anon key |
| `CAMPAIGN_CREDS_KEY` | Yes | Fernet key that encrypts SMTP passwords. **See section 8.3 before ever changing it.** |
| `DIGEST_CRON_TOKEN` | Yes | Shared secret the scheduler sends as `X-Cron-Token` |
| `PUBLIC_API_URL` | Recommended | Public base URL for unsubscribe links: `https://onswift-backend-846361006238.us-central1.run.app`. Without it, links use whichever host served the request. |
| `SECRET_KEY` | Already set | Signs unsubscribe tokens. Changing it breaks the links in every email already sent. |

Generate a Fernet key yourself, and don't paste it anywhere public:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend (Vercel)
The admin panel uses the existing `VITE_API_BASE_URL` and the Supabase client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). No campaign-specific variables.

### Cloud Scheduler job
| Setting | Value |
|---|---|
| Name | `campaigns-send-due` (us-central1) |
| Schedule | `* * * * *` (every minute) |
| Target | `POST https://onswift-backend-846361006238.us-central1.run.app/api/v10/campaigns/send-due/` |
| Header | `X-Cron-Token: <DIGEST_CRON_TOKEN>` |
| Attempt deadline | 90s |
| Retries | 0 (the next minute is the retry) |

Use the `…846361006238.us-central1.run.app` URL. The `…-uc.a.run.app` form is rejected by `ALLOWED_HOSTS`.

**Cost:** the first 3 Scheduler jobs per billing account are free; beyond that it's about $0.10 per job per month. A call with nothing to send returns in milliseconds, so the per-minute calls are negligible on Cloud Run.

---

## 8. Operating it

### 8.1 Sending a campaign (checklist)
1. **Sender settings:** connect your mailbox, then **Verify connection**. You only need to do this once.
2. **Campaigns → New campaign:** add a name, subject and body. Use `{first_name}` and keep `{unsubscribe_link}` in the footer.
3. **Add recipients** by CSV or platform-user filters. Check the "added / duplicates / opted out / previously emailed" summary.
4. **Preview**, then **Send test** to yourself. Check how it looks in a real inbox, including the spam folder.
5. **Start.** You can close the tab; sending continues on the server.
6. Check back occasionally. Watch the **failed** count and the error banner.
7. Read the replies in your own mailbox. Add anyone who says "stop" to **Opt-outs**.

### 8.2 Good sending practice
- Keep the **daily limit at or below what your provider allows**. Zoho's limits depend on the plan; 300/day is a safe default for a personal mailbox. Going over gets the mailbox blocked.
- Send to **people who know OnSwift** (sign-ups, users). Don't send to bought or scraped lists.
- Two admins can send at the same time; each sends from their own mailbox, under their own limit.
- Plain text, personal tone and a real reply address are deliberate. They're what keep these emails out of the Promotions and spam folders.

### 8.3 Maintenance tasks

**Rotating `DIGEST_CRON_TOKEN`:**
1. Set the new value on Cloud Run and deploy.
2. Immediately update the Scheduler job's `X-Cron-Token` header to match.
3. Check the next run returns 200 (see 8.4).

**Rotating `CAMPAIGN_CREDS_KEY`:** ⚠️ Every saved SMTP password was encrypted with the old key and **can't be decrypted with a new one**. If you change it:
- Every sending campaign pauses with *"The saved SMTP password can't be decrypted. Re-enter it."*
- Every admin must re-enter their mailbox password in Sender settings and verify.
- Only rotate it if the key may have leaked, and tell the team first.

**Losing `CAMPAIGN_CREDS_KEY`:** same as rotating. Nothing else is affected; campaigns, recipients and opt-outs are not encrypted.

**Someone's mailbox password changed:** their running campaign pauses with "rejected the login". They update the password in Sender settings, verify, then **Resume**.

**Adding or removing an admin:** edit `CAMPAIGN_ADMIN_EMAILS` and deploy (see section 2). A removed admin's `SenderAccount` and their campaigns stay in the database. Another admin can resume those campaigns, which then send from **that** admin's mailbox.

**Pausing all sending (emergency):** pause each sending campaign in the UI, **or** pause the Scheduler job, which stops everything instantly:

```bash
gcloud scheduler jobs pause campaigns-send-due --location=us-central1
gcloud scheduler jobs resume campaigns-send-due --location=us-central1
```

Campaigns stay in `sending` while the job is paused and pick up where they left off when it resumes.

**Deploying:** safe at any time, even mid-campaign. State is in the database, and a call cut off by a deploy just continues on the next minute. New models need `python manage.py migrate` (migrations are in `campaigns/migrations/`).

### 8.4 Monitoring
- **In the app:** campaign counts, the error banner, and "sent in last 24h" on Sender settings.
- **Scheduler:** Cloud Console → Cloud Scheduler → `campaigns-send-due` → *Last run* should say **Success** every minute.
- **Cloud Run logs:** filter for `send-due`. A healthy log shows `POST 200` from `Google-Cloud-Scheduler`. Failed SMTP connects are logged as warnings, `campaign <id>: SMTP connect failed`.
- **Manual check** (reads the token from your shell; don't paste it into chat or docs):

  ```bash
  curl -X POST -H "X-Cron-Token: $DIGEST_CRON_TOKEN" -H "Content-Length: 0" \
    https://onswift-backend-846361006238.us-central1.run.app/api/v10/campaigns/send-due/
  # {"sent": 0}  when nothing is due
  ```

### 8.5 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This account doesn't have access to email campaigns" | Email not in `CAMPAIGN_ADMIN_EMAILS` | Add it, deploy |
| "Admin auth is not configured on the server" | `SUPABASE_URL` / `SUPABASE_ANON_KEY` missing on Cloud Run (or still `VITE_`-prefixed) | Set them without the prefix |
| "Your admin session has expired" | Supabase token expired | Sign in to /admin again |
| "CAMPAIGN_CREDS_KEY is not set on the server" (503) | Key missing | Set it on Cloud Run |
| "The saved SMTP password can't be decrypted" | The key changed | Re-enter the password and verify |
| Verify fails: "rejected the username or password" | Wrong password, or the provider needs an app password | Create an app password in Zoho/Gmail |
| Verify fails: "Couldn't connect to host:port" | Wrong host or port | Zoho: `smtp.zoho.com` + 465 |
| Campaign stuck on `sending`, nothing goes out | Scheduler paused or failing, or the token doesn't match | Check Scheduler *Last run*; 403 means a token mismatch, 503 means `DIGEST_CRON_TOKEN` unset |
| "Daily limit of N emails reached" | `daily_cap` hit | Nothing to do: it resumes on its own as the 24h window rolls. Raise the limit only if your provider allows it |
| "Mail server unreachable, retrying" | Temporary network or provider problem | Usually clears itself; check the provider's status if it persists |
| Many **failed** with "recipient rejected" | Bad or old addresses | Expected for old lists; leave them, or **Retry failed** if the cause was temporary |
| Unsubscribe link says "Link not valid" | Link truncated by a mail client, or `SECRET_KEY` changed | Add the person manually on Opt-outs |
| Unsubscribe links point to the wrong host | `PUBLIC_API_URL` not set | Set it to the public backend URL |
| A recipient was **skipped** | Opted out, or already emailed by another campaign | Check the recipient's error text; turn off "skip previously emailed" if the resend is intentional |

---

## 9. One-time migration from `send_winback.py`

Moves the script's history into the database so nobody from the old win-back run is emailed twice. It is **safe to run more than once**.

```bash
cd backend/core
python manage.py import_winback_state --sent-log ../../sent_log.txt [--optouts ../../optouts.txt] --created-by <your admin email>
```

- `sent_log.txt` → recipients marked **sent** on a draft campaign named **"Win-back"**, which gets the script's original subject and body.
- `optouts.txt` (optional) → the Opt-outs list.

**To run it against production (Neon) from your machine:**
1. `.env.local` overrides `.env`, so temporarily set `USE_SQLITE=false` in `.env.local`.
2. Run the command. Confirm the output says **`DB backend: NEON`** before trusting the result.
3. Set `USE_SQLITE=true` back in `.env.local`.

---

## 10. Code map

**Backend: `backend/core/campaigns/`**

| File | What's in it |
|---|---|
| `models.py` | The four models (section 5) |
| `auth.py` | `SupabaseAdminAuthentication`: Supabase token check plus the allowlist |
| `crypto.py` | Fernet encrypt/decrypt for SMTP passwords |
| `recipients.py` | CSV parsing, platform-user filters, `add_recipients` (dedupe, opt-out, previously-emailed counts) |
| `sender.py` | Rendering, message building, SMTP, the per-email logic, `send_tick` |
| `views.py` | All `/api/v10/` endpoints, the scheduler entry point, the public unsubscribe page |
| `urls.py` | Routes (mounted in `core/urls.py` as `api/v10/`) |
| `management/commands/import_winback_state.py` | Section 9 |
| `tests.py` | 25 tests: auth, encryption, CSV rules, sending, caps, slot claiming, pause/resume, unsubscribe |

Run the tests with `cd backend/core && python manage.py test campaigns`.

**Frontend**

| File | What's in it |
|---|---|
| `src/api/adminApiClient.ts` | Calls `/api/v10` with the admin's Supabase token |
| `src/pages/admin/email/CampaignsPage.tsx` | Campaign list |
| `src/pages/admin/email/CampaignDetailPage.tsx` | Editor, recipients, preview, test, start/pause |
| `src/pages/admin/email/SenderSettingsPage.tsx` | Mailbox settings |
| `src/pages/admin/email/OptOutsPage.tsx` | Opt-outs |
| `src/components/admin/email/m3.tsx`, `m3.css`, `shared.tsx` | Material 3 components and styles used only by these pages (lazy-loaded) |
| `src/components/admin/AdminLayout.tsx` | The **Email** section of the admin sidebar |
| `src/App.tsx` | Lazy routes under `/admin/email/*` |

---

## 11. Known limits and possible next steps

- **Plain text only.** There are no HTML emails, images or open/click tracking. This is deliberate for deliverability, not a missing piece.
- **No scheduled start time.** A campaign starts when you press Start.
- **"Stop" replies are manual.** The system doesn't read the inbox, so add those people on Opt-outs.
- **Bounces aren't tracked** beyond immediate SMTP rejections (shown as failed). Late bounce emails land in the sender's inbox.
- **Opt-outs list shows the first 500.** Search to find older entries.
- **One sender per admin.** An admin can't have two mailboxes.
- **The email digest job** (README §20, issue 4) also uses `DIGEST_CRON_TOKEN` but is not scheduled yet. That's a separate job from `campaigns-send-due`.
