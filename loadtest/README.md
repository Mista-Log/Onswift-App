# Backend load test

Written 12 November 2026. Files here: `k6-baseline.js` (the test), `TEARDOWN.md` (run commands and
cleanup checklist), `RESULTS.md` (what each run measured, added as runs happen).

## Backend address

Use `https://onswift-backend-846361006238.us-central1.run.app`. Cloud Run also lists a second address
for the same service (`...gx5jcdupoa-uc.a.run.app`), but the backend's `ALLOWED_HOSTS` does not include
it, so every request there gets a plain "Bad Request (400)" page.

Settings before any change (12 Nov 2026, revision `onswift-backend-00019-7tb`): no minimum instances
(0), maximum 20, 80 requests per instance, 1 CPU, 512MB.

## What we are doing

Measuring how the live backend (`onswift-backend` on Cloud Run, `us-central1`, with the Neon database)
behaves when many people use it at once. Nothing in the app is built or changed. The output is numbers:

- How fast it responds under 50, 200 and 500 simultaneous users (typical, slow and worst-case times).
- What gives way first: the server, the database connections, or one particular endpoint.
- Whether keeping one server instance always warm noticeably improves the first request.

## How

1. **Prepare.** Set a billing alert, note the current Cloud Run settings, warn the other contributors.
2. **Smoke test.** 2 simulated users for 30 seconds, to prove the address and both test accounts work.
3. **Baseline run.** The script signs in once as a creator and once as a talent, then simulates up to
   500 people loading what the dashboards fetch (profile, settings, notifications, projects, team,
   tasks) over 15 minutes.
4. **Change one thing.** Turn on one always-warm instance (`min-instances=1`).
5. **Run the identical test again** and compare.
6. **Tear down.** Put the Cloud Run setting back and delete anything created (`TEARDOWN.md`).

The tool is k6, a free program that pretends to be many users and times every response.

## Why this approach

- **Measure, don't build.** The GCP credits were about to expire. Anything set up would have to be
  deleted or paid for; the numbers stay useful.
- **Read-only.** The test hits the real backend and database. Reads cannot create junk records or
  send email.
- **Sign in once.** Login is limited to 10 a minute (and 10 an hour per email). Signing in 500 times
  would only measure that limit. It also means at most 10 runs can be started per hour.
- **Ramp in steps.** Holding at 50, then 200, then 500 shows the level where things start to slow,
  which one flat 500-user run would hide.
- **One change at a time.** If two things change between runs, there is no telling which mattered.
- **Not done: moving the database to Cloud SQL, adding Redis.** Both need setup or code changes that
  cannot be done and trusted in a day. The baseline shows whether either is worth doing later.

## Costs and limits

- The live app is slower for real users during each 15-minute run.
- Neon is billed separately; GCP credits do not cover the database load this creates.
- All simulated users share two accounts, so this shows how the server copes with volume, not how
  500 different accounts with different data would behave.
- Where the traffic is sent from matters. From a home connection the times include that connection's
  delay, and a slow uplink can become the limit before the backend does. A VM in `us-central1`
  removes that.
