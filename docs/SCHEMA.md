# Data Schema

## 1. Overview

- **Database / storage:** PostgreSQL, described and migrated with Prisma.
- **Source of truth:** PostgreSQL. The client and WebSocket connection read or change state through the Express server.
- **Conventions:** Use generated opaque primary keys, UTC `createdAt` / `updatedAt` timestamps where applicable, and foreign keys for relationships. Use nullable foreign keys only where a relationship is genuinely optional. Product terminology is **Collabspace**; the database model may retain the internal `Workspace` name.
- **Normalization:** Keep the relational model in third normal form (3NF). Store each fact once, use separate rows for multi-valued attributes and many-to-many relationships, and derive counts or display summaries from their source rows instead of storing duplicates.
- **Modeling scope:** This document defines the main product records and the small supporting records needed for authentication, membership, saved posts, notifications, and unread state. Prisma model syntax and exact ID types are implementation details.

## 2. Main entities

### User

- **Purpose:** Authentication identity and public developer profile.
- **Fields:** `id`; private, unique `email`; nullable unique `username` until Google profile setup is complete; `name`; nullable `passwordHash`; nullable unique `googleSubject`; optional `city`, `experience`, and `description`; `profileDetailsPromptPending` (default false); `createdAt`; `updatedAt`. Skills relate through `UserSkill` to reusable `Skill` records.
- **Constraints:** Name and username are required before a profile is complete. A null username identifies a Google-authenticated account that must finish username setup before using the product. `profileDetailsPromptPending` is set for newly created accounts and cleared when the member saves or skips the optional post-sign-in profile prompt. Username uniqueness is case-insensitive. Experience is Beginner, Junior, Intermediate, or Senior. At least one authentication method must be configured. Skills are stored through UserSkill rows, not as a list on User. Email is never returned in public profile data.
- **Sensitive data:** Email and password hash are private. Store only a secure password hash; never store plaintext passwords or OAuth tokens.
- **Related requirements:** F-01, F-02.

### Opportunity

- **Purpose:** Public, title-free collaboration post and record of the resulting project.
- **Fields:** `id`; `ownerId`; required `description`; optional `experienceSought`, `workSetup`, and `workCity`; `status`; `commentsEnabled` (default true); `createdAt`; `updatedAt`; nullable `deletedAt`.
- **Constraints:** One owner per opportunity; a user may own many. Categories and sought skills are stored in related rows, not as lists on Opportunity. Work setup is Remote, In-person, or Hybrid; work city is only used for In-person or Hybrid. Status is Open, Paused, Filled, Completed, or Archived. `deletedAt` distinguishes deletion from the Archived status so deleted posts can leave discovery while a linked Collabspace retains its history.
- **Related requirements:** F-03–F-07, F-10–F-12, F-18.

### Collabspace (`Workspace` in the data model)

- **Purpose:** Named team space linked to an opportunity, with membership, group chat, and taskboard.
- **Fields:** `id`; unique required `opportunityId`; `name`; `status` (Active or Archived); `createdAt`; nullable `archivedAt`.
- **Constraints:** Created separately after the opportunity is published. Each opportunity has at most one Collabspace, and each Collabspace belongs to exactly one opportunity. Archiving makes the space read-only.
- **Related requirements:** F-12, F-13, F-18.

### Membership

- **Purpose:** User's role and access state in a Collabspace.
- **Fields:** `id`; `workspaceId`; `userId`; `role` (Owner, Admin, Member); `status` (Active, Left, Removed); `joinedAt`; nullable `endedAt`.
- **Constraints:** A user has at most one current membership record per Collabspace; membership rows remain when a member leaves or is removed. The opportunity owner has an active Owner membership and admin permissions. Only the owner changes admin roles; admins manage regular members. The owner cannot leave their own space.
- **Related requirements:** F-13, F-16, F-18.

### Request

- **Purpose:** One record for collaboration requests, profile chat requests, and owner invitations.
- **Fields:** `id`; `senderId`; `recipientId`; `type` (CollaborationRequest, ChatRequest, ChatInvitation, CollabspaceInvitation); `status` (Pending, Accepted, Declined, Withdrawn, Canceled); optional `opportunityId`; optional `message`; `createdAt`; `updatedAt`; nullable `resolvedAt`.
- **Constraints:** Collaboration requests and opportunity-owner invitations reference their opportunity. A Collabspace invitation's destination is resolved through the opportunity's unique Collabspace link; do not store a redundant `workspaceId` here. Profile chat requests do not require an opportunity. Chat requests have no note; collaboration requests and invitations may have an optional note. Only the intended recipient accepts or declines; the sender may withdraw while pending. Keep resolved rows as history. A declined collaboration request cannot be repeated for that opportunity; a declined invitation cannot be repeated for that recipient and destination. A declined chat request may be sent again. Withdrawal allows a new request or invitation. Prevent duplicate pending requests/invitations to the same recipient and destination; enforce cross-record lifecycle rules in trusted server logic and transactions.
- **Related requirements:** F-07–F-09, F-17, F-18.

### Conversation

- **Purpose:** Private chat between two users or group chat for one Collabspace.
- **Fields:** `id`; `type` (Private or Collabspace); optional unique `workspaceId` (required for Collabspace conversations); `createdAt`; nullable `endedAt`.
- **Constraints:** Private participants are stored as separate PrivateConversationParticipant rows, not as two participant columns. A private conversation has exactly two distinct participant rows and at most one active conversation per pair. A Collabspace conversation is linked to exactly one Collabspace and is accessible only through current membership (or the documented archived read-only access). Chat deletion ends the private conversation for both participants. Group chat remains inside its Collabspace.
- **Related requirements:** F-13–F-15, F-17, F-18.

### Milestone and Task

- **Purpose:** Milestones organize a Collabspace's tasks; tasks track assigned work.
- **Milestone fields:** `id`; `workspaceId`; `name`; `position`; `createdAt`; `updatedAt`.
- **Task fields:** `id`; `milestoneId`; `title`; optional `description`, `assigneeId`, and `dueAt`; `status` (ToDo, InProgress, Done); `position`; `createdAt`; `updatedAt`.
- **Constraints:** A milestone belongs to one Collabspace. A task belongs to one milestone and has zero or one assignee. A task can be assigned only to an active member of the same Collabspace. Only empty milestones can be deleted; tasks are moved before milestone deletion. When a member leaves or is removed, their unfinished tasks become unassigned; completed tasks remain as history and may retain the former assignee for attribution.
- **Related requirements:** F-13, F-16, F-18.

### Message

- **Purpose:** Persisted text or link sent to a private or Collabspace conversation.
- **Fields:** `id`; `conversationId`; `senderId`; `content`; `createdAt`; nullable `editedAt`.
- **Constraints:** Content is text or a link; attachments are out of scope. A sender may edit or delete their own message. Collabspace admins may delete group messages. Deleting a private conversation removes its messages. Persist before broadcasting over WebSocket.
- **Related requirements:** F-14, F-15, F-17.

### Skill and opportunity category

- **Purpose:** Provide reusable skill names and controlled opportunity categories for profile and opportunity filtering.
- **Skill fields:** `id`; `name`.
- **Category:** A fixed category value from the approved PRD list, stored once per opportunity-category relationship.
- **Constraints:** Skill names are unique case-insensitively. The same Skill record can be associated with many users and opportunities. Categories use only Web, Mobile, Desktop, Data/AI, Games, Developer Tools/Open Source, Hardware/IoT, and Other.
- **Related requirements:** F-02, F-04, F-05.

## 3. Supporting records

These records support the main entities without changing their ownership model:

- **PrivateConversationParticipant:** Composite key `(conversationId, userId)`, plus `lastReadAt` and nullable `mutedAt`. Used for the two private-chat participants, unread counts, and per-chat mute. Collabspace group access remains governed by Membership.
- **UserSkill:** Composite key `(userId, skillId)`; no duplicate skill assignment to the same user.
- **OpportunitySkill:** Composite key `(opportunityId, skillId)`; no duplicate sought skill on the same opportunity.
- **OpportunityCategory:** Composite key `(opportunityId, category)`, with category drawn from the fixed approved set; no duplicate category on the same opportunity.
- **Comment:** `id`, `opportunityId`, `authorId`, `text` (up to 1,000 characters), and `createdAt`. Comments are flat; deleting one does not delete other comments. Deleting an opportunity cascades to its comments; deleting a user who authored comments is restricted.
- **SavedOpportunity:** `userId`, `opportunityId`, and `savedAt`; unique per user/opportunity. Saves are private to the saver.
- **OpportunityLink:** `id`, `opportunityId`, `label`, `url`, and `position`; multiple optional links may be added to completed work.
- **Notification:** `id`, `recipientId`, `type`, optional `requestId` / `messageId`, `createdAt`, and nullable `readAt`. Represents incoming requests/invitations, acceptance alerts, and private-message alerts. A check constraint requires the source reference appropriate to the notification type. Collabspace group messages and comments do not create notifications. A muted private chat suppresses its message alerts but not its unread count.
- **Session:** `id` (store a hash of the opaque session identifier), `userId`, `createdAt`, and `expiresAt`. Session values are private authentication data and are not exposed to the client beyond the secure HttpOnly cookie.

## 4. Relationships

| Entity | Relationship | Entity | Rules |
|---|---|---|---|
| User | One-to-many | Opportunity | Each opportunity has one owner; a user may own many. |
| Opportunity | Optional one-to-one | Collabspace | The space is created from its opportunity; the link is explicit and unique. |
| User | Many-to-many through Membership | Collabspace | Membership stores role and active/ended access. A user may join multiple spaces. |
| User | One-to-many as sender or recipient | Request | Each request has one sender and one recipient; opportunity and destination links depend on request type. |
| Collabspace | Optional one-to-one | Collabspace conversation | Group conversation belongs to its space and uses its membership for access. |
| Conversation | One-to-many | Message | Messages belong to one private or group conversation. |
| User | Many-to-many through UserSkill | Skill | Skills are reusable normalized values. |
| Opportunity | Many-to-many through OpportunitySkill | Skill | Sought skills reference the same Skill vocabulary as profile skills. |
| Opportunity | One-to-many | OpportunityCategory | Each row records one approved category for that opportunity. |
| Conversation | One-to-many | PrivateConversationParticipant | Private conversations have exactly two participant rows; group access is determined by Collabspace membership. |
| User | One-to-many | PrivateConversationParticipant | Stores private-chat participation and per-chat read/mute state. |
| Collabspace | One-to-many | Milestone | A space may have multiple milestones. |
| Milestone | One-to-many | Task | Tasks move between milestones only within their Collabspace. |
| User | One-to-many as assignee | Task | Assignee is optional and must be an active member of that task's Collabspace. |
| Opportunity | One-to-many | Comment / OpportunityLink | Comments and completed-project links belong to one opportunity. |
| User | Many-to-many through SavedOpportunity | Opportunity | Each user can save an opportunity once. |
| User | One-to-many | Notification / Session | Each record has one recipient or owner. |

## 5. Integrity and business invariants

- **INV-01 — Opportunity ownership:** Each opportunity has exactly one owner. Only that owner controls its content, comments setting, status, and deletion.
- **INV-02 — Opportunity and Collabspace link:** An opportunity has zero or one linked Collabspace. The link is set by creating the space from that opportunity, never by matching names.
- **INV-03 — Current membership:** Only active members may read or write an active Collabspace. The owner is an active member with owner/admin permissions. Leaving or removal ends access immediately.
- **INV-04 — Archived space access:** Deleting an opportunity archives its linked Collabspace as read-only for users who were active members at archival time. Former or removed members do not gain archived access.
- **INV-05 — Request transitions:** Requests begin Pending and resolve to Accepted, Declined, Withdrawn, or Canceled. Only pending records can transition. A declined collaboration request or invitation cannot be repeated under the rules defined for Request.
- **INV-06 — Conversation access:** Private messages are visible only to the two participants. Group messages are visible only to current Collabspace members, with archived read-only access as defined above. Message persistence precedes real-time delivery.
- **INV-07 — Task authorization:** Owners/admins manage milestones and task details. An assignee may change the status of their own task. Assignments can be made only to active members of the same Collabspace. When membership ends, unfinished tasks are unassigned; completed tasks may retain their former assignee for history.
- **INV-08 — Private information:** Email, password hashes, session identifiers, and Google OAuth credentials are never exposed in public profile or discovery responses.

Association tables use their relationship columns as composite keys or unique keys. Non-key fields belong to their entity or relationship and do not repeat facts derivable from another stored field. Do not persist derived counts such as member totals, unread totals, or milestone task totals; calculate them from their source rows.

Enforce durable uniqueness and foreign-key rules in PostgreSQL where possible. Enforce multi-record permission and lifecycle rules in Express transactions, and recheck them for REST and WebSocket actions. The exact participant-count, active-pair, and request-transition invariants require trusted transactional validation in addition to database constraints.

## 6. Indexes and query needs

| Data / query pattern | Index or constraint | Reason |
|---|---|---|
| User lookup by email or username | Unique indexes; username uniqueness is case-insensitive | Authentication and profile lookup. |
| Opportunities by status and creation time | Index on `(status, createdAt)` | Newest-first Discover feed and status filters. |
| Opportunities by owner and creation time | Index on `(ownerId, createdAt)` | My Opportunities profile tab. |
| Membership lookup by space and user | Unique `(workspaceId, userId)` plus lookup index | Access checks and member lists. |
| Pending request lookup by recipient/status | Index on `(recipientId, status, createdAt)` | Incoming Notifications and review actions. |
| Outgoing request history | Index on `(senderId, createdAt)` | Requests tab. |
| Conversation messages | Index on `(conversationId, createdAt)` | Chronological chat history. |
| Tasks by milestone/status/order | Index on `(milestoneId, status, position)` | Three-column taskboard. |
| Saved opportunities | Index on `(userId, savedAt)` | Most-recently-saved list. |

Add search-specific indexes only after choosing the search implementation and confirming query needs.

## 7. Access and data lifecycle

- **Ownership / boundaries:** Opportunity owner controls opportunity data. Collabspace membership controls space data. Conversation participants control private chat data. Notification and saved-post records are private to their user.
- **Read / write permissions:** Public visitors can read public profiles and non-deleted opportunities. Protected actions require authentication. Enforce all role and membership checks in Express, including WebSocket actions.
- **Deletion / archival:** Opportunity deletion removes the post from public discovery and cancels its pending requests/invitations. Retain the opportunity record as a non-public tombstone while its linked Collabspace is archived read-only. Private-chat deletion ends the chat for both participants and removes its messages. Comment deletion removes only the selected comment. Removing a member ends access but retains team conversation and task history.
- **Privacy:** Email is authentication-only. Password hashes, session identifiers, and OAuth secrets remain private. Saved posts and notifications are visible only to their owner.
- **Audit history:** Keep resolved Request rows for the Requests history. No separate general audit log is required by the current MVP scope.

## 8. Migrations and seed data

- **Migration approach:** Version database changes with Prisma migrations committed alongside the application changes. Apply migrations deliberately to each environment.
- **Seed data:** Use fictional development/demo users and content only; keep seed credentials separate from deployed user accounts.
- **Recovery:** Back up data that matters before applying production migrations. Never rewrite an applied migration to change existing data.

## 9. Open schema questions

- No product-level schema questions currently block the initial model. Exact Prisma ID strategy, enum representation, case-insensitive username implementation, and search indexes can be selected during implementation without changing the product relationships above.
