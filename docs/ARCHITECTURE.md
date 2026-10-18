# Architecture

## 1. Overview

- **Application:** EthioDev, a mobile-friendly collaboration web app for beginner and junior Ethiopian developers.
- **Architecture style:** React single-page application backed by Supabase services, with authorization enforced by PostgreSQL Row Level Security (RLS) and database functions.
- **Deployment target:** Free-tier static frontend hosting (provider deferred); Supabase Free for backend services; Brevo Free for transactional email.
- **Key constraints:** Zero spend; persistent reviewer-created data; public discovery and private collaboration data; realtime text chat and file attachments; free-tier quotas and inactivity behavior.
- **MVP boundary:** Use Supabase for authentication, PostgreSQL, generated APIs, Realtime, and Storage. Do not add Express or Socket.IO in the MVP.

## 2. Technology stack

| Area                  | Choice                                                                 | Reason / status                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend              | React, Vite, JavaScript                                                | Chosen. Browser app is deployed as static assets; provider remains open until deployment.                                                                                                                                           |
| Runtime / package manager | Node.js 24.20.0, npm 11.19.0                                      | Pinned in `.nvmrc` and `package.json` for reproducible local development.                                                                                                                              |
| Backend platform      | Supabase Free                                                          | Chosen for Auth, PostgreSQL, Data API, Realtime, Storage, and limited server-side functions.                                                                                                                                        |
| Database              | Supabase PostgreSQL                                                    | Source of truth for application data, chat messages, membership, permissions, and notifications.                                                                                                                                    |
| Authentication        | Supabase Auth                                                          | Email/password and Google; email verification and password reset. Google provider-verified email satisfies the verification rule.                                                                                                   |
| Realtime              | Supabase Realtime                                                      | Chosen instead of Socket.IO for the MVP. Database rows remain the durable source of truth for chat history.                                                                                                                         |
| File storage          | Supabase Storage                                                       | Attachments are stored as objects, not on an application server filesystem. Enforce a 10 MB per-file app limit, below the Free plan's 50 MB service maximum.                                                                        |
| Transactional email   | Brevo Free, connected to Supabase Auth by custom SMTP                  | Chosen for verification and password-reset email. Brevo-branded sender address is acceptable.                                                                                                                                       |
| Frontend hosting      | Undecided                                                              | Select a free static host at deployment; use its free URL and do not require a purchased custom domain.                                                                                                                             |
| Edge/server functions | None planned for the MVP                                       | Use PostgreSQL functions for atomic business operations with RLS. Reassess only if an in-scope feature requires trusted server execution. |
| Quality tools         | ESLint, Prettier, Vitest, React Testing Library, Playwright            | Chosen. Use Vitest and Testing Library for component/unit coverage; use Playwright for the deployed reviewer journey.                                                                                                                |

## 3. System boundaries

The access rules, storage policies, and trusted function boundaries are captured alongside the logical schema in `SCHEMA.md` and in this architecture. Implement and review them in versioned migrations; no separate authorization or storage specification is maintained.

```text
React + Vite (JavaScript, static frontend; host TBD)
  ├── Supabase Auth: sign-in, Google OAuth, verification, password reset
  ├── Supabase Data API / Postgres: queries and mutations under RLS
  ├── Postgres functions: atomic business operations and invariant checks
  ├── Supabase Realtime: authorized live updates; persisted chat rows are canonical
  ├── Supabase Storage: private buckets under Storage RLS policies
  └── Supabase Auth ── custom SMTP ── Brevo transactional email
```

The browser may contain the Supabase project URL and publishable key. It must never contain a Supabase secret/service-role key, Brevo credential, or other privileged secret. RLS must protect every exposed table and Storage operation because the browser calls Supabase directly.

## 4. Modules and responsibilities

| Module / area                     | Responsibility                                                                                                                                                | Depends on                                                       | Must not do                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| React application                 | Render routes, collect input, call Supabase clients, display realtime updates and recoverable states                                                          | Supabase publishable configuration                               | Treat hidden UI controls as authorization; contain service-role keys or email credentials                 |
| Supabase Auth                     | Identity, session lifecycle, email/password, Google, email verification, password reset                                                                       | Google OAuth configuration; Brevo custom SMTP for email delivery | Decide EthioDev workspace or opportunity permissions                                                      |
| PostgreSQL schema and constraints | Store profiles and all application records; enforce uniqueness, foreign-key integrity, and state constraints                                                  | Supabase PostgreSQL                                              | Depend on a client-supplied role or trust UI validation                                                   |
| RLS policies                      | Enforce public-read, owner, applicant, member, assignee, and admin access rules for exposed data                                                              | Authenticated user identity and relational membership data       | Permit writes only because a route or button is hidden                                                    |
| Database functions                | Perform multi-row state transitions that need a single transaction (for example, accepting a request into a workspace or applying membership-removal effects) | PostgreSQL schema and caller identity                            | Expose privileged operations without validating `auth.uid()` and current state                            |
| Supabase Realtime                 | Deliver authorized chat and notification updates to connected clients                                                                                         | Postgres records and/or private authorized channels              | Act as the durable message store or grant channel access based on client-selected room names alone        |
| Supabase Storage                  | Store profile/opportunity media and attachment bytes with controlled access                                                                                   | Private buckets, Storage RLS, relational ownership, cleanup jobs | Store authorization decisions only in object paths or client metadata; delete object bytes with SQL       |
| Supabase Edge Functions           | Execute narrowly scoped trusted operations requiring server-only credentials or external APIs                                                                 | Auth JWT validation, Supabase services, configured secrets       | Become a second general-purpose backend without a defined need                                            |
| Brevo                             | Deliver transactional verification and password-reset messages from Supabase Auth                                                                             | Supabase Auth SMTP configuration and Brevo account               | Receive app credentials in browser code or send product notifications (MVP notifications are in-app only) |

## 5. Repository structure

The initial React/Vite scaffold is at the repository root. The feature-oriented structure below is the planned direction; keep the scaffold small until a feature needs the additional modules.

```text
src/
  shell/               # App shell, routes, and providers
  features/            # Auth, opportunities, profiles, chat, workspace, tasks, showcase
  lib/                 # Supabase browser client and shared helpers
  components/          # Small UI pieces reused across features
supabase/              # Supabase project configuration and database migrations
  migrations/          # Versioned SQL schema, constraints, indexes, and RLS policies
  functions/           # Optional trusted Edge Functions
```

Keep credentials in deployment environment settings and local ignored environment files. Commit only a placeholder `.env.example` once the required public configuration is known.

## 6. Key technical decisions

- **DEC-01 — Supabase as the MVP backend:** Use Supabase Free for Auth, PostgreSQL, Data API, Realtime, and Storage. This keeps the portfolio MVP within the zero-spend constraint and avoids operating a separate server.
- **DEC-02 — Direct client access guarded by RLS:** React uses the Supabase client directly. Enable RLS on every exposed application table and define least-privilege policies. Validate roles and membership from trusted database records, not editable user metadata or client payloads.
- **DEC-03 — Database functions for atomic business actions:** Put multi-row transitions and invariants in PostgreSQL functions/transactions rather than depending on a sequence of browser requests. Functions must validate caller identity, ownership, membership, email verification where required, and current record state.
- **DEC-04 — PostgreSQL is canonical for chat history:** Save a chat message in PostgreSQL before showing it as sent; use Realtime to deliver new message events. On reconnect, reload history from the database. Realtime delivery alone is not durable history.
- **DEC-05 — Supabase Storage:** Keep object bytes in Storage and relational metadata/ownership references in PostgreSQL. Use private buckets, parent-record RLS for media, membership RLS for attachments, and a 10 MB per-file application limit. Delete object bytes through the Storage API, never by deleting Storage metadata through SQL.
- **DEC-09 — Retriable Storage cleanup:** Trusted database operations enqueue exact object paths and authorized users before lifecycle changes. Authorized clients remove objects through Storage API and acknowledge jobs; RLS revokes read access immediately. With no background worker, byte cleanup retries when an authorized user returns. Guaranteed time-bounded deletion requires revisiting the no-Edge-Function decision. The queue and retry behavior are described in `SCHEMA.md`.
- **DEC-06 — Brevo for auth email:** Configure Brevo as Supabase Auth's custom SMTP provider. Use the currently tested Brevo-branded sender. Do not add email notifications for social events.
- **DEC-07 — Zero-spend deployment:** Use only free plans and free provider URLs; do not enable paid upgrades or add-ons. Supabase Free currently has a 500 MB database quota per project, 1 GB Storage quota across the organization, 5 GB egress, 50,000 monthly active users, 2 million Realtime messages, 200 peak connections, and 500,000 Edge Function invocations. Brevo Free allows up to 300 sends per day. See [Supabase quotas](https://supabase.com/docs/guides/platform/billing-on-supabase), [Realtime limits](https://supabase.com/docs/guides/realtime/limits), and [Brevo limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan). Quotas and provider plans can change, so verify them again before deployment.
- **DEC-08 — Express migration is deferred:** The MVP has no Express or Socket.IO layer. Whether a later Express service would replace only app-specific API logic or replace more Supabase services is intentionally undecided. Keep PostgreSQL constraints and data definitions documented, but do not build speculative compatibility layers now.

## 7. Data and integration flow

### Authenticated application operation

1. React obtains the current Supabase Auth session and sends requests through the Supabase client.
2. Supabase validates the session. PostgreSQL RLS policies use the authenticated identity and trusted relational state to authorize the operation.
3. Simple reads and safe single-row changes use the Data API under RLS. Multi-row state transitions call a database function that validates its preconditions and commits atomically.
4. The client reports success only after Supabase confirms the write. On an ambiguous network failure, refresh current state before retrying to avoid duplicate requests or actions.

### Chat and attachments

1. Confirm conversation participation or workspace membership before permitting message or attachment access.
2. Store message text and attachment metadata in PostgreSQL. Store attachment bytes in Supabase Storage with paths linked to their conversation/workspace.
3. Realtime broadcasts new messages to authorized subscribers. A reconnecting client loads missed history from PostgreSQL.
4. Enforce accepted standard image/document types at upload boundaries and cap each file at 10 MB. Validate MIME/type and size server-side or through trusted Storage policies/functions where supported; never rely only on the file picker.
5. Ending a private collaboration or another specified in-scope deletion removes messages and attachment objects. Make cleanup safe to retry if database and object-storage operations do not complete together.

### Transactional email

Supabase Auth owns verification and password-reset tokens and templates. It sends the transactional messages through configured Brevo SMTP credentials held by Supabase, never by the browser. Social/product notifications remain in-app.

## 8. Cross-cutting requirements

- **Authentication / authorization:** Supabase Auth establishes identity. RLS is the mandatory authorization boundary for direct browser-to-Supabase access. Private Realtime channels and Storage policies must derive access from active membership/conversation participation. UI checks are usability only, never the security control.
- **Verification:** Enforce verified-email requirements in trusted policies/functions for opportunity publishing and join requests. Google accounts count as verified only when Supabase Auth reports the provider-verified email state required by the PRD.
- **Validation:** Validate data in the UI for feedback and again in database constraints/functions or trusted upload operations. Use allowlists for enums, the attachment extensions/MIME types in `SCHEMA.md`, and state transitions.
- **Errors and logging:** Surface actionable errors without leaking private records, tokens, message contents, file contents, or secrets to logs. Do not mark writes successful until confirmed. Handle rate limits, quotas, reconnects, stale state, and paused projects gracefully.
- **Configuration and secrets:** Browser variables may contain only public Supabase URL/key. Store privileged keys, OAuth client secrets, and SMTP credentials in provider-managed secret settings. Never commit real credentials.
- **Realtime durability:** Persist chat and notification records before broadcasting. Treat subscriptions as a live-update mechanism; reload canonical state after reconnect.
- **File privacy and lifecycle:** Use RLS for object reads/writes and keep attachment ownership linked to the protected conversation/workspace. Make object cleanup part of relevant deletion flows through the retriable Storage API queue described in `SCHEMA.md`.
- **Cost controls:** Stay on free plans, watch usage dashboards, and set application limits below provider maximums where practical. When a free quota prevents an operation, show a clear limit/error and do not upgrade automatically.
- **Reliability:** Supabase Free projects may pause after a period of low activity and have no paid-tier availability guarantee. Review demo readiness and service state before a portfolio review.

## 9. Trade-offs and limitations

- Supabase Free currently permits two active projects per owner/admin account, which is enough for production and staging, but its shared free Storage allowance is 1 GB across the organization. An individual free-project upload cannot exceed 50 MB; EthioDev applies a lower 10 MB cap.
- The database quota is 500 MB per active Free project. Exceeding it can make the database read-only; the app must be able to explain write failures rather than silently dropping them.
- Supabase Free does not include automatic database backups. Protect the deployed project with versioned migrations and consider manual exports if reviewer-created data must be recoverable.
- Supabase Free projects can pause after seven days with low database activity. First requests after a pause may be unavailable until the project is restored.
- Brevo Free allows 300 email sends per day and displays Brevo branding on the accepted sender. Delivery/provider limits can change.
- The selected architecture reduces backend operations but creates reliance on Supabase RLS correctness. Policy review is required for every public or private table, Realtime channel, and Storage action.
- Free tiers have no guarantee of sufficient capacity or uptime for production growth. If the portfolio demo exceeds quotas, reduce/clean data or stop the affected operation; paid upgrades are not part of this plan.
- Future Express migration boundaries are not defined. Adding Express later may require moving business logic out of database functions/RLS and reviewing how Auth, Realtime, and Storage remain integrated.

## 10. Deferred technical decisions

- **Frontend host:** Choose a free static hosting provider at deployment. It must support React/Vite assets, HTTPS, and a free provider URL without requiring a purchased domain.
- **Reviewer access:** Support open registration and configure any dedicated reviewer accounts outside source control. Do not seed fictional records or run reset jobs; records reviewers create through the product persist.
- **Future Express scope:** Deferred by user; no decision needed for the Supabase-only MVP.
- **Account deletion:** Out of scope for the MVP; revisit before any implementation in a later version.
