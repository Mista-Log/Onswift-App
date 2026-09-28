# OnSwift

OnSwift is an agency-operations platform. One workspace where a creative agency runs its **projects, tasks, deliverables, client onboarding, files, chat, docs and a lightweight CRM**, instead of stitching together several separate tools.

This README documents the whole application as it exists in the code today: what every feature does, who can use it, how it works underneath, and which API endpoints it uses. Everything here was checked against the source; where something is unfinished, unused, or inconsistent, it says so (see [Known issues](#20-known-issues-and-limitations)).

> **Where to look:** the frontend lives in `src/`, the backend in `backend/core/`. API routes are mounted in `backend/core/core/urls.py`; the frontend route table is in `src/App.tsx`.

---

## Table of contents

1. [What OnSwift is](#1-what-onswift-is)
2. [Architecture](#2-architecture)
3. [Getting started](#3-getting-started)
4. [Configuration reference](#4-configuration-reference)
5. [Users, roles and access control](#5-users-roles-and-access-control)
6. [Data model](#6-data-model)
7. [Features](#7-features)
   - 7.1 [Accounts, sign-in and profiles](#71-accounts-sign-in-and-profiles)
   - 7.2 [Team building: invites and hire requests](#72-team-building-invites-and-hire-requests)
   - 7.3 [Projects](#73-projects)
   - 7.4 [Tasks and the board](#74-tasks-and-the-board)
   - 7.5 [Talent task rules and the completion gate](#75-talent-task-rules-and-the-completion-gate)
   - 7.6 [Personal tasks](#76-personal-tasks)
   - 7.7 [My Tasks panel, instant saves and offline queue](#77-my-tasks-panel-instant-saves-and-offline-queue)
   - 7.8 [Deliverables ("Attachments")](#78-deliverables-attachments)
   - 7.9 [Deadlines, the calendar and the Next Deadline clock](#79-deadlines-the-calendar-and-the-next-deadline-clock)
   - 7.10 [Reminders and the email digest](#710-reminders-and-the-email-digest)
   - 7.11 [Creator analytics](#711-creator-analytics)
   - 7.12 [Messaging](#712-messaging)
   - 7.13 [Notifications](#713-notifications)
   - 7.14 [The OnSwift assistant](#714-the-onswift-assistant)
   - 7.15 [Client portal](#715-client-portal)
   - 7.16 [Onboarding forms and standalone forms](#716-onboarding-forms-and-standalone-forms)
   - 7.17 [File library](#717-file-library)
   - 7.18 [Docs editor](#718-docs-editor)
   - 7.19 [CRM sheets](#719-crm-sheets)
   - 7.20 [Global search](#720-global-search)
   - 7.21 [Settings](#721-settings)
   - 7.22 [Sound and vibration feedback](#722-sound-and-vibration-feedback)
   - 7.23 [Google Calendar sync](#723-google-calendar-sync)
   - 7.24 [Talent marketplace](#724-talent-marketplace)
   - 7.25 [Dashboards and greeting](#725-dashboards-and-greeting)
   - 7.26 [Quick Start, celebrations and banners](#726-quick-start-celebrations-and-banners)
   - 7.27 [Blog and CMS](#727-blog-and-cms)
   - 7.28 [Marketing site and analytics tooling](#728-marketing-site-and-analytics-tooling)
8. [Frontend architecture](#8-frontend-architecture)
9. [Backend architecture](#9-backend-architecture)
10. [Complete API reference](#10-complete-api-reference)
11. [Cross-cutting flows](#11-cross-cutting-flows)
12. [Storage, email and third-party services](#12-storage-email-and-third-party-services)
13. [Deployment and CI/CD](#13-deployment-and-cicd)
14. [Testing](#14-testing)
15. [Frontend route table](#15-frontend-route-table)
16. [Browser storage keys](#16-browser-storage-keys)
17. [Polling inventory](#17-polling-inventory)
18. [Conventions for contributors](#18-conventions-for-contributors)
19. [Planning documents in this repo](#19-planning-documents-in-this-repo)
20. [Known issues and limitations](#20-known-issues-and-limitations)

---

## 1. What OnSwift is

### The people in the system

| Role | Who they are | What they can do |
|---|---|---|
| **Creator** | The agency owner/operator. The paying customer. | Create projects and tasks, build a team, approve deliverables, onboard clients, use the library, docs, CRM, forms, analytics. |
| **Talent** | A freelancer/team member a creator brings onto their team. | See only assigned work, start and pause their own tasks, submit attachments, request completion, chat, use files/CRM shared with them. |
| **Client** | The agency's customer, usually created through an onboarding form or invite. | See their projects (read-mostly), chat with the creator in a per-project thread, view their submitted forms and their documents. |
| **OnSwift AI** | A scripted assistant account (`role = "assistant"`). **No language model is involved.** | Welcomes people, mirrors important notifications into chat, nudges talents about imminent deadlines and relays their replies. |

A user has **one role, set at sign-up**, and it does not change. The same codebase also serves a public **marketing site** (`/`), a **blog** (`/blog`) and a **blog admin** (`/admin`) that runs on Supabase, completely separate from the main app's authentication.

### Feature overview

Projects and a kanban task board · task detail (comments, checklists, attachments, recurrence, priorities, deadlines) · personal to-dos · deliverable submission and approval · a deadlines page with a live digital countdown clock · daily/weekly/weekend reminders (in-app report + email digest) · creator analytics · direct messages, group chats and a per-project client thread · notifications with email mirroring · a scripted assistant · client portal and invites · form builder (client onboarding + standalone forms) · file library with versioning, sharing and trash · Notion-style docs · spreadsheet-style CRM · global search · instant, offline-tolerant task status changes · sound and vibration feedback.

---

## 2. Architecture

```
                 ┌──────────────────────────────────────────────┐
                 │              Browser (React SPA)              │
                 │  Vite · React 18 · TypeScript · Tailwind ·    │
                 │  shadcn/ui (Radix) · React Router             │
                 └───────┬──────────────┬───────────────┬────────┘
                         │ JWT Bearer   │ Supabase SDK   │ Firestore SDK
                         ▼              ▼               ▼
        ┌────────────────────────┐  ┌──────────┐  ┌──────────────┐
        │  Django REST API       │  │ Supabase │  │  Firebase    │
        │  gunicorn + WhiteNoise │  │ blog CMS │  │  (signup     │
        │  /api/v1 … /api/v8     │  │ + admin  │  │  analytics)  │
        └───┬───────┬────────┬───┘  └──────────┘  └──────────────┘
            ▼       ▼        ▼
      ┌──────────┐ ┌────────────┐ ┌──────────────┐
      │ Postgres │ │ Cloudinary │ │ Hostinger    │
      │ (Neon)   │ │  (media)   │ │ SMTP (email) │
      └──────────┘ └────────────┘ └──────────────┘
```

Key facts to internalise:

- **The frontend polls; there are no websockets.** Chat refreshes every 5 seconds, notifications every 30 seconds. See [§17](#17-polling-inventory).
- **There is no background-job system** (no Celery or queue). Anything "scheduled" either piggybacks on a frequently-polled request (the assistant's deadline sweep) or is triggered from outside by an authenticated cron call (the reminder email digest). See [§7.10](#710-reminders-and-the-email-digest) and [§7.14](#714-the-onswift-assistant).
- **Two identity systems.** The app uses Django JWT. The blog CMS at `/admin` uses Supabase Auth. A creator's password will not log into `/admin`.
- **API "versions" are namespaces, not versions.** `/api/v1/` … `/api/v8/` are one Django app each; v8 is not "newer" than v2.

### Technology

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui on Radix primitives, React Router 6, React Hook Form + Zod, Recharts, Sonner toasts, `lucide-react` icons, `date-fns` |
| Editors | BlockNote (docs), TipTap (rich text in forms/blog); CKEditor is listed as a dependency but **not imported anywhere** |
| Backend | Python 3.11, Django 5.2.6, Django REST Framework 3.16, SimpleJWT 5.5, `django-cors-headers`, WhiteNoise, gunicorn |
| Database | PostgreSQL (Neon) in production; SQLite for local/CI |
| Files | Cloudinary via `django-cloudinary-storage` (`RawMediaCloudinaryStorage`) |
| Email | Django SMTP backend → Hostinger (`smtp.hostinger.com:465`, SSL) |
| Auth extras | Google OAuth (ID-token verification on the backend), Google Calendar API |
| Analytics | PostHog, Vercel Analytics, Firebase Firestore (sign-up wizard only) |
| Testing | Vitest + Testing Library + jsdom (frontend), Django test runner (backend) |
| Hosting | Vercel (frontend), Google Cloud Run (backend container), Neon (database) |

### Repository layout

```
Onswift-App/
├── src/                          # React frontend
│   ├── api/apiClient.ts          # secureFetch / publicFetch — ALL HTTP goes through here
│   ├── components/               # feature folders + ui/ (shadcn primitives)
│   ├── contexts/                 # Auth, Project, Team, Notification, AdminAuth, Analytics
│   ├── hooks/                    # data + behaviour hooks (useTaskDetail, useCRM, useDocs, …)
│   ├── lib/                      # cache, syncQueue, feedback, greeting, nextDeadline, taskStages, …
│   ├── pages/                    # route components, grouped by area
│   ├── services/googleAuth.ts    # Google sign-in call
│   ├── types/                    # shared TypeScript interfaces
│   └── App.tsx                   # provider tree + the whole route table
├── backend/core/                 # Django project (manage.py lives here)
│   ├── core/                     # settings.py, urls.py, exceptions.py
│   ├── account/      (v1)        # users, auth, profiles, settings
│   ├── project/      (v2)        # projects, tasks, deliverables, chat, calendar, reminders, analytics
│   ├── notification/ (v3)        # notifications, hire requests, team, invite links
│   ├── onboarding/   (v4)        # onboarding + standalone forms
│   ├── portal/       (v5)        # client portal (projects, project chat, client invites)
│   ├── library/      (v6)        # file library
│   ├── crm/          (v7)        # CRM sheets
│   ├── docs/         (v8)        # docs editor + global search
│   ├── assistant/                # OnSwift AI (services only, no URLs)
│   ├── utils/email_service.py    # threaded SMTP sender
│   ├── Dockerfile · Procfile · requirements.txt
├── public/                       # logos, favicon, fonts (DSEG7 digital-clock font), og image
├── .github/workflows/main.yml    # CI/CD
├── vercel.json                   # SPA rewrite
└── *.md                          # planning/architecture documents (see §19)
```

---

## 3. Getting started

### Prerequisites

- Node 20 or 22 (`package.json` pins `>=20 <=22`; newer Node warns but builds)
- Python 3.11
- npm

### Backend

```bash
cd backend/core
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver                              # http://127.0.0.1:8000
```

Settings load `.env` and `.env.local` from the **repository root** (`.env.local` overrides `.env`; both are git-ignored). To work fully offline against SQLite, put `USE_SQLITE=true` in `.env.local`. With no `DATABASE_URL` the backend also falls back to SQLite. On start-up it prints which database it chose (`[settings] DB backend: SQLITE (offline)` or `NEON`).

> `requirements.txt` has been seen re-saved as UTF-16 on Windows. The Dockerfile normalises it to UTF-8 before installing; if `pip install` complains locally, re-save it as UTF-8.

### Frontend

```bash
npm install
npm run dev                                             # http://localhost:8080
```

Create `.env` (or `.env.local`) at the repo root with at least `VITE_API_BASE_URL=http://127.0.0.1:8000`. The blog/CMS code throws on start-up if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, so set those too (see [§4](#4-configuration-reference)). `http://localhost:8080` is already in the backend's CORS allow-list.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build |
| `npm test` | Frontend tests (`vitest run`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npx tsc --noEmit -p .` | Type-check (note: `strictNullChecks` is off) |
| `python manage.py test` | All backend tests (uses local-disk file storage, never Cloudinary) |
| `python manage.py test project.test_deadlines` | One backend module |
| `python manage.py makemigrations` / `migrate` | Schema changes |

---

## 4. Configuration reference

Names only; never commit values.

### Backend (read in `core/settings.py` and a few views)

| Variable | Used for | Default / note |
|---|---|---|
| `SECRET_KEY` | Django signing key | Falls back to a **dev-only literal** if unset; must be set in production |
| `ALLOWED_HOSTS` | Comma-separated host list | `onswift.org,www.onswift.org,localhost,127.0.0.1` |
| `DATABASE_URL` | Postgres connection (Neon) | If unset → SQLite. SSL required when used |
| `USE_SQLITE` | `true` forces SQLite even if `DATABASE_URL` is set | Personal offline-dev switch |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Media storage | Not needed for tests |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | SMTP | Host `smtp.hostinger.com`, port 465, SSL |
| `FRONTEND_URL` | Base URL used in emailed links (password reset, invites, digest) | No default for password reset; invites fall back to `https://onswift.org` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in ID-token verification and Calendar OAuth | |
| `ASSISTANT_EMAIL` | Service-account email for OnSwift AI | `assistant@onswift.org` |
| `DIGEST_CRON_TOKEN` | Shared secret for `POST /api/v2/reminders/send-due/` | Endpoint answers 503 if unset |

Hard-coded in settings (change in code, not env): `DEBUG = False`, CORS allowed origins (`https://onswift-app.vercel.app`, `https://www.onswift.org`, `http://localhost:8080`), CSRF trusted origins, JWT lifetimes (access **20 minutes**, refresh **7 days**), scoped throttles for public forms (`standalone_form_submit` 10/hour, `standalone_form_upload` 20/hour), production security flags (secure cookies, HSTS for one week with subdomains and preload, `SECURE_PROXY_SSL_HEADER`).

### Frontend (`import.meta.env`)

| Variable | Used by |
|---|---|
| `VITE_API_BASE_URL` | Every API call (`apiClient.ts`, `googleAuth.ts`, invite pages) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Blog + blog CMS (`lib/supabase.ts`) — **required at start-up** |
| `VITE_POSTHOG_API_KEY`, `VITE_POSTHOG_HOST` | PostHog analytics |
| `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google sign-in / OAuth provider |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase (sign-up wizard analytics only) |

---

## 5. Users, roles and access control

### Authentication

- **JWT (SimpleJWT).** Login, sign-up, Google sign-in and client onboarding all return `{access, refresh, user}`. Access tokens last 20 minutes, refresh tokens 7 days; there is no rotation or blacklist. Clients send `Authorization: Bearer <access>`.
- **Session storage.** The frontend keeps `onswift_access`, `onswift_refresh` and `onswift_user` in `localStorage`. Anything an XSS could read, it could exfiltrate (see [Known issues](#20-known-issues-and-limitations)).
- **Automatic refresh.** `secureFetch` (see [§8](#8-frontend-architecture)) refreshes on a 401 via `POST /api/v1/auth/token/refresh/` and replays the request; on refresh failure it clears only the three auth keys and redirects to `/login`.
- **Default permission** for every DRF view is `IsAuthenticated`; public endpoints opt out with `AllowAny`.
- **Password reset** uses Django's `PasswordResetTokenGenerator`; the emailed link is `FRONTEND_URL/reset-password/<uid>/<token>`. The request endpoint always answers "if this email exists…" to avoid revealing which emails are registered.

### Where role checks live

Roles are enforced in three styles (prefer the first when adding code):

1. **Permission classes** — `portal/permissions.py` (`IsClientRole`, `IsProjectClient`, `IsCreatorOrProjectClient`), plus small classes in `onboarding`, `library`, `docs` (`IsCreatorRole`, `IsCreatorOrTalent`, `IsDocUser`).
2. **Queryset scoping** — most list views filter by role (creators see projects they own; talents see projects where they have an assigned task).
3. **Inline `request.user.role == "creator"` checks** scattered through `project/views.py` and elsewhere.

### Access matrix (summary)

| Capability | Creator | Talent | Client |
|---|:-:|:-:|:-:|
| Create/edit/delete projects and tasks | ✅ | ❌ (can create tasks only if the creator turned on *allow talent task creation* for that project and the talent already works in it) | ❌ |
| Start/pause own assigned task (Planning ↔ In Progress) | ✅ | ✅ | ❌ |
| Complete a task directly | ✅ | ❌ (goes through the completion gate) | ❌ |
| Approve / request revision on deliverables | ✅ | ❌ | ❌ |
| Submit deliverables | — | ✅ | ❌ |
| Personal tasks | ✅ | ✅ only if a creator enabled talent task creation on a project they work in | ❌ |
| Analytics | ✅ | ❌ | ❌ |
| Library files | ✅ (owner) | folders shared with them | their client folder |
| Docs | ✅ | ✅ (own + shared) | ❌ |
| CRM sheets | ✅ | ✅ (own + shared) | ✅ (own + shared) |
| Forms / onboarding builder | ✅ | ❌ | ❌ |
| Client portal chat | ✅ (their projects) | ❌ | ✅ (their projects) |

---

## 6. Data model

All primary keys are UUIDs. Types are abbreviated; "→" means a foreign key. Choice lists are the values in `models.py` (some code stores values outside them; see Known issues).

### account (`/api/v1/`)

| Model | Fields |
|---|---|
| **User** | id, `role` (`creator`/`talent`/`client`; the assistant uses `"assistant"`), email (login field), full_name, profile_picture, is_active, is_staff, date_joined |
| **TalentProfile** | user (1:1), professional_title, bio, skills (JSON list), primary_skill, hourly_rate, portfolio_links (JSON), availability, avatar |
| **CreatorProfile** | user (1:1), company_name, bio, website, industry, location, social_links (JSON), verified, avatar, created_at |
| **UserSettings** | user (1:1), email_notifications, push_notifications, message_alerts, **reminder_enabled**, **reminder_frequency** (`daily`/`weekly`/`weekends`), **reminder_weekday** (0–6, Monday=0), **reminder_time**, **reminder_timezone**, **reminder_email**, last_reminder_sent_on, created_at, updated_at |

### project (`/api/v2/`)

| Model | Fields |
|---|---|
| **Project** | creator → User, name, description, due_date, `status` (`pending`/`in-progress`/`completed`), **allow_talent_task_creation**, created_at |
| **ProjectClientMembership** | project → Project, client → User, `status` (`active`/`completed`/`archived`/`on_hold`), added_at, completed_at, archived_at |
| **TeamMember** | project, name, avatar (legacy display record) |
| **Task** | project, name, description, **assignees** (many-to-many Users), `status` (`planning`/`in-progress`/`completed`), `priority` (`highest`…`lowest`, `not_sure`), deadline (date), **task_time** (optional time of day), `recurrence_type` (`daily`/`weekly`/`monthly`/`custom`), recurrence_days, **awaiting_approval**, created_at |
| **PersonalTask** | owner → User, name, description, status, deadline, linked_projects (many-to-many Projects), completed_at, created_at |
| **PersonalTaskAttachment** | task → PersonalTask, name, file, url, created_at |
| **TaskComment** | task, author, content, parent (threaded replies), mentions (many-to-many Users), created_at, updated_at |
| **TaskAttachment** | task, uploaded_by, name, file, url, created_at |
| **TaskChecklist / TaskChecklistItem** | checklist (task, title) / item (checklist, content, is_checked, order) |
| **Deliverable** | task, title, description, submitted_by, `status` (`pending`/`approved`/`revision`), feedback, revision_count, created_at, updated_at |
| **DeliverableFile / DeliverableLink** | deliverable, file (name, size, file_type) / url |
| **ProjectSample** | project, name, `type` (`file`/`link`), file, url, description |
| **Conversation** | participants (many-to-many), last_message, updated_at |
| **Message** | sender, recipient, content, is_read, reply_to, is_edited, edited_at, is_deleted, created_at |
| **Group / GroupMembership** | name, description, avatar, creator, members / (group, user, role `admin`/`member`, joined_at) |
| **GroupMessage / GroupMessageReadStatus** | group, sender, content, mentions, reply_to, is_edited, edited_at, is_deleted / (message, user, read_at) |
| **GoogleCalendarToken / CalendarSyncedTask** | per-user OAuth token record / (task, user, google_event_id, synced_at, last_updated) |

### notification (`/api/v3/`)

| Model | Fields |
|---|---|
| **Notification** | user, title, message, `notification_type` (`hire`/`system`; `project_added` also appears in practice), is_read, hire_request, link, created_at |
| **HireRequest** | creator, talent, message, `status` (`pending`/`accepted`/`rejected`), created_at, responded_at. **An accepted HireRequest is what "on a creator's team" means.** |
| **InviteToken** | token (auto UUID), creator, invited_email, is_used, used_by, used_at, created_at, expires_at (**7 days** by default; the generate endpoint accepts `expires_in_days` 1–365) |

### onboarding (`/api/v4/`)

| Model | Fields |
|---|---|
| **OnboardingTemplate** | creator, title, **blocks** (JSON), **project → Project (required to generate a link)**, timestamps |
| **OnboardingInstance** | template, slug (random URL-safe), client, project, `status` (`SENT`/`OPENED`/`COMPLETED`), expires_at, completed_at, responses (JSON), created_at |
| **OnboardingUpload** | instance, block_index, file, original_name |
| **StandaloneForm** | creator, title, blocks (JSON), slug, **is_open**, timestamps |
| **StandaloneFormResponse / StandaloneFormUpload** | form, responses (JSON), submitted_at / (form, block_index, file, original_name) |

### portal (`/api/v5/`)

| Model | Fields |
|---|---|
| **PortalMessage** | project, sender, content, file, file_name, is_read, read_at, thread_id, created_at |
| **ClientInvite** | project, creator, token (48-byte URL-safe), client_email, onboarding_form (JSON), responses (JSON), expires_at (default 30 days), accepted_at, created_at |

### library (`/api/v6/`)

| Model | Fields |
|---|---|
| **Folder** | creator, parent_folder, name, `folder_type` (`CLIENT`/`TEMPLATE`/`INTERNAL`), client, created_at |
| **FolderAccess** | folder, user, role (`viewer`/`editor`) |
| **Document** | creator, client, folder, name, file, file_type, size_kb, tags (JSON), color_label, is_locked, is_favorite, is_deleted, deleted_at, version, timestamps |
| **DocumentVersion** | document, version_number, file, file_type, size_kb, uploaded_by |
| **DocumentActivity** | document, actor, actor_role, action (`VIEWED`/`DOWNLOADED`/`EDITED`/`SHARED`/`UPLOADED`/`DELETED`/`RESTORED`), timestamp |
| **DocumentShareLink** | document, slug, permission (`VIEW`/`EDIT`), expires_at, created_by |

### crm (`/api/v7/`)

| Model | Fields |
|---|---|
| **CRMSheet** | owner, folder, name, is_favorite, timestamps |
| **CRMColumn** | sheet, name, `field_type` (`text`, `email`, `phone`, `url`, `number`, `date`, `single_select`, `multi_select`, `checkbox`), options (JSON), order |
| **CRMRow** | sheet, values (JSON keyed by column), order |
| **CRMAccess** | sheet, user, role (`viewer`/`editor`/`admin`) |

### docs (`/api/v8/`)

| Model | Fields |
|---|---|
| **Doc** | owner, parent (tree), project, folder, title, icon, **content** (BlockNote block JSON), order, is_favorite, timestamps |
| **DocAccess** | doc, user, role (`viewer`/`editor`) |

### assistant

| Model | Fields |
|---|---|
| **AssistantNudge** | task, user, sent_at — unique per (task, user); it is what prevents duplicate deadline nudges |

---

## 7. Features

Each feature lists: what it does, who can use it, how it works, the frontend files involved, and the endpoints. Endpoint paths are relative to the API host; full request/response detail per endpoint is in [§10](#10-complete-api-reference).

### 7.1 Accounts, sign-in and profiles

**What.** Email/password sign-up and login, Google sign-in, password reset, profile editing (role-specific), account statistics and self-service account deletion.

**Sign-up.** `SignupSerializer` creates the `User` (`role` is required) plus a `TalentProfile` or `CreatorProfile` from optional fields (talent: professional title, skills, primary skill, hourly rate; creator: company, bio, website, industry, location). Passwords must be at least 8 characters. A talent may include an `invite_token`: if valid, the invite is marked used, an **accepted** `HireRequest` is created (so the talent lands on that creator's team), the creator is notified, and the assistant congratulates the talent. Every new creator/talent is welcomed by the assistant. The response includes JWT tokens so the user is signed in immediately.

**Login.** `LoginSerializer` authenticates by email + password and rejects disabled accounts.

**Google sign-in.** The frontend obtains a Google ID token and posts it (`token`, optional `role`) to `POST /api/v1/auth/google/`. The backend verifies it with Google against `GOOGLE_CLIENT_ID`, then `get_or_create`s the user (default role **talent**), creating a profile and sending the welcome message for new users.

**Profiles.** `PATCH /api/v1/auth/profile/` accepts multipart data (profile picture plus the role-specific fields above) and creates the profile row if it is missing. `GET /api/v1/auth/user/` returns the user with a nested `profile`, which `AuthContext.getUser` flattens into the frontend `User` (title, bio, skills, hourly rate, profile picture, social links).

**Account.** `GET /api/v1/account/stats/` returns member-since plus role-specific counts (creator: projects, team size, completed tasks; talent: projects worked on, teams, completed tasks, who added them). `DELETE /api/v1/account/delete/` optionally checks the password, then deletes the user; related rows cascade.

**Frontend.** `contexts/AuthContext.tsx` (session, login, signup, logout, profile updates, password reset), `pages/auth/*` (Login, SignUp, SignUpCreator, SignUpTalent, ForgotPassword, ResetPassword, GoogleOAuthCallback, OAuthCallback), `services/googleAuth.ts`, `pages/TalentProfileEdit.tsx`, `pages/CreatorProfileEdit.tsx`, `pages/Settings.tsx`. Login/sign-up identify the user in PostHog; logout resets PostHog and clears all `onswift_cache_*` entries.

**Endpoints.** `POST auth/signup/`, `POST auth/login/`, `POST auth/token/refresh/`, `GET auth/user/`, `PATCH auth/profile/`, `POST auth/google/`, `POST password-reset/`, `POST password-reset-confirm/`, `GET account/stats/`, `DELETE account/delete/`, `PATCH settings/profile/` (all under `/api/v1/`).

### 7.2 Team building: invites and hire requests

A creator's **team** is the set of talents with an *accepted* `HireRequest` against them.

**Invite links (the live path).**
1. Creator opens Team → **Invite Member** (`InviteMemberModal`) → `POST /api/v3/invites/generate/` (creators only), optionally for a specific email and with `expires_in_days` (1–365, default 7). If an email is given, an invitation email with `FRONTEND_URL/invite/<token>` is sent.
2. The invitee opens `/invite/:token` (`InvitePage`). It calls the public `GET /api/v3/invites/validate/<token>/`, which returns the creator's name/company or an error if the token is expired or used.
3. The page offers **Sign in & accept** (`/login?invite=<token>`) or **Create account & accept** (`/signup/talent?invite=<token>`).
4. Signed in, `POST /api/v3/invites/accept/<token>/` (talents only) creates the accepted `HireRequest`, marks the token used, notifies the creator ("Invite Accepted") and the assistant congratulates the talent. If the talent is already on the team it says so and changes nothing. Sign-up with `invite_token` does the same (see 7.1).

**Hire requests (backend complete, UI limited).** `POST /api/v3/hire-requests/` (creators only; target must be a talent) notifies the talent. `GET /api/v3/hire-requests/received/` lists a talent's pending requests, and `PATCH /api/v3/hire-requests/<id>/respond/` (only `accepted`/`rejected`) updates it and notifies the creator. The direct "hire from marketplace" flow is not wired: the marketplace shows a "coming soon" modal (see 7.24). Hire notifications carry actions in `NotificationItem`.

**Managing the team.** `GET /api/v3/team/` (creator: accepted members), `DELETE /api/v3/team/<id>/remove/` (removes the accepted hire request and notifies the talent), `GET /api/v3/my-creators/` (talent: creators who hired them; feeds the chat contact picker).

**Frontend.** `pages/Team.tsx` (My Team: cards, invite, send message, remove), `contexts/TeamContext.tsx`, `components/dashboard/InviteMemberModal.tsx`, `components/dashboard/TeamMemberCard.tsx`, `pages/InvitePage.tsx`.

### 7.3 Projects

**What.** The container for tasks, deliverables, client access and the project chat.

**Rules.**
- Creators list/create their own projects. Talents see the projects where they hold at least one assigned task.
- Only the creator may edit or delete (`PUT/PATCH/DELETE` return 403 otherwise).
- **Status** is `pending` / `in-progress` / `completed` in the model. The frontend derives the *displayed* status from task counts (`deriveStatus` in `ProjectContext.tsx`): no tasks → Planning; all completed → Completed; nothing started and nothing completed → Planning; otherwise In Progress. The serializer exposes `task_count`, `completed_tasks` and `in_progress_tasks` for this.
- **Complete** (`POST projects/<id>/complete/`): creator only; idempotent; sets the project completed, marks active/on-hold client memberships completed, and on the first transition notifies every assigned talent and the creator.
- **Archive** (`POST projects/<id>/archive/`): creator only; marks the project and all its client memberships archived.
- **Duplicate** (`POST projects/<id>/duplicate/`): creator only. Copies the project's tasks and checklists into a new "<name> (Copy)" project starting **un-started** (project `pending`, every task `planning`, checklist items unchecked). Assignees, deadlines, client links, attachments, comments and deliverables are deliberately not copied.
- **Project completion signals** (`project/signals.py`): when every task in a project is completed, or the project is saved as completed, active client memberships are updated to completed.
- **Samples** (`projects/<id>/samples/`, `project-samples/<id>/delete/`): portfolio-style file/link samples per project. Implemented in the backend; the current frontend does not call them.

**Frontend.** `pages/Projects.tsx` (list, create, first-project celebration), `pages/ProjectDetail.tsx` (tabs **Board** and **Attachments**, task sorting, the creator's *allow talent task creation* switch, client invites section, personal tasks linked to the project), `contexts/ProjectContext.tsx` (canonical `Project`/`Task` types, list/CRUD, `deriveStatus`, browser copy of the project list and per-project tasks), `components/dashboard/ProjectCard.tsx`, `lib/api.ts` (`mapFromBackend`).

**Endpoints.** `GET/POST projects/`, `GET/PUT/PATCH/DELETE projects/<id>/`, `POST projects/<id>/complete|archive|duplicate/`, `GET/POST projects/<id>/samples/`, `DELETE project-samples/<id>/delete/` (v2).

### 7.4 Tasks and the board

**What.** Units of work inside a project.

**Fields.** Name, description, multiple assignees, status (`planning`/`in-progress`/`completed`), priority, deadline (date), optional `task_time` (time of day), recurrence, `awaiting_approval`.

**Board.** The Board tab shows three columns (Planning, In Progress, Completed). Cards can be moved with the stage menu, by **dragging**, or by **swiping** on touch devices (left = next stage, right = previous, ≥50 px). Each card has a 3×3 dots grip icon that appears only when the current user can actually move it somewhere. Tasks can be sorted by soonest deadline, latest deadline or alphabetically.

**Task detail modal** (`components/project/TaskDetailModal.tsx`, `hooks/useTaskDetail.ts`). Opened from a card or by `/projects/:id?task=<taskId>` (used by notification links). Sections:
- Description, assignees, deadline, priority, status, recurrence (creators edit; others read).
- **Comments** with threaded replies and `@mentions`. Only the project creator and the task's assignees are valid mention targets (checked server-side); mentioned users get a notification. Authors and the creator can delete a comment.
- **Checklists**: only the creator can create/rename/delete checklists and items; assignees can tick items (an update containing only `is_checked` is allowed).
- **Attachments (deliverables)**: submitted work that needs approval — see 7.8.
- **Reference files & links**: plain attachments (files or links) that any assignee or the creator can add; not a submission. The uploader or the creator can delete. Served by `tasks/<id>/attachments/`.
- The pending-approval banner (7.5) with **Approve** / **Request revision** for creators.

**Assignment and notifications.** Creating a task or adding an assignee notifies the assignee with a priority-1 notification ("New Task Assigned" / "Task Reassigned"), which also lands in their assistant chat and inbox email. Self-assignment does not notify.

**Recurrence.** When a task with a `recurrence_type` becomes completed — by the creator changing the status, or by approving its deliverable — `spawn_recurring_task` creates the next occurrence: `planning`, deadline moved by the interval (daily +1 day, weekly +7, monthly +1 month, custom +N days), same assignees, priority, `task_time`, checklists (unchecked) and **link** attachments (files can't be cloned). The creator and assignees get a "Recurring Task Reset" notification.

**Endpoints.** `GET/POST projects/<id>/tasks/`, `GET/PUT/PATCH/DELETE tasks/<id>/`, `GET my-tasks/`, `GET/POST tasks/<id>/comments/`, `DELETE tasks/<id>/comments/<cid>/`, `GET/POST tasks/<id>/attachments/`, `DELETE tasks/<id>/attachments/<aid>/`, checklist routes under `tasks/<id>/checklists/…` (v2).

### 7.5 Talent task rules and the completion gate

Talents work under a deliberately narrow set of rules, enforced on the server (`TaskDetailView`) and mirrored in the UI (`lib/taskStages.ts`):

| Action by a talent on a task assigned to them | Result |
|---|---|
| Set status to `planning` or `in-progress` with a `PATCH` containing **only** `status` | ✅ allowed |
| Set status to `completed` | ❌ 403 — goes through the completion gate |
| Change any other field, `PUT`, or `DELETE` | ❌ 403 ("Only creators can modify tasks.") |
| Any change while the task is `completed` | ❌ 403 |
| Any change while the task is `awaiting_approval` | ❌ 403 |
| A task they are not assigned to | 404 (not visible) |

**The completion gate.** When a talent tries to complete a task (button, drag or swipe) the UI asks **"Do you have an attachment for this task?"**:
- **Yes, add attachment** → opens the Attachments/Deliverables flow with the task preselected. When the creator later approves the deliverable, the task becomes completed (and recurrence spawns).
- **No, request approval** → `POST tasks/<id>/request-completion/`, which sets `awaiting_approval = true` and notifies the creator ("Task Ready for Approval", priority 1). It is idempotent, rejects completed tasks, and requires the caller to be an assignee.

**Awaiting approval, made visible.** In My Tasks such tasks move into a separate amber **"Waiting on your creator"** group and are locked. On the board they get an amber ring and a **"Waiting on your creator"** chip (creators see **"Needs your approval"**).

**Creator response.** The creator either completes the task or approves its deliverable (either clears `awaiting_approval`), or `POST tasks/<id>/request-revision/` (creator only): clears the flag and notifies the assignees "Revision Requested" with the creator's feedback.

**Auto-start.** `DashboardTalent` moves tasks assigned within the last 5 minutes from Planning to In Progress when the dashboard loads (a `{status}`-only `PATCH`, allowed by the rule above).

### 7.6 Personal tasks

**What.** A private to-do list owned by one user, independent of any project, optionally *linked* to projects for context.

**Who.** Creators always; talents only when they can link at least one project — i.e. a creator enabled *allow talent task creation* on a project the talent already works in (`can_create_personal_tasks`). The eligibility endpoint tells the UI whether to show the **+** button and which projects can be linked.

**Rules.** Owner-only for every operation (other users get 404). Owners can set any status freely (no approval flow). Setting `completed` stamps `completed_at`; moving away clears it. Linking is validated against the projects the user may link. Personal tasks appear in My Tasks, on the linked project's page (owner-only), on the Deadlines page and in reminder reports.

**Attachments.** Each personal task can carry files and links (owner-only): `GET/POST personal-tasks/<id>/attachments/` (multipart `file` or a JSON/form `url`; `https://` is added if missing; a file or a URL is required) and `DELETE personal-tasks/<id>/attachments/<aid>/`. The list/detail responses embed `attachments`. Files go through Cloudinary with storage errors mapped to a 503.

**Frontend.** `components/tasks/PersonalTaskDialog.tsx` (create/edit/delete, project linking, attachments section for saved tasks), `components/tasks/AttachmentsSection.tsx` (shared files-and-links list), My Tasks and project page integrations.

**Endpoints.** `GET/POST personal-tasks/` (optional `?project=<id>`), `GET/PATCH/DELETE personal-tasks/<id>/`, `GET personal-tasks/eligibility/`, plus the two attachment routes (v2).

### 7.7 My Tasks panel, instant saves and offline queue

**What.** The task list on the Creator and Talent dashboards (`components/tasks/MyTasksPanel.tsx`): project tasks assigned to the user plus their personal tasks, with **To Do** and **Completed** tabs and counts.

**Card** (`components/talent/TaskCard.tsx`). Shows the name, description, deadline label (Overdue / Due Today / Due Tomorrow / Due in N days), project (or "Personal"), status, and a "Pending approval" badge. A **chevron-down** button opens the stage menu (only stages the user may use); a **grip icon** signals that the card is swipeable. **Swipe** left = next stage, right = previous, with a live "reveal" of the target stage; vertical scrolling still works; pressing a control inside the card never starts a swipe.

**Role rules** come from `stageAction(role, from, to, awaiting)` in `lib/taskStages.ts`, returning `apply`, `gate` or `locked`: creators apply anything; talents apply Planning↔In Progress, are sent to the gate for Completed, and are locked out of completed or awaiting-approval tasks. Personal tasks are unrestricted.

**Instant, offline-tolerant status changes** (`lib/syncQueue.ts`). Changing a task's status updates the screen immediately, stores the change in the browser, and sends it in the background:
- Changes are keyed per task, so rapid taps collapse into one request carrying the latest status.
- The queue is persisted in `localStorage` (`onswift_cache_sync_queue`), so it survives reloads, and is wiped at logout (a different account must never replay it).
- It flushes right away, on the browser `online` event, when the tab becomes visible, and every 15 seconds.
- Network errors, `5xx`, `408` and `429` retry with backoff (1 s doubling to 30 s); other `4xx` responses drop the change, revert the card and show an error toast plus an error sound.
- `applyPendingStatuses` layers unconfirmed changes over freshly fetched data so a background refresh can't bounce a card back.
- The top bar shows a small **Saving… / Offline · N changes saved on this device** pill (`components/layout/SyncStatusPill.tsx`).
- Only **task status changes** use the queue (project tasks and personal tasks).

**Browser copy.** The panel is filled instantly from a saved copy (`my-tasks:<userId>`, 30-minute TTL) while the server answers, then refreshed silently.

**Endpoints.** `GET my-tasks/`, `GET/POST/PATCH personal-tasks/…`, `PATCH tasks/<id>/` (status only, via the queue), `POST tasks/<id>/request-completion/`.

### 7.8 Deliverables ("Attachments")

In the UI, submitted work is called **Attachments** (the model and API call it deliverables).

**Flow.**
1. A talent (or creator) opens the project's **Attachments** tab (or "Add" in the task modal) and submits a deliverable for an assigned, non-completed task: title, description, any number of **files** (drag-and-drop or browse) and **links**. `POST /api/v2/deliverables/` is multipart: `task`, `title`, `description`, repeated `files` and `urls`.
2. The project creator is notified ("Deliverable Submitted").
3. The creator reviews: **Approve** (`PATCH deliverables/<id>/review/` with `status=approved`) marks the deliverable approved, **completes the task**, clears `awaiting_approval`, spawns the next recurrence if any, and notifies the talent; **Request revision** (`status=revision` + feedback) increments `revision_count` and notifies the talent; un-approving (`pending` after `approved`) moves a completed task back to In Progress.
4. The submitter can edit title/description (`PATCH deliverables/<id>/`), add/edit/remove links, and add/remove files after the fact; the creator can do the same.

**Visibility.** Creators see deliverables for their projects; everyone else sees only what they submitted. The list is filterable in the panel.

**Frontend.** `components/team/DeliverablesPanel.tsx`, `UploadDeliverableModal.tsx` (task picker, files + links), `DeliverableCard.tsx`, `DeliverableDetailModal.tsx`, `pages/Deliverables.tsx` ("My Attachments" for talents, "Team Attachments" for creators), the deliverables block inside `TaskDetailModal.tsx`. Talents get first-attachment and first-approval celebrations.

**Endpoints.** `GET/POST deliverables/`, `GET/PATCH/PUT/DELETE deliverables/<id>/`, `PATCH deliverables/<id>/review/`, `GET/POST deliverables/<id>/links/`, `PATCH/DELETE deliverables/<id>/links/<lid>/`, `GET/POST deliverables/<id>/files/`, `DELETE deliverables/<id>/files/<fid>/` (v2).

### 7.9 Deadlines, the calendar and the Next Deadline clock

**Deadlines page** (`/calendar`, nav label "Deadlines"; `pages/Calendar.tsx`). One request, `GET /api/v2/deadlines/`, returns every dated task the user can see — creators see all tasks in their projects, others see tasks assigned to them — plus their personal tasks. Each row: id, name, project id/name, `deadline` (date), `task_time` (optional), status, assignee, `is_personal`. The page offers:
- A **Deadlines table** with a status filter (all / overdue / urgent / due / completed), overdue tasks first, completed last.
- An optional month **calendar** grid.
- The **reminder switch** (enable + settings gear) and the **daily report** dialog (see 7.10).
- The **Next Deadline clock** (below).
- Silent background refresh every 30 seconds while the tab is visible, with a saved browser copy for instant display.
- Status rules: `completed` if done, `overdue` before today, `urgent` within two days, otherwise `due`.

**Next Deadline clock** (`components/deadlines/CountdownCircle.tsx`). A circular countdown in a 7-segment digital font (DSEG7, `public/fonts`). It shows days : hours : minutes : seconds. Under 24 hours the ring turns red with "URGENT: Due in less than 24 hours!"; under one hour (or overdue) it blinks; overdue shows "Overdue! Wrap up this task as soon as you can."

**One rule for both clocks.** The Deadlines page and the Talent dashboard use the same selection (`lib/nextDeadline.ts`): the open task due soonest, where the due moment is the deadline plus `task_time` (or the end of the day), and an **overdue task still counts**. The Talent dashboard reads the same endpoint through `hooks/useNextDeadline.ts`, so both show the same task, time and label.

**Sidebar badge.** `hooks/useDeadlineCount.ts` counts imminent deadlines for the sidebar item.

**Endpoints.** `GET /api/v2/deadlines/`.

### 7.10 Reminders and the email digest

Users can opt in to a recurring summary of what's left.

**Settings** (on `UserSettings`, edited through `GET/PATCH /api/v1/settings/` via `hooks/useReminderSettings.ts`): enabled, frequency (`daily`, `weekly` + weekday, or `weekends`), local time, time zone (defaults to the browser's), and whether to also send email.

**In-app report.** `GET /api/v2/reminders/report/` builds the report for "today" in the user's time zone: **overdue**, **due today**, **due this week** (next 7 days), and **needs action** — for creators, tasks awaiting approval and pending deliverables; for others, deliverables awaiting revision. Project tasks and personal tasks are both included. It also returns `scheduled_today`. The report dialog (`components/reminders/DailyReportDialog.tsx`) is wrap-friendly on phones.

**Email digest.** `send_due_digests()` emails every user with reminders and email enabled whose local time has passed their chosen time on a scheduled day, at most once per local day (`last_reminder_sent_on`); empty reports are not emailed. It is triggered by `POST /api/v2/reminders/send-due/`, which requires the `X-Cron-Token` header to match `DIGEST_CRON_TOKEN` (constant-time compare; 503 if the secret is not configured; 403 on mismatch). **Nothing in the repository schedules this call** — point an hourly scheduler (for example Cloud Scheduler) at it.

**Endpoints.** `GET reminders/report/`, `POST reminders/send-due/` (v2); `GET/PATCH settings/` (v1).

### 7.11 Creator analytics

**What.** A creator-only page (`/analytics`, `pages/Analytics.tsx`, `components/dashboard/analytics/*`) with three views: **completion** (approved deliverables over time), **client acquisition** (new distinct clients over time, by their earliest project membership) and **talent performance** (per team member: submitted, approved, approval rate, tasks completed, pending; team members are accepted hires plus anyone assigned to the creator's tasks). A team-status donut is included.

**Ranges.** `?range=` is one of `24h` (hourly buckets), `7d`, `30d` (daily), `3m`, `12m`, `24m` (monthly); unknown values fall back to `30d`. Non-creators get 403.

**Frontend.** `hooks/useCreatorAnalytics.ts` keeps a browser copy per range (30-minute TTL), shows it immediately, refreshes in the background and keeps it visible if the server can't be reached.

**Endpoints.** `GET /api/v2/creator/analytics/?range=…`.

### 7.12 Messaging

Three real chat systems plus the assistant. All use the Chats page (`/messages`, `pages/Messages.tsx`) except the client project thread.

**Direct messages.** `GET /api/v2/conversations/` lists the user's conversations (with `unread_count` and the other user); `POST conversations/start/` gets or creates a conversation with a `user_id` (self-chat is rejected with 400); messages are listed, sent (`content`, optional `reply_to_id`), marked read, **edited within 5 minutes** of sending (sender only), and deleted (sender only; content is blanked and the message flagged deleted). Sending notifies the recipient ("New Message"), except to the assistant (see 7.14).

**Group chats.** Create a group with members, list groups, edit/delete (admins only), list/add members (admins add; creators can fetch available team members via `groups/available-members/`), remove members (admins remove others; anyone can leave; the last admin can't be removed or leave while others remain; an empty group is deleted). Messages support `@mentions`, replies, edit (5 minutes), delete, and per-user read tracking (`GroupMessageReadStatus`).

**Client project thread.** A per-project thread between the creator and that project's clients (`/api/v5/projects/<id>/messages/…`), described in 7.15. Clients see these threads listed in Chats under "Project chats" with unread counts.

**Chat UI features.** Reply, edit, delete, **forward** to other chats, multi-select with a selection toolbar, an action bar, a contact-info panel, `@mention` dropdown in groups, date dividers, swipe-to-reply on touch (64 px) and long-press (2 s) via `hooks/use-message-gesture.ts`. Opening `/messages?user=<id>` opens or creates that DM (used by global search and the Team page); the app no longer auto-opens the assistant conversation on load. An `ErrorBoundary` wraps the routes so a render error shows a recoverable panel instead of a blank page.

**Freshness.** The open chat polls every 5 seconds; the sidebar Chats badge (`hooks/useUnreadChatCount.ts`) polls conversations and groups every 30 seconds.

**Browser copy.** The conversation and group lists (`chat-conversations`, `chat-groups`) and the newest 50 messages of the 10 most recently opened chats (`chat-msgs:…`, 30-minute TTL) are saved, so Chats opens instantly and works for recent chats offline.

**Sounds.** A soft chime plays when a poll brings in messages from someone else, and a short tick when you send (see 7.22).

**Endpoints (v2).**
`GET conversations/`, `POST conversations/start/`, `GET conversations/<id>/messages/`, `POST …/messages/send/`, `POST …/messages/read/`, `PATCH …/messages/<mid>/edit/`, `DELETE …/messages/<mid>/delete/`;
`GET/POST groups/`, `GET groups/available-members/`, `GET/PATCH/PUT/DELETE groups/<id>/`, `GET/POST groups/<id>/members/`, `DELETE groups/<id>/members/<uid>/`, `POST groups/<id>/leave/`, `GET groups/<id>/messages/`, `POST …/messages/send/`, `POST …/messages/read/`, `PATCH …/messages/<mid>/edit/`, `DELETE …/messages/<mid>/delete/`.

### 7.13 Notifications

**What.** An in-app feed (bell dropdown and `/notifications` page) that is also mirrored to email.

**One choke point.** Every notification-worthy event should go through `notification.services.create_notification(user, title, message, notification_type, hire_request, link, priority)`. It:
1. Stores a `Notification` row (the bell).
2. If `priority == 1`, also drops the message into the user's **assistant chat**.
3. If the user has an email, sends a branded HTML email (subject `OnSwift: <title>`) on a background thread.

(`create_notification` swallows unknown keyword arguments; see Known issues.)

**Feed.** `GET /api/v3/notifications/` returns the user's notifications; individual items can be marked read (`PATCH …/<id>/read/`) or deleted; `POST …/mark-all-read/` and `DELETE …/delete-all/` are bulk operations. `link` makes an item clickable (deep links such as `/projects/<id>?task=<taskId>`).

**Polling and the sweep.** `NotificationContext` polls every 30 seconds. `NotificationListView` also calls the assistant's deadline sweep on each fetch (7.14).

**Sound.** New unread notifications play a bell chime once per poll; the first load after sign-in only records what is already there (7.22).

**Events that create notifications include:** task assigned/reassigned, task ready for approval, revision requested, deliverable submitted/approved/revised/unapproved, `@mention` in a comment, new direct message, portal message, client added to a project, invite accepted, hire request created/answered, removed from team, project completed, recurring task reset, onboarding link generated/opened, new client onboarded, new form response, assistant messages.

**Endpoints (v3).** `GET notifications/`, `PATCH notifications/<id>/read/`, `DELETE notifications/<id>/`, `POST notifications/mark-all-read/`, `DELETE notifications/delete-all/`.

### 7.14 The OnSwift assistant

`assistant/services.py` — a **scripted** service-account user (`assistant@onswift.org`, `role="assistant"`, inactive, unusable password) that talks through the normal direct-message system. Every entry point is wrapped so a failure can never break sign-up, notifications or messaging. It shows in Chats pinned to the top with the OnSwift logo.

| Behaviour | Trigger |
|---|---|
| Welcome message | New creator or talent (email sign-up or first Google sign-in) |
| Team-join congratulations | A talent joins a creator's team through an invite |
| Notification mirror | Any `create_notification(..., priority=1)` |
| Deadline nudge | Task due in **under 2 hours** (deadline + `task_time`, or 23:59:59): each assignee gets one message + notification, deduplicated by a unique `AssistantNudge(task, user)` |
| Reply relay | A talent replies to the assistant within 24 hours of a nudge → the message is forwarded to the task's creator ("Concerning '<task>', <name> said: …") and the talent gets an acknowledgement |
| Canned reply | Any other message to the assistant gets a polite "I'm not a person" note |

**Scheduling without a scheduler.** `maybe_sweep_deadlines()` is called from the notification list endpoint and throttled to once per 5 minutes per server process; duplicate-nudge safety comes from the database constraint, not the throttle.

### 7.15 Client portal

**Model.** Clients see only projects they are attached to, through a `ProjectClientMembership` (`active` or `on_hold`) or a completed onboarding instance linked to a project (`get_client_project_ids`). This membership is the spine of all client access.

**How a client gets in.**
1. **Onboarding form** (the main path, 7.16): a public form link creates the client account and the membership in one step.
2. **Direct add**: `POST /api/v5/projects/<id>/add-client/` (creator) attaches an existing client account immediately, reactivating archived/completed memberships, and notifies the client.
3. **Portal invite** (`POST /api/v5/projects/<id>/invites/`, creator): generates a 30-day token with a default or customised form and emails the client. The public endpoints `GET /api/v5/invites/<token>/` and `POST …/accept/` show and accept it (existing users get a membership and the creator is notified; new users are told to sign up). **Note:** the emailed link points to `/client/invite/<token>`, and the frontend has no such route (see Known issues).

**What a client sees.**
- **Home / Projects** (`ClientProjects.tsx`): their projects, overview and quick access.
- **Project detail** (`ClientProjectDetail.tsx`): tasks and deliverables with progress (read-mostly).
- **Project thread** (`/projects/:id/messages`, `ClientMessages.tsx`) and the creator-side modal (`ClientChatModal.tsx`): both parties list messages (`?before=<id>&limit=<=100`), send text and one file, mark read and see unread counts. Sending notifies the other side with a link to the right place. Both poll every 5 seconds; a sound plays for incoming messages.
- **Client Portal page** (`/onboarding` for clients, `ClientPortalView.tsx`): their submitted onboarding forms.

**Creator tools.** Client invites table per project (`ClientInvitesTable.tsx`, refreshed every 30 s), invite/add modal, and **Client History** (`GET /api/v5/clients/history/`, `pages/onboarding/ClientHistoryPage.tsx`) with per-client project counts and submissions.

**Endpoints (v5).** `GET projects/`, `GET projects/<id>/`, `GET projects/<id>/messages/`, `POST …/messages/send/`, `POST …/messages/read/`, `GET …/messages/unread/`, `GET/POST projects/<id>/invites/`, `DELETE projects/<id>/invites/<iid>/`, `POST projects/<id>/add-client/`, `GET invites/<token>/`, `POST invites/<token>/accept/`, `GET clients/history/`.

### 7.16 Onboarding forms and standalone forms

Two related features built on the same block editor (`components/onboarding/FormBlockEditor.tsx`, `BlockRenderer.tsx`).

**Block types.** `welcome` (rich intro text), `short_answer`, `long_answer`, `multiple_choice`, `file_upload`, `checkbox` (terms). Blocks carry an optional stable `id` so references survive reordering; each may be required.

**Client onboarding (creator → new client).**
1. The creator builds a **template** (`/onboarding/new`, `/onboarding/:id`; `/api/v4/templates/`). **A template must be linked to a project** before a link can be generated.
2. **Generate link** (`POST /api/v4/instances/create/`) creates an `OnboardingInstance` with a random slug (`/onboard/<slug>`), copies the template's project, optionally sets an expiry, and notifies the creator. The link table (`OnboardingLinkTable`, refreshed every 10 s) tracks **SENT → OPENED → COMPLETED**, or expired.
3. The client opens `/onboard/<slug>` (public). Opening a `SENT` link marks it `OPENED` and notifies the creator. Expired links return 410; completed ones 409.
4. Files attached to `file_upload` blocks are uploaded first (`POST …/upload/`, max **10 MB**, only to blocks of that type) and their URLs go into the response.
5. **Submit** (`POST /api/v4/onboard/<slug>/submit/`) runs in one transaction: create the client `User` (`role="client"`), mark the instance completed and store the responses, create the `ProjectClientMembership`, ensure the creator's client library folders exist (a client folder and an "Onboarding Responses" subfolder), and notify the creator (priority 1). The response contains JWT tokens, so the client lands signed in on their project. Answers stay on the instance (`responses`); they are **not** auto-filed as library documents.
6. Creators read submissions per client (`GET /api/v4/clients/<id>/submissions/`); clients read their own (`GET /api/v4/my-submissions/`).

**Standalone forms (creator → anyone).** Plain forms independent of projects and accounts: `/forms` (list), `/forms/new` and `/forms/:id` (builder), `/forms/:id/responses` and `…/responses/:responseId` (responses), public fill at `/f/<slug>`. A form has an **open/closed** switch (a closed form still loads so the page can say "no longer accepting responses"). Anyone can submit many responses without an account; submit and upload are **throttled** (10 and 20 per hour per client). Each submission notifies the creator.

**Frontend.** `pages/onboarding/*` (OnboardingFormPage list, OnboardingBuilder, ClientOnboard, ClientHistoryPage), `pages/forms/*`, drafts saved in `localStorage` (`onswift_form_draft_<id>`, `onswift_standalone_form_draft_<id>`).

**Endpoints (v4).** `GET/POST templates/`, `GET/PATCH/DELETE templates/<id>/`, `GET instances/` (`?template_id=&status=`), `POST instances/create/`, `GET instances/<id>/`, `GET clients/<client_id>/submissions/`, `GET onboard/<slug>/`, `POST onboard/<slug>/submit/`, `POST onboard/<slug>/upload/`, `GET my-submissions/`, `GET/POST forms/`, `GET/PATCH/DELETE forms/<id>/`, `GET forms/<id>/responses/`, `GET forms/<id>/responses/<rid>/`, `GET f/<slug>/`, `POST f/<slug>/submit/`, `POST f/<slug>/upload/`.

### 7.17 File library

**What.** Creator-owned file storage (`/library`, nav "Files" for creators, "My Files" for talents, "Docs" for clients; `pages/library/DocumentLibrary.tsx`). The page presents **files, docs and CRM sheets together** in a grid or list, organised in folders, with favourites, move-to, sharing and trash.

**Folders.** Types `CLIENT`, `TEMPLATE`, `INTERNAL`. Creators create nested folders; rename/move if they own it or hold an **editor** grant; delete only the owner (contents go with it). **Folder sharing** by email with `viewer`/`editor` (`FolderAccess`); talents on the creator's team appear in the "sharable users" list. Shared folders are visible to the people they're shared with.

**Files.**
- **Upload** (`POST /api/v6/documents/upload/`, creators, multipart): into a folder (or Home). If a file with the same name already exists in that folder, the previous file is archived as a **version** and the new one replaces it (version + 1).
- **Metadata**: rename, tags, colour label, favourite, lock, move to another folder, manual created-at override. A **locked** document rejects edits and re-uploads (423).
- **Versions & activity**: version history, and an activity log (viewed, edited, uploaded, shared, deleted, restored).
- **Trash**: delete is a soft delete; `GET documents/trash/` lists items deleted in the **last 30 days**; restore or permanently delete.
- **Share links**: create a time-limited link with `VIEW`/`EDIT` permission; list, revoke; the public `GET /api/v6/shared/<slug>/` returns the file info (410 once expired).
- **Search**: `GET /api/v6/search/?q=` over names and tags, scoped by role.
- **Clients** list documents in their own client folder via `GET documents/`.

**Frontend usage today.** The library page uses upload, list, trash/restore/permanent delete, folders and folder sharing, file sharing (`FileShareModal`), move-to, and shows docs and CRM sheets alongside files. Version history, lock toggle and library search exist on the backend but have no frontend caller.

**Endpoints (v6).** `GET folders/`, `POST folders/create/`, `GET/PATCH/DELETE folders/<id>/`, `GET/POST folders/<id>/access/`, `PATCH/DELETE folders/<id>/access/<aid>/`, `GET sharable-users/`, `GET documents/`, `POST documents/upload/`, `GET documents/trash/`, `GET/PATCH/DELETE documents/<id>/`, `POST documents/<id>/reupload|restore|lock/`, `DELETE documents/<id>/permanent/`, `GET documents/<id>/versions|activity/`, `POST documents/<id>/share/`, `GET documents/<id>/shares/`, `DELETE documents/<id>/share/<lid>/`, `GET search/`, `GET shared/<slug>/`.

### 7.18 Docs editor

**What.** Notion-style pages (`/docs`, `/docs/:docId`; `pages/docs/DocsPage.tsx`, `components/docs/*`). Creators and talents only (`IsDocUser`).

**How it works.**
- A page is a `Doc` with a title, emoji icon, and a **BlockNote** block-JSON `content`; pages nest (`parent`) to form a tree shown by `DocTree`, and can live in a library folder or be tied to a project.
- List shows the user's own docs plus docs shared with them (`?all=1` returns the whole tree, `?folder_id=` filters).
- **Permissions:** owner can do everything; a `viewer` can read; an `editor` can edit; only the owner can delete, share or list children.
- **Sharing:** by email with `viewer`/`editor` (`DocShareModal`, `POST docs/<id>/access/`; changing an existing grant updates it), revoke with `DELETE`; a people-search endpoint (`users/search/?q=`, minimum two characters) feeds the picker.
- **Export:** Markdown, PDF and Word (`lib/docExport.ts`, using `html-to-docx`).
- The tree refreshes every 10 seconds while a doc is open so title changes propagate.
- Trying the docs feature marks a Quick Start step complete.

**Endpoints (v8).** `GET/POST docs/`, `GET/PATCH/PUT/DELETE docs/<id>/`, `GET docs/<id>/children/`, `GET/POST docs/<id>/access/`, `PATCH/DELETE docs/<id>/access/<aid>/`, `GET users/search/`, `GET sharable-users/`.

### 7.19 CRM sheets

**What.** A spreadsheet-style contact tool (`/library/crm`, `pages/tools/CRMBuilder.tsx`, `hooks/useCRM.ts`), reachable through the Files area and through nav entries labelled "CRM" for talents and clients.

**How it works.** A **sheet** has typed **columns** (`text`, `email`, `phone`, `url`, `number`, `date`, `single_select`, `multi_select`, `checkbox`; select columns store their `options`) and **rows** whose `values` JSON is keyed by column. Sheets can sit in a library folder and be favourited.

**Permissions.** The **owner** can do everything, including renaming/deleting the sheet and managing access. A user with `editor` or `admin` access can create/edit/delete columns and rows; `viewer` is read-only (403 "read-only access"). Users without access get 404. Only the owner manages the access list, sharing with hired talent and onboarded clients (`GET sharable-users/`, creators only).

**Endpoints (v7).** `GET/POST sheets/` (`?folder_id=`), `GET/PATCH/PUT/DELETE sheets/<id>/`, `GET/POST sheets/<id>/columns/`, `GET/PATCH/DELETE sheets/<id>/columns/<cid>/`, `GET/POST sheets/<id>/rows/`, `GET/PATCH/DELETE sheets/<id>/rows/<rid>/`, `GET/POST sheets/<id>/access/`, `GET/PATCH/DELETE sheets/<id>/access/<aid>/`, `GET sharable-users/`.

### 7.20 Global search

`GET /api/v8/search/?q=` (minimum two characters), surfaced as the search box / ⌘K palette in the top bar (`hooks/useGlobalSearch.ts`). It returns up to 8 results in each of: **docs** (own, title + content), **files** (creator's own or client's own, name + tags), **projects** (creator's, client's memberships, or a talent's), **talents** (creators and clients only; results link to `/messages?user=<id>`), **CRM sheets** (own + shared). Results carry a `route` to open. See Known issues about talent project results.

### 7.21 Settings

`/settings` (`pages/Settings.tsx`) has: **Profile** (name, email, bio; picture; links to the role-specific profile editors), **Notifications** switches (backed by `UserSettings`), **Sound & vibration** switches (vibration, tap sounds, message & notification sounds — stored **per device** in the browser), **Account stats**, and a **Danger Zone** to delete the account.

**Endpoints.** `GET/PATCH /api/v1/settings/`, `PATCH /api/v1/settings/profile/`, `GET /api/v1/account/stats/`, `DELETE /api/v1/account/delete/`.

### 7.22 Sound and vibration feedback

`lib/feedback.ts`. A tiny Web Audio synthesiser (no audio files) plus `navigator.vibrate`. Three independent preferences, stored in `localStorage` (`onswift_feedback`), all **on by default**:

| Preference | Controls |
|---|---|
| **Vibration** (`haptics`) | Short vibration patterns (Android/desktop browsers that support it; iPhones do not allow web vibration) |
| **Sounds** (`sound`) | Soft tones for taps, swipes, success and error |
| **Message & notification sounds** (`alerts`) | The `send`, `message` and `notify` sounds — separate so silencing tap sounds does not silence alerts |

**Where it fires.** A subtle tap from the shared `Button`, `Switch`, `Checkbox` and `TabsTrigger` (buttons accept `feedback={false}` to opt out); a swipe tone when a swipe crosses its threshold; success when a task reaches Completed; error on a rejected sync; **send** when you send a message, **message** when a poll brings in someone else's message, **notify** for a new unread notification. Taps/swipes are rate-limited (40 ms) so they never stack; success/error/alerts always play. Browsers only allow sound after the user has interacted with the page, and background tabs may delay polling, so an alert can arrive late or be missed there.

### 7.23 Google Calendar sync

**Backend (complete).** A user connects Google Calendar by posting their OAuth tokens (`GoogleCalendarToken`), after which tasks with a deadline can be created as calendar events (`google_calendar.py`, scope `calendar.events`, with automatic token refresh). Endpoints: status, connect, disconnect (removes tokens and synced records), sync one task, sync all tasks, unsync a task, list synced tasks.

**Frontend.** `components/calendar/GoogleCalendarSync.tsx` implements the dialog and calls those endpoints, but it is **not mounted on any page** in the current build, so users cannot reach the feature from the UI. (Reinstating it means rendering that component, for example from the Deadlines page.) See Known issues about access checks on the sync endpoints.

**Endpoints (v2).** `GET calendar/status/`, `POST calendar/connect/`, `DELETE calendar/disconnect/`, `POST calendar/sync/`, `POST calendar/sync-all/`, `DELETE calendar/unsync/<task_id>/`, `GET calendar/synced/`.

### 7.24 Talent marketplace

`/talent` (`pages/TalentMarketplace.tsx`, signed-in route): a directory of talents fetched from the public `GET /api/v1/user/talentprofile/`, with category filters (Design, Video, Audio, Dev, 3D, Photo, Writing) and freelancer cards. "Hire" opens a **coming-soon** modal. The route exists but appears in no sidebar (the entry is commented out); the individual talent profile page is likewise disabled.

### 7.25 Dashboards and greeting

`/dashboard` chooses by role (`pages/Dashboard.tsx`):

- **Creator** (`DashboardCreator.tsx`): the three nearest-due active projects, stat cards, **My Tasks**, and the team list.
- **Talent** (`DashboardTalent.tsx`): stat cards (completed, pending, active projects), **My Tasks**, the **Next Deadline clock**, an "Upcoming Deadlines" list (five soonest), a recent-activity area, and a profile-completion banner.
- **Client** (`ClientProjects.tsx`): "Your Projects", an overview and quick access.

**Greeting.** Each dashboard opens with a short line chosen from the viewer's local time of day (`lib/greeting.ts`): morning 05–11, afternoon 12–16, evening 17–20, night 21–04, each with a small pool of playful lines ("Rise and shine, Ada", "What's on your mind, Ada?", "Golden hour, Ada", "Welcome, night owl"). The line is picked by day and day-part, so it's stable within a part of the day and changes across days; names longer than 16 characters are trimmed; without a name the name is left out.

### 7.26 Quick Start, celebrations and banners

- **Quick Start launcher** (`components/quickstart/*`, `hooks/useQuickStart.ts`): a floating checklist for creators — create a project, add a task, invite a teammate, try Docs, create an onboarding form — with completion tracked by `localStorage` flags.
- **Celebrations**: first project, first task, first invite (creator); first project done, first attachment sent, first approval (talent) — small modal moments (`CelebrationModal`), each shown once per browser.
- **Creator upsell bar** (`components/layout/CreatorUpsellBar.tsx`): talent and client accounts see a dismissible top bar inviting them to create their own creator account (opens `/signup/creator`); dismissal is remembered per user.
- **Profile completion banner** on the talent dashboard.

### 7.27 Blog and CMS

A separate content system on **Supabase**, unrelated to the Django backend.

- **Public blog**: `/blog` (list) and `/blog/:slug` (post) render posts from the Supabase tables `blog_posts` and `blog_categories`, track views in `blog_post_views`, and render HTML or Markdown bodies (`components/blog/*`).
- **Admin CMS**: `/admin/login`, `/admin/dashboard`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/categories`, guarded by `AdminAuthContext` + `AdminProtectedRoute` using **Supabase Auth** (create admin users in the Supabase dashboard). Posts have a draft/published status, category, tags, cover image and excerpt; the editor can keep local drafts (`onswift_blog_draft_<id>`).
- **If the blog breaks**, check that the Supabase project isn't paused (free-tier projects pause when idle; a paused project stops resolving DNS, which shows up as network errors on `/blog`). Nothing in the code needs to change.

### 7.28 Marketing site and analytics tooling

`/` shows the marketing **Landing** page (`pages/Landing.tsx`) to signed-out visitors and redirects signed-in users to `/dashboard`. The sign-up wizard records lead data to Firestore (`lib/firebase.ts`, used from `SignUp.tsx` only). **PostHog** (`lib/posthog.ts`, `PageTracker`) tracks page views and events and identifies users at login/sign-up; **Vercel Analytics** is mounted in `App.tsx`. An `AnalyticsContext`/`useAnalytics` layer wraps event capture.

---

## 8. Frontend architecture

### Provider tree (`src/App.tsx`, outer → inner)

```
QueryClientProvider → TooltipProvider → AuthProvider → ProjectProvider → TeamProvider
  → NotificationProvider → ThemeProvider → (toasters, analytics) → BrowserRouter
     → PageTracker → RouteErrorBoundary → Routes
```

`QueryClientProvider` is mounted but **no `useQuery` calls exist**; all data fetching is hand-written (`secureFetch` + effects + polling). `main.tsx` also wraps the app in `GoogleOAuthProvider` and boots PostHog.

### Contexts

| Context | Responsibility |
|---|---|
| `AuthContext` | User session, login/signup/logout, profile updates, password reset, PostHog identify |
| `ProjectContext` | Projects and tasks (fetch, add/update/delete task, duplicate), canonical `Project`/`Task` types, `deriveStatus`, browser copies; providers key on the signed-in user id |
| `TeamContext` | Creator's team list (`/api/v3/team/`), remove member |
| `NotificationContext` | Notification feed, unread count, mark read/delete; 30 s poll; new-item chime |
| `AdminAuthContext` | Supabase session for `/admin/*` only |
| `AnalyticsContext` | Event-capture helpers |

### The HTTP layer (`src/api/apiClient.ts`)

Use only these two functions — never raw `fetch`:
- `publicFetch(endpoint, init)` — unauthenticated (login, sign-up, public forms, marketplace). Adds `Content-Type: application/json` unless the body is `FormData`.
- `secureFetch(endpoint, init)` — attaches the bearer token; **30-second timeout**; on network failure **GET** requests retry twice (1 s, 2 s) while mutations never retry; on **401** it refreshes the token and replays once, and on refresh failure clears the three auth keys and redirects to `/login`. If no token exists on a non-public page it redirects to `/login`.
- `isNetworkError(err)` identifies network-level failures (used to say "slow connection" instead of "failed").

### Browser cache (`src/lib/cache.ts`)

`readCache(key)` / `writeCache(key, data, ttlMs)` store JSON with a TTL (default 10 minutes) under `onswift_cache_<key>`; `clearAllCache()` (called at logout) removes every such key. Screens paint a saved copy first and refresh in the background (stale-while-revalidate). Cached data: project list, per-project tasks (`project-tasks:<id>`), My Tasks (`my-tasks:<userId>`), chat lists and recent messages, analytics per range, reminder settings, notifications (2-minute TTL), deadlines, unread chat count, deadline count, and more. Storage failures are swallowed.

### Notable libraries in `src/lib`

| File | Purpose |
|---|---|
| `syncQueue.ts` | Write-behind queue for task status changes (7.7) |
| `taskStages.ts` | `stageAction` — role rules for moving a task between stages |
| `nextDeadline.ts` | `deadlineInstant`, `pickNextDeadline` — the single Next Deadline rule |
| `feedback.ts` | Sounds and vibration (7.22) |
| `greeting.ts` | Time-of-day dashboard greeting (7.25) |
| `cache.ts` | Browser cache (above) |
| `api.ts` | `mapFromBackend` — backend→frontend project/task mapping |
| `docExport.ts` | Doc export to Markdown/PDF/Word |
| `uploadError.ts` | Friendly upload-failure messages (network/5xx → "use the link option") |
| `libraryFolders.ts`, `fileIcons.ts` | Library helpers |
| `inviteTemplates.ts`, `inviteUtils.ts` | Invite link/message helpers |
| `loadingGate.ts` | Minimum "processing" display time |
| `supabase.ts`, `firebase.ts`, `posthog.ts` | Third-party clients |

### Notable hooks in `src/hooks`

`useTaskDetail` (task detail + comments/attachments/checklists), `useCreatorAnalytics`, `useReminderSettings`, `useNextDeadline`, `useDeadlineCount`, `useUnreadChatCount`, `useCRM`, `useDocs`, `useFolderBrowser`, `useGlobalSearch`, `useQuickStart`, `use-message-gesture` (chat swipe/long-press), `use-swipe-status` (task-card swipe), `use-mobile`, `use-toast`.

### Error handling

`components/ErrorBoundary.tsx` provides `RouteErrorBoundary`, mounted around all routes so a render error shows a recoverable message and resets on navigation instead of blanking the app.

### UI conventions

Tailwind + `cn()` (`lib/utils.ts`), shadcn/ui primitives in `src/components/ui/` (generated — don't hand-edit), toasts via `sonner`, forms via React Hook Form + Zod, `@/` import alias for `src/`, PascalCase for components/pages and kebab-case for hooks.

---

## 9. Backend architecture

- **One Django app per API namespace**, mounted in `core/urls.py`. Django admin at `/admin/` on the API host is unrelated to the frontend's `/admin` CMS route.
- **Serializers** hold business rules (sign-up with invite handling, task create/update side effects, deliverable review effects, hire-request response, form validation).
- **Notifications, email and assistant** are service modules (`notification/services.py`, `utils/email_service.py`, `assistant/services.py`) that views call; email is sent on a **daemon thread** (fire-and-forget) so requests never wait on SMTP.
- **Storage errors** are translated by `core/exceptions.storage_error_guard` into a `503 storage_unavailable` (`StorageUnavailable`) when Cloudinary/network writes fail, so the frontend can show a friendly message.
- **Signals** (`project/signals.py`) keep client memberships in step with task/project completion.
- **Static files** are served by WhiteNoise; `collectstatic` is baked into the Docker image.
- **Media (`/media/`)** is served by Django only when `DEBUG` is true; production media comes from Cloudinary URLs.

---

## 10. Complete API reference

Base URL = `VITE_API_BASE_URL`. All paths below are under `/api/vN/`. "Auth" means a valid bearer token; "Public" needs none. Roles in parentheses restrict beyond that.

### v1 — account (`/api/v1/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `auth/signup/` | Public | Create user + profile; optional talent `invite_token`; returns tokens |
| POST | `auth/login/` | Public | Email + password → tokens |
| POST | `auth/token/refresh/` | Public | Refresh access token |
| POST | `auth/google/` | Public | Verify Google ID token; get-or-create user |
| GET | `auth/user/` | Auth | Current user with nested profile |
| PATCH | `auth/profile/` | Auth | Update name, picture, role-specific profile (multipart) |
| PATCH | `settings/profile/` | Auth | Update name, email, bio |
| GET, PATCH | `settings/` | Auth | Notification + reminder settings (created on first read) |
| GET | `account/stats/` | Auth | Member-since and role-specific counts |
| DELETE | `account/delete/` | Auth | Delete the account (optional `password` check) |
| GET | `user/talentprofile/` | Public | Talent directory |
| POST | `password-reset/` | Public | Email a reset link (always "sent" response) |
| POST | `password-reset-confirm/` | Public | Set a new password from `uid` + `token` |

### v2 — project (`/api/v2/`)

**Projects and samples**

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `projects/` | Auth | List own/assigned projects; create |
| GET, PUT, PATCH, DELETE | `projects/<id>/` | Auth (write: creator) | Project detail/update/delete |
| POST | `projects/<id>/complete/` | Creator (owner) | Complete project; update memberships; notify |
| POST | `projects/<id>/archive/` | Creator (owner) | Archive project + memberships |
| POST | `projects/<id>/duplicate/` | Creator (owner) | Copy tasks/checklists into a new un-started project |
| GET, POST | `projects/<id>/samples/` | Auth | Project samples |
| DELETE | `project-samples/<id>/delete/` | Auth | Remove a sample |

**Tasks**

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `projects/<id>/tasks/` | Creator (all tasks) / talent (assigned; create only if allowed) | List/create project tasks |
| GET | `tasks/<id>/` | Creator/assignee/client | Task detail (deliverables, comments, checklists, attachments) |
| PATCH, PUT, DELETE | `tasks/<id>/` | Creator; talent `PATCH {status: planning\|in-progress}` only | Update/delete |
| POST | `tasks/<id>/request-completion/` | Assignee | Flag for creator approval |
| POST | `tasks/<id>/request-revision/` | Creator | Clear approval flag; notify assignees |
| GET | `my-tasks/` | Auth | Tasks assigned to the user |
| GET | `deadlines/` | Auth | All dated tasks + personal tasks (with `task_time`) |
| GET | `creator/analytics/?range=` | Creator | Analytics |
| GET, POST | `tasks/<id>/comments/` | Creator/assignee/client | Comments (threaded, `mention_ids`) |
| DELETE | `tasks/<id>/comments/<cid>/` | Author or creator | Delete comment |
| GET, POST | `tasks/<id>/attachments/` | Creator/assignee/client | Reference files and links |
| DELETE | `tasks/<id>/attachments/<aid>/` | Uploader or creator | Delete attachment |
| GET, POST | `tasks/<id>/checklists/` | List: any; create: creator | Checklists |
| PATCH, DELETE | `tasks/<id>/checklists/<cid>/` | Creator | Rename/delete checklist |
| GET, POST | `tasks/<id>/checklists/<cid>/items/` | List: any; create: creator | Checklist items |
| PATCH, DELETE | `tasks/<id>/checklists/<cid>/items/<iid>/` | Creator; anyone may toggle `is_checked` | Edit/delete/tick items |

**Personal tasks and reminders**

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `personal-tasks/` | Owner (`?project=`) | List/create personal tasks |
| GET | `personal-tasks/eligibility/` | Auth | Can the user add personal tasks + linkable projects |
| GET, PATCH, DELETE | `personal-tasks/<id>/` | Owner | Detail/update/delete |
| GET, POST | `personal-tasks/<id>/attachments/` | Owner | Files/links |
| DELETE | `personal-tasks/<id>/attachments/<aid>/` | Owner | Remove |
| GET | `reminders/report/` | Auth | Current reminder report |
| POST | `reminders/send-due/` | Cron (`X-Cron-Token`) | Send due email digests |

**Deliverables**

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `deliverables/` | Auth (creator sees project-wide; others their own) | List/submit |
| GET, PATCH, PUT, DELETE | `deliverables/<id>/` | Creator/submitter | Detail/edit title+description/delete |
| PATCH | `deliverables/<id>/review/` | Creator | Approve / request revision |
| GET, POST | `deliverables/<id>/links/` | Submitter/creator | Links |
| PATCH, DELETE | `deliverables/<id>/links/<lid>/` | Submitter/creator | Edit/remove link |
| GET, POST | `deliverables/<id>/files/` | Submitter/creator | Files |
| DELETE | `deliverables/<id>/files/<fid>/` | Submitter/creator | Remove file |

**Direct messages**

| Method | Path | Purpose |
|---|---|---|
| GET | `conversations/` | List conversations |
| POST | `conversations/start/` | Get/create a conversation (`user_id`) |
| GET | `conversations/<id>/messages/` | Messages (oldest first) |
| POST | `conversations/<id>/messages/send/` | Send (`content`, `reply_to_id`) |
| POST | `conversations/<id>/messages/read/` | Mark other party's messages read |
| PATCH | `conversations/<id>/messages/<mid>/edit/` | Edit within 5 minutes (sender) |
| DELETE | `conversations/<id>/messages/<mid>/delete/` | Blank + flag deleted (sender) |

**Groups**

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `groups/` | List/create groups |
| GET | `groups/available-members/` | Team members a creator can add (creator only) |
| GET, PUT, PATCH, DELETE | `groups/<id>/` | Detail; update/delete admin only |
| GET, POST | `groups/<id>/members/` | List; add (admin) |
| DELETE | `groups/<id>/members/<uid>/` | Remove (admin) / leave; last admin protected |
| POST | `groups/<id>/leave/` | Leave the group |
| GET | `groups/<id>/messages/` | Messages |
| POST | `groups/<id>/messages/send/` | Send (`content`, `mention_ids`, `reply_to_id`) |
| POST | `groups/<id>/messages/read/` | Mark all read |
| PATCH | `groups/<id>/messages/<mid>/edit/` | Edit within 5 minutes (sender) |
| DELETE | `groups/<id>/messages/<mid>/delete/` | Delete (sender) |

**Google Calendar**

| Method | Path | Purpose |
|---|---|---|
| GET | `calendar/status/` | Connected? + synced count |
| POST | `calendar/connect/` | Store OAuth tokens |
| DELETE | `calendar/disconnect/` | Remove tokens + synced records |
| POST | `calendar/sync/` | Sync one task (`task_id`) |
| POST | `calendar/sync-all/` | Sync all of the user's tasks |
| DELETE | `calendar/unsync/<task_id>/` | Remove one task's event |
| GET | `calendar/synced/` | List synced tasks |

### v3 — notification (`/api/v3/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `hire-requests/` | Creator | Send a hire request to a talent |
| GET | `hire-requests/received/` | Talent | Pending requests |
| PATCH | `hire-requests/<id>/respond/` | Talent (own pending) | Accept/reject |
| GET | `team/` | Creator | Accepted team members |
| DELETE | `team/<id>/remove/` | Creator | Remove a member |
| GET | `my-creators/` | Talent | Creators who hired the talent |
| GET | `notifications/` | Auth | Feed (also runs the assistant sweep) |
| POST | `notifications/mark-all-read/` | Auth | Bulk mark read |
| DELETE | `notifications/delete-all/` | Auth | Bulk delete |
| DELETE | `notifications/<id>/` | Auth | Delete one |
| PATCH | `notifications/<id>/read/` | Auth | Mark one read |
| POST | `invites/generate/` | Creator | Create an invite token (emails it if an address is given) |
| GET | `invites/validate/<token>/` | Public | Validate a token |
| POST | `invites/accept/<token>/` | Talent | Join the creator's team |

### v4 — onboarding (`/api/v4/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `templates/` | Creator | List/create onboarding templates |
| GET, PATCH, DELETE | `templates/<id>/` | Creator | Template detail |
| GET | `instances/` | Creator | List links (`?template_id=`, `?status=`) |
| POST | `instances/create/` | Creator | Generate a link (template must have a project) |
| GET | `instances/<id>/` | Creator | Link detail |
| GET | `clients/<client_id>/submissions/` | Creator | A client's completed submissions |
| GET | `onboard/<slug>/` | Public | Fetch form; marks OPENED |
| POST | `onboard/<slug>/submit/` | Public | Client signs up + submits (atomic) |
| POST | `onboard/<slug>/upload/` | Public | Upload a file for a `file_upload` block (≤10 MB) |
| GET | `my-submissions/` | Auth | The client's own submissions |
| GET, POST | `forms/` | Creator | Standalone forms |
| GET, PATCH, DELETE | `forms/<id>/` | Creator | Form detail |
| GET | `forms/<id>/responses/` | Creator | Responses |
| GET | `forms/<id>/responses/<rid>/` | Creator | One response |
| GET | `f/<slug>/` | Public | Fetch a standalone form |
| POST | `f/<slug>/submit/` | Public, throttled 10/h | Submit a response |
| POST | `f/<slug>/upload/` | Public, throttled 20/h | Upload a file (≤10 MB) |

### v5 — portal (`/api/v5/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `projects/` | Client | Projects the client can access |
| GET | `projects/<id>/` | Client (member) | Project dashboard + last 50 messages |
| GET | `projects/<id>/messages/` | Creator (owner) / client (member) | Thread (`?before=&limit=`) |
| POST | `projects/<id>/messages/send/` | Creator/client | Send text and/or file |
| POST | `projects/<id>/messages/read/` | Creator/client | Mark others' messages read |
| GET | `projects/<id>/messages/unread/` | Creator/client | Unread count |
| GET, POST | `projects/<id>/invites/` | Creator (owner) | List / create client invites |
| DELETE | `projects/<id>/invites/<iid>/` | Creator (owner) | Delete an invite |
| POST | `projects/<id>/add-client/` | Creator (owner) | Add an existing client directly |
| GET | `invites/<token>/` | Public | Invite details (404/410/400 for missing/expired/used) |
| POST | `invites/<token>/accept/` | Public | Accept + submit responses |
| GET | `clients/history/` | Creator | All clients with project counts |

### v6 — library (`/api/v6/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `folders/` | Creator/talent (own + shared) | List (`?parent_id=`, `?type=`) |
| POST | `folders/create/` | Creator | Create a folder |
| GET, PATCH, DELETE | `folders/<id>/` | Owner/grantee; delete owner | Contents, rename/move, delete |
| GET, POST | `folders/<id>/access/` | Owner (post) / any with access (get) | Share by email (`viewer`/`editor`) |
| PATCH, DELETE | `folders/<id>/access/<aid>/` | Owner | Change/revoke |
| GET | `sharable-users/` | Creator | Team talents to share with |
| GET | `documents/` | Creator (own) / client (own) | List (`?folder_id=`) |
| POST | `documents/upload/` | Creator | Upload (auto-version by name) |
| GET | `documents/trash/` | Creator | Deleted in last 30 days |
| GET, PATCH, DELETE | `documents/<id>/` | Creator | View (logged), update, soft-delete |
| POST | `documents/<id>/reupload/` | Creator | New version |
| POST | `documents/<id>/restore/` | Creator | Restore from trash |
| DELETE | `documents/<id>/permanent/` | Creator | Permanent delete |
| GET | `documents/<id>/versions/`, `…/activity/` | Creator | History, activity |
| POST | `documents/<id>/share/` | Creator | Create share link |
| GET | `documents/<id>/shares/` | Creator | List share links |
| DELETE | `documents/<id>/share/<lid>/` | Creator | Revoke |
| POST | `documents/<id>/lock/` | Creator | Toggle lock |
| GET | `search/?q=` | Creator/client | Name/tag search |
| GET | `shared/<slug>/` | Public | Shared file info (410 when expired) |

### v7 — crm (`/api/v7/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `sheets/` | Auth | List accessible (`?folder_id=`) / create |
| GET, PATCH, PUT, DELETE | `sheets/<id>/` | Access; write: owner | Sheet with columns/rows |
| GET, POST | `sheets/<sid>/columns/` | read: access; write: owner/editor/admin | Columns |
| GET, PATCH, PUT, DELETE | `sheets/<sid>/columns/<id>/` | same | One column |
| GET, POST | `sheets/<sid>/rows/` | same | Rows |
| GET, PATCH, PUT, DELETE | `sheets/<sid>/rows/<id>/` | same | One row |
| GET, POST | `sheets/<sid>/access/` | Owner | Sharing |
| GET, PATCH, PUT, DELETE | `sheets/<sid>/access/<id>/` | Owner | One grant |
| GET | `sharable-users/` | Creator | Team + clients to share with |

### v8 — docs and search (`/api/v8/`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `docs/` | Creator/talent | List (own + shared; `?all=1`, `?folder_id=`) / create |
| GET, PATCH, PUT, DELETE | `docs/<id>/` | Owner; grantees read/edit | Doc; viewers cannot edit; only owner deletes |
| GET | `docs/<id>/children/` | Owner | Child pages |
| GET, POST | `docs/<id>/access/` | Grantee (get) / owner (post) | Share by email |
| PATCH, DELETE | `docs/<id>/access/<aid>/` | Owner | Change/revoke |
| GET | `users/search/?q=` | Creator/talent | Find users to share with (2+ chars) |
| GET | `sharable-users/` | Creator/talent | Team talents |
| GET | `search/?q=` | Auth | Global search (docs, files, projects, talents, CRM) |

---

## 11. Cross-cutting flows

### A. New creator signs up
1. Frontend `POST auth/signup/` → `SignupSerializer` creates `User` + `CreatorProfile`.
2. The assistant sends a welcome DM and conversation.
3. Tokens return; the frontend stores them, fetches `auth/user/`, identifies in PostHog.
4. The creator sees the Quick Start launcher; first project/task/invite fire celebrations.

### B. Talent joins a team by invite
Creator generates a token → invitee opens `/invite/:token` → signs up (`invite_token`) or signs in and accepts → accepted `HireRequest` → creator notified, assistant congratulates the talent → the talent's Chats show a welcome and, once tasks are assigned, their dashboard fills.

### C. Task assigned → three deliveries from one call
`TaskSerializer` → `create_notification(priority=1)` → (1) bell notification, (2) assistant chat mirror, (3) HTML email.

### D. A talent finishes work
Start the task (instant, saved locally, synced in the background) → do the work → gate: attach work (deliverable) **or** request approval → creator is notified → creator approves (task completed, recurrence spawns) or requests revision (talent notified, flag cleared).

### E. Client onboarding
Template (with project) → link → client opens (status OPENED, creator notified) → fills and uploads → submit: user created, instance completed, membership created, client folders ensured, creator notified, JWT returned → client lands on their project.

### F. Deadline nudge
Any signed-in browser polls notifications → the endpoint triggers the assistant sweep (≤ every 5 minutes) → tasks due in under 2 hours get one nudge per assignee → a reply within 24 hours is relayed to the creator.

### G. Reminder digest
An external scheduler calls `POST reminders/send-due/` with `X-Cron-Token` (e.g. hourly) → each opted-in user whose local time has passed their chosen time on a scheduled day, and who hasn't been emailed today, gets a digest of overdue / today / this week / needs-action items.

---

## 12. Storage, email and third-party services

| Service | Use | Notes |
|---|---|---|
| **Neon (Postgres)** | Production database | `DATABASE_URL`, SSL required |
| **Cloudinary** | All uploaded media | `RawMediaCloudinaryStorage` (accepts PDFs, docs, zips); failures → 503 |
| **Hostinger SMTP** | All email | Threaded, fire-and-forget; transactional volume only |
| **Google (OAuth + Calendar)** | Sign-in and calendar sync | `GOOGLE_CLIENT_ID/SECRET` |
| **Supabase** | Blog CMS data and `/admin` auth | Separate from the Django backend |
| **Firebase Firestore** | Sign-up wizard lead analytics only | |
| **PostHog** | Product analytics | |
| **Vercel Analytics** | Web analytics | |
| **Cloud Run / Vercel** | Backend / frontend hosting | See §13 |

---

## 13. Deployment and CI/CD

**Backend → Google Cloud Run.** `backend/core/Dockerfile` builds a `python:3.11-slim` image, installs requirements (normalising the file's encoding), runs `collectstatic`, and starts `gunicorn core.wsgi:application --workers 2 --threads 4 --timeout 60` on `$PORT` (8080 by default). A `Procfile` (`web: gunicorn core.wsgi:application`) also exists for Procfile-style hosts.

**Frontend → Vercel.** `vercel.json` rewrites every path to `/` so the SPA router handles it.

**Pipeline** (`.github/workflows/main.yml`, on push/PR to `main` and `feature-branch`, or manually):
1. **backend-tests** — Python 3.11, install, `python manage.py test`.
2. **backend-deploy** — only on `workflow_dispatch` or a push to `main`, after the tests: run `python manage.py migrate --noinput` against the production database first, then deploy `backend/core` to the Cloud Run service `onswift-backend` using Workload Identity Federation. Migrations must stay additive/backward-compatible because the previous revision keeps running while the new one rolls out.
3. **frontend-build-and-deploy** — Node 20, `npm ci`, `npm test`, then `vercel pull` → `vercel build` → `vercel deploy --prebuilt`.

Repository secrets used: `DJANGO_SECRET_KEY`, `DATABASE_URL`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_REGION`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

**Production checklist.** Set `SECRET_KEY`, `ALLOWED_HOSTS` (include the Cloud Run host), `DATABASE_URL`, Cloudinary and SMTP credentials, `FRONTEND_URL`, Google credentials, and `DIGEST_CRON_TOKEN`; add the frontend origin to `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` in `settings.py` (these lists are hard-coded); schedule the digest call; run migrations before deploying code that needs them.

---

## 14. Testing

**Frontend** (`npm test`, Vitest + jsdom + Testing Library): unit and component tests colocated with the code, covering — among others — `deriveStatus`, the sync queue (coalescing, persistence, retries, drop-on-403), feedback preferences and alert sounds, task-stage rules, the swipe hook, the My Tasks card (role-aware controls), `nextDeadline`, `greeting`, the unread-chat-count chime, `AttachmentsSection`, `UploadDeliverableModal`, the countdown circle, the error boundary, the Forward-message modal, the Messages page, and the document library.

**Backend** (`python manage.py test`): Django `TestCase` suites in `account`, `crm`, `docs`, `library`, `notification`, `onboarding`, `portal` and `project` (`tests.py` plus `test_conversations.py`, `test_deadlines.py`, `test_personal_tasks.py`, `test_personal_task_attachments.py`, `test_project_status.py`, `test_reminders.py`, `test_talent_task_status.py`). Tests run with **local-disk file storage** so they never touch Cloudinary. `assistant` has no dedicated test module.

`TESTING_GUIDE.md` is an older, manual-testing guide focused on invites and notifications.

---

## 15. Frontend route table

| Route | Who | Component |
|---|---|---|
| `/` | Public (signed-in users redirect to `/dashboard`) | Landing |
| `/login`, `/signup`, `/signup/creator`, `/signup/talent`, `/forgot-password`, `/reset-password/:uid/:token`, `/auth/google/callback` | Public | Auth pages |
| `/invite/:token` | Public | Team invite (`InvitePage`) |
| `/onboard/:slug` | Public | Client onboarding form |
| `/f/:slug` | Public | Standalone form fill |
| `/blog`, `/blog/:slug` | Public | Blog |
| `/admin/login`, `/admin/dashboard`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/categories` | Supabase admins | Blog CMS |
| `/dashboard` | All (role-branched) | Creator / Talent / Client dashboard |
| `/projects`, `/projects/:id` | All (client gets client pages) | Projects, project detail |
| `/projects/:projectId/messages` | Client (and creator via modal) | Project thread |
| `/calendar` | All | Deadlines |
| `/analytics` | Creator | Analytics |
| `/messages` | All | Chats |
| `/settings` | All | Settings |
| `/notifications` | All | Notification page (nav entry hidden) |
| `/team` | Creator | My Team |
| `/onboarding`, `/onboarding/new`, `/onboarding/:id`, `/onboarding/clients` | Creator (clients see their Client Portal at `/onboarding`) | Onboarding |
| `/forms`, `/forms/new`, `/forms/:id`, `/forms/:id/responses`, `/forms/:id/responses/:responseId` | Creator | Standalone forms |
| `/profile/edit`, `/deliverables` | Talent | Profile, My Attachments |
| `/profile/creator/edit` | Creator | Creator profile |
| `/library`, `/library/crm` | All | Files, CRM |
| `/docs`, `/docs/:docId` | Creator/talent | Docs |
| `/talent` | Signed-in | Marketplace (no nav link) |
| Legacy: `/portal*` → `/projects*`; `/tools/crm` → `/library/crm` | — | Redirects |

**Sidebar navigation by role** (`AppSidebar.tsx`)
- **Creator:** Workspace, Projects, Analytics, Teams, Chats, Client Portal, Forms, Files, Deadlines.
- **Talent:** Dashboard, My Profile, My Projects, Chats, My Files, CRM, Deadlines.
- **Client:** Workspace, Chats, Client Portal, Docs, CRM, Deadlines.
- All roles: Settings. Badges show unread chats and imminent deadlines.

---

## 16. Browser storage keys

Everything the app writes starts with `onswift_` except where noted. None of the flag keys are namespaced per user, so two accounts on one browser share them (the creator-upsell dismissal is per user).

| Key | Purpose |
|---|---|
| `onswift_access`, `onswift_refresh`, `onswift_user` | Session (cleared at logout / auth failure) |
| `onswift_cache_<key>` | TTL cache (cleared at logout by `clearAllCache`), including `onswift_cache_sync_queue` |
| `onswift_feedback` | `{sound, haptics, alerts}` |
| `onswift_celebrated_first_project` / `_first_task` / `_first_invite` | First-milestone celebrations |
| `onswift_quickstart_docs` / `_onboarding` / `_dismissed` / `_rewarded` / `_open` | Quick Start progress and state |
| `onswift_talent_first_deliverable`, `onswift_talent_deliverable_approved`, `onswift_talent_project_done` | Talent celebrations |
| `onswift_form_draft_<id>`, `onswift_standalone_form_draft_<id>`, `onswift_blog_draft_<id>` | Editor drafts |
| `onswift_visitor_id`, `onswift_customer` | Analytics/marketing identifiers |
| `creator-upsell-dismissed:<userId>` | Creator upsell bar dismissed |

---

## 17. Polling inventory

There are no websockets; these timers are why the network tab is never quiet.

| What | Interval | Where |
|---|---|---|
| Notification feed (also triggers the assistant sweep) | 30 s | `NotificationContext` |
| Unread chat count (conversations + groups) | 30 s | `useUnreadChatCount` |
| Open direct/group chat messages | 5 s | `Messages.tsx` |
| Client project thread (page and modal) | 5 s | `ClientMessages`, `ClientChatModal` |
| Client project list + unread counts (client Chats) | 30 s | `Messages.tsx` |
| Deadlines page data | 30 s (tab visible) | `Calendar.tsx` |
| Next Deadline data (Talent dashboard) | 30 s (tab visible) | `useNextDeadline` |
| Client invites table | 30 s | `ClientInvitesTable` |
| Onboarding link table | 10 s | `OnboardingLinkTable` |
| Docs tree (while a doc is open) | 10 s | `DocsPage` |
| Offline sync queue flush | 15 s (plus on `online`/visible) | `syncQueue` |
| Countdown clock tick | 1 s | `CountdownCircle` |

---

## 18. Conventions for contributors

**Backend**
- New domain → new Django app mounted at the next `/api/v9/` in `core/urls.py`; otherwise extend the owning app.
- Anything that should notify a user goes through `notification.services.create_notification` (never `Notification.objects.create`); use `priority=1` for the assistant-chat mirror and `link=` to make it clickable.
- Programmatic assistant messages: `assistant.services.send_assistant_message`.
- Role checks: prefer permission classes in the style of `portal/permissions.py` over inline `user.role` checks.
- File writes: wrap the storage call in `storage_error_guard()`.
- Schema changes must be additive (CI migrates the live database before deploying new code).

**Frontend**
- Route in `App.tsx`; navigation entry in the right role array in `AppSidebar.tsx`.
- HTTP only through `secureFetch` / `publicFetch`. Reuse `Task`/`Project` from `ProjectContext`; don't define your own.
- Use `readCache`/`writeCache` for saved copies (keys are wiped at logout), and the sync queue only for task status changes.
- Long text in bubbles/inputs: `min-w-0`, `break-words`, `[overflow-wrap:anywhere]`.
- Make surgical changes; keep edits to the lines that matter.

---

## 19. Planning documents in this repo

Root-level `.md` files are historical planning/design documents, not living documentation:

| File | What it is |
|---|---|
| `ONSWIFT_INFRASTRUCTURE_FOR_DOCS.md` | A July 2026 architecture atlas. Useful background; **parts are out of date** (for example the `SECRET_KEY`/`ALLOWED_HOSTS` concerns, the Render hosting and the Celery dependency it describes have since changed) — this README is authoritative |
| `BACKEND_ARCHITECTURE.md` | An early backend requirements document (includes a WebSocket design that was never built) |
| `TESTING_GUIDE.md` | Manual testing guide for invites and notifications |
| `MEETING_TRANSCRIPTION_PLAN.md` | Plan for a meeting-transcription feature (not built) |
| `WEB_PUSH_NOTIFICATIONS_PLAN.md` | Plan for Web Push to reduce polling (not built) |

---

## 20. Known issues and limitations

Verified against the code at the time of writing; none of these is fixed by this document.

### Behaviour that doesn't work as it appears

1. **Client portal invite emails link to a page that doesn't exist.** `ClientInviteCreateView` emails `FRONTEND_URL/client/invite/<token>`, but `App.tsx` has no such route (`InviteAccept` is commented out; `/invite/:token` is the *talent* team invite). The copy-link button in `ClientInvitesTable` builds `/invite/<token>`, which validates against the wrong token type. The direct-add and onboarding-form paths work; the emailed portal invite does not.
2. **Google Calendar sync has no UI.** The backend and `GoogleCalendarSync.tsx` are complete, but the component is not mounted anywhere.
3. **Global search: talent "projects" results are always empty.** `docs/views.py` filters `Q(tasks__assigned_to=user)`, but the field is `assignees`; the resulting `FieldError` is swallowed by a bare `except`.
4. **Email digests need an external scheduler that isn't configured in the repo.** Until something calls `POST reminders/send-due/` on a schedule, no digest is sent (the in-app report works regardless).
5. **`create_notification` silently discards unknown keyword arguments.** `portal/views.py` passes `related_project=...` (in `ClientDirectAddView`), which is dropped.
6. **Model choices drift from stored values.** `Project.status` has no `archived` choice although the archive endpoint writes it; `Notification.notification_type` choices omit `project_added`; `User.ROLE_CHOICES` omits `assistant`.

### Authorization gaps worth fixing

7. **Google Calendar sync endpoints don't check task access.** `SyncTaskToCalendarView` and `UnsyncTaskFromCalendarView` load a task by id without verifying the caller can see it.
8. **`ProjectSample` list/create is not creator-restricted.** `IsCreator` implements only object-level permission, which list/create views don't invoke.
9. **`ProjectListCreateView.perform_create` has no role check** (creator is set to whoever posts).
10. **Deliverable creation doesn't verify assignment.** The talent-facing UI only offers assigned tasks, but `DeliverableCreateSerializer` accepts any task id from an authenticated user.

### Security posture

11. **JWTs live in `localStorage`** (any XSS can read both tokens; token writing is duplicated across a few components). The 20-minute access lifetime is the mitigation.
12. **`DEBUG` is hard-coded `False`**, including locally (so Django does not serve `/media/` in dev), and `SECRET_KEY` has an insecure dev fallback — production must set it.
13. **CORS and CSRF origin lists are hard-coded** to the production domains plus `localhost:8080`; a new deployment (for example staging) needs them edited.
14. **No token rotation or blacklist**; password-reset and other emails use `FRONTEND_URL`, which must be set.

### Scale and maintenance

15. **No pagination** on notifications, tasks, conversations, library or deadlines; fine for small accounts, a risk as data grows.
16. **Heavy polling** (see §17) and no websockets; many list serializers lack `select_related`/`prefetch_related`.
17. **Unused frontend dependencies**: CKEditor is installed but never imported; `@tanstack/react-query` is mounted but has no queries; Firebase is bundled for a single analytics write.
18. **Dead or unrouted UI/API surface**: the marketplace hire flow ("coming soon"), the public talent profile page, `InviteAccept`, library versioning/lock/search on the frontend, project samples, group-leave/remove-member and project complete/archive on the frontend, the direct hire-request create/list UI.
19. **Test coverage is uneven**: newer features have frontend tests, but the `assistant` backend module has none.
20. **Big components**: `CRMBuilder.tsx`, `Messages.tsx` and `ProjectDetail.tsx` are very large and hard to review in one sitting.
21. **Message editing is limited to 5 minutes on the server; deletion has no time limit.**

