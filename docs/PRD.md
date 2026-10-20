# Product Requirements Document

## 1. Overview

**Product terminology:** The shared collaboration space is called a Project throughout the product. Database and API identifiers retain the legacy `workspace` name for compatibility; users do not see a separate Workspace concept.

- **Product:** EthioDev
- **Status:** Draft - in review
- **Summary:** EthioDev helps beginner and junior Ethiopian developers discover project opportunities, find collaborators, coordinate work, and showcase completed projects.
- **Target users:** Beginner and junior developers across Ethiopia. The product serves both people who want to build an idea and developers looking for practical projects to join.
- **Problem:** Developers can have ideas without teammates, or skills without a practical place to use them. EthioDev connects public project discovery with a clear way to form a team, collaborate, and show the resulting work.
- **Product outcome:** A reviewer can complete the end-to-end collaboration journey in a deployed, mobile-friendly web app using open registration or interactive demo accounts.

## 2. Goals and scope

- **Goals:**
  - Let developers publish, discover, and engage with project opportunities.
  - Help project creators form teams through collaboration requests or direct project invitations.
  - Support both private one-to-one coordination and shared project spaces.
  - Give teams lightweight tools to organize tasks and milestones.
  - Let teams present completed work publicly.

- **In-scope features:**
  - Email/password and Google authentication, email verification, and password recovery.
  - Public developer profiles and a public directory searchable by skills and city.
  - Public project opportunities with keyword search and filters for skills, project type, experience, and city. Commitment is optional free text and is not a filter.
  - Opportunity creation and management, likes, threaded comments, and replies.
  - Collaboration requests with optional messages, creator decisions, and applicant withdrawal.
  - A creator-selected path on acceptance: start a private chat, or add the developer to a project.
  - Real-time text chat and standard image and document attachments supported by the selected free service in private chats and project chats.
  - One project per opportunity, with direct developer invitations and project membership management.
  - Tasks with multiple assignees, due dates, and shared status; milestones that group tasks.
  - Project status management and optional public showcases for completed projects.
  - In-app notifications for important collaboration, engagement, membership, assignment, and status events.
  - Open registration and interactive demo accounts whose changes persist.

- **Out of scope:**
  - Hiring, payments, or startup formation.
  - Replacing GitHub or providing deep GitHub integration.
  - A full project-management suite.

- **Constraints:**
  - This is a portfolio MVP. Success is demonstrated when a reviewer can complete the end-to-end journey; there are no numeric user or project targets.
  - The web app must be mobile-friendly and English-first.
  - The product is intended for developers across Ethiopia.
  - Hosting and third-party services must use free plans; service limits must be checked against real-time chat and file sharing.

## 3. User journeys

- **J-01 - Discover developers and opportunities:** A visitor browses public opportunity posts or the developer directory, searches and filters results, expands long post descriptions inline, and opens public profiles.
- **J-02 - Publish and engage with an opportunity:** A developer registers, creates a profile, publishes an opportunity, and manages it. Other users can like it and add threaded comments or replies.
- **J-03 - Join an opportunity:** A developer submits one collaboration request with an optional message. The creator accepts or rejects it; the applicant can withdraw while it is pending.
- **J-04 - Choose how collaboration starts:** When accepting a request, the creator chooses to start a private one-to-one chat or add the developer directly to a project. The direct project path creates the project if one does not exist.
- **J-05 - Coordinate privately and as a team:** Collaborators use real-time private chat before a project is created when that path is chosen. In a project, members use team chat, tasks, and milestones. A creator can also invite any developer directly to a project.
- **J-06 - Complete and showcase a project:** The creator marks the project Completed. The creator or a project admin may publish, edit, or unpublish a public showcase. Completed projects may be showcased even when some tasks remain unfinished.
- **J-07 - Manage an account:** A user registers or signs in, maintains their profile, and uses password recovery when needed.

## 4. Functional requirements

| ID   | Requirement                      | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Priority     |
| ---- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| F-01 | Authentication                   | Users can register and sign in with email/password or Google. Email/password users can request a password reset. Email verification is required to publish opportunities or request to join. A Google account with a provider-verified email satisfies the verification requirement.                                                                                                                                                                                                                                                                                                                                                                                  | Must         |
| F-02 | Profiles and directory           | A public profile has a unique username and display name; bio, skills, city, and external links are optional. It lists the developer’s public opportunities. An incomplete profile does not block participation. The public developer directory supports search by skills and city.                                                                                                                                                                                                                                                                                                                                                                                    | Must         |
| F-03 | Opportunity management           | Users can create, edit, close, reopen, and delete their own opportunities. An opportunity describes the idea, project type, needed skills, experience expectations, commitment, and optional city.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Must         |
| F-04 | Opportunity discovery            | Visitors can browse opportunities without signing in, search titles and descriptions by keyword, and filter by skills, project type, experience, and city. Commitment is optional free text and is not a filter.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Must         |
| F-05 | Opportunity interaction          | Users can like opportunities and add comments with replies nested to any depth. Comment authors can edit or delete their own comments; the opportunity owner can delete any comment on their opportunity. Deleting a comment preserves its replies and thread position with a deleted-comment placeholder. Closed opportunities remain public and continue to accept likes and comments.                                                                                                                                                                                                                                                                              | Must         |
| F-06 | Collaboration requests           | A verified user can submit a request per opportunity with an optional message. The applicant can withdraw a pending request. The creator can accept or reject it. A rejected or withdrawn request cannot be resubmitted. A request canceled because the opportunity closes may be resubmitted if the opportunity reopens. The creator may accept multiple collaborators and decides when to close the opportunity.                                                                                                                                                                                                                                                    | Must         |
| F-07 | Acceptance path and private chat | For each accepted request, the creator chooses either private chat or direct project access. The private-chat path enables real-time text messages and standard image and document attachments supported by the selected free service for the two participants. Either participant can end the pre-project collaboration; doing so removes their chat access and deletes its messages and attachments.                                                                                                                                                                                                                                                                | Must         |
| F-08 | Project creation and membership  | Each opportunity has at most one project. The creator can create it manually after an acceptance, or create it as part of accepting a request into the project path. The creator can invite any developer; invited developers gain access immediately. The creator appoints admins. The creator and admins can invite or remove non-owner members; non-owner members can leave. The creator remains project owner and cannot leave; ownership transfer is out of scope. Deleting an opportunity does not delete accepted collaborations, private chats, or its project.                                                                                               | Must         |
| F-09 | Project chat                     | Project members can exchange real-time text messages and standard image and document attachments supported by the selected free service in the project chat.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Must         |
| F-10 | Task management                  | Tasks support a title, optional description, optional due date, multiple assignees, and To do / In progress / Completed status. Every task belongs to exactly one milestone. Project members can view the three-column task board. The creator and admins can create, edit, assign, and move any task between columns. An assignee can update the shared status only for tasks assigned to them.                                                                                                                                                                                                                                                                                                                   | Must         |
| F-11 | Milestones                       | The creator and admins can create and manage milestones. Milestones appear beside the task board; selecting one makes it active and filters the board to its tasks. A project must have at least one milestone before tasks can be created. New tasks are assigned to the active milestone automatically; existing tasks can be reassigned while editing. A milestone containing tasks cannot be deleted until its tasks are moved or deleted. A milestone with one or more linked tasks automatically completes when all linked tasks are Completed. An empty milestone stays incomplete until manually marked. A creator/admin's manual completion state persists until manually changed again, regardless of later task status changes.                                                                                                                                                                                                                                                     | Must         |
| F-12 | Project lifecycle                | A project starts as Active when created. Only the project owner can change status among Active, Paused, and Completed. Paused can return to Active; Completed is final and requires clear confirmation. Completed projects are ready for a showcase. Tasks and milestones can be changed only while Active; they are read-only while Paused or Completed. Deleting a project is a separate permanent owner-only action with a typed-name confirmation; it deletes project data and its showcase while retaining the opportunity and accepted collaboration history. The owner can create a replacement project later if eligible. Ownership transfer is out of scope. | Must         |
| F-13 | Public project showcase          | A showcase can be published only for a Completed project. It presents an overview, relevant links, status, and contributor names. Contributor names are included automatically and have no opt-out; contributors include accepted collaboration applicants and all current or former project members. The creator and project admins can publish, edit, or unpublish it.                                                                                                                                                                                                                                                                                              | Must         |
| F-14 | In-app notifications             | Users receive in-app notifications for collaboration requests and decisions, project invitations and membership changes, task assignments, project-status changes, and opportunity likes, comments, and replies. Notification emails are not part of the MVP.                                                                                                                                                                                                                                                                                                                                                                                                         | Must         |
| F-15 | Account deletion                 | Out of scope for the MVP. Self-service account deletion and related ownership transfer, cleanup, and history anonymization are deferred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Out of scope |
| F-16 | Deployed demo access             | The deployed app supports open registration and interactive demo accounts. Changes made through demo accounts persist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Must         |

### Business rules

- Browsing public opportunities, profiles, and the developer directory does not require an account. Participation requires an account. Email verification is required before publishing an opportunity or sending a collaboration request.
- Username and display name are required to save a profile; bio, skills, city, and external links are optional. Profile completeness is not a participation gate.
- Closing an opportunity stops new collaboration requests until it is reopened. It does not hide the opportunity or disable likes and comments.
- Pending request rows are deleted silently when an opportunity closes. If the opportunity reopens, the affected applicants may submit a fresh request. Rejection and applicant withdrawal remain terminal and cannot be retried.
- Deleting a comment clears its text but keeps its place in the reply tree, displayed as a deleted-comment placeholder; replies remain available.
- Deleting an opportunity removes its public listing, likes, comments, and non-accepted requests. Existing accepted collaborations, private chats, and projects are preserved privately for authorized participants; without accepted collaboration/project context, the opportunity and its cover are deleted.
- A collaboration request is private to its applicant and creator. Accepting it does not require project creation; the creator chooses the private-chat or project path for that acceptance.
- Direct project invitations can bypass collaboration requests and private chat. Access begins immediately when the creator or an admin invites a developer.
- A project is private to its members. Admins are appointed by the creator and can manage tasks, milestones, and non-owner membership. The creator remains the project owner, cannot leave or be removed, and is the only person who can change project status or delete the project; ownership transfer is out of scope.
- Showcase contributors are the project creator, all accepted collaboration applicants, and every project member with a membership history, including members who later leave or are removed.
- Tasks and milestones can be changed only while a project is Active. Reactivating a Paused project restores editing; Completed projects stay read-only.
- Project members can view the task board. Admins can create, edit, assign, and move tasks between To do, In progress, and Completed. An assignee can change the status of tasks assigned to them; each task has one shared status.
- Deleting a project permanently removes its members, chat, files, tasks, milestones, showcase, and related notifications. The opportunity and accepted collaboration history remain.
- Completion does not require every task or milestone to be complete. The creator may mark the project Completed after consulting the team.
- Reporting and blocking are not available in the MVP.

## 5. Quality requirements

- **Performance:** Browsing, profile, opportunity, chat, and project interactions should remain responsive for a portfolio demonstration. No numeric capacity target is set.
- **Security and privacy:** Enforce authentication and authorization on the server for every protected operation. Private chats, project data, membership, and file attachments must be inaccessible to unauthorized users. Validate uploaded files against the selected supported image and document formats and never trust client-supplied identity, verification, or role information.
- **Accessibility:** Use semantic structure, keyboard-operable controls, visible focus, associated labels, readable contrast, and actionable validation and error messages. Support mobile layouts.
- **Reliability and recovery:** Do not report a state-changing action as successful until the server confirms it. Handle expired sessions, failed uploads, network interruptions, and stale collaboration or membership state without granting access or duplicating records.
- **Data lifecycle:** Follow the chat-deletion and project membership rules in F-07 through F-12. Do not expose private project content through public profiles or showcases.
- **Cost:** Keep hosting and third-party services within free plans. Confirm current quotas, inactivity behavior, storage limits, and real-time feature limits before choosing providers.

## 6. Assumptions and open decisions

- **Assumptions:**
  - The deployed application is a portfolio project with open registration and interactive demo accounts, not a numeric-growth experiment.
  - The creator remains the permanent project owner; ownership transfer is out of scope.
  - Chat attachments use the explicit image and document allowlist in `SCHEMA.md`, with a 10 MB per-file cap; unsupported content types are rejected.

- **Dependencies / risks:**
  - Authentication, email verification and password recovery, real-time chat, and file storage must fit the free-only budget.
  - Open registration and user-generated public content are in scope; reporting and blocking are not.
  - Verify the agreed formats and 10 MB limit against current Supabase Storage limits during setup.

- **Decisions deferred until implementation:**
  - Select a free static frontend host at deployment and verify its current limits then.
  - Verify current Supabase and Brevo quotas and inactivity behavior during service setup; choose a free static frontend host at deployment.

## 7. Definition of ready

- [x] The problem, target users, and portfolio outcome are defined.
- [x] Must-have feature areas have testable acceptance criteria.
- [x] Major permissions, collaboration paths, lifecycle rules, and account-deletion behavior are documented.
- [x] Open decisions that affect the first implementation tasks are resolved or explicitly deferred with agreed behavior.
- [x] Relevant design and technical requirements are clear enough to proceed without consequential guesswork.
