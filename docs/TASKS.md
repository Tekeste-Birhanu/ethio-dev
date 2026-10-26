# Implementation Tasks

## Working rules

- Work on one task at a time, in order, unless a dependency requires otherwise.
- Each task should produce a useful, understandable increment. Explain what it builds and why before starting it.
- Complete each milestone as one coherent feature and make one Git commit for that milestone.
- Mark a task complete only after its acceptance criteria and applicable verification are satisfied.
- After finishing a task, state the next task.

## Status

- **Done** — acceptance criteria met and verified.
- **In progress** — currently being implemented.
- **Not started** — work has not begun.

## Milestone overview

| Milestone | Outcome | Depends on | Status |
| --- | --- | --- | --- |
| M1. Project setup and requirements | A documented, runnable foundation | — | Done |
| M2. Accounts and developer profiles | Users can register, sign in, and maintain profiles | M1 | In progress |
| M3. Opportunity posts | Users can publish and manage collaboration opportunities | M2 | Not started |
| M4. Discover and search | Users can browse opportunities and developers | M3 | Not started |
| M5. Private chat | Accepted chat requests create one-to-one conversations | M2 | Not started |
| M6. Collabspaces and group chat | Teams have a linked shared space and group conversation | M3, M5 | Not started |
| M7. Collaboration requests and invitations | Owners can review requests and invite developers | M3, M4, M5, M6 | Not started |
| M8. Shared taskboard | Members coordinate work with tasks and assignees | M6 | Not started |
| M9. Release readiness | Core flows are polished and ready for release | M1–M8 | Not started |
| M10. Production and deployment | The app is deployed and operational | M9 | Not started |

## M1. Project setup and requirements

**Outcome:** Establish the project foundation and turn approved product and technical decisions into a clear implementation starting point.

- [x] **T-01 — Review and align product requirements.** Check the approved PRD against the agreed product scope and resolve known terminology or flow conflicts.
- [x] **T-02 — Define the application flow.** Document the main routes, navigation, and user journeys.
- [x] **T-03 — Choose the technical architecture.** Record the client/server split, API approach, authentication approach, database, and deployment direction.
- [x] **T-04 — Define the initial data schema.** Document the main entities, relationships, constraints, and normalization approach.
- [x] **T-05 — Plan milestones and implementation tasks.** Organize the build into milestones with small, ordered tasks.
- [x] **T-06 — Establish repository conventions.** Use the documented `client/`, `server/`, and `docs/` layout; follow JavaScript and React naming conventions; use Prettier for formatting and ESLint for code checks. Work on `main` for M1, M9, and M10. Use one branch per milestone for M2–M8, with one commit per milestone.
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

- [ ] **T-15 — Create the opportunity data model and API.** Support the approved post fields, categories, skills, experience, location/work setup, and open/closed state.
- [ ] **T-16 — Build the create-opportunity form.** Provide clear validation for required and optional fields.
- [ ] **T-17 — Build opportunity cards.** Display the post text and key matching information in the social feed style.
- [ ] **T-18 — Add long-post expansion.** Let users expand and collapse long post text inline.
- [ ] **T-19 — Add opportunity editing and deletion.** Allow only the owner to edit or delete their opportunity, with a confirmation before deletion.
- [ ] **T-20 — Add comments and replies.** Support flat comments and replies according to the approved comment rules, including owner-controlled comments on an opportunity.
- [ ] **T-21 — Add save and share actions.** Let users save opportunities and share a stable link that opens the original post.

## M4. Discover and search

**Outcome:** Users can discover opportunities and developers through one Discover area.

- [ ] **T-22 — Build the opportunity feed.** Show public opportunities with pagination or incremental loading and sensible empty/loading/error states.
- [ ] **T-23 — Build the Developers tab.** Show developer cards with profile details relevant to discovery and a link to each profile.
- [ ] **T-24 — Add search across opportunities and developers.** Match the agreed searchable fields, such as post text, name, username, skills, and city.
- [ ] **T-25 — Add relevant filters.** Filter the active Discover tab using supported fields such as skill, city, and experience.

## M5. Private chat

**Outcome:** Users can request a private conversation and communicate after the recipient accepts.

- [ ] **T-26 — Create private chat and message records.** Model a two-person conversation and its message history.
- [ ] **T-27 — Add request-chat action and incoming request handling.** Let a user request a chat; the recipient can accept or decline. Declining sends no notification to the requester.
- [ ] **T-28 — Open chat after acceptance.** Acceptance creates or opens the private conversation and notifies the requester.
- [ ] **T-29 — Build the private chat list and conversation view.** Make Chat clearly accessible and show unread message counts per conversation.
- [ ] **T-30 — Support sending and receiving messages.** Provide the agreed real-time behavior and preserve message history.
- [ ] **T-31 — Add private-chat deletion.** Let either participant delete the private chat with a clear warning; deletion applies to both participants as agreed for MVP.

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
- [ ] **T-38 — Add the Send collaboration request action.** Require a completed profile and prevent duplicate pending requests.
- [ ] **T-39 — Build outgoing request tracking.** Show a user's sent requests and their current status in the profile's Requests area.
- [ ] **T-40 — Build incoming request review.** Show pending requests with the requester's profile available to the owner.
- [ ] **T-41 — Add accept and decline actions.** Let the opportunity owner decide; acceptance notifies the requester and decline does not.
- [ ] **T-42 — Add accepted-request routing.** The owner can accept into private chat or add directly to the linked Collabspace. If the opportunity has no Collabspace, guide the owner to create one before adding the person.
- [ ] **T-43 — Add owner invitations to developers.** Let an owner invite a developer to request a private chat or join the opportunity's Collabspace; the invitee must accept before the relevant access is granted.

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

## Deferred from MVP

- Separate public project showcase pages.
- File attachments and object storage.
- Follow/unfollow, blocking, and unrelated social-feed post types.
- Administrative dashboard.
- Ownership transfer and email change.
- Nearby-developer recommendations.
