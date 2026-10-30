# Implementation Tasks

## Working rules

- Work on one task at a time, in order, unless a dependency requires otherwise.
- Each task should produce a useful, understandable increment. Explain what it builds and why before starting it.
- Complete each milestone as one coherent feature.
- Mark a task complete only after its acceptance criteria and applicable verification are satisfied.
- After finishing a task, state the next task.

## Status

- **Done** — acceptance criteria met and verified.
- **In progress** — currently being implemented.
- **Not started** — work has not begun.

## Milestone overview

| Milestone                                  | Outcome                                                  | Depends on     | Status      |
| ------------------------------------------ | -------------------------------------------------------- | -------------- | ----------- |
| M1. Project setup and requirements         | A documented, runnable foundation                        | —              | Done        |
| M2. Accounts and developer profiles        | Users can register, sign in, and maintain profiles       | M1             | Done        |
| M3. Opportunity posts                      | Users can publish and manage collaboration opportunities | M2             | Done        |
| M4. Discover and search                    | Users can browse opportunities and developers            | M3             | Done        |
| M5. Private chat                           | Accepted chat requests create one-to-one conversations   | M2             | Done        |
| M6. Collabspaces and group chat            | Teams have a linked shared space and group conversation  | M3, M5         | Not started |
| M7. Collaboration requests and invitations | Owners can review requests and invite developers         | M3, M4, M5, M6 | Not started |
| M8. Shared taskboard                       | Members coordinate work with tasks and assignees         | M6             | Not started |
| M9. Release readiness                      | Core flows are polished and ready for release            | M1–M8          | Not started |
| M10. Production and deployment             | The app is deployed and operational                      | M9             | Not started |

## M1. Project setup and requirements

**Outcome:** Establish the project foundation and turn approved product and technical decisions into a clear implementation starting point.

- [x] **T-01 — Review and align product requirements.** Check the approved PRD against the agreed product scope and resolve known terminology or flow conflicts.
- [x] **T-02 — Define the application flow.** Document the main routes, navigation, and user journeys.
- [x] **T-03 — Choose the technical architecture.** Record the client/server split, API approach, authentication approach, database, and deployment direction.
- [x] **T-04 — Define the initial data schema.** Document the main entities, relationships, constraints, and normalization approach.
- [x] **T-05 — Plan milestones and implementation tasks.** Organize the build into milestones with small, ordered tasks.
- [x] **T-06 — Establish repository conventions.** Use the documented `client/`, `server/`, and `docs/` layout; follow JavaScript and React naming conventions; use Prettier for formatting and ESLint for code checks. Work on `main` for M1, M9, and M10.
- [x] **T-07 — Create the client and server project skeletons.** Set up the React/Tailwind client and JavaScript/Express server in the agreed repository structure.
- [x] **T-08 — Add local development configuration.** Add environment examples and the minimum instructions needed to install and run the app locally.

## M2. Accounts and developer profiles

**Outcome:** Users can create accounts, authenticate, and present a complete developer profile.

- [x] **T-09 — Set up the PostgreSQL and Prisma connection.** Configure the server's database connection and migration workflow.
- [x] **T-10 — Implement email and password registration.** Validate credentials, hash passwords securely, and enforce unique email and username values.
- [x] **T-11 — Implement sign-in and session handling.** Add secure cookie-based authentication and sign-out.
- [x] **T-12 — Add Google OAuth sign-in.** Support Google authentication and route first-time users to required profile setup.
- [x] **T-13 — Complete a new user's profile.** Keep registration focused on required account fields, then invite signed-in new members to add optional profile details or skip for now.
- [x] **T-14 — Build profile viewing and editing.** Show public profile information while keeping email private; let users edit their profile and change their password where supported.

## M3. Opportunity posts

**Outcome:** A signed-in developer can publish and manage a public post seeking collaborators.

- [x] **T-15 — Create the opportunity data model and API.** Support the approved post fields, categories, skills, experience, optional collaboration city, and lifecycle status.
- [x] **T-16 — Build the create-opportunity composer.** Require only a description; keep skill tags and other metadata visible and optional.
- [x] **T-17 — Build opportunity cards.** Display the post text and key matching information in the social feed style.
- [x] **T-18 — Add long-post expansion.** Let users expand and collapse long post text inline.
- [x] **T-19 — Add opportunity editing and deletion.** Allow only the owner to edit or delete their opportunity, with a confirmation before deletion.
- [x] **T-20 — Add opportunity comments.** Let signed-in members add flat comments; let authors edit or delete their comments, let opportunity owners delete comments, and let owners turn comments on or off.
- [x] **T-21 — Add save and share actions.** Let signed-in users save and revisit private saved opportunities, and let anyone share a stable link that opens the original post.

## M4. Discover and search

**Outcome:** Users can discover opportunities and developers through one Discover area.

- [x] **T-22 — Build the opportunity feed.** Show public opportunities with pagination or incremental loading and sensible empty/loading/error states.
- [x] **T-23 — Build developer discovery and profiles.** Show developer cards with useful profile details, link to each public profile, and show that developer’s opportunity posts there.
- [x] **T-24 — Add search across opportunities and developers.** Search post text, owner and developer names/usernames, skills, and city from the active Discover tab.
- [x] **T-25 — Add relevant filters.** Filter the active Discover tab using supported fields such as skill, city, and experience.

## M3/M4 follow-up — Opportunity lifecycle

- [x] **T-25a — Add minimal opportunity lifecycle controls.** Let owners pause, resume a paused opportunity, or complete it after confirmation; show completed posts in Discover.

## M5. Private chat

**Outcome:** Users can request a private conversation and communicate after the recipient accepts.

- [x] **T-26 — Create private chat and message records.** Model a two-person conversation and its message history.
- [x] **T-27 — Add request-chat action and incoming request handling.** Let a user request a chat; the recipient can accept or decline. Declining sends no notification to the requester.
- [x] **T-28 — Open chat after acceptance.** Acceptance creates or opens the private conversation and notifies the requester.
- [x] **T-29 — Build the private chat list and conversation view.** Make Chat clearly accessible, show unread message counts per conversation, support direct links to participant-only conversations, return to the list from Chat navigation, and provide the documented per-chat mute control. Mute state belongs to one participant; muted conversations still receive messages and accrue unread counts.
- [x] **T-30 — Support sending and receiving messages.** Provide the agreed real-time behavior and persisted history. Let each sender edit or delete their own messages; broadcast changes to both participants and refresh the preview and unread count after deletion.
- [x] **T-31 — Add private-chat deletion.** Let either participant delete the private chat with a clear warning; deletion applies to both participants as agreed for MVP.

## M6. Collabspaces and group chat

**Outcome:** An opportunity owner can create a linked Collabspace for a team to communicate and coordinate.

- [ ] **T-32 — Create the Collabspace data model.** Link a Collabspace to its opportunity and define owner, admin, and member relationships.
- [ ] **T-33 — Create a Collabspace from its opportunity.** Provide a Create Collabspace action and require a name; keep the opportunity-to-space relationship explicit.
- [ ] **T-34 — Build the Collabspace overview.** Show its linked opportunity, members, group chat, and taskboard entry points.
- [ ] **T-35 — Build Collabspace group chat.** Provide shared member chat with unread counts and message history.
- [ ] **T-36 — Add member and admin management.** Let the owner add or remove members and assign admins; admins manage the Collabspace but cannot edit the opportunity. Preserve the agreed deleted-space display/history behavior.

## M7. Collaboration requests and invitations

**Outcome:** Opportunity owners can review collaboration requests and add accepted developers to the right Collabspace.

- [ ] **T-37 — Create collaboration request records and API.** Associate each request with its opportunity and requester; allow an optional message.
- [ ] **T-38 — Add the Send collaboration request action.** Require a completed profile, allow requests only for Open opportunities in both UI and API, and prevent duplicate pending requests.
- [ ] **T-39 — Build outgoing request tracking.** Show a user's sent requests and their current status in the profile's Requests area.
- [ ] **T-40 — Build incoming request review.** Show pending requests with the requester's profile available to the owner, including requests on Paused opportunities.
- [ ] **T-41 — Add accept and decline actions.** Let the opportunity owner decide; acceptance notifies the requester and decline does not. Completing an opportunity closes its pending requests.
- [ ] **T-42 — Add accepted-request routing.** The owner can accept into private chat or add directly to the linked Collabspace. If the opportunity has no Collabspace, guide the owner to create one before adding the person.
- [ ] **T-43 — Add owner invitations to developers.** Let an owner invite a developer from an Open opportunity to request a private chat or join the opportunity's Collabspace; the invitee must accept before the relevant access is granted. Completing an opportunity closes its pending invitations.

## M8. Shared taskboard

**Outcome:** Collabspace members can organize work in a three-column taskboard.

- [ ] **T-44 — Create task records and milestone grouping.** Organize tasks under milestones and support one assignee per task.
- [ ] **T-45 — Build the three-column board.** Show To do, In progress, and Done, with task cards grouped under their milestone.
- [ ] **T-46 — Add task details and editing.** Expand a task to view and update its details, assignee, and status.
- [ ] **T-47 — Add task creation and milestone controls.** Allow authorized Collabspace members to create tasks and milestones and manage them according to the approved roles.
- [ ] **T-48 — Add drag-and-drop task movement.** Allow tasks to move between status columns and persist the updated status.

## M9. Release readiness

**Outcome:** The MVP's core flows are consistent, accessible, and ready to deploy.

- [ ] **T-49 — Review authorization and privacy.** Verify server-side access checks for profiles, opportunities, requests, chats, Collabspaces, and tasks; confirm private data is not exposed.
- [ ] **T-50 — Complete loading, empty, success, and error states.** Review the main user journeys and make failures understandable.
- [ ] **T-51 — Review responsive and accessible behavior.** Check navigation, forms, dialogs, chat, and taskboard interactions across screen sizes and keyboard use.
- [ ] **T-52 — Run configured verification.** Run the available automated tests, linting, and production builds; fix release-blocking issues.
- [ ] **T-53 — Final product and UI review.** Check the MVP against the approved requirements and remove unfinished or out-of-scope interface elements.

## M10. Production and deployment

**Outcome:** EthioDev is deployed with production configuration and a repeatable release process.

- [ ] **T-54 — Prepare production configuration.** Set production secrets, allowed origins, OAuth callbacks, cookie settings, and service URLs.
- [ ] **T-55 — Deploy the client and API.** Deploy the client to Cloudflare Pages and the Express API to Render.
- [ ] **T-56 — Provision and migrate the production database.** Configure Neon PostgreSQL, run Prisma migrations, and verify connectivity.
- [ ] **T-57 — Verify the live release and document operations.** Check authentication, core user journeys, logs, and recovery steps; document how to release updates.

## Planned follow-up outside M5

- [ ] **T-58 — Build the shared Notifications screen.** After request and invitation flows are available, show activity in one chronological list with unread state and links to each review or chat destination. Until then, M5 acceptance and private-message alerts appear as temporary Chat toasts using polling.

## Deferred from MVP

- Separate public project showcase pages.
- File attachments and object storage.
- Follow/unfollow, blocking, and unrelated social-feed post types.
- Administrative dashboard.
- Ownership transfer and email change.
- Nearby-developer recommendations.
