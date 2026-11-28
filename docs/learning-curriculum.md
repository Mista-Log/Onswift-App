# OnSwift Learning Curriculum

A 12-week plan to deepen your backend, database, cloud, terminal and mobile skills, built around **the code you already own**. Every module points at real OnSwift files, so you learn the idea and then see it working in your own system.

Each module has the same shape:

- **Why it matters for OnSwift**: the real problem this solves in your app.
- **Concepts**: what to understand, in order.
- **Read in the codebase**: where the idea already lives.
- **Do**: hands-on exercises (on a practice branch, never on `mvp-v.3.0` directly).
- **Resources**: free and reliable sources, mostly official docs.
- **You've got it when…**: a self-check.

---

## How to use this

- **Pace:** about 5–7 hours a week. One module a week, two weeks for the big ones. Module 1 first; skip around after that.
- **Rhythm per session:**
  1. Read (30 min).
  2. Find it in the codebase (30 min).
  3. Do the exercise (30–60 min).
  4. Write 3–5 lines in a `learning-log.md`: what you learned, what confused you, one question.
- **Rule of thumb:** explain each concept out loud in two sentences *without* jargon. If you can't, that's your next thing to read.
- **Use AI well:** after an explanation, ask it to *quiz you*, and ask "what would break if we did it the other way?" That second question is where understanding lives.
- **Safety:** practise on a branch (`git switch -c learn/module-3`) and on SQLite locally (`USE_SQLITE=true` in `.env.local`). Never practise against Neon or Cloud Run production.

---

## The 12-week map

| Week | Module | Theme |
|---|---|---|
| 1 | 1 | Terminal fluency: Bash + PowerShell |
| 2 | 2 | Git like a professional |
| 3 | 3 | How the web works: HTTP, REST, APIs |
| 4–5 | 4 | Backend architecture with Django + DRF |
| 6–7 | 5 | Database systems: Postgres, indexes, transactions, migrations |
| 8 | 6 | Resource handling: time, memory, connections, limits |
| 9 | 7 | Cloud compute from the terminal: gcloud, Cloud Run, Scheduler |
| 10 | 8 | Security for builders |
| 11 | 9 | Testing and verification |
| 12 | 10 | Mobile readiness |
| After | 11 | Capstone projects |

---

## Module 1: Terminal fluency (Bash + PowerShell)

**Why it matters for OnSwift:** almost everything we did together (finding code, running tests, building, deploying, reading logs) happened in a terminal. Fluency lets you check things yourself instead of guessing.

### Concepts
1. The shell is a program that runs other programs. The working directory, absolute vs relative paths, `~`.
2. stdin / stdout / stderr, **pipes** (`|`), **redirection** (`>`, `>>`, `2>&1`).
3. Exit codes: `0` means success. `&&` (run if the last one succeeded), `||` (run if it failed), `;` (always).
4. Environment variables, and why secrets live there instead of in code.
5. Quoting: `'single'` is literal; `"double"` expands `$VARS`. This is exactly why one of my edit scripts broke on apostrophes.
6. Heredocs: feeding a multi-line block into a command (`python - <<'EOF' ... EOF`).

### Commands I used constantly in this codebase (Git Bash)

| Command | What it does | Example from our work |
|---|---|---|
| `cd`, `ls`, `pwd` | Move, list, where am I | `cd /c/Users/User/Onswift-App` |
| `cat file` | Print a whole file | reading `models.py` |
| `sed -n '40,54p' file` | Print only lines 40–54 | peeking into `TaskDetailModal.tsx` |
| `head -20` / `tail -5` | First / last lines | `npm run build \| tail -5` |
| `grep -n "pattern" file` | Find lines, with numbers | `grep -n "has_clients" src/contexts/ProjectContext.tsx` |
| `grep -rn "x" src --include=*.tsx` | Search a folder by file type | finding every settings call |
| `grep -c` / `wc -l` | Count matches / lines | counting tests |
| `grep -v` | Lines that *don't* match | filtering noise |
| `python - <<'EOF' ... EOF` | Inline Python script | safe find-and-replace edits |
| `npx tsc --noEmit -p tsconfig.app.json` | Type-check without building | after every frontend change |
| `npx eslint <files>` | Lint | telling new errors from old ones |
| `npx vitest run <path>` | Frontend tests | 559 passing |
| `npm run build` | Production build | the final check |
| `npm install pkg@1.3.1 --save-exact` | Install a pinned version | `driver.js` |
| `python manage.py test project portal` | Django tests for some apps | 691 passing |
| `python manage.py makemigrations` / `migrate` | Create / apply schema changes | client-visibility fields |
| `curl -X POST -H "Header: v" URL` | Hand-made HTTP request | testing `send-due` |
| `git show HEAD:path \| grep ...` | Look at a file as it was at the last commit | proving a lint error was already there |

### PowerShell equivalents (Windows-native)

| Bash | PowerShell |
|---|---|
| `cat file` | `Get-Content file` |
| `head -20` / `tail -5` | `Get-Content f -TotalCount 20` / `Get-Content f -Tail 5` |
| `grep -n "x" file` | `Select-String -Pattern "x" -Path file` |
| `grep -rn "x" src` | `Get-ChildItem src -Recurse \| Select-String "x"` |
| `wc -l file` | `(Get-Content file \| Measure-Object -Line).Lines` |
| `export X=1` / `echo $X` | `$env:X = "1"` / `$env:X` |
| `a && b` | `a; if ($?) { b }` (Windows PowerShell 5.1 has no `&&`) |
| `rm -rf dir` | `Remove-Item -Recurse -Force dir` |
| `which node` | `(Get-Command node).Source` |
| free a port | `Get-NetTCPConnection -LocalPort 5179 \| Select OwningProcess`, then `Stop-Process -Id <pid>` |

**Key idea:** Bash pipes *text*; PowerShell pipes *objects*. That's why `Get-Process | Where-Object CPU -gt 100 | Sort-Object CPU` works without parsing text.

### Do
1. Without an editor, find every file that calls `/api/v1/settings/`. Do it in Bash, then in PowerShell.
2. Print lines 300–370 of `backend/core/project/views.py` and find `check_permissions`, the guard that stops clients from editing tasks.
3. Count the tests in `backend/core/campaigns/tests.py` (`grep -c "def test"`). You should get 25.
4. Write `checks.sh` to run tsc, eslint and vitest, stopping at the first failure (`set -e`).
5. Find what's listening on port 8080 and stop it, in PowerShell.

### Resources
- **MIT "The Missing Semester of Your CS Education"** (missing.csail.mit.edu): lectures 1–4.
- **linuxcommand.org**: "Learning the Shell".
- **Microsoft Learn**: "Introduction to PowerShell".
- Built-in help: `grep --help`, `Get-Help Select-String -Examples`.

**You've got it when…** you can find any function in the codebase in under a minute.

---

## Module 2: Git like a professional

**Why it matters for OnSwift:** three people commit actively. "Keep edits minimal, don't touch unrelated lines" is a Git discipline: it's what makes changes reviewable.

### Concepts
1. Working tree → staging → commits. `git status` shows which area each change is in.
2. Branches are pointers (`mvp-v.3.0`, `feature-branch`).
3. `git diff`, `git diff --staged`, `git diff HEAD -- file`.
4. `git log --oneline --graph`, and `git show <commit>:path` to see a file as it was.
5. Merge vs rebase; resolving conflicts calmly.
6. Small commits whose messages explain *why*.

### Do
1. Run `git log --oneline -15`, then `git show 70d9681 --stat` (the campaigns commit).
2. On a practice branch, create a conflict on purpose and resolve it by hand.
3. Practise `git add -p`, which stages part of a file. It's the habit behind surgical changes.

### Resources
- **Pro Git** (git-scm.com/book): chapters 2, 3 and 7.
- **learngitbranching.js.org**: an interactive, visual game.
- **ohshitgit.com**: recovering from mistakes.

**You've got it when…** `git status` tells you exactly what your next commit will contain, and `.env` files never get in.

---

## Module 3: How the web works (HTTP, REST, APIs)

**Why it matters for OnSwift:** the web app, the admin panel, Cloud Scheduler and the coming mobile app all talk to Django over HTTP.

### Concepts
1. **Request:** method, URL, headers, body. **Response:** status, headers, body.
2. **Methods:** GET, POST, PATCH, PUT, DELETE. *Idempotency* is why repeating a GET is safe and repeating a POST may not be.
3. **Status codes in OnSwift:**
   - **200 / 201 / 204:** success.
   - **400:** bad input.
   - **401:** who are you?
   - **403:** I know who you are, and no.
   - **404:** not found, *or deliberately hidden*. Clients get 404 for unshared tasks so they can't even learn the task exists.
   - **409:** conflict ("pause before editing").
   - **411:** length required (the scheduler `curl` hit this).
   - **503:** not configured.
4. **Headers in our system:** `Authorization: Bearer …`, `Content-Type`, `X-Cron-Token`.
5. **Error shape:** JSON errors like `{"error": "..."}`, which the UI can show directly.
6. **API versioning:** OnSwift runs `/api/v1` through `/api/v10`. Versions let old clients keep working while new ones change, which is crucial for mobile (Module 10).
7. **CORS:** why a browser blocks some requests that `curl` allows.

### Read in the codebase
- `backend/core/core/urls.py`: every API version mounted in one place.
- `src/api/apiClient.ts` (`secureFetch`): how tokens are attached.
- `backend/core/campaigns/views.py`: small endpoints with clear status codes.

### Do
1. DevTools → Network on localhost:8080: open a project and inspect `GET /api/v2/projects/<id>/`.
2. Repeat the same request with `curl` (local token only).
3. Draw the full journey of "client posts feedback": browser → `secureFetch` → URL → view → serializer → database → notification → response.

### Resources
- **MDN Web Docs → HTTP**.
- **httpbin.org**, for safe `curl` practice.

**You've got it when…** you can look at any failed request and say whether it's an auth, a permission, a validation or a server problem.

---

## Module 4: Backend architecture with Django + DRF (2 weeks)

**Why it matters for OnSwift:** knowing *where* logic belongs (model, serializer, view, permission, service) is the difference between "it works" and "it's maintainable".

### Concepts
1. **Apps as boundaries:** `account`, `project`, `portal`, `notification`, `agent`, `campaigns`.
2. **Request flow:**
   - URL → view
   - authentication (who) → permissions (allowed?)
   - queryset (which rows) → serializer (shape and validation)
   - response
3. **Models:** `ForeignKey` / `on_delete`, `related_name`, `Meta.constraints` and `indexes`.
4. **Serializers:** `validate_<field>`, `SerializerMethodField`, overriding `update()` for side effects (notifying clients when a task is newly shared).
5. **Views:** `APIView` vs generic views, `get_queryset`, `perform_create`, `get_object`.
6. **Authorization:**
   - Role-based (creator, talent, client) plus object-level (is *this* user on *this* project?).
   - **One rule, one helper.** `client_visible_tasks()` and `get_client_project_ids()` are used everywhere, so the rule can't drift between endpoints.
7. **Thin views, services for logic:** `send_tick()` lives in `sender.py`, so it's testable and reusable.
8. **Side effects only on change:** notify when something *newly* becomes shared, not on every save.
9. **Vocabulary:** modular monolith (OnSwift, and right for your size) vs microservices; coupling and cohesion; the Twelve-Factor App.

### Read in the codebase
- `backend/core/campaigns/`: a complete small app. Study it first.
- `backend/core/project/models.py`: `Task`, `TaskComment.audience`, `client_visible_tasks`.
- `backend/core/project/views.py`: `TaskDetailView`, `_deny_client`, `TaskClientCommentListCreateView`, which reuses a view through inheritance.
- `backend/core/project/serializers.py`: `TaskSerializer.update()`.
- `backend/core/portal/permissions.py`: `get_client_project_ids`.

### Do
1. Trace `PATCH /api/v2/tasks/<id>/ {"shared_with_client": true}` from URL to database, naming every function it passes through.
2. Build a throwaway app `learning`: a `Note` model, a serializer, list/create views, URLs and one test. Then delete it.
3. Explain in writing why a talent gets **404**, not 403, on `client-comments/`.
4. Note one place where view logic could move into a helper. Write it down; don't change it.

### Resources
- **Django tutorial** (docs.djangoproject.com, parts 1–7).
- **DRF tutorial** (django-rest-framework.org, parts 1–6).
- **12factor.net**.
- *Two Scoops of Django* (book).
- *Designing Data-Intensive Applications*, Kleppmann: chapters 1–3 now.

**You've got it when…** for a new feature you can list its model, serializer, view, permission and test *before* writing code.

---

## Module 5: Database systems (2 weeks)

**Why it matters for OnSwift:** Neon Postgres is your source of truth. Slow queries, missing constraints and risky migrations are the hardest bugs to undo.

### Concepts
1. **Tables and keys:** primary keys (OnSwift uses UUIDs), foreign keys, joins.
2. **SQL to read fluently:** `SELECT … WHERE … ORDER BY … LIMIT`, `JOIN`, `GROUP BY` + `COUNT`, `UPDATE … WHERE`.
3. **ORM ↔ SQL:** `filter`, `exclude`, `annotate(Count(...))`, `select_related` (a JOIN) vs `prefetch_related` (a second query). Print `queryset.query` to see the SQL.
4. **N+1 queries:** touching `task.project.name` in a loop fires one query per task. "Speed up project list" was this class of fix.
5. **Indexes:** `Index(fields=["campaign","status"])` makes "pending recipients of this campaign" fast. Too many indexes slow down writes.
6. **Constraints are guarantees:** `UniqueConstraint(campaign, email)` makes a double-add *impossible*, not just unlikely.
7. **Transactions and races:** the scheduler's atomic conditional `update()` returns 0 for whoever loses a race, so two ticks can never double-send. Also learn `transaction.atomic` and `select_for_update`.
8. **Migrations:**
   - Adding a column with a default is safe.
   - Renaming or dropping is risky.
   - Migrate before deploying code that needs the column.
   - Never edit an applied migration.
9. **Soft deletes:** every read must filter out deleted rows (your open "Agent shows deleted deliverables" note).
10. **Pagination:** `LIMIT/OFFSET` vs keyset (parked until you have hundreds of projects per account).

### Read in the codebase
- `backend/core/campaigns/models.py`: constraints and indexes.
- `backend/core/campaigns/sender.py` → `_process_campaign`: the atomic slot claim.
- `backend/core/campaigns/views.py` → `COUNT_ANNOTATIONS`: several counts in one query.
- `backend/core/project/migrations/0018_*`: a migration generated for you.

### Do
1. In `python manage.py shell` (SQLite), run `print(Task.objects.filter(status="completed").query)`.
2. Count the queries on the projects page (django-debug-toolbar or query logging), and find an N+1.
3. Write "sent recipients per campaign" as raw SQL, then in the ORM.
4. Reason through two racing scheduler ticks. Why does the loser's `update()` return 0?
5. Try adding a non-nullable column with no default to a table with rows. Read what `makemigrations` asks, and work out why.
6. In the Neon console, learn **branching**, so you can test risky migrations on a copy of production.

### Resources
- **PostgreSQL tutorial** (postgresql.org/docs).
- **SQLBolt** (sqlbolt.com).
- **Use The Index, Luke** (use-the-index-luke.com).
- **Django docs:** "Making queries", "Aggregation", "Database transactions", "Migrations".
- **Neon docs:** branching.

**You've got it when…** you can predict roughly the SQL, and the number of queries, from an ORM expression.

---

## Module 6: Resource handling

**Why it matters for OnSwift:** servers have limits on time, CPU, memory, connections and other services' quotas. The campaign scheduler design is a direct answer to these limits.

### Concepts
1. **Time budgets:** gunicorn's 60s timeout is why `send_tick` works for 45 seconds at most. Always ask "how long can this run?"
2. **Background work:** keep long jobs out of user requests. The options:
   - A scheduler plus a database queue (what campaigns use).
   - A task queue: Celery, RQ or Cloud Tasks.
   - Threads, which are fragile on Cloud Run.
3. **Serverless behaviour:**
   - Scale to zero and cold starts.
   - CPU throttled outside requests.
   - Instances are disposable, so state must live in the database.
4. **Connections are resources:**
   - SMTP: `with server:` closes the connection.
   - Database: Neon has connection limits; poolers exist for this.
   - HTTP: **every network call needs a timeout.**
5. **Rate limits and quotas:** the per-mailbox `daily_cap`, provider limits. Back off rather than hammer.
6. **Retries:**
   - Transient errors (retry) vs permanent ones (mark failed).
   - Idempotency, so a retry is safe.
   - Exponential backoff with jitter.
7. **Caching:** the 60-second auth cache, the frontend `readCache`. Always ask how stale is acceptable.
8. **Memory:** batching, `.iterator()`, `bulk_create`, size caps (the 2 MB CSV limit).
9. **Cost:** Cloud Run CPU-seconds, Neon compute, scheduler jobs, AI tokens.

### Read in the codebase
- `backend/core/campaigns/sender.py`: the docstring plus `send_tick`. Read every line.
- `backend/core/campaigns/auth.py`: timeout plus cache.
- `backend/core/campaigns/recipients.py`: `MAX_ROWS`, `bulk_create(ignore_conflicts=True)`.
- `src/lib/syncQueue.ts`: the frontend's queue for status changes.

### Do
1. For each external call in `sender.py` and `auth.py`, write down its timeout, what happens on failure, and whether it's retried.
2. Grep for `requests.get(` / `requests.post(` in the backend and list any call without `timeout=`.
3. On paper: how would you send a weekly digest to 10,000 users within the timeout and the provider's limits?

### Resources
- *Designing Data-Intensive Applications*, chapter 1.
- **Cloud Run docs:** "Container runtime contract", "CPU allocation", "Request timeout".
- **AWS Builders' Library:** "Timeouts, retries, and backoff with jitter".
- *Release It!*, Michael Nygard.

**You've got it when…** your first questions about any feature are how long it can take, what it can exhaust, and what happens if it fails halfway.

---

## Module 7: Cloud compute from the terminal (gcloud)

**Why it matters for OnSwift:** the backend runs on Cloud Run (`onswift-backend`, us-central1), and Cloud Scheduler calls it every minute. Operating it from the terminal means you can diagnose problems on your own.

### Concepts
1. **Projects, regions, services, revisions:** every deploy or env-var change creates a **revision**. Rolling back means pointing traffic at an older one.
2. **Config and secrets:** config lives in env vars; secrets ideally live in **Secret Manager**.
3. **IAM:** least privilege for people and service accounts.
4. **Cloud Logging:** filtering by service, severity and text.
5. **Scheduler:** cron syntax (`* * * * *`), HTTP targets, headers, deadlines, retries.
6. **Allowed hosts:** why only the `…846361006238.us-central1.run.app` URL passes Django's `ALLOWED_HOSTS`.

### Command cheat sheet (read-only commands are safe to practise any time)

```bash
# Who am I, which project?
gcloud auth list
gcloud config list

# Cloud Run: look
gcloud run services list --region=us-central1
gcloud run services describe onswift-backend --region=us-central1
gcloud run revisions list --service=onswift-backend --region=us-central1
# Env var NAMES only (values may be secrets, never paste them anywhere)
gcloud run services describe onswift-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env[].name)"

# Cloud Run: change (each one creates a new revision)
gcloud run services update onswift-backend --region=us-central1 --update-env-vars KEY=value
gcloud run services update onswift-backend --region=us-central1 --remove-env-vars KEY
# Roll back
gcloud run services update-traffic onswift-backend --region=us-central1 --to-revisions=<REVISION>=100

# Logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="onswift-backend"' --limit=50 --freshness=1h
gcloud logging read 'resource.type="cloud_run_revision" AND httpRequest.requestUrl:"send-due"' --limit=20

# Cloud Scheduler
gcloud scheduler jobs list --location=us-central1
gcloud scheduler jobs describe campaigns-send-due --location=us-central1
gcloud scheduler jobs run campaigns-send-due --location=us-central1      # fire once now
gcloud scheduler jobs pause campaigns-send-due --location=us-central1    # emergency stop
gcloud scheduler jobs resume campaigns-send-due --location=us-central1
```

The same commands work in PowerShell; only quoting and line continuations differ (a backtick instead of `\`).

### Do
1. Run every read-only command and write down what each output means.
2. In `revisions list`, find the revision that added `DIGEST_CRON_TOKEN` (00031 or later) and the current live one.
3. Match the `describe` output of `campaigns-send-due` to the table in `docs/email-campaigns.md` §7.
4. Confirm the last hour of `send-due` calls returned 200.
5. Rehearse a rollback in your head: which command, which revision, and how you'd confirm it worked.
6. Stretch: plan moving `CAMPAIGN_CREDS_KEY` into Secret Manager.

### Resources
- **Cloud Run docs:** quickstart, "Managing revisions", "Environment variables", "Using secrets".
- **Built-in help:** `gcloud run --help`, `gcloud scheduler --help`.
- **Google Cloud Skills Boost:** free Cloud Run labs.

**You've got it when…** you can say in five minutes, from the terminal, whether the backend is healthy, which revision is live, and what it logged in the last hour.

---

## Module 8: Security for builders

**Why it matters for OnSwift:** you hold clients' work, people's emails and mailbox passwords. During the client-portal work we found clients could upload attachments and tick checklists. Good security comes from asking the right questions every time.

### Concepts
1. **Authentication vs authorization.** OnSwift has two systems: Django JWT for the app, and Supabase plus an allowlist for `/admin`.
2. **Never trust the client.** Hiding a button is UX; the server must enforce every rule (`check_permissions`, `_deny_client`).
3. **Deny by default:** `shared_with_client=False`, `show_profile_to_clients=False`.
4. **Secrets:** env vars only, never in git or chat. Know each secret's blast radius (rotating `CAMPAIGN_CREDS_KEY` locks out every saved password).
5. **Hashing vs encryption vs signing:**
   - **Hashing** is one-way: OTPs are stored as HMACs.
   - **Encryption** is reversible with a key: SMTP passwords, using Fernet.
   - **Signing** proves nothing was tampered with: unsubscribe tokens.
6. **Timing-safe comparison:** `hmac.compare_digest`.
7. **OWASP Top 10:** broken access control is #1, which is exactly the client-visibility work.
8. **Don't leak:** return 404 rather than 403 when existence itself is private; leave out fields the viewer shouldn't see.

### Do
1. For one endpoint per app, write down who can call it, what stops everyone else, and where that check lives.
2. List the gaps in `test_client_visibility.py`, for example a client of a *different* project.
3. Run `git log -p -S "SECRET" -- .` to check nothing secret was ever committed.

### Resources
- **OWASP Top 10** and the **OWASP Cheat Sheet Series**.
- **Django docs:** "Security in Django".
- **PortSwigger Web Security Academy**: start with "Access control".

**You've got it when…** your reflex on every endpoint is "who must *not* be able to do this, and which test proves it?"

---

## Module 9: Testing and verification

**Why it matters for OnSwift:** 691 backend and 559 frontend tests are why we could rework who sees what with confidence. Tests are how three contributors avoid breaking each other's work.

### Concepts
1. **The test pyramid:** many unit tests, some integration tests, few end-to-end tests.
2. **Django `TestCase`:** each test is rolled back. Use `APIClient.force_authenticate`, and assert on the status *and* the database state.
3. **Test behaviour, not implementation:** "a client can't see unshared work".
4. **Setup can mislead:** the new tests first failed because completing the only open task auto-completed the project. The test was right; the setup was naive.
5. **Frontend:** Vitest and Testing Library. Assert on what the user sees.
6. **The verification loop:** typecheck → lint → tests → build → manual check.

### Do
1. Run `python manage.py test project.test_client_visibility -v 2` and read each test name as a sentence.
2. Add a test: a client of project A can't see a shared task in project B.
3. Add a Vitest test: clicking "Complete only" in `ShareWithClientDialog` calls `onCompleteOnly`.
4. Remove `_deny_client` from one view, watch which test fails, then restore it.

### Resources
- **Django docs:** "Testing tools".
- **DRF docs:** "Testing".
- **Testing Library:** "Guiding principles".
- *Test-Driven Development with Python* (obeythetestinggoat.com, free).

**You've got it when…** a red test feels like information, not failure.

---

## Module 10: Mobile readiness

**Why it matters for OnSwift:** the mobile app will reuse your backend, but you **can't force users to update**, networks are flaky, and app stores have rules. Preparing now prevents painful redesigns.

### Concepts
1. **Stack:** you know React and TypeScript, so **React Native with Expo** is the natural fit. Know Flutter and native well enough to defend the choice.
2. **RN vs web:** `<View>` / `<Text>` instead of `<div>`; StyleSheet, or NativeWind for Tailwind; Expo Router for navigation.
3. **API compatibility forever:** old versions stay installed for months.
   - Only *add* fields.
   - Never rename or remove fields an app reads.
   - Version breaking changes (`/api/vN` already does this).
   - Add a "minimum supported version" check.
4. **Auth:**
   - Tokens in **SecureStore** (Keychain / Keystore), never plain storage.
   - A refresh flow.
   - **Apple requires Sign in with Apple if you offer other social logins.**
5. **Offline:** optimistic updates and a sync queue, the same idea as `syncQueue.ts`.
6. **Push:** APNs and FCM, or Expo Notifications. The backend stores device tokens and sends on events you already create ("New completed work", "New client feedback").
7. **Deep links:** `onswift://projects/<id>?task=<id>` and universal links. The `?task=` links we built map straight across.
8. **Performance:** `FlatList` virtualization, image sizes, battery, app lifecycle.
9. **Shipping:**
   - App Store Connect and Google Play Console.
   - TestFlight.
   - Review guidelines and privacy labels.
   - EAS Build / Submit, and EAS Update for JS-only fixes.
10. **First screens:** probably the client portal and task updates (high value, mostly reading).

### Read in the codebase
- `src/api/apiClient.ts`: what a mobile client must replicate.
- `src/lib/syncQueue.ts`: the offline pattern.
- `backend/core/notification/`: where push would plug in.
- `src/pages/client/ClientProjectDetail.tsx`: a good first screen to port.

### Do
1. `npx create-expo-app@latest learn-mobile`, then run it on your phone with Expo Go.
2. Build one screen that logs in to your **local** backend and lists projects.
3. Keep the token in `expo-secure-store` and stay logged in after restarting the app.
4. Send yourself a push notification with Expo's push tool.
5. Write a one-page "API contract rules for mobile" for the team.

### Resources
- **Expo docs** (docs.expo.dev): Get started, Router, SecureStore, Notifications, EAS.
- **React Native docs** (reactnative.dev): Core Components, Networking, Performance.
- **Apple App Store Review Guidelines** (skim *before* building) and the **Human Interface Guidelines**.
- **Google Play Console help**: preparing for review.

**You've got it when…** you can explain why mobile makes backend changes riskier, and a login + list screen runs on your own phone.

---

## Module 11: Capstone projects (pick 1–2)

Real OnSwift improvements that tie modules together. Build them on a branch, then bring them back next time for review.

1. **Schedule the email digest** (README §20, issue 4):
   - A second Cloud Scheduler job, modelled on `campaigns-send-due`.
   - Uses: Modules 1, 6, 7.
2. **Audit deleted-row filters in the Agent's read tools:**
   - Your open note.
   - List every queryset the Agent reads from, mark which ones filter deleted rows, and add tests for the gaps.
   - Uses: Modules 4, 5, 8, 9.
3. **Add missing timeouts:**
   - Every outbound HTTP call gets `timeout=`.
   - Uses: Modules 1, 6.
4. **Query budget for the projects page:**
   - Measure the queries, fix any N+1, and lock it in with `assertNumQueries`.
   - Uses: Modules 5, 9.
5. **Mobile spike:**
   - Expo app with login, the client project list, and task detail with feedback.
   - Uses: Modules 3, 10.
6. **Secrets to Secret Manager:**
   - `CAMPAIGN_CREDS_KEY` and `DIGEST_CRON_TOKEN`, with a documented rollback.
   - Uses: Modules 7, 8.

Still parked from before: stress-test the Agent hard, and work through README §20 known issues together.

---

## Concept checklist

Tick each one off when you can explain it in two sentences without notes.

- **Terminal:** pipes · redirection · exit codes · env vars · quoting · heredocs · text vs object pipelines
- **Git:** staging · branches · diff vs show · merge vs rebase · `add -p`
- **HTTP:** methods · idempotency · 401 vs 403 vs 404 · headers · CORS · versioning
- **Backend:** request flow · model/serializer/view/permission roles · one rule, one helper · services · side effects on change · modular monolith · Twelve-Factor
- **Databases:** joins · N+1 · `select_related` vs `prefetch_related` · indexes and their cost · constraints · transactions · atomic conditional update · safe migrations · soft deletes · pagination
- **Resources:** time budgets · serverless background work · connection lifecycle · timeouts · retries/backoff/idempotency · cache staleness · batching · cost
- **Cloud:** revisions · rollback · env vars vs secrets · IAM · logs · scheduler
- **Security:** authn vs authz · server-side enforcement · deny by default · hash vs encrypt vs sign · timing-safe compare · broken access control
- **Testing:** pyramid · behaviour over implementation · setup pitfalls · verification loop
- **Mobile:** RN vs web · backward-compatible APIs · secure storage · offline queue · push · deep links · store review · OTA updates

---

## Reading order

1. MIT Missing Semester, lectures 1–4
2. Django tutorial → DRF tutorial
3. SQLBolt → Use The Index, Luke
4. The Twelve-Factor App
5. *Designing Data-Intensive Applications*, Kleppmann (slowly; it will reshape how you think about systems)
6. OWASP Top 10 + PortSwigger access-control labs
7. Expo "Get started"
8. *Release It!*, Nygard (once real traffic arrives)

---

*Built from the OnSwift codebase in November 2026. Companion docs in this repo: `docs/email-campaigns.md` and `docs/agent-build-log.md`.*
