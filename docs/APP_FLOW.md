# Application Flow

## 1. Purpose

This document describes how developers move through EthioDev to discover opportunities, connect with people, and work together. Product behavior and permissions are defined in `PRD.md`; visual guidance belongs in `DESIGN.md`.

## 2. Navigation map

Primary destinations have stable URLs. Discover keeps its selected tab in the URL; search text stays transient and clears on reload.

```text
Public entry
  ├── Discover
  │   ├── Opportunities tab → Opportunity post → Owner profile / collaboration request
  │   └── Developers tab → Developer profile → Chat request
  └── Sign in / register
      ├── Email/password registration (Full name, Username, Email, Password) → Sign in → Optional profile details (can skip) → Discover
      ├── Google sign-in (first time) → Create account with verified Google identity → Choose username → Optional profile details (can skip) → Discover
      └── Returning member sign-in → Discover

Signed-in navigation
  ├── Discover (Opportunities | Developers)
  │   └── Search → Results (Opportunities | Developers)
  │       └── Opportunity post expands inline; comments open in a dialog
  ├── Chat → Private conversation list → Conversation history
  ├── Collabspaces → Collabspace → Group chat / Taskboard / Members / Settings
  ├── My profile
      ├── Profile card
      ├── Requests → Outgoing requests and invitations
      ├── My Opportunities → Opportunity post / owner controls
      ├── Saved → Private saved opportunities
      ├── Edit profile
      └── Settings → Change password (password accounts only)
  └── Notifications → Incoming request or invitation → Review context → Accept / Decline

Collabspaces → Create Collabspace → New standalone space
```

Discover is one page with Opportunities and Developers tabs. The Post opportunity action sits beside those tabs. Search stays inline, and only the active tab is stored in the URL (for example `/?tab=developers`); search text clears on reload. Switching between Discover and Profile updates the path; browser back and forward restore the previous destination and Discover tab. Chat remains visibly accessible as a primary destination. The owner's profile has Requests, My Opportunities, and Saved tabs; Requests and Saved are private. Other visitors see the public profile and My Opportunities only.

Requests are organized by direction. The Requests tab lists requests and invitations the member has sent in one chronological list. Each item identifies the recipient, related opportunity or Collabspace, and status. Pending items can be withdrawn; resolved items remain as history without further actions. Notifications is one chronological list of incoming collaboration requests, invitations, and acceptance alerts, with unread items clearly indicated. Incoming collaboration requests remain in Notifications after acceptance or decline and show their outcome; opening one shows its request context without response actions. Requests and invitations open their review context; acceptance alerts open the relevant chat or Collabspace. Incoming private messages use a small temporary toast in Chat and do not appear in the Notifications list. Comments do not create notifications.

## 3. Main journeys

### J-01 — Find an opportunity and request to collab

- **Actor / role:** Developer seeking a project
- **Entry point:** Discover → Opportunities tab
- **Preconditions / access:** Anyone can browse public opportunities. A signed-in member with a completed profile can request collaboration.
- **Steps:**
  1. Browse the newest opportunities, or open Search and enter keywords or filters such as city, skills, or experience.
  2. Search results can be switched between Opportunities and Developers. Opportunity posts stay in the results: expand long text inline, open comments in a dialog, and open the owner's profile separately.
  3. Optionally save the post to the member's private Saved profile tab, share its stable `/opportunities/:id` URL, or add a comment if comments are enabled.
  4. Send a collaboration request with an optional message. The sent request appears in the member's private Requests tab as Pending.
  5. The owner receives an incoming notification. Opening it shows the request and applicant profile before the owner chooses to accept into a private chat, accept into a Collabspace they own/administer, or decline. If no eligible Collabspace exists, create one first; the request remains pending until the owner selects it and accepts.
  6. Acceptance into a private chat opens the private conversation for both members; the applicant is not added to the Collabspace. The owner may invite them to the Collabspace later.
  7. Acceptance into a Collabspace adds the applicant as a member immediately. No second acceptance is required. If the owner has no eligible space, they create one first; space creation alone leaves the request pending.
- **Success outcome:** The developer starts a private conversation with the owner or joins the selected Collabspace.
- **Failure and recovery:** A pending request can be withdrawn from Requests. After withdrawal, the developer may submit another request. After decline, they cannot request again for that opportunity, though the owner may invite them. If the opportunity is Paused, no new requests can be sent, but pending requests remain reviewable. Completed opportunities do not accept new requests.
- **Related requirements:** F-02, F-04, F-06, F-07, F-10, F-12, F-17

### J-02 — Publish an opportunity and build a team

- **Actor / role:** Opportunity owner
- **Entry point:** Discover → Create opportunity
- **Preconditions / access:** Signed in with email/username and password or Google OAuth, and has a completed profile (name and username).
- **Steps:**
  1. Compose a title-free opportunity post with a description. Skill tags, categories, experience sought, and an optional collaboration city are visible as controls beneath the post; the owner may publish with description only.
  2. Publish the opportunity. It appears in Discover; no Collabspace is created yet.
  3. Create a standalone Collabspace separately from the Collabspaces page when ready. The creator becomes its Owner. A space can exist without a related opportunity.
  4. The owner receives incoming collaboration requests through Notifications. Opening a request shows the applicant profile and opportunity context before a decision.
  5. For each request, the owner can accept into private chat, choose a Collabspace they own or administer, or decline. If no eligible space exists, the owner creates one first, then returns to the request and accepts into it. Canceling either step keeps the request pending.
  6. The opportunity owner may invite a developer to private chat. A Collabspace owner or admin may invite a developer to that space; the recipient must accept before membership begins.
  7. Send invitations from a developer's public profile by choosing an Open opportunity for private chat or a Collabspace the inviter owns/administers. An optional note can be included. The invitation appears in the recipient's Notifications for review, and the sender can withdraw it from Requests while it is pending.
  8. The owner can find and manage posts in My Opportunities under their profile. The post card has a three-dot actions menu for editing, pausing/resuming, marking Completed, and deleting. Marking a post Completed opens a warning and confirmation. Choosing Delete opens a separate confirmation before the post is removed.
- **Success outcome:** A public opportunity is available for discovery, and the owner can independently create or select a Collabspace before accepting a request.
- **Failure and recovery:** Validation errors keep the owner in the creation flow with entered content available to correct. Paused opportunities stop new requests and opportunity invitations while pending requests remain reviewable. Completing the opportunity requires confirmation and closes pending requests and opportunity invitations. Deleting it requires confirmation and does not alter standalone Collabspaces.
- **Related requirements:** F-01, F-05, F-07, F-09, F-10, F-12, F-18

### J-03 — Find and contact a developer

- **Actor / role:** Signed-in member
- **Entry point:** Discover → Developers tab, or a developer profile shown on an opportunity
- **Preconditions / access:** Signed in to send a chat request. Public profile viewing is available to signed-in and signed-out visitors.
- **Steps:**
  1. Browse developers or search by name, username, skills, or city; apply relevant filters.
  2. Open a developer profile and review its public information.
  3. Send a chat request without a note. The outgoing request appears in Requests as Pending.
  4. The recipient sees the incoming request in Chat. Selecting it shows the sender and request actions in the conversation pane, where the recipient accepts or declines.
  5. If accepted, a private conversation opens for both members. The requester receives a saved unread alert, shown as a temporary Chat toast when they next poll while signed in.
  6. Either participant can choose Delete chat. After a warning, confirming ends the conversation for both and removes its messages; connected participants are notified and the chat disappears from their lists.
  7. From the conversation settings menu, an active Collabspace owner or admin can invite the other participant to one of their Collabspaces, optionally adding a note. The participant must accept from Notifications before joining.
  8. After deletion, either member can start a new chat request from the other's profile; the other member must accept it before a new conversation opens.
- **Success outcome:** The members can communicate in a private chat after the recipient accepts.
- **Failure and recovery:** A declined request sends no notification to the requester; its Requests row changes to Declined. The requester may send another chat request later, which appears as a new Requests row. A chat request does not create Collabspace membership. A Collabspace invitation sent from an active private chat also does not add membership until the invitee accepts it.
- **Related requirements:** F-02, F-04, F-08, F-17

### J-04 — Work together in a Collabspace

- **Actor / role:** Owner, admin, or member
- **Entry point:** Collabspaces list or accepted invitation
- **Preconditions / access:** The developer is an accepted member. Direct addition after acceptance of a collaboration request takes effect immediately; a separately invited developer joins only after accepting the invitation.
- **Steps:**
  1. Open the Collabspace. Its tabs are Group chat, Taskboard, Members, and Settings; Group chat opens by default. Members contains the roster, access controls, and an Add members action for the Owner or an Admin. That action searches developers and sends a Collabspace invitation to the selected person; the recipient must accept before joining. Settings contains space-level actions.
  2. Use the persisted, live group chat to communicate with the team. Unread group messages are counted per member in the Collabspaces list; reading the conversation clears messages through the last one shown. Group messages do not create notifications.
  3. Open the shared taskboard and view milestones and tasks with To do, In progress, and Done statuses.
  4. An owner or admin creates, edits, and deletes milestones; creates and edits tasks, optionally sets due dates, and assigns one member to each task. Adding a task from a status column makes it inherit that milestone and status. An admin may assign a task to themselves. Deleting a milestone requires confirmation; if it contains tasks, the warning states how many tasks will also be permanently deleted.
  5. An assignee updates the status of their own task by moving it between columns. Other current members see saved task changes live, and the task counts beside the status headings update.
  6. In Members, the owner appoints or removes admins. Owners and admins can search for and invite developers from Add members; the invitation does not add membership until accepted. Owners and admins manage regular member access; only the owner changes admin privileges. A member can also leave. New members enter through an accepted collaboration request or invitation, not direct addition.
  7. In Settings, the owner can rename the Collabspace. The new name appears for all members.
  8. The owner can permanently delete the Collabspace from Settings after confirming that everyone loses access and all group chat and task history is removed.
  9. When someone leaves or is removed, access ends and their open tasks become unassigned. Other members retain the team history.
- **Success outcome:** The team coordinates in one group conversation and tracks shared work on its taskboard.
- **Failure and recovery:** A non-member or removed member who opens a stale Collabspace link is told the space is unavailable to them and returned to an accessible destination. A deleted Collabspace is unavailable to every member and cannot be restored.
- **Milestone deletion:** Confirm before deleting a milestone. If it contains tasks, state the number of tasks that will be permanently deleted and require a second explicit action to delete the milestone and its tasks. If the task count changed since confirmation opened, refresh the board and ask the user to review and confirm again.
- **Related requirements:** F-12, F-13, F-14, F-16, F-17, F-18

### J-05 — Finish and share a project

- **Actor / role:** Opportunity owner
- **Entry point:** My Opportunities under the owner's profile
- **Preconditions / access:** The owner controls the opportunity.
- **Steps:**
  1. Mark the opportunity Completed when the project is finished.
  2. Add one or more project, demo, or repository links if available.
  3. Share the completed opportunity post. The post remains visible in the owner's public My Opportunities list and in Discover with its Completed status.
- **Success outcome:** The opportunity serves as a public record of completed work and can help developers discover project ideas and collaborators.
- **Failure and recovery:** Completion closes pending collaboration requests and invitations. The Collabspace remains available to its members for continued access to team work.
- **Related requirements:** F-10, F-11

### J-06 — Manage profile and password settings

- **Actor / role:** Signed-in member
- **Entry point:** Own Profile → Edit profile or Settings
- **Steps:**
  1. Edit profile details from the own profile page: name, username, city, experience, skills, and description.
  2. In Settings, members whose account has a password credential can change their password. Accounts without one do not show a password-change action.
- **Success outcome:** Profile changes are saved, and members with a password credential can update it in Settings.
- **Scope note:** Email changes are not available in the MVP.
- **Related requirements:** F-01

## 4. Screen and route inventory

Discover uses `/`; a public developer profile uses `/profile/:username`; the signed-in member's profile uses `/profile`; and a shared opportunity uses `/opportunities/:id`.

| Screen / destination           | Purpose                                                                                                                                                          | Who can access it                                                          | Related journeys       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| Discover — Opportunities       | Browse public collaboration posts                                                                                                                                | Everyone                                                                   | J-01, J-02, J-05       |
| Discover — Developers          | Browse public developer profiles                                                                                                                                 | Everyone                                                                   | J-03                   |
| Search                         | Search opportunities and developers with filters and result tabs                                                                                                 | Everyone; sign-in required for actions                                     | J-01, J-03             |
| Opportunity post               | Read and expand the post inline, open comments, save/share, and request collaboration                                                                            | Everyone; signed-in for interactions                                       | J-01, J-02, J-05       |
| Create / edit opportunity      | Publish or edit the owner's post                                                                                                                                 | Signed-in completed-profile member for creation; owner for editing         | J-02                   |
| Create Collabspace dialog      | Name and create a standalone Collabspace                                                                                                                          | Signed-in member                                                            | J-02, J-04             |
| Developer profile              | View public profile and send a chat request                                                                                                                      | Everyone; signed-in to send request                                        | J-01, J-03             |
| Own profile — Requests         | Track outgoing requests and invitations in one chronological list; withdraw pending items and review resolved history                                            | Profile owner only                                                         | J-01, J-02, J-03, J-04 |
| Own profile — My Opportunities | View and manage the owner's opportunity posts across all statuses                                                                                                | Everyone can view; owner can manage                                        | J-02, J-05             |
| Own profile — Saved            | Revisit and unsave saved opportunities, ordered by most recent save                                                                                              | Profile owner only                                                         | J-01, J-05             |
| Profile settings               | Change password for password-based accounts                                                                                                                      | Signed-in member; password change only for password-based accounts         | J-06                   |
| Request / invitation review    | Review the sender's profile and request context, then take the actions available for that request type                                                           | Signed-in recipient                                                        | J-01, J-02, J-03, J-04 |
| Chat                           | Review incoming profile chat requests, view private conversations and message history, and see per-chat unread counts                                               | Signed-in member; requests are recipient-only and conversations participant-only | J-03              |
| Collabspaces                   | Create, view, and open standalone Collabspaces                                                                                                                    | Signed-in member                                                           | J-01, J-02, J-04       |
| Collabspace                    | Use group chat, membership controls, and taskboard                                                                                                               | Current members                                                             | J-02, J-04             |
| Notifications                  | Review incoming collaboration requests/invitations and acceptance alerts in one chronological list; unread items are indicated and each item opens its relevant context | Signed-in member | J-01, J-02, J-03, J-04 |
| Sign in / profile setup        | Register with required account fields, then invite the signed-in member to add optional city, experience, skills, and description; the invitation can be skipped | Signed-out visitor / new member                                            | J-01, J-02, J-03       |

## 5. Shared states and edge cases

- **Loading:** Keep the current destination identifiable while opportunities, profiles, Requests, Saved, Notifications, chats, messages, or taskboard data load. Prevent duplicate submissions while an action is processing.
- **Empty:** Explain how to find opportunities or developers, create an opportunity, send a first request, start a chat, or add the first milestone/task in the relevant destination. Empty states should offer the next relevant action.
- **Success / confirmation:** Confirm when a request or invitation is sent, accepted, declined, or withdrawn; when an opportunity is published or its status changes; and when a member joins or leaves a Collabspace.
- **Request status:** Outgoing items appear in one chronological Requests list. Pending items can be withdrawn; resolved items remain visible as history without extra actions. Accepted requests notify the sender and lead to the resulting chat or membership. Declined items show Declined in Requests without notifying the sender. A withdrawn request disappears from the recipient's incoming list without a notification.
- **Error:** Show a concise explanation and a retry or correction path. Preserve form content when a recoverable publish, comment, message, request, or task action fails.
- **Unauthorized / unavailable:** When signed out, allow public browsing and route the user to sign-in (email/username and password or Google) when they begin a protected action, then return them to the intended context. If content was deleted or access was removed, explain that it is unavailable and provide a safe return destination.
- **Destructive action:** Deleting a private chat requires a warning that it removes the conversation for both participants and ends that chat. Deleting an opportunity requires confirmation and explains that it is removed from discovery; standalone Collabspaces are unaffected. Deleting a Collabspace requires Owner confirmation that all members lose access and all group chat and task history is permanently removed.
- **Interrupted:** If a request or message submission has an uncertain result after interruption, show the current server state before allowing a retry so users do not accidentally duplicate the action.

## 6. Flow rules

- Discover has Opportunities and Developers tabs. Search offers both result tabs and defaults to the Discover tab from which it was opened. Closing Search returns to that prior Discover tab.
- A public profile shows its profile card and My Opportunities across all statuses. The owner's profile has Requests, My Opportunities, and Saved tabs. Requests shows outgoing requests and invitations; Saved shows only that member's saved opportunities.
- Saved opportunities are private to their saver, appear in most-recently-saved order, and can be unsaved from the Saved tab.
- Incoming profile chat requests appear in Chat; the recipient reviews the sender's profile and accepts or declines there. Accepted private conversations appear in each participant's list. Opening one loads persisted message history and marks the messages shown as read. Members exchange text and links over an authenticated WebSocket; messages are saved before delivery and history reloads after reconnect. Each sender can edit or delete their own messages, with updates delivered to both participants; deleting a message refreshes the preview and unread count. Private-message alerts appear as small temporary Chat toasts using polling; they do not appear in Notifications. The Notifications destination shows incoming collaboration requests and invitations alongside persisted acceptance alerts in chronological order. Muted chats suppress private-message toasts; comments and Collabspace group messages do not create notifications.
- Acceptance notifies the sender. Decline sends no notification; the sender sees the declined status in Requests. Withdrawal removes the incoming item silently.
- Any sender can withdraw an outgoing pending request or invitation from Requests. A new request after withdrawal creates a new Requests row. Declined chat requests may be sent again as new rows; declined collaboration requests and declined invitations cannot be repeated.
- Accepting a collaboration request into a private chat opens the chat immediately and does not add the applicant to a Collabspace. Accepting into a Collabspace selects one the owner owns or administers. If none is available, the owner creates one first, then selects it and accepts the request; creating the space alone leaves the request pending. A separate private-chat or Collabspace invitation requires recipient acceptance.
- The Chat destination contains private conversations only. Each active private conversation has a `/chat?conversation=:id` link; opening it loads the chat only for one of its two participants. Clicking Chat navigation returns to `/chat`. Collabspace group chat is accessed from inside its Collabspace. Joining a Collabspace does not remove an existing private conversation.
- A member's unread count belongs to its individual chat list item. Muting a chat suppresses its message alerts while unread counts continue to change.
- A member can view public profiles and opportunities without signing in. Protected actions require authentication; collaboration requests also require a completed profile.
- The member edits profile details from their own Profile destination. Settings contains password change for password-based accounts; email changes are unavailable in the MVP.
- Opportunity statuses govern available actions: Open accepts new requests/invitations; Paused stops new ones but allows pending requests to be reviewed; Completed closes pending requests/invitations, remains visible in Discover, and cannot be reopened. Completing requires confirmation. My Opportunities shows the owner's posts across all statuses.
- Leaving or being removed from a Collabspace ends access immediately. The Owner remains in their own Collabspace. Deleting a Collabspace permanently removes it and its group chat and task history for everyone.
- Deleting an opportunity cancels its pending requests and opportunity-related invitations. It does not change any standalone Collabspace. Existing private chats remain available unless a participant deletes the chat.
- The app interface is English; user-authored profile and opportunity content may be English or Amharic.
