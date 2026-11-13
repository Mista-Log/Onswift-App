# Load test: how to run it, and what to delete afterwards

Project: `project-27afaff0-4480-42f7-9b4` · Region: `us-central1` · Service: `onswift-backend`

The GCP credits end soon. Anything left running after that bills the card on the account, so every
resource created for this exercise goes in the table below when it is created, and comes out when it is
deleted. Neon is billed separately and is **not** covered by GCP credits.

## Before starting

- [ ] Set a budget alert on the billing account (Billing → Budgets & alerts), a small amount such as $10,
      with email alerts at 50% and 100%. This is the safety net if something below is forgotten.
- [ ] Note the service's current settings, so Step 2 can be undone exactly:
      ```
      gcloud run services describe onswift-backend --region=us-central1 \
        --format="value(spec.template.metadata.annotations)"
      ```
      Write down the value of `autoscaling.knative.dev/minScale` (absent means 0).
- [ ] Open the Neon dashboard on a second screen: watch active connections and compute while the test runs.
- [ ] Tell the other two contributors when the test will run. The live app will be slower for those 15 minutes.

## Running the test

Install k6 on the machine that sends the traffic (the test VM, or your own machine for the smoke run),
then from the repo root. Passwords go in as variables so they never land in a file:

```
# 1. Smoke run first: 2 users for 30 seconds. Proves the address and both accounts work.
k6 run -e SMOKE=1 \
  -e BASE_URL=https://onswift-backend-846361006238.us-central1.run.app \
  -e CREATOR_EMAIL=... -e CREATOR_PASSWORD=... \
  -e TALENT_EMAIL=...  -e TALENT_PASSWORD=... \
  loadtest/k6-baseline.js

# 2. A gentle real run: peaks at 100 users instead of 500.
k6 run -e MAX_VUS=100 -e BASE_URL=... (same variables) loadtest/k6-baseline.js

# 3. The full run (50 → 200 → 500 users, 15 minutes). Save the result.
k6 run -e BASE_URL=... (same variables) loadtest/k6-baseline.js | tee baseline-$(date +%H%M).txt
```

The script only reads (GET requests) after signing in once per account, so it creates no data and sends
no email. It stops itself if a quarter of requests are failing on the server.

What to record from each run: `http_req_duration` med / p(95) / p(99) overall and per endpoint,
`http_reqs` per second, `http_req_failed`, `server_errors`, and Neon's peak connection count.

Run order for a fair comparison: baseline → change one thing → identical run → compare.

## Resources created (fill in as you go)

| Created | What | Name | Deleted? |
|---|---|---|---|
| 12 Nov | Compute Engine VM (load generator), e2-standard-2 | `k6-loadgen`, zone `us-central1-a` | [x] deleted 12 Nov; no disks or static IPs left |
| 12 Nov | Compute Engine API switched on (was off; free, no need to undo) | `compute.googleapis.com` | n/a |
| 12 Nov | Cloud Run setting: min-instances set to 1 for the idle test | onswift-backend | [x] back to 0 on 12 Nov (revision `onswift-backend-00021-qv8`) |
| | Cloud Run test revision / tag (if Step 3) | | [ ] |
| | Cloud SQL instance (if Step 3) | | [ ] |
| | Memorystore Redis (if Step 4) | | [ ] |
| | Secrets / service accounts made for the above | | [ ] |

## Teardown, in this order

1. **Cloud Run back to how it was.** Use the value noted under "Before starting" (0 if it was absent):
   ```
   gcloud run services update onswift-backend --region=us-central1 --min-instances=0
   ```
   If a test revision was deployed for Step 3, send all traffic back to the normal one **before**
   deleting the database it points at, then remove the test revision:
   ```
   gcloud run services update-traffic onswift-backend --region=us-central1 --to-latest
   gcloud run revisions list --service=onswift-backend --region=us-central1
   ```
   - [ ] Confirm the live app still loads and signs in after this.

2. **Cloud SQL** (the most expensive thing to forget). It holds a copy of real user data, so make sure
   its backups go with it:
   ```
   gcloud sql instances list
   gcloud sql instances delete INSTANCE_NAME
   gcloud sql instances list            # the instance is gone
   ```
   - [ ] Also delete any database dump file made for the import (local disk, the VM, or a storage bucket).

3. **Memorystore Redis**, if created:
   ```
   gcloud redis instances list --region=us-central1
   gcloud redis instances delete INSTANCE_NAME --region=us-central1
   ```

4. **Load generator VM(s)** and their disks:
   ```
   gcloud compute instances list
   gcloud compute instances delete VM_NAME --zone=ZONE
   gcloud compute disks list            # nothing left over from the VM
   gcloud compute addresses list        # no reserved static IPs (these bill while unused)
   ```

5. **Leftovers that bill quietly:**
   ```
   gcloud compute networks vpc-access connectors list --region=us-central1   # if one was made for Redis/SQL
   gcloud storage buckets list                                               # any bucket used for a dump
   gcloud secrets list                                                       # secrets added for the test
   gcloud services api-keys list                                             # keys created today
   ```

6. **Final check, the next day:** Billing → Reports, grouped by service, filtered to today. Compute
   Engine, Cloud SQL and Memorystore should all read zero. Cloud Run should be back to its usual level.

## Do not delete

- The `onswift-backend` Cloud Run service itself, or its normal revision.
- The Neon database. Nothing in this checklist touches it.
- Secrets and service accounts that existed before today.
