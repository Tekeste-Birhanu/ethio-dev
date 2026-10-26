# Architecture

## 1. Overview

- **Application:** EthioDev, a collaboration platform for discovering project opportunities and working with other developers.
- **Status:** Draft
- **Architecture style:** JavaScript client and modular Express server in one repository; one deployable backend application.
- **Deployment target:** Cloudflare Pages for the React client, Render for the Express server, and Neon for PostgreSQL. This free-tier setup is for learning and portfolio demonstration; service limits and availability are not production guarantees.
- **Key constraints:** The backend is custom-built with Express. Product UI uses Collabspace terminology. The API and WebSocket connection use the same Express application. File attachments are outside the current MVP scope, so no object-storage service is included.

## 2. Technology stack

| Area | Choice | Notes |
|---|---|---|
| Frontend | React, JavaScript, Tailwind CSS | Located in `client/`; deployed as a static site. |
| Backend | Node.js, Express, JavaScript | Located in `server/`; modular monolith with REST, real-time chat, and taskboard events on the same application. |
| API | REST over HTTP | JSON requests and responses for ordinary application operations. |
| Real-time | WebSocket connection hosted by Express | Used for live chat and taskboard updates; library remains an implementation choice. Changes are persisted in PostgreSQL before they are broadcast. |
| Database / ORM | PostgreSQL, Prisma | PostgreSQL is the source of truth for application data. Prisma schema and migrations describe database changes. |
| Authentication | Password credentials, Google OAuth, and server-managed sessions | Express supports email/username and password sign-in as well as Google OAuth. Both issue the same application session: an opaque session identifier in an HttpOnly cookie, with session records in PostgreSQL. Store only secure password hashes, never plaintext passwords. |
| Hosting / deployment | Cloudflare Pages, Render, Neon | Free-tier portfolio/demo deployment. Frontend and API use separate services; cookie and cross-origin configuration remains open (see Section 9). |
| File storage | None for MVP | Chat supports text and links. Attachments and R2 are excluded. |
| Testing | Tooling undecided | Add automated coverage for authorization, validation, and important multi-record workflows. |

## 3. System boundaries

```text
Browser
  |-- React static application (Cloudflare Pages)
  |      |-- REST / HTTPS -------------------+
  |      `-- WebSocket / WSS ----------------|
  `-- Password sign-in or Google OAuth       |
                                               v
                                    Express application (Render)
                                      |-- REST API
                                      |-- WebSocket chat
                                      |-- OAuth callback and sessions
                                      `-- Prisma data access
                                               |
                                               v
                                    PostgreSQL (Neon)
```

The React client is untrusted and does not connect directly to PostgreSQL. Express validates input, establishes identity, applies authorization and business rules, and persists changes through Prisma. Password authentication or Google OAuth establishes the external identity; EthioDev owns the member profile, session, roles, and product permissions.

## 4. Modules and responsibilities

These are logical backend modules inside one Express application, not separate services.

| Module | Responsibility | Boundary |
|---|---|---|
| Authentication and profiles | Password registration/sign-in/change, Google OAuth callback, session lifecycle, public profile data, profile completion | Store password hashes securely. Never expose authentication email in public profile responses. Email changes are out of MVP scope. |
| Discovery | Opportunity and developer browsing, search, and filters | Return only fields intended for public discovery. |
| Opportunities | Opportunity posts, comments, saves, sharing metadata, and lifecycle | Opportunity owner controls opportunity content and lifecycle. |
| Requests and invitations | Collaboration requests, chat requests, invitations, withdrawal, acceptance, and decline | Enforce duplicate and eligibility rules in trusted server logic and database constraints where applicable. |
| Collabspaces and membership | Space membership, admin roles, archival, and member access | Every protected read and write checks current membership; owner/admin powers follow `PRD.md`. |
| Tasks and milestones | Milestones, tasks, assignments, due dates, and status changes | Enforce admin management rights and assignee status rights on the server. |
| Chat and notifications | Private/group messages, editing/deletion, unread counts, mute settings, and in-app notifications | Persist messages before reporting successful delivery; authorize access to each conversation. The product Chat destination lists private conversations only; group chat is accessed within its Collabspace. |

Modules may call shared domain/service logic and Prisma data access. Keep HTTP route handlers and WebSocket event handlers thin: parse input, authenticate, invoke the relevant operation, and map results/errors to transport responses. Avoid cross-module database writes that bypass the owning module's rules.

## 5. Repository structure

```text
client/                 React application
server/                 Express application
  prisma/               Prisma schema and versioned migrations
  src/
    modules/            Feature modules listed in Section 4
    middleware/         Authentication, validation, and error handling
    shared/             Configuration and small shared server utilities
docs/                   Product and technical documentation
```

This is an initial boundary proposal for the new application. Add folders when implementation needs them; keep the client and server independently runnable while sharing one repository.

### Repository conventions

- Keep application code in `client/` and `server/`, and project documentation in `docs/`.
- Use Prettier for formatting and ESLint for JavaScript code checks. Follow established JavaScript and React naming conventions.
- Work directly on `main` for M1, M9, and M10. For M2–M8, create one branch per milestone and merge its single milestone commit into `main`.

## 6. Key technical decisions

- **ADR-01 - Custom modular monolith:** Use one Express application for the API and chat connection. This supports the goal of learning backend implementation while avoiding microservice operations for the MVP.
- **ADR-02 - REST for application operations:** Use REST for profiles, discovery, opportunities, requests, Collabspaces, tasks, chat history, and notifications. Use WebSockets for live chat delivery and persisted taskboard updates to current Collabspace members.
- **ADR-03 - PostgreSQL with Prisma:** Use relational storage for connected product entities and permission-sensitive workflows. Keep schema changes in Prisma migrations; use database constraints and transactions for integrity-sensitive operations.
- **ADR-04 - Server-managed sessions for both sign-in methods:** Authenticate with email/username and password or Google OAuth, then create an EthioDev session stored in PostgreSQL. Store only a hash of the opaque session ID in the database and put the ID in an HttpOnly, SameSite=Lax cookie; set Secure in production. Sessions expire after 30 days and sign-out revokes the server-side record. Do not store session credentials in browser local storage. Accounts with a password credential can change it; accounts without one do not have an EthioDev password to change. Google OAuth uses the server-side authorization-code flow with state validation and PKCE; request only OpenID, email, and profile scopes.
- **ADR-05 - No attachment storage in MVP:** Do not add R2 or another file-storage service. Chat messages support text and links as specified in the product requirements.
- **ADR-06 - Free portfolio deployment:** Use Cloudflare Pages, Render, and Neon for the initial public demo. Design for service sleep, restarts, and WebSocket reconnects; do not treat the free deployment as a production reliability commitment.
- **ADR-07 - Explicit opportunity-to-Collabspace link:** An opportunity may have no Collabspace after publication. When its owner uses Create Collabspace on that opportunity, persist an explicit one-to-one association (`workspace.opportunityId` referencing the opportunity ID, unique and required once created). Member addition and invitations resolve the linked space through that association, never by name.

## 7. Data and integration flow

An opportunity may exist without a Collabspace. The owner creates the Collabspace from the opportunity's Create Collabspace action and provides its name; the server saves the opportunity ID on the `workspace` record. The unique relationship lets request handling resolve the correct space when the owner adds someone. Deleting an opportunity archives its linked Collabspace only if one exists.

### REST operation

1. The browser sends an HTTPS request with the session cookie when signed in.
2. Express resolves the session and validates the request body, parameters, and query values.
3. The feature module checks permissions and product rules using trusted server-side data.
4. The module performs the required Prisma operations. Use a transaction when a single user action must update multiple related records atomically, such as accepting a request and creating a conversation or membership.
5. Express returns a JSON result or a consistent error response. The client updates its view from the response and may refresh affected data.

### Sign-in and session

For password sign-in, the browser submits credentials to Express over HTTPS; Express verifies the stored password hash. For Google sign-in, Express handles the OAuth callback and finds or creates the EthioDev member. Both methods issue the same application session, and the session cookie is sent on later requests. Protected REST operations and WebSocket connections must resolve the same authenticated member and check current permissions. Local state-changing authentication requests validate the browser Origin against `CLIENT_ORIGIN`; production must set that value to the deployed client origin and finish the cross-origin cookie/CORS arrangement before release. Passwords are never stored in plaintext; OAuth client secrets and session secrets belong in deployment environment configuration, never in the client bundle or source control.

### Chat message

The client loads conversation history over REST. It then opens an authenticated WebSocket connection to Express. On each send, Express validates the message and checks current conversation access, persists the message, and then emits it to authorized connected participants. Unread counts and notification records derive from persisted messages and per-member read state; a live socket event alone is not the source of truth. Clients reconnect and reload missed history after a connection interruption.

### Taskboard update

Task creation and status changes use REST so Express can validate permissions and persist the change through Prisma. After persistence, Express broadcasts the updated task and milestone count to authorized current Collabspace members over WebSockets. Clients reconnect and reload taskboard state through REST after an interruption.

### Permission-sensitive team operation

Express identifies the member from the session, loads the relevant opportunity/Collabspace context, checks current role or membership, validates the requested change, and persists it. Removed or former members must fail authorization on subsequent requests and socket events even if they still have a stale client screen open.

## 8. Cross-cutting requirements

- **Authentication and authorization:** Authentication is shared by REST and WebSocket transports. Enforce all owner, admin, member, assignee, and public-access rules in Express. Hiding a client control is not authorization. Recheck membership for each protected operation; do not rely only on a connection-time role for long-lived sockets.
- **Validation and data integrity:** Treat all client input as untrusted. Validate at the HTTP and WebSocket boundaries. Use PostgreSQL uniqueness, foreign-key, and check constraints where they express durable invariants; use transactions for coupled updates. Keep field and entity definitions in `SCHEMA.md`.
- **Errors and logging:** Return predictable errors without stack traces or secrets. Log operational context such as request ID and operation, but do not log passwords, password hashes, OAuth tokens, cookies, session IDs, message content, or private email unnecessarily.
- **Configuration and secrets:** Read environment-specific configuration from environment variables. Keep a safe `.env.example` in sync with the application. Use separate OAuth credentials and database credentials for local, preview, and production environments where practical.
- **Cookies and cross-origin requests:** Configure credentialed requests only for the intended frontend origin. Use secure cookie settings in production and protect state-changing requests against CSRF. Final cookie/CORS deployment arrangement is open in Section 9.
- **Migrations and recovery:** Commit versioned Prisma migrations. Apply migrations as a deliberate deployment step and keep a recovery/backup path for any database containing data that matters.
- **Real-time reliability:** Treat WebSocket delivery as interruptible. Persist messages and task changes before emitting, make clients reconnect, and reload missed chat or taskboard state through REST. Do not keep essential message, task, or membership state only in server memory.
- **No speculative infrastructure:** The MVP has no separate job queue, cache, microservices, or attachment service. Add these only when a requirement or measured need justifies them.

## 9. Open technical questions

- **Question:** How should the Pages frontend and Render API share the session cookie across their deployment origins?
  - **Impact:** OAuth callback configuration, cookie `SameSite`/`Secure` settings, CORS, CSRF protection, and whether to add a custom domain or same-origin proxy.
  - **Blocking:** Resolve and verify before implementing production sign-in against the deployed frontend/API. Local development can proceed with a documented local cookie/CORS setup.

- **Question:** Which WebSocket library and test tools should the implementation use?
  - **Impact:** Chat event API, reconnect behavior, and test setup.
  - **Blocking:** Not blocking the architecture direction; decide while establishing the server foundation, before implementing chat.
