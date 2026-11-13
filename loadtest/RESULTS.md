# Load test results

All tests: 12 November 2026, against the live `onswift-backend` service with the Neon free database.
Tests sent from a home connection include the trip to `us-central1` in their times (about 280ms of
every response). Tests sent from the VM `k6-loadgen`, in the same region as the backend, are close to
what the backend itself takes. **Do not compare Run 1 and Run 2 directly**: the sender changed
between them. Run 3 repeats Run 1 from the VM, so Run 3 and Run 2 are the pair to compare (100
against 500 users, same sender).

## Test log: every test that was run

Eleven tests, in order. Times are local (UTC+1) and approximate to the minute; "?" means the time
was not recorded. All used the script `k6-baseline.js` except tests 9 and 11, which timed single
requests with `curl`. Accounts: one creator and one talent test account, signed in once per test.

| # | Time | Test | Sent from | Backend revision | Outcome | Raw output |
|---|---|---|---|---|---|---|
| 1 | 08:30 | Smoke, 2 users, 30s | Home | 00019-7tb | **Failed.** Wrong address (`...gx5jcdupoa-uc.a.run.app`); backend refused it with "Bad Request (400)" after 11.7s. No load sent. | `results/other-tests.txt` |
| 2 | 08:31 | Smoke, 2 users, 30s | Home | 00019-7tb | **Failed.** Creator signed in (4.9s); talent refused, "Invalid email or password" (the account did not exist on the live database yet). No load sent. | `results/other-tests.txt` |
| 3 | ? (08:31–08:47) | Smoke, 2 users, 30s | Home | 00019-7tb | **Partial.** 22 requests, no errors, but only one simulated user started, so the creator's team endpoint was never called. Script's smoke stage fixed afterwards. | `results/other-tests.txt` |
| 4 | 08:47 | Smoke, 2 users, 30s | Home | 00019-7tb | **Passed.** 42 requests, all six endpoints 200, no errors. | `results/smoke.txt` |
| 5 | 08:48–09:03 | **Run 1**: peak 100 users, 15 min | Home | 00019-7tb | **Passed.** 22,992 requests, no errors. | `results/run1-100users-baseline.txt` |
| 6 | ? (after 09:03) | Peak 500 users, 15 min | Home | 00019-7tb | **Cut off, no numbers.** The sending machine ran out of memory and the run was stopped. The backend received an unknown amount of traffic first. | none |
| 7 | 10:29 | Smoke, 2 users, 30s | VM | 00019-7tb | **Passed.** 42 requests, all six endpoints 200, no errors. | `results/other-tests.txt` |
| 8 | 10:31–10:46 | **Run 2**: peak 500 users, 15 min | VM | 00019-7tb | **Passed.** 126,287 requests, no errors. | `results/run2-500users-baseline.txt` |
| 9 | 11:37 | Idle start, no minimum instances (4 single requests after 51 min idle) | VM | 00019-7tb | **Completed.** First request 3.6s, first sign-in 2.1s. | `results/other-tests.txt` |
| 10 | 11:38–11:53 | **Run 3**: peak 100 users, 15 min | VM | 00019-7tb | **Passed.** 27,462 requests, no errors. | `results/run3-100users-from-vm.txt` |
| 11 | 12:16 | Idle start, `min-instances=1` (4 single requests after about 20 min idle) | VM | 00020-qfr | **Completed.** First request 0.10s, first sign-in 1.9s. | `results/other-tests.txt` |

Not tests, but recorded for completeness: after each settings change the backend was checked with a
few single requests from home (all answered; times in `results/other-tests.txt`).

What was not saved: `results/smoke.txt` holds test 4 only, because tests 1 to 3 wrote to the same
file and were overwritten. Their output, and that of tests 7, 9 and 11, was copied from the terminal
session into `results/other-tests.txt`. The sections below give the results in detail.

## Smoke tests: 2 users, 30 seconds (tests 1, 2, 3, 4 and 7)

Test 4, from home: both accounts signed in, all six endpoints returned 200, 42 requests, no errors.

| Endpoint | Typical (median) | Slow (p95) | Worst |
|---|---|---|---|
| All requests (includes the two sign-ins) | 369ms | 811ms | 1.00s |
| Profile (`auth/user`) | 369ms | 392ms | 399ms |
| Settings | 363ms | 379ms | 381ms |
| Notifications | 377ms | 426ms | 438ms |
| Projects | 500ms | 792ms | 814ms |
| Team (creator) | 373ms | 380ms | 381ms |
| My tasks (talent) | 334ms | 336ms | 337ms |

Test 7, from the VM: same result, 42 requests, no errors.

| Endpoint | Typical (median) | Slow (p95) | Worst |
|---|---|---|---|
| All requests (includes the two sign-ins) | 87ms | 419ms | 5.75s |
| Profile (`auth/user`) | 86ms | 100ms | 102ms |
| Settings | 86ms | 133ms | 155ms |
| Notifications | 86ms | 151ms | 162ms |
| Projects | 215ms | 416ms | 419ms |
| Team (creator) | 86ms | 88ms | 88ms |
| My tasks (talent) | 78ms | 86ms | 87ms |

The 5.75s worst case in test 7 is one of the two sign-ins, made after the backend had been idle.

Tests 1 to 3 (the failed and partial attempts) are described in the test log above. From them:
before the service was warm, the very first request took 11.7s (test 1) and a sign-in a minute later
4.9s (test 2). Two requests only, so a hint, not a measurement. Likely a Cloud Run cold start plus
the Neon free database waking from sleep.

## Run 1 (test 5): baseline, peak 100 users (10 → 40 → 100), 15 minutes, sent from home

Settings: no minimum instances, maximum 20, 1 CPU, 512MB.

- Requests: 22,992 in total, about 25 per second on average.
- Errors: none (0 server errors, 0 failed requests).

| Endpoint | Typical (median) | Slow (p95) | Slowest 1% (p99) | Worst |
|---|---|---|---|---|
| All requests | 385ms | 676ms | 804ms | 1.31s |
| Profile (`auth/user`) | 379ms | 525ms | 679ms | 1.04s |
| Settings | 377ms | 540ms | 690ms | 1.06s |
| Notifications | 389ms | 559ms | 714ms | 1.31s |
| Projects | 587ms | 782ms | 946ms | 1.23s |
| Team (creator) | 379ms | 520ms | 667ms | 1.10s |
| My tasks (talent) | 376ms | 522ms | 657ms | 1.07s |

What it shows:

- The backend handles 100 simultaneous users without errors and without responses getting badly slower.
- The projects list is the one endpoint that stands out: about 200ms slower than the rest at every
  level. It is the first place to look for a slow query.

## Run 2 (test 8): baseline, peak 500 users (50 → 200 → 500), 15 minutes, sent from a VM

Sender: `k6-loadgen` (e2-standard-2, `us-central1-a`). Same backend settings as Run 1. An earlier
attempt at this run from the home machine (test 6) was cut off when that machine ran out of memory;
it produced no numbers.

A 2-user smoke test from the VM first (test 7): typical response 87ms (projects 215ms), against
369ms from home.

- Requests: 126,287 in total, about 139 per second on average.
- Errors: none (0 server errors, 0 failed requests).

| Endpoint | Typical (median) | p90 | Slow (p95) | Slowest 1% (p99) | Worst |
|---|---|---|---|---|---|
| All requests | 101ms | 659ms | 1.03s | 1.57s | 9.78s |
| Profile (`auth/user`) | 90ms | 631ms | 1.01s | 1.54s | 9.51s |
| Settings | 90ms | 628ms | 1.02s | 1.55s | 8.21s |
| Notifications | 90ms | 610ms | 991ms | 1.51s | 7.99s |
| Projects | 341ms | 770ms | 1.13s | 1.68s | 9.78s |
| Team (creator) | 89ms | 626ms | 1.00s | 1.51s | 8.17s |
| My tasks (talent) | 88ms | 599ms | 980ms | 1.53s | 8.64s |

What it shows:

- Nothing broke. 500 simultaneous users, no errors, and the Neon free database did not run out of
  connections.
- Half of all requests still came back in about 100ms, but the slow end stretched a lot: one request
  in ten took over 650ms and one in twenty over a second. With 2 users the slow end was about 400ms.
  So the backend stays up under this load but gets uneven.
- These figures cover the whole 15 minutes (the 50, 200 and 500 levels together). The summary does
  not say at which level the slow responses happened; most likely the 500 level, but that is not
  measured.
- A few requests took 8 to 10 seconds. The likely cause is new server instances starting up as
  traffic grew (each new one has to boot before it can answer). Not confirmed.
- Projects is again the slowest endpoint: 341ms typical against about 90ms for the others, nearly
  four times as long. It is the clearest thing to fix in the code.
- Compared with Run 3 (100 users, same sender): the typical response barely moved (83ms → 101ms),
  but the slow end roughly tripled (p95 377ms → 1.03s, p99 471ms → 1.57s).
- Not measured: what the database was doing. Neon's own dashboard for this window (connections,
  compute) is the place to see whether it was near a limit.


## Run 3 (test 10): peak 100 users (10 → 40 → 100), 15 minutes, sent from the VM

Same settings as Runs 1 and 2. 27,462 requests, about 30 per second, no errors.

| Endpoint | Typical (median) | p90 | Slow (p95) | Slowest 1% (p99) | Worst |
|---|---|---|---|---|---|
| All requests | 83ms | 349ms | 377ms | 471ms | 1.77s |
| Profile (`auth/user`) | 82ms | 158ms | 213ms | 369ms | 930ms |
| Settings | 81ms | 165ms | 224ms | 378ms | 573ms |
| Notifications | 82ms | 157ms | 207ms | 380ms | 708ms |
| Projects | 318ms | 402ms | 449ms | 614ms | 1.08s |
| Team (creator) | 81ms | 162ms | 220ms | 366ms | 576ms |
| My tasks (talent) | 81ms | 155ms | 209ms | 360ms | 576ms |

What it shows:

- At 100 users the backend is fast and steady: about 80ms typical, and even the slowest 1% of
  requests under half a second (projects aside).
- Projects takes about 320ms typical against 80ms for everything else, four times as long. In the
  2-user smoke test it was 215ms, so it is slow even with no load: this is the query itself, not
  crowding.

## Cold start: the first request after the backend has been idle

Timed from the VM with single requests. One measurement of each, so treat exact figures loosely.

### Test 9: before any change (no minimum instances), after 51 minutes idle

| Request | First after idle | Straight afterwards (warm) |
|---|---|---|
| One that does not touch the database (`auth/user`, no token) | 3.6s | 0.07s |
| Sign-in (touches the database) | 2.1s | 0.96s |

- The server starting up costs about 3.5 seconds on the first request.
- The first sign-in was about 1.2 seconds slower than a warm one. The likely cause is the Neon free
  database waking from sleep (it suspends when idle); not confirmed.
- A warm sign-in still takes about a second. That is mostly the deliberate cost of checking a
  password securely on a 1-CPU instance.

### Test 11: with one always-warm instance (`min-instances=1`), after about 20 minutes idle

| Request | First after idle | Straight afterwards (warm) |
|---|---|---|
| One that does not touch the database | 0.10s | 0.07s |
| Sign-in (touches the database) | 1.9s | 0.35s |

Side by side, first request after idle:

| Request | No warm instance | One warm instance |
|---|---|---|
| No database | 3.6s | 0.10s |
| Sign-in | 2.1s | 1.9s |

- The warm instance removes the server start-up delay almost entirely (3.6s → 0.1s).
- It does nothing for the first sign-in, which stayed at about 2 seconds. That delay is on the
  database side: the Neon free plan suspends the database when idle, and Cloud Run settings cannot
  keep it awake. Still the likely cause, not confirmed from Neon's side.
- So a warm instance by itself makes the first page shell appear fast but leaves the first
  data-backed action slow. Both halves need addressing for a cold visit to feel quick.
- The warm sign-in differed between the two measurements (0.96s and 0.35s). One sample each, so
  that difference is noise until measured more.

## After the tests

12 Nov 2026: `min-instances` set back to 0 (revision `onswift-backend-00021-qv8`, same code and
settings as before the tests), the VM deleted, no disks or static IPs left. The backend answered
normally afterwards.

## What to do with this

1. **Fix the projects list query** (`GET /api/v2/projects/`). Slowest endpoint in every run, about
   four times the others, and slow even with two users. A code change; costs nothing to run.
2. **Decide on a warm instance.** It removes about 3.5 seconds from the first request after idle,
   at the cost of one instance running all month.
3. **Decide on the database sleeping.** The remaining 2-second first sign-in needs the database kept
   awake (a paid Neon plan, or a database that does not suspend).
4. **Not urgent: capacity.** The backend took 500 simultaneous users with no errors. Only the slow
   end degraded (one request in twenty over a second).
