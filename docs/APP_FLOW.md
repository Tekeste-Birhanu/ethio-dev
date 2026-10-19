# Application Flow

## 1. Purpose

Describe how developers move from public discovery to collaboration, shared project work, and a public showcase. The journeys reflect the MVP decisions in `PRD.md`; implementation and visual details belong in the architecture and design documents.

## 2. Navigation map

```text
Explore (mobile bottom navigation; separate desktop links)
  ├── Discover tab ── opportunity feed post ── expand description / like / comment
  │        └── verified account ── request to join
  └── Developers tab ── public directory ── profile

Sign in / register ── profile and notifications

Creator
  └── My opportunities ── edit / close / reopen / delete
           ├── Accept → private chat ── end collaboration
           │                         └── later workspace invitation
           └── Accept → create or enter workspace

Workspace member
  └── Workspace ── team chat / tasks / milestones / project status
           └── Completed project ── showcase editor ── public showcase
```

## 3. Main journeys

### J-01 — Discover opportunities and developers

- **Actor / role:** Visitor or signed-in developer.
- **Entry point:** Public home, opportunities, or developer directory.
- **Preconditions / access:** Public browsing requires no account.
- **Steps:**
  1. Browse opportunities or developers; search and apply the relevant filters.
  2. Expand a long opportunity description inline or open a developer profile to see their posts.
  3. Sign in or register to like, comment, or request to join from the feed post.
- **Success outcome:** User finds a relevant opportunity or developer and can continue to an appropriate interaction.
- **Failure and recovery:** Empty results preserve the search and filters so the user can adjust them. If a listing is unavailable, return to discovery with a clear message.
- **Related requirements:** F-02, F-04, F-05.

### J-02 — Register, sign in, and complete a profile

- **Actor / role:** New or returning developer.
- **Entry point:** Sign-in/register action or protected interaction.
- **Preconditions / access:** Email/password or Google account. Registration collects a unique username and display name.
- **Steps:**
  1. Register or sign in; email/password users can request a reset link if needed.
  2. Enter the one-time code sent to an email/password user's inbox to verify registration. A Google account with provider-verified email meets this requirement.
  3. Add optional bio, skills, city, or links now or later.
  4. Return to the originally requested destination after successful authentication.
- **Success outcome:** The user has an account and can participate; optional profile incompleteness does not block participation.
- **Failure and recovery:** Show field-level validation and preserve safe, non-secret form values. An invalid or expired verification code can be retried or resent. Expired or invalid password-reset links offer a way to request another link. A sign-in prompt returns the user to their intended action after authentication.
- **Related requirements:** F-01, F-02.

### J-03 — Publish and manage an opportunity

- **Actor / role:** Signed-in, verified opportunity creator.
- **Entry point:** Expand the feed composer or open the creator’s profile.
- **Preconditions / access:** Publishing requires verified email. Only the creator manages the opportunity.
- **Steps:**
  1. Expand the composer in the opportunity feed, enter the project details, and publish. Long descriptions expand inline in the feed.
  2. Review and edit the public listing, or close, reopen, or delete it.
  3. When closing, pending join request rows are deleted silently. Reopening allows those applicants to submit a fresh request; rejected or withdrawn requests remain terminal.
  4. When deleting, confirm the destructive action; the public listing, likes, comments, and non-accepted requests are removed. Accepted collaborations, chats, and workspace remain private to authorized participants. Without accepted collaboration/workspace context, the opportunity and cover are deleted.
- **Success outcome:** The opportunity reflects the creator’s chosen public and request-acceptance state.
- **Failure and recovery:** Validation errors keep entered content. On a failed save, retain the draft for retry. Confirm deletion before committing; explain that accepted collaboration data remains.
- **Related requirements:** F-03, F-06, F-08.

### J-04 — Engage with an opportunity

- **Actor / role:** Signed-in developer.
- **Entry point:** Opportunity feed post.
- **Preconditions / access:** Sign-in required; email verification is not required. Closed opportunities remain visible and allow likes and comments.
- **Steps:**
  1. Like or unlike the opportunity.
  2. Open the comments popup and add a comment or reply to any comment, including nested replies.
  3. Edit or delete one’s own comment; the opportunity owner may delete any comment on their opportunity. Deleting a comment with replies leaves a deleted-comment placeholder so the replies and thread position remain.
- **Success outcome:** The engagement change is saved and relevant in-app notifications are created.
- **Failure and recovery:** If the session expires, ask the user to sign in and return them to the opportunity. On save failure, preserve the comment text for retry. If content was concurrently removed, refresh the thread and explain the changed state.
- **Related requirements:** F-05, F-14.

### J-05 — Request to join an opportunity

- **Actor / role:** Verified developer (applicant) and opportunity creator.
- **Entry point:** Request-to-join action on an open opportunity; creator’s request inbox.
- **Preconditions / access:** Applicant is signed in and verified. Opportunity is open. A user may have only one request row per opportunity at a time. Rejected or withdrawn requests cannot be resubmitted; a pending request deleted on close may be submitted again after reopening.
- **Steps:**
  1. Applicant optionally writes a message and submits the request.
  2. Creator reviews the request and accepts or rejects it. Applicant may withdraw while pending.
  3. On acceptance, creator chooses “start private chat” or “add to workspace.” If there is no workspace, the latter creates one; otherwise it adds the applicant to the existing workspace.
  4. If creator closes the opportunity while requests are pending, those request rows are deleted silently. Affected applicants may submit again after reopening. Deleting the opportunity removes its non-accepted requests.
- **Success outcome:** Request is accepted, rejected, withdrawn, or canceled. A canceled request may be resubmitted after reopening; acceptance follows the creator-selected collaboration path.
- **Failure and recovery:** If the opportunity closes or the request changes before submission, do not create a duplicate; show the updated state. Preserve an optional message after recoverable network failure. The applicant is not notified when a request is canceled by close or deletion.
- **Related requirements:** F-06, F-07, F-08, F-14.

### J-06 — Coordinate in private chat

- **Actor / role:** Applicant and creator accepted through the private-chat path.
- **Entry point:** Acceptance confirmation or private conversation list.
- **Preconditions / access:** Only the two participants can access the conversation. Either can end the pre-workspace collaboration.
- **Steps:**
  1. Exchange real-time text messages and supported image/document attachments.
  2. Either participant may end the collaboration. The system removes both participants’ access and deletes the messages and attachments.
  3. A participant may later be invited to the workspace by a workspace creator or admin, without preserving access to the ended private chat.
- **Success outcome:** Participants coordinate privately, or the private collaboration ends and its content is deleted.
- **Failure and recovery:** Failed messages or uploads remain retryable where possible and are not shown as sent until confirmed. If access has ended, return to the conversation list with an explanation.
- **Related requirements:** F-07, F-08, F-14.

### J-07 — Create or join a workspace and manage membership

- **Actor / role:** Workspace creator, admin, invited developer, or member.
- **Entry point:** Workspace invitation, accepted request’s direct-workspace path, or creator’s project page.
- **Preconditions / access:** One workspace at most per opportunity. Creator can create manually after an acceptance or during acceptance; creator/admin can invite any developer. Invitees gain access immediately. The creator is the permanent owner; ownership transfer is out of scope, so the creator cannot leave or be removed.
- **Steps:**
  1. Creator creates the workspace or accepts a request directly into it. A new workspace starts Active.
  2. Creator appoints admins. Creator and admins can invite or remove non-owner members; non-owner members can leave.
  3. On removal or departure, unfinished tasks assigned to that member are unassigned. Completed task history remains.
  4. Members land in workspace chat. They open the workspace header’s three-dot menu and choose Members to view the member list and available membership actions. The owner may permanently delete the workspace from this menu after reviewing the effects and entering its name; admins cannot delete it. Deleting the opportunity does not remove the workspace.
- **Success outcome:** Authorized members enter the workspace and can work according to their role.
- **Failure and recovery:** Invalid, expired, or revoked invitations do not grant access. If membership changes during an action, refresh authorization and show the current workspace state.
- **Related requirements:** F-07, F-08, F-09, F-10, F-11.

Direct invitations remain available to the creator and admins for an existing workspace even when its opportunity is closed or deleted. Closing/deleting the opportunity prevents new join requests and removes its public listing or requests as specified; it does not disable invitations to the retained workspace.

### J-08 — Coordinate work with chat, tasks, and milestones

- **Actor / role:** Workspace creator, admin, or member/assignee.
- **Entry point:** Workspace chat; members and membership actions are reached through the workspace header menu.
- **Preconditions / access:** Workspace membership required. Creator/admin manage task details, assignees, and milestones; any assignee can update the shared task status.
- **Steps:**
  1. Members open the workspace and exchange messages and supported attachments in the main chat view. They can open Members from the workspace header menu when needed.
  2. Creator/admin create tasks, assign one or more members, and optionally group each task under at most one milestone.
  3. Assignees update a task’s shared status: To do, In progress, or Done.
  4. A milestone with linked tasks auto-completes when all are Done. An empty milestone stays incomplete until manually marked. A manual completion state remains until a creator/admin changes it.
- **Success outcome:** Workspace work and progress are visible to members and remain consistent across task and milestone views.
- **Failure and recovery:** Prevent writes when the user lacks permission or the project is read-only. On concurrent updates, refresh the current value and allow the user to retry against current state.
- **Related requirements:** F-09, F-10, F-11, F-12, F-14.

### J-09 — Change project status and publish a showcase

- **Actor / role:** Workspace creator (permanent owner); creator or workspace admin for showcase actions.
- **Entry point:** Workspace project settings or showcase editor.
- **Preconditions / access:** Only the current owner changes status. A showcase can be published only for a Completed project.
- **Steps:**
  1. Owner changes status among Active, Paused, Completed, or Abandoned. Paused can return to Active; Completed and Abandoned are final.
  2. In inactive statuses, tasks and milestones are read-only by default. Creator/admin can change the project setting to allow edits across inactive statuses.
  3. For a Completed project, creator/admin adds an overview and links, reviews the automatically included contributor names (accepted applicants and all current or former workspace members), and publishes, edits, or unpublishes the showcase.
  4. Visitors open the public showcase and see the project's automatically attributed contributors.
- **Success outcome:** Project status and public presentation reflect authorized changes.
- **Failure and recovery:** Reject stale or unauthorized status changes and explain the current status. If the project is not Completed, keep showcase publishing unavailable and direct the user to project status.
- **Related requirements:** F-12, F-13, F-14.

### J-10 — Review notifications

- **Actor / role:** Signed-in user.
- **Entry point:** In-app notification center.
- **Preconditions / access:** User can read and update read state only on their own notifications.
- **Steps:**
  1. Review in-app notifications for requests and decisions, workspace and membership changes, task assignments, project status changes, and opportunity engagement.
- **Success outcome:** The user can review notifications, follow their destinations, and mark them read.
- **Failure and recovery:** If a destination is no longer available, explain that and keep the notification readable without exposing private data.
- **Related requirements:** F-14.

## 4. Screen and route inventory

Route shapes are illustrative; implementations may choose equivalent URLs while preserving these access boundaries.

| Screen / route | Purpose | Who can access it | Related journeys |
| --- | --- | --- | --- |
| `/` | Public landing and entry to discovery | Everyone | J-01 |
| `/opportunities` | Browse, search, and filter opportunities | Everyone | J-01 |
| `/developers` | Public developer directory | Everyone | J-01 |
| `/u/:username` | Public developer profile | Everyone | J-01 |
| `/showcases/:id` | Public completed-project showcase | Everyone | J-09 |
| `/auth/sign-up`, `/auth/sign-in`, `/auth/reset-password` | Account access and recovery | Everyone | J-02 |
| `/settings/profile` | Edit profile | Signed-in user | J-02 |
| `/opportunities/new`, `/my-opportunities`, `/opportunities/:id/edit` | Open feed composer or manage own opportunities | Signed-in; verified to publish; owner for management | J-03 |
| `/opportunities/:id/requests` | Review requests | Opportunity creator | J-05 |
| `/messages` | Private conversations | Signed-in; only active participants see each conversation | J-06 |
| `/workspaces/:id` | Workspace chat; Members and membership actions from the header menu | Workspace members | J-07, J-08 |
| `/workspaces/:id/settings` | Membership, roles, lifecycle, showcase settings | Workspace creator/admin by action; owner for status changes | J-07, J-09 |
| `/notifications` | In-app notification center | Signed-in user | J-10 |

## 5. Shared states and edge cases

- **Loading:** Keep the current route context visible while lists, conversations, or workspace data load. Do not indicate a state-changing action succeeded until the server confirms it.
- **Empty:** Discovery shows a useful no-results state with search/filter adjustment. Empty requests, conversations, notifications, tasks, and milestones explain what can be done next without implying data exists.
- **Success / confirmation:** Confirm publishing, request submission/decision, membership changes, status changes, and showcase publication. For irreversible deletion, summarize effects before the final confirmation.
- **Error:** Preserve safe user-entered content after validation or network errors. Provide retry for failed requests, messages, and uploads. Avoid duplicate submissions after an uncertain response by checking the current server state.
- **Unauthorized / unavailable:** Public routes remain readable without sign-in. Protected routes prompt sign-in and return to the requested destination. A signed-in but unauthorized user sees an access explanation and a safe route back; never reveal private chat or workspace data.
- **Closed/deleted/stale opportunity:** Closed opportunities remain public and interactive but do not accept new requests. Deleted opportunities leave public discovery; accepted collaborations and workspaces continue. Stale forms refresh the opportunity/request state before allowing another action.
- **Session expiry:** Ask the user to sign in again before protected changes; return to the intended route when safe. Do not silently submit a protected action after reauthentication.
- **Destructive action:** Require confirmation for deleting an opportunity, ending a private collaboration, or removing a member. Explain the data and access consequences before committing.
- **Offline/interrupted:** Do not imply a message, upload, or other mutation was saved without server confirmation. Keep retryable input where safe; refresh membership and permissions before retrying protected workspace actions.

## 6. Flow rules

- Public opportunity, profile, directory, and showcase pages are directly accessible. Sign-in gates likes/comments; verified sign-in gates opportunity publishing and join requests.
- After sign-in, return users to the action or page that initiated authentication when that action is still valid. If it is no longer valid, show the current state instead of replaying it.
- Closing an opportunity silently deletes pending request rows and allows affected applicants to request again if it reopens. Deleting it removes non-accepted requests; accepted collaborations, chats, and workspace persist.
- Acceptance always records the creator’s choice between private chat and workspace access. Direct workspace access creates the one allowed workspace when needed; otherwise it adds the accepted developer to the existing workspace.
- Creator/admin direct invitations to an existing workspace remain allowed after its opportunity is closed or deleted. Deleting an opportunity does not delete its accepted collaborations or workspace.
- Private chat is available only while that pre-workspace collaboration is active. Ending it revokes both participants’ access and deletes messages and attachments.
- Workspace access is membership-based. Creator/admin membership actions take effect immediately; removed members and leavers lose access, unfinished assignments are cleared, and completed history remains.
- Inactive project editability follows one project-level setting. The creator remains workspace owner and alone changes project status; ownership transfer is out of scope. Completed and Abandoned cannot be reactivated.
- A published showcase requires Completed status. Contributor names are included automatically.
- Self-service account deletion and ownership transfer are out of scope for the MVP.

## 7. Open questions

There are no unresolved flow decisions at this stage. Attachment formats and limits are specified in `SCHEMA.md`. Account deletion is out of scope for the MVP.
