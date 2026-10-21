# EthioDev MVP Task Plan

This backlog breaks the MVP into reviewable implementation steps. Complete tasks in order unless a dependency is listed. Each task should leave the app in a usable, secure state for the slice it covers.

## Milestones

- **M1 — Foundation and app shell:** product foundation, responsive shell, and Supabase baseline (T-01–T-03). **Outcome:** feature work has a runnable, styled app and a configured data platform.
- **M2 — Accounts and profiles:** authentication, verification, password recovery, profiles, skills, locations, and public profile pages (T-04–T-05). **Outcome:** developers can sign in and maintain public profiles.
- **M3 — Discovery and engagement:** developer directory, opportunity feed/search, likes, and threaded comments (T-06–T-07). **Outcome:** visitors can find developers and opportunities; signed-in users can engage.
- **M4 — Opportunities and private collaboration:** opportunity lifecycle, join requests, acceptance, and private chat (T-08–T-10). **Outcome:** creators can recruit collaborators and work together privately.
- **M5 — Projects:** project membership, chat, tasks, milestones, and project lifecycle (T-11–T-14). **Outcome:** teams can coordinate and manage project work.
- **M6 — Showcases and notifications:** public showcases and in-app notifications (T-15–T-16). **Outcome:** teams can present completed projects and users can follow important activity.
- **M7 — Reviewer readiness and release:** reviewer access, hardening, deployment, and end-to-end verification (T-17–T-19). **Outcome:** the deployed MVP is ready for review.

## M1 — Foundation and app shell

### T-01 — Build the product foundation

This task groups the initial technical foundation into modules so each part keeps a clear scope and status.

**Module: Set up the React/Vite project**

- Establish the JavaScript React/Vite app, npm setup, environment example, and documented local start instructions.
- Keep the app runnable from a clean checkout and keep generated dependencies/build output out of source control.
- **Status:** Complete (2026-10-18). Verified with `npm ci`, `npm run dev` (HTTP 200 with the EthioDev page title), and `npm run build` on Node.js 24.20.0 and npm 11.19.0.

**Module: Implement the database schema**

- Implement agreed entities, relationships, indexes, constraints, triggers, and lifecycle invariants from `SCHEMA.md` in versioned SQL migrations.
- Include the agreed city catalog, exclusive “Any level” experience rule, and attachment metadata constraints.
- **Status:** Complete (2026-10-18). The core schema migration was applied and verified with the hosted baseline in T-03.

**Module: Enforce data access and trusted operations**

- Implement deny-by-default RLS policies and trusted PostgreSQL functions using `SCHEMA.md` and `ARCHITECTURE.md`.
- Enforce public-read boundaries, ownership, verified-email gates, request/collaboration transitions, project roles/membership, assignee actions, private-data access, and Realtime authorization.
- **Status:** Complete (2026-10-18). RLS policies and trusted workflows are applied. The three local and remote migration versions match, and the database check found RLS enabled on every public table and `storage.objects`.

**Module: Set up the JavaScript quality toolchain**

- Use Node.js 24.20.0 and npm 11.19.0 with ESLint, Prettier, Vitest, React Testing Library, and Playwright. Keep the application JavaScript-only.
- Document the actual setup and available commands in `README.md`.
- **Status:** Complete (2026-10-18). Lint, formatting, and build commands were verified; test suites have no test files yet.

**Module: Secure file storage and cleanup**

- Implement private buckets, parent-record Storage policies, upload limits and type constraints, and access checks for media and attachments using `SCHEMA.md` and `ARCHITECTURE.md`.
- Queue Storage API cleanup through trusted database operations; no Edge Function/background worker is planned.
- **Status:** Complete (2026-10-18). Hosted buckets passed the migration configuration check; Storage policies and cleanup functions are applied, and RLS is enabled on `storage.objects`.

- **Done when:** all foundation modules are implemented and reviewed. T-03 applies and verifies their migrations in a clean Supabase project.
- **Status:** Complete (2026-10-18). Foundation migrations are applied to the hosted development project; migration history matches and RLS is enabled on all public tables and `storage.objects`.

### T-02 — Build the responsive app shell

- **Depends on:** T-01 project setup module. The shell can proceed while the database modules are being finalized.

- Implement the approved light visual system, shared tokens, accessible form and button styles, and outline icon treatment.
- Add desktop left navigation and mobile bottom tabs, with responsive page containers and loading/empty/error patterns.
- **Done when:** all main MVP areas have a consistent responsive shell following `DESIGN.md`.
- **Status:** Complete (2026-10-18). Added the responsive desktop/mobile navigation shell, shared visual tokens and accessible controls, and discovery empty state. Verified with `npm run lint`, `npm run format:check`, and `npm run build`.

### T-03 — Establish Supabase database baseline

- Add Supabase client configuration and a migration workflow for a hosted development project.
- Integrate and apply the schema, RLS policies, trusted functions, Storage policies, and cleanup operations implemented in T-01 after the app shell is ready.
- **Done when:** a clean development project can be linked and migrated reproducibly, and unauthorized access is denied by default.
- **Status:** Complete (2026-10-18). Linked the hosted development project, passed bucket configuration preflight, applied all three migrations, confirmed matching local/remote migration history, and verified RLS is enabled on every public table and `storage.objects`.

## M2 — Accounts and profiles

### T-04 — Implement authentication and account recovery

**Included module: Implement account registration and sign-in**

- Support email/password and Google sign-in through Supabase Auth.
- Collect a unique, case-sensitive username and display name during sign-up.
- **Done when:** users can register, sign in, sign out, and recover from validation/authentication errors.

**Included module: Implement verification and password recovery**

- Verify email/password registration with a 6-digit one-time code delivered through Brevo; password reset remains an email link.
- Require verified email for publishing opportunities and sending join requests; trust Google’s verified email.
- Preserve the intended destination through verification and password-reset flows.
- **Done when:** verification and recovery work end to end, and verification gates are enforced by trusted policies/functions.

**Status:** Complete (2026-10-18). Email/password, Google OAuth, profile completion, OTP verification and resend, and password recovery are implemented. The profile-creation migration is applied and local/remote migration history matches. The user confirmed Google OAuth, six-digit signup verification, and password recovery work, including staying signed in after updating the password.

### T-05 — Build developer profiles and profile discovery pages

**Included module: Create and edit developer profiles**

- Support required username and display name, plus optional profile fields defined by the PRD/schema.
- Allow signed-in users with incomplete optional profile details to participate.
- **Done when:** users can create and update their own profile and cannot edit another user’s profile.

**Included module: Implement skill catalog and profile skills**

- Let users add skills to their profile; normalize matching without regard to capitalization and reuse existing catalog entries.
- Add new submitted skills to the shared catalog automatically without duplicate capitalization variants.
- **Done when:** skill selection and directory matching use the shared growing catalog consistently.

**Included module: Implement city catalog and profile location**

- Use the predefined city list agreed in T-01, with an “Other” text entry.
- Store and display a selected city or the user’s other-city text consistently.
- **Done when:** profiles can be filtered by standard cities and by an “Other” location without inventing catalog entries.

**Included module: Build public profile pages**

- Show public profile details, skills, city, and relevant public contribution links.
- Provide sensible missing-field and avatar fallback states.
- **Done when:** public profile pages work for signed-out visitors and never expose private account data.

**Status:** Complete (2026-10-18). Implemented profile editing for username, display name, bio, avatar, skills, city/Other, and external links; public profile pages at `/u/:username`; and an authenticated `/settings/profile` route. Profile links open the public view, which loads profile details in one query and renders before the avatar URL finishes loading. Uses the existing profile RLS policies, skill RPC, city catalog, and private image bucket. The user confirmed the profile flow works; lint, formatting, and production build pass.

## M3 — Discovery and engagement

### T-06 — Build public developer and opportunity discovery

**Included module: Build the developer directory**

- List public profiles and support search/filter by skill and city.
- Make directory access public while keeping protected actions behind sign-in.
- **Done when:** a visitor can find and open a developer profile on desktop and mobile.

**Included module: Build opportunity feed posts**

- Present public opportunities as a visual feed with cover image first when available and clear project information.
- Show public opportunity details and engagement in the feed; let readers expand long descriptions inline.
- **Done when:** visitors can read complete opportunities in the feed without navigating to a separate detail page, and private/deleted content is not leaked.

**Included module: Add opportunity search and filters**

- Support keyword search and the agreed filters: project type, experience level, city, and skills where applicable.
- Use predefined choices plus “Other” for categorical opportunity fields; omit commitment filtering.
- **Done when:** filters compose correctly and are usable on mobile.

**Status:** Complete (2026-10-20). Added the public developer directory and searchable opportunity feed. Search and filters cover skills, city, project type, and experience. Lists are paginated and public images are signed from Storage. Discovery reads only public profile fields and undeleted opportunities. Full post reading and engagement stay in the feed. The user confirmed the Supabase data, filter, and signed-out access checks.

### T-07 — Add opportunity likes and threaded comments

**Included module: Add opportunity likes**

- Require sign-in, but not email verification, to like or unlike an opportunity.
- Prevent duplicate likes and display an accurate count and signed-in state.
- **Done when:** likes persist, are private to their owner where appropriate, and update reliably.

**Included module: Add comments and threaded replies**

- Allow signed-in users to comment and reply at any depth without requiring email verification.
- Allow authors to edit/delete their comments and the opportunity owner to delete any comment.
- **Done when:** thread ordering, permissions, deleted-comment behavior, and empty/error states are handled.

**Included module: Keep reading and engagement in the feed**

- Expand long opportunity descriptions inline and show likes and threaded comments on the feed post.
- **Done when:** reading a full post or joining its discussion does not navigate to a separate opportunity detail page.

**Status:** Complete (2026-10-19). Added opportunity likes with private per-user state and public aggregate counts, plus comment creation/editing, nested replies, and author/owner deletion through the existing tombstone function. Feed posts show activity counts and open the discussion in a popup. The user confirmed T-07 and T-08 and committed them together.

## M4 — Opportunities and private collaboration

### T-08 — Publish and manage opportunity lifecycle

**Included module: Create and publish opportunities**

- Build the opportunity form with the agreed project types, experience choices, skills, city, optional commitment text, and cover image.
- Open the creation form as an inline composer in the opportunity feed; keep editing on a dedicated form.
- Require verified email to publish and start new opportunities as open. Projects start as Active when created.
- **Done when:** valid opportunities publish publicly and invalid or unverified submissions are rejected safely.

**Included module: Edit and manage opportunity lifecycle**

- Let the creator edit, close/reopen, or delete their opportunity according to the PRD.
- On deletion, keep the cover image private when accepted collaboration/project context remains; otherwise delete it. Revoke public access in either case.
- Keep closed opportunities visible and engagement open; stop new join requests when closed.
- On close, silently delete pending join requests so applicants can request again if reopened. On delete, remove non-accepted requests; retain deleted details privately for existing collaborators and remove likes/comments.
- **Done when:** lifecycle transitions and public/private visibility follow the same rules in UI and database permissions.

**Status:** Complete (2026-10-19). Added the verified opportunity form, shared-skill association, optional private-bucket cover upload, creator management page, editing, close/reopen, and deletion. Added trusted RPCs for create/edit/delete and applied the migration to the hosted project. Opportunity creation opens as a feed composer; the user confirmed T-08 was complete.

### T-09 — Handle collaboration requests and acceptance

**Included module: Submit, withdraw, and track join requests**

- Require verified email to request to join an open opportunity.
- Enforce one request row per person per opportunity at a time. Deleting pending rows when the opportunity closes allows resubmission after reopening; rejected/withdrawn requests remain terminal.
- Let applicants see their request status and withdraw a pending request.
- **Done when:** duplicate, closed, and unauthorized requests are prevented at the trusted data boundary.

**Included module: Review join requests**

- Give opportunity creators a request inbox and applicant profile context.
- Allow accept or reject; on acceptance require the creator to choose Private chat or direct Project access.
- Support multiple accepted collaborators and maintain the creator’s ability to close the opportunity.
- **Done when:** every decision is recorded once and sends the user into the selected collaboration path.

**Status:** Complete (2026-10-19). Implemented applicant request submission with an optional message, request status and withdrawal, and a creator inbox with applicant profile context. Creators can open requests from the request icon beside post comments; the icon shows the pending request count. Trusted request RPCs enforce verification, open-listing state, terminal rejected/withdrawn states, and atomic acceptance into private chat or project. The applicant-to-creator request and decision flow was verified live.

### T-10 — Build private collaboration chat and attachments

**Included module: Build private chat conversations**

- Create a private chat for accepted collaborators routed to the Private chat path.
- Support persistent real-time text messages, history pagination, delivery/loading/error states, and access checks.
- **Done when:** only the two collaboration participants can read or write the conversation.

**Included module: Add private chat attachments**

- Support the approved standard format allowlist with a maximum size of 10 MB per file.
- Validate uploads and downloads, store files privately, and show progress and failure recovery.
- **Done when:** only authorized chat participants can access attachments and invalid uploads are rejected.

**Included module: End private collaboration**

- Let either participant end the private collaboration.
- Revoke chat access and delete its messages and attachments as specified by the PRD.
- **Done when:** the operation cannot leave downloadable orphaned files or accessible message history.

**Status:** Complete (2026-10-19). Added the private messages page, active-conversation list, participant-only message workflow, Realtime updates with database history recovery, older-message pagination, allowlisted private attachments, and end-collaboration cleanup. Messages are grouped by date with a centered date pill and local time without seconds. The trusted send/end and conversation-status migrations are applied to Supabase, and the live chat, attachment, and ended-collaboration flows were verified. Conversation action menus also let either participant end a collaboration from the list without opening the chat.

## M5 — Projects

### T-11 — Create projects and manage membership

**Included module: Create a project from accepted collaboration**

- Let the opportunity creator manually create at most one project for an opportunity after acceptance.
- Support the direct Project acceptance route and grant invited users access immediately.
- **Done when:** duplicate projects are prevented and project membership starts with the intended participants.

**Included module: Invite members and manage project roles**

- Let the creator appoint admins; creators and admins can invite/remove non-owner developers, and non-owner members can leave. The creator remains owner and cannot leave because ownership transfer is out of scope.
- Allow invites whenever a project exists, including after the opportunity is closed or deleted.
- **Done when:** membership changes are recorded and unauthorized invitations/removals are rejected.

**Included module: Enforce membership access and departure rules**

- Revoke a removed or departed member’s access to all project chat history and files, including prior content.
- Unassign unfinished tasks when a member leaves or is removed while retaining completed task history.
- **Done when:** removal and departure update all relevant access and assignments consistently; the creator remains owner because ownership transfer is out of scope.

**Status:** Complete (2026-10-20). Project creation from accepted collaboration, immediate direct invitations, creator/admin/member actions, role changes, and membership access revocation were implemented and confirmed by the user. Project deletion is tracked under T-14.

### T-12 — Build project chat and attachments

**Included module: Build project chat**

- Add persistent real-time text conversations for current project members.
- Enforce membership on history, subscriptions, and message writes.
- **Done when:** removed members lose realtime and historical access immediately.

**Included module: Add project chat attachments**

- Use the same approved attachment allowlist and 10 MB limit as private chat.
- Enforce current membership on upload, preview, and download, including access revocation after removal.
- **Done when:** files follow the project’s private access and deletion rules.

**Status:** Complete (2026-10-20). Added project chat with persistent history, older-message pagination, Realtime updates, private attachments using the T-10 allowlist and 10 MB limit, and member-only access. Messages show the sender’s display name, a centered date pill between days, and local time without seconds. The project menu provides member access and project actions. The user confirmed the project chat and attachment flows and closed T-12.

### T-13 — Implement the project task board and milestones

**Included module: Implement tasks and assignments**

- Use a Trello-style board with To do, In progress, and Completed columns.
- Let creators/admins create, edit, and assign tasks, then move any task between columns using its drag handle. Put task edit/delete actions in the card’s three-dot menu. Assignees can move only tasks assigned to them using the handle; keyboard users can focus it and use left/right arrows. Other members can view the board.
- Support multiple assignees and one shared status per task; unassign unfinished work on member removal/departure.
- Show task status through its board column. Keep due date on the card; put a View details disclosure at the bottom for description and assignees.
- **Done when:** task permissions and assignment changes match the approved rules.

**Included module: Implement milestones**

- Put milestone selection beside the board and place Add milestone below its list. Do not repeat the selected milestone name above the board. Require at least one milestone before creating tasks; new tasks join the selected milestone automatically, and editing can move a task. Do not allow deleting a milestone while it has tasks.
- Auto-complete a milestone when it has tasks and all are Completed; empty milestones remain incomplete until manually marked.
- Preserve manual completion overrides until changed manually again.
- **Done when:** milestone status behaves consistently as tasks and manual overrides change.

**Status:** Complete (2026-10-20). Added the three-column project task board, drag-handle status changes for creators/admins and assigned users, keyboard status changes from the handle, compact task details, and milestone selection beside the board. Tasks require exactly one milestone; new tasks use the selected milestone. Migrations `20261020000400_project_lifecycle_and_task_board.sql` and `20261020000500_required_task_milestones.sql` update task permissions, remove the Abandoned status, backfill ungrouped tasks into General milestones, and enforce required milestone assignment. The user confirmed T-13 is complete.

### T-14 — Enforce project lifecycle and read-only rules

**Included module: Implement project lifecycle and read-only rules**

- Support Active, Paused, and Completed project states; owner alone changes project status.
- Allow Paused to reactivate; Completed is final and requires clear confirmation. Start projects Active.
- Allow task and milestone changes only while the project is Active. Paused and Completed projects are read-only; reactivating a Paused project restores editing.
- Let the owner permanently delete a project after typing its name. Deletion removes project data and its showcase while retaining the opportunity and accepted collaboration history.
- **Done when:** status transitions, edit permissions, and final-state behavior are enforced in UI and data policies.

**Status:** Complete (2026-10-20). Added owner-only Active/Paused/Completed controls, a clear final-completion confirmation, and typed-name project deletion. Migration `20261020000400_project_lifecycle_and_task_board.sql` converts former Abandoned projects to Paused, makes Completed final, and updates task status permissions. The user confirmed T-14 is complete.

## M6 — Showcases and notifications

### T-15 — Publish public project showcases

**Included module: Publish project showcases**

- Allow creator/project admins to publish a showcase only for a Completed project.
- Let owners/admins open the editor from Project settings or the public showcase list/detail page to publish, edit, or unpublish.
- Show contributor names automatically with no opt-out.
- **Done when:** showcase visibility and attribution follow the approved lifecycle and deletion rules.

**Status:** Complete (2026-10-20). Added the public showcase list/detail view and a project editor for completed projects. Owner/admin publishing, editing, unpublishing, public contributor attribution, and link management are backed by `20261020000600_project_showcases.sql`. The user confirmed the migration was applied and live authorization, publication, editing, and unpublishing checks passed.

### T-16 — Add in-app notifications

**Included module: Add engagement notifications**

- Create in-app notifications for opportunity likes, comments, and replies.
- Let users open the relevant opportunity/thread and mark notifications read.
- **Done when:** notifications identify the event and actor without exposing private information.

**Included module: Add collaboration notifications**

- Create in-app notifications for join-request decisions, project invitations, and relevant membership changes.
- Let users navigate to the correct request, chat, or project destination.
- **Done when:** notification recipients and destinations match each event’s authorization rules.

**Included module: Add work notifications**

- Add useful in-app notifications for task assignment and important project lifecycle changes.
- Avoid sending notifications for silent join-request cancellation on opportunity close/delete.
- **Done when:** supported events notify the right current users and silent events remain silent.

**Status:** In progress (2026-10-21). Added the signed-in notification center, individual read actions, a live unread navigation count, and links to relevant opportunities, request decisions, private chats, projects, and task boards. A new migration adds database-generated like/comment/reply and project-membership notifications, including joins, departures, and role changes. Apply the migration and verify each event and recipient live before closing T-16.

## M7 — Reviewer readiness and release

### T-17 — Build persistent interactive demo access

**Included module: Build persistent interactive demo access**

- Provide reviewer access through open registration and, if needed, dedicated accounts configured outside source control.
- Do not add fictional record seeding or reset jobs. Reviewers can create records through the product, and their changes persist.
- Keep reviewer access usable without disclosing credentials or granting access to other users' private data.
- **Done when:** a reviewer can sign in, create the records needed, and complete the end-to-end journey; their changes persist between sessions.

**Status:** Not started.

### T-18 — Harden and review the MVP

**Included module: Harden and review the MVP**

- Review RLS, database functions, Storage policies, validation, authorization boundaries, responsive layouts, keyboard access, and error states.
- Compare implementation with the PRD, APP_FLOW, DESIGN, ARCHITECTURE, and SCHEMA; resolve consequential mismatches.
- **Done when:** the end-to-end journey works and security/privacy checks have documented results.

**Status:** Not started.

### T-19 — Deploy and verify the reviewer journey

**Included module: Deploy and verify the reviewer journey**

- Deploy the frontend and configure the selected Supabase project, auth redirects, Brevo email, and reviewer access.
- Verify registration/sign-in, discovery, likes/comments, join request, chosen acceptance route, private/project collaboration, task/milestone use, and showcase publication using the deployed app.
- **Done when:** the deployed reviewer journey is usable on mobile and desktop and setup/known limitations are documented in `README.md`.

**Status:** Not started.

## Release checklist

- [ ] All MVP tasks are complete or explicitly marked out of scope with a documented reason.
- [ ] RLS and Storage policies have been reviewed for every private feature.
- [ ] The deployed interactive demo completes the end-to-end reviewer journey.
- [ ] `README.md` has current setup, environment, deployment, and demo instructions.
- [ ] Known limitations and any free-tier constraints are documented.
